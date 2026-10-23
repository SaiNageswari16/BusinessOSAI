"""Platform Service implementation — business logic, state machines, and catalog seeding."""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.platform.models import (
    AccessPolicy,
    ModuleLifecycleState,
    PermissionCatalogue,
    PlatformAdmin,
    PlatformAdminRole,
    PlatformAuditEntry,
    PluginManifest,
    TenantModuleState,
    _utcnow,
)
from src.services.shared.registry import all_services, base_url
from src.utils.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

logger = logging.getLogger("platform_service")

# ─── DEFAULT PLUGINS CATALOG ────────────────────────────────────────────────

DEFAULT_PLUGINS = [
    {
        "id": "restaurant",
        "name": "Restaurant & Dining OS",
        "version": "1.0.0",
        "category": "vertical",
        "description": "Complete restaurant system with tables, KDS, recipes, and dining workflows.",
        "icon": "UtensilsCrossed",
        "required_capabilities": ["catalog", "metering", "consumable", "access"],
        "permissions": ["pos:*", "kitchen:*", "menu:*", "inventory:*"],
        "navigation": [
            {"key": "pos", "label": "POS", "to": "/pos", "icon": "Receipt"},
            {"key": "kitchen", "label": "Kitchen KDS", "to": "/kitchen", "icon": "ChefHat"},
            {"key": "operations", "label": "Floor & Tables", "to": "/operations", "icon": "Armchair"},
            {"key": "menu", "label": "Menu & Recipes", "to": "/menu", "icon": "UtensilsCrossed"},
            {"key": "orders", "label": "Orders Ledger", "to": "/orders", "icon": "ClipboardList"},
            {"key": "reservations", "label": "Reservations", "to": "/reservations", "icon": "Calendar"},
        ],
        "settings_schema": {"type": "object", "properties": {"auto_kot": {"type": "boolean", "default": True}}},
    },
    {
        "id": "salon",
        "name": "Salon & Spa Care",
        "version": "1.0.0",
        "category": "vertical",
        "description": "Stylist rosters, appointment slots, consumable dye/shampoo tracking, and chair billing.",
        "icon": "Scissors",
        "required_capabilities": ["catalog", "metering", "schedule", "access", "consumable"],
        "permissions": ["salon:appointments:*", "salon:stylists:*", "pos:*"],
        "navigation": [
            {"key": "salon_appointments", "label": "Appointments", "to": "/salon/appointments", "icon": "CalendarClock"},
            {"key": "salon_stylists", "label": "Stylists & Chairs", "to": "/salon/stylists", "icon": "Scissors"},
            {"key": "pos", "label": "Quick Checkout", "to": "/pos", "icon": "Receipt"},
        ],
        "settings_schema": {"type": "object", "properties": {"buffer_mins": {"type": "integer", "default": 15}}},
    },
    {
        "id": "gym",
        "name": "Fitness & Gym Club",
        "version": "1.0.0",
        "category": "vertical",
        "description": "Recurring memberships, turnstile gate access, locker allocation, and trainer schedules.",
        "icon": "Dumbbell",
        "required_capabilities": ["catalog", "recurring", "metering", "access", "schedule"],
        "permissions": ["gym:members:*", "gym:classes:*", "pos:*"],
        "navigation": [
            {"key": "gym_members", "label": "Memberships", "to": "/gym/memberships", "icon": "Users"},
            {"key": "gym_checkin", "label": "Turnstile Check-in", "to": "/gym/checkin", "icon": "ShieldCheck"},
            {"key": "gym_trainers", "label": "Classes & Trainers", "to": "/gym/classes", "icon": "Dumbbell"},
        ],
        "settings_schema": {"type": "object", "properties": {"max_guests": {"type": "integer", "default": 2}}},
    },
    {
        "id": "retail",
        "name": "Retail Store & Boutique",
        "version": "1.0.0",
        "category": "vertical",
        "description": "Barcode SKU lookup, batch expiry dates, warehouse transfers, and multi-counter POS.",
        "icon": "ShoppingBag",
        "required_capabilities": ["catalog", "metering", "consumable", "access"],
        "permissions": ["retail:sku:*", "inventory:*", "pos:*"],
        "navigation": [
            {"key": "pos", "label": "Barcode POS", "to": "/pos", "icon": "ScanBarcode"},
            {"key": "inventory", "label": "Stock & SKUs", "to": "/inventory", "icon": "Boxes"},
        ],
        "settings_schema": {"type": "object", "properties": {"allow_negative_stock": {"type": "boolean", "default": False}}},
    },
    {
        "id": "clinic",
        "name": "Medical & Dental Clinic",
        "version": "1.0.0",
        "category": "vertical",
        "description": "Doctor appointments, patient medical history, procedure billing, and pharma stock.",
        "icon": "Stethoscope",
        "required_capabilities": ["catalog", "schedule", "access", "recurring"],
        "permissions": ["clinic:patients:*", "clinic:consultations:*", "pos:*"],
        "navigation": [
            {"key": "clinic_consultations", "label": "Consultations", "to": "/clinic/appointments", "icon": "Calendar"},
            {"key": "crm", "label": "Patients Ledger", "to": "/crm", "icon": "Users"},
            {"key": "inventory", "label": "Pharmacy Stock", "to": "/inventory", "icon": "Boxes"},
        ],
        "settings_schema": {"type": "object", "properties": {"default_slot_mins": {"type": "integer", "default": 30}}},
    },
    {
        "id": "carwash",
        "name": "Automated Car Wash & Detailing",
        "version": "1.0.0",
        "category": "vertical",
        "description": "Wash cycle machine metering, bay allocation, and recurring monthly pass subscriptions.",
        "icon": "Car",
        "required_capabilities": ["catalog", "metering", "access", "recurring"],
        "permissions": ["carwash:bays:*", "pos:*"],
        "navigation": [
            {"key": "carwash_bays", "label": "Wash Bays", "to": "/carwash/bays", "icon": "Car"},
            {"key": "pos", "label": "Bay POS", "to": "/pos", "icon": "Receipt"},
        ],
        "settings_schema": {"type": "object", "properties": {"bay_count": {"type": "integer", "default": 4}}},
    },
]

# ─── DEFAULT PERMISSION CATALOGUE (60+ GRANULAR KEYS) ───────────────────────

DEFAULT_PERMISSIONS = [
    # Platform Super Admin
    {"code": "platform:tenants:view", "module": "platform", "name": "View Tenants", "tier": 1},
    {"code": "platform:tenants:manage", "module": "platform", "name": "Manage Tenants & Onboarding", "tier": 2},
    {"code": "platform:modules:view", "module": "platform", "name": "View Platform Modules", "tier": 1},
    {"code": "platform:modules:manage", "module": "platform", "name": "Toggle & Manage Tenant Modules", "tier": 2},
    {"code": "platform:modules:kill", "module": "platform", "name": "Global Plugin Kill Switch", "tier": 3},
    {"code": "platform:roles:view", "module": "platform", "name": "View Platform Roles", "tier": 1},
    {"code": "platform:roles:manage", "module": "platform", "name": "Manage Platform Roles & Permissions", "tier": 2},
    {"code": "platform:policies:manage", "module": "platform", "name": "Manage ABAC Access Policies", "tier": 2},
    {"code": "platform:audit:view", "module": "platform", "name": "View Platform Audit Trail", "tier": 1},
    {"code": "platform:breakglass", "module": "platform", "name": "Execute Break-Glass Emergency Session", "tier": 4},

    # Auth & Users
    {"code": "auth:users:view", "module": "auth", "name": "View Users Directory", "tier": 1},
    {"code": "auth:users:create", "module": "auth", "name": "Invite & Create Users", "tier": 2},
    {"code": "auth:users:update", "module": "auth", "name": "Update User Profiles", "tier": 2},
    {"code": "auth:users:deactivate", "module": "auth", "name": "Deactivate Users", "tier": 3},
    {"code": "auth:roles:view", "module": "auth", "name": "View Roles & Privileges", "tier": 1},
    {"code": "auth:roles:manage", "module": "auth", "name": "Manage Tenant Roles", "tier": 2},

    # Organization & Outlets
    {"code": "org:settings:view", "module": "organization", "name": "View Organization Settings", "tier": 1},
    {"code": "org:settings:manage", "module": "organization", "name": "Manage Company & Tax Settings", "tier": 2},
    {"code": "org:outlets:view", "module": "organization", "name": "View Branches & Outlets", "tier": 1},
    {"code": "org:outlets:manage", "module": "organization", "name": "Create & Update Outlets", "tier": 2},
    {"code": "org:tables:manage", "module": "organization", "name": "Manage Table Layouts", "tier": 2},

    # Menu & Catalog
    {"code": "menu:categories:manage", "module": "menu", "name": "Manage Menu Categories", "tier": 2},
    {"code": "menu:items:view", "module": "menu", "name": "View Menu Items", "tier": 1},
    {"code": "menu:items:create", "module": "menu", "name": "Create Menu Dishes", "tier": 2},
    {"code": "menu:items:update", "module": "menu", "name": "Update Menu Items", "tier": 2},
    {"code": "menu:items:toggle_86", "module": "menu", "name": "Toggle Dish Availability (86)", "tier": 3},
    {"code": "menu:recipes:manage", "module": "menu", "name": "Manage Ingredient Recipes", "tier": 2},

    # POS & Orders
    {"code": "pos:orders:view", "module": "pos", "name": "View POS Orders", "tier": 1},
    {"code": "pos:orders:create", "module": "pos", "name": "Create New Orders", "tier": 2},
    {"code": "pos:orders:update", "module": "pos", "name": "Modify Live Orders", "tier": 2},
    {"code": "pos:orders:discount", "module": "pos", "name": "Apply Order Discounts", "tier": 3},
    {"code": "pos:orders:cancel", "module": "pos", "name": "Cancel or Void Orders", "tier": 3},
    {"code": "pos:orders:split", "module": "pos", "name": "Split Table Bills", "tier": 3},
    {"code": "pos:tables:manage", "module": "pos", "name": "Seat Guests & Manage Tables", "tier": 2},

    # Kitchen (KDS)
    {"code": "kitchen:kds:view", "module": "kitchen", "name": "View Kitchen Display Screen", "tier": 1},
    {"code": "kitchen:kot:fire", "module": "kitchen", "name": "Fire KOT to Kitchen", "tier": 2},
    {"code": "kitchen:kot:bump", "module": "kitchen", "name": "Bump Prepared Orders", "tier": 3},
    {"code": "kitchen:kot:cancel", "module": "kitchen", "name": "Cancel KOT Tickets", "tier": 3},

    # Billing & Payments
    {"code": "billing:bills:view", "module": "billing", "name": "View Invoices & Bills", "tier": 1},
    {"code": "billing:bills:generate", "module": "billing", "name": "Generate Customer Invoices", "tier": 2},
    {"code": "billing:bills:void", "module": "billing", "name": "Void Settled Bills", "tier": 3},
    {"code": "billing:payments:process", "module": "billing", "name": "Settle Cash/Card/UPI Payments", "tier": 2},
    {"code": "billing:payments:refund", "module": "billing", "name": "Process Customer Refunds", "tier": 3},

    # Inventory & Stock
    {"code": "inventory:stock:view", "module": "inventory", "name": "View Inventory & Stock Levels", "tier": 1},
    {"code": "inventory:stock:adjust", "module": "inventory", "name": "Adjust Stock Counts", "tier": 3},
    {"code": "inventory:stock:transfer", "module": "inventory", "name": "Transfer Stock Between Outlets", "tier": 2},
    {"code": "inventory:wastage:record", "module": "inventory", "name": "Record Kitchen Wastage", "tier": 2},

    # Purchasing & GRN
    {"code": "purchase:vendors:manage", "module": "purchase", "name": "Manage Suppliers & Vendors", "tier": 2},
    {"code": "purchase:orders:create", "module": "purchase", "name": "Raise Purchase Orders", "tier": 2},
    {"code": "purchase:orders:approve", "module": "purchase", "name": "Approve High-Value POs", "tier": 3},
    {"code": "purchase:grn:post", "module": "purchase", "name": "Receive & Post Goods Receipts (GRN)", "tier": 2},

    # Staff & Roster
    {"code": "staff:employees:view", "module": "staff", "name": "View Staff Directory", "tier": 1},
    {"code": "staff:employees:manage", "module": "staff", "name": "Manage Employees & Roles", "tier": 2},
    {"code": "staff:attendance:punch", "module": "staff", "name": "Punch Clock In / Clock Out", "tier": 2},
    {"code": "staff:roster:manage", "module": "staff", "name": "Schedule Shift Rosters", "tier": 2},

    # Customers & CRM
    {"code": "customers:profiles:view", "module": "customers", "name": "View Customer Directory", "tier": 1},
    {"code": "customers:profiles:manage", "module": "customers", "name": "Manage Customer Profiles", "tier": 2},
    {"code": "customers:pii:reveal", "module": "customers", "name": "View Unmasked Phone Numbers", "tier": 4},

    # Loyalty
    {"code": "loyalty:points:view", "module": "loyalty", "name": "View Loyalty Accounts", "tier": 1},
    {"code": "loyalty:points:award", "module": "loyalty", "name": "Award or Redeem Points", "tier": 2},
    {"code": "loyalty:tiers:override", "module": "loyalty", "name": "Override Customer Loyalty Tier", "tier": 3},

    # Accounting
    {"code": "accounting:ledger:view", "module": "accounting", "name": "View General Ledger", "tier": 1},
    {"code": "accounting:journal:post", "module": "accounting", "name": "Post Journal Entries", "tier": 2},
    {"code": "accounting:gst:generate", "module": "accounting", "name": "Generate GSTR-1 & Financials", "tier": 2},

    # Reports & BI
    {"code": "reports:sales:view", "module": "reports", "name": "View Sales & Revenue Reports", "tier": 1},
    {"code": "reports:financial:view", "module": "reports", "name": "View Profit & Loss Statements", "tier": 1},
    {"code": "reports:data:export", "module": "reports", "name": "Export Raw Data to Excel/CSV", "tier": 3},
]


# ─── SERVICE IMPLEMENTATION ──────────────────────────────────────────────────

class PlatformService:
    @staticmethod
    async def seed_defaults(session: AsyncSession) -> None:
        """Seed the plugin marketplace and the permission catalogue.

        Deliberately does NOT create a super admin. That account is created
        once, out of band, by ``scripts/seed_platform_admin.py`` — seeding it
        here would mean the credential lives in the repository and the account
        is recreated on every boot. Idempotent, so it is safe on every start.
        """
        # 1. Default Plugin Manifests
        for p in DEFAULT_PLUGINS:
            p_res = await session.execute(
                select(PluginManifest).where(PluginManifest.id == p["id"])
            )
            if p_res.scalar_one_or_none() is None:
                manifest = PluginManifest(
                    id=p["id"],
                    name=p["name"],
                    version=p["version"],
                    category=p["category"],
                    description=p["description"],
                    icon=p["icon"],
                    required_capabilities=p["required_capabilities"],
                    permissions=p["permissions"],
                    navigation=p["navigation"],
                    settings_schema=p["settings_schema"],
                    is_system=True,
                    is_active=True,
                )
                session.add(manifest)

        # 2. Default Permissions
        for perm in DEFAULT_PERMISSIONS:
            perm_res = await session.execute(
                select(PermissionCatalogue).where(PermissionCatalogue.code == perm["code"])
            )
            if perm_res.scalar_one_or_none() is None:
                item = PermissionCatalogue(
                    code=perm["code"],
                    module=perm["module"],
                    name=perm["name"],
                    tier=perm["tier"],
                    is_system=True,
                )
                session.add(item)

        await session.commit()

    @staticmethod
    async def authenticate_admin(
        session: AsyncSession, email: str, password: str
    ) -> PlatformAdmin | None:
        res = await session.execute(
            select(PlatformAdmin).where(
                PlatformAdmin.email == email, PlatformAdmin.is_active.is_(True)
            )
        )
        admin = res.scalar_one_or_none()
        if not admin or not verify_password(password, admin.hashed_password):
            return None
        admin.last_login_at = _utcnow()
        await session.commit()
        return admin

    @staticmethod
    def issue_platform_token(admin: PlatformAdmin) -> str:
        """Issue an isolated platform admin token with separate auth realm."""
        from datetime import timedelta
        platform_realm_id = uuid.UUID("00000000-0000-0000-0000-000000000000")
        claims = {
            "email": admin.email,
            "full_name": admin.full_name,
            "role": admin.role,
            "auth_realm": "platform",
            "is_superadmin": True,
            # No "*" in this claim. The "*" passes every tenant-side
            # require() — pos, billing, accounting — because has() checks
            # membership in the wildcard first. Platform power is scoped to
            # the platform:* namespace only; tenant-side endpoints must
            # reject platform-realm tokens, and the gateway enforces that
            # before proxying.
            "permissions": ["platform:*"],
        }
        return create_access_token(
            user_id=admin.id,
            tenant_id=platform_realm_id,
            expires_delta=timedelta(hours=12),
            claims=claims,
        )

    @staticmethod
    async def list_plugins(session: AsyncSession) -> list[PluginManifest]:
        res = await session.execute(select(PluginManifest).order_by(PluginManifest.id))
        return list(res.scalars().all())

    @staticmethod
    async def toggle_plugin_kill_switch(
        session: AsyncSession, plugin_id: str, is_active: bool, admin_email: str
    ) -> PluginManifest:
        res = await session.execute(select(PluginManifest).where(PluginManifest.id == plugin_id))
        manifest = res.scalar_one_or_none()
        if not manifest:
            raise ValueError(f"Plugin {plugin_id} not found")
        manifest.is_active = is_active
        audit = PlatformAuditEntry(
            admin_email=admin_email,
            action="plugin.kill_switch.toggle",
            target_type="plugin",
            target_id=plugin_id,
            details={"is_active": is_active},
        )
        session.add(audit)
        await session.commit()
        return manifest

    @staticmethod
    async def get_tenant_modules(
        session: AsyncSession, tenant_id: uuid.UUID
    ) -> list[TenantModuleState]:
        res = await session.execute(
            select(TenantModuleState).where(TenantModuleState.tenant_id == tenant_id)
        )
        return list(res.scalars().all())

    @staticmethod
    async def activate_module(
        session: AsyncSession,
        tenant_id: uuid.UUID,
        plugin_id: str,
        admin_id: uuid.UUID | None,
        admin_email: str,
        config: dict | None = None,
    ) -> TenantModuleState:
        # ── Alias resolution: plugin ids that name an internal core service
        #    (e.g. "pos", "kitchen") resolve to the "restaurant" vertical,
        #    since that is the only plugin that owns those services today.
        #    This is a compatibility shim, not a general mechanism — the
        #    alias table grows only when a new vertical genuinely adds a
        #    service that should be toggleable under that name.
        _SERVICE_ALIASES: dict[str, str] = {
            "pos": "restaurant",
            "kitchen": "restaurant",
            "menu": "restaurant",
            "billing": "restaurant",
            "crm": "customers",
        }
        resolved_plugin_id = _SERVICE_ALIASES.get(plugin_id, plugin_id)

        # Check manifest
        p_res = await session.execute(select(PluginManifest).where(PluginManifest.id == resolved_plugin_id))
        manifest = p_res.scalar_one_or_none()
        if manifest is None:
            # Fall back to a registry-based synthetic manifest only for real
            # core service names, so a typo or a made-up plugin id still
            # fails loudly instead of silently creating a row.
            from src.services.shared.registry import get_descriptor
            core_desc = get_descriptor(plugin_id)
            if core_desc is None or resolved_plugin_id != plugin_id:
                raise ValueError(f"Plugin '{plugin_id}' does not exist in platform catalog")
            manifest = PluginManifest(
                id=resolved_plugin_id,
                name=core_desc.description,
                version="1.0.0",
                category="core_addon",
                is_system=True,
                is_active=True,
            )
            session.add(manifest)
            await session.flush()
        if not manifest.is_active:
            raise ValueError(f"Plugin '{plugin_id}' is currently disabled globally by kill-switch")

        m_res = await session.execute(
            select(TenantModuleState).where(
                TenantModuleState.tenant_id == tenant_id,
                TenantModuleState.plugin_id == plugin_id,
            )
        )
        state_row = m_res.scalar_one_or_none()
        now = _utcnow()
        if state_row is None:
            state_row = TenantModuleState(
                tenant_id=tenant_id,
                plugin_id=plugin_id,
                state=ModuleLifecycleState.ACTIVE,
                activated_version=manifest.version,
                schema_version=manifest.version,
                config=config or {},
                activated_by=admin_id,
                activated_at=now,
            )
            session.add(state_row)
        else:
            state_row.state = ModuleLifecycleState.ACTIVE
            state_row.activated_at = now
            state_row.suspended_at = None
            if config:
                state_row.config = {**state_row.config, **config}

        audit = PlatformAuditEntry(
            admin_id=admin_id,
            admin_email=admin_email,
            action="module.activated",
            target_type="tenant_module",
            target_id=f"{tenant_id}:{plugin_id}",
            details={"resolved_plugin": resolved_plugin_id, "version": manifest.version, "config": config},
        )
        session.add(audit)
        await session.commit()
        return state_row

    @staticmethod
    async def suspend_module(
        session: AsyncSession,
        tenant_id: uuid.UUID,
        plugin_id: str,
        admin_id: uuid.UUID | None,
        admin_email: str,
    ) -> TenantModuleState:
        m_res = await session.execute(
            select(TenantModuleState).where(
                TenantModuleState.tenant_id == tenant_id,
                TenantModuleState.plugin_id == plugin_id,
            )
        )
        state_row = m_res.scalar_one_or_none()
        # No row yet means this tenant was "active by default" for this
        # module (it was never explicitly onboarded). Suspend must still work
        # for that case — that is the whole point of the gate: you must be able
        # to turn off a module the tenant never had a row for. Create the row
        # in the suspended state rather than refusing.
        if state_row is None:
            p_res = await session.execute(
                select(PluginManifest).where(PluginManifest.id == plugin_id)
            )
            manifest = p_res.scalar_one_or_none()
            state_row = TenantModuleState(
                tenant_id=tenant_id,
                plugin_id=plugin_id,
                state=ModuleLifecycleState.SUSPENDED,
                activated_version=manifest.version if manifest else "1.0.0",
                schema_version=manifest.version if manifest else "1.0.0",
                config={},
                activated_by=None,
                activated_at=None,
                suspended_at=_utcnow(),
            )
            session.add(state_row)
        else:
            state_row.state = ModuleLifecycleState.SUSPENDED
            state_row.suspended_at = _utcnow()

        audit = PlatformAuditEntry(
            admin_id=admin_id,
            admin_email=admin_email,
            action="module.suspended",
            target_type="tenant_module",
            target_id=f"{tenant_id}:{plugin_id}",
        )
        session.add(audit)
        await session.commit()
        return state_row

    @staticmethod
    async def archive_module(
        session: AsyncSession,
        tenant_id: uuid.UUID,
        plugin_id: str,
        admin_id: uuid.UUID | None,
        admin_email: str,
    ) -> TenantModuleState:
        m_res = await session.execute(
            select(TenantModuleState).where(
                TenantModuleState.tenant_id == tenant_id,
                TenantModuleState.plugin_id == plugin_id,
            )
        )
        state_row = m_res.scalar_one_or_none()
        # Same as suspend: no row yet = "active by default", and archive must
        # work for that case so a module can be turned off for a tenant that
        # was never explicitly onboarded.
        if state_row is None:
            p_res = await session.execute(
                select(PluginManifest).where(PluginManifest.id == plugin_id)
            )
            manifest = p_res.scalar_one_or_none()
            state_row = TenantModuleState(
                tenant_id=tenant_id,
                plugin_id=plugin_id,
                state=ModuleLifecycleState.ARCHIVED,
                activated_version=manifest.version if manifest else "1.0.0",
                schema_version=manifest.version if manifest else "1.0.0",
                config={},
                activated_by=None,
                activated_at=None,
                archived_at=_utcnow(),
            )
            session.add(state_row)
        else:
            state_row.state = ModuleLifecycleState.ARCHIVED
            state_row.archived_at = _utcnow()

        audit = PlatformAuditEntry(
            admin_id=admin_id,
            admin_email=admin_email,
            action="module.archived",
            target_type="tenant_module",
            target_id=f"{tenant_id}:{plugin_id}",
        )
        session.add(audit)
        await session.commit()
        return state_row

    @staticmethod
    async def list_permissions(
        session: AsyncSession, module: str | None = None
    ) -> list[PermissionCatalogue]:
        stmt = select(PermissionCatalogue)
        if module:
            stmt = stmt.where(PermissionCatalogue.module == module)
        stmt = stmt.order_by(PermissionCatalogue.code)
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_permission(
        session: AsyncSession,
        code: str,
        module: str,
        name: str,
        description: str | None,
        tier: int,
        admin_email: str,
    ) -> PermissionCatalogue:
        existing = await session.execute(
            select(PermissionCatalogue).where(PermissionCatalogue.code == code)
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Permission '{code}' already exists")

        perm = PermissionCatalogue(
            code=code, module=module, name=name, description=description, tier=tier, is_system=False
        )
        session.add(perm)
        audit = PlatformAuditEntry(
            admin_email=admin_email,
            action="permission.created",
            target_type="permission",
            target_id=code,
            details={"module": module, "name": name, "tier": tier},
        )
        session.add(audit)
        await session.commit()
        return perm

    @staticmethod
    async def list_policies(
        session: AsyncSession, tenant_id: uuid.UUID | None = None
    ) -> list[AccessPolicy]:
        stmt = select(AccessPolicy)
        if tenant_id:
            stmt = stmt.where(
                (AccessPolicy.tenant_id == tenant_id) | (AccessPolicy.tenant_id.is_(None))
            )
        stmt = stmt.order_by(AccessPolicy.priority.desc())
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_policy(
        session: AsyncSession, data: dict, admin_email: str
    ) -> AccessPolicy:
        policy = AccessPolicy(**data)
        session.add(policy)
        audit = PlatformAuditEntry(
            admin_email=admin_email,
            action="policy.created",
            target_type="policy",
            target_id=str(policy.id),
            details=data,
        )
        session.add(audit)
        await session.commit()
        return policy

    @staticmethod
    async def probe_fleet_health() -> dict:
        """Probe all microservices in the fleet."""
        async with httpx.AsyncClient(timeout=3.0) as client:
            async def probe_service(d):
                t0 = time.perf_counter()
                status = "down"
                latency = None
                error = None
                db_status = "unknown"
                try:
                    r = await client.get(f"{base_url(d)}/health")
                    latency = round((time.perf_counter() - t0) * 1000, 1)
                    if r.status_code == 200:
                        body = r.json()
                        status = body.get("status", "up")
                        db_status = body.get("database", "ok")
                    else:
                        status = f"http_{r.status_code}"
                except Exception as exc:
                    error = type(exc).__name__

                return {
                    "service": d.name,
                    "port": d.port,
                    "status": status,
                    "latency_ms": latency,
                    "database": db_status,
                    "error": error,
                }

            results = await asyncio.gather(*(probe_service(d) for d in all_services()))

        services_up = sum(1 for s in results if s["status"] == "up")
        overall = "ok" if services_up == len(results) else ("degraded" if services_up else "down")

        return {
            "overall_status": overall,
            "services_up": services_up,
            "services_total": len(results),
            "services": results,
            "checked_at": _utcnow(),
        }
