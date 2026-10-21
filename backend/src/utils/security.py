import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt

# Fix passlib 1.7.4 bug with bcrypt >= 4.0.0 where passlib reads _bcrypt.__about__.__version__
if not hasattr(bcrypt, "__about__"):
    class _BcryptAbout:
        __version__ = getattr(bcrypt, "__version__", "4.0.0")
    bcrypt.__about__ = _BcryptAbout()

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.models import Permission, Role, RolePermission

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─── Permission catalogue ────────────────────────────────────────
# (code, name, module, description)

DEFAULT_PERMISSIONS: list[tuple[str, str, str, str]] = [
    # ─── Core ───
    ("view:dashboard", "View Dashboard", "core", "Access main dashboard overview"),
    ("use:copilot", "Use AI Copilot", "core", "Query the AI assistant"),
    ("view:insights", "View AI Insights", "core", "Access demand forecast and menu engineering"),
    ("view:api_keys", "View API Keys", "core", "View developer integration API keys"),
    ("manage:api_keys", "Manage API Keys", "core", "Generate and revoke developer API keys"),
    ("view:mfa_policies", "View MFA Policies", "core", "View Multi-Factor Authentication settings"),
    ("manage:mfa_policies", "Manage MFA Policies", "core", "Configure tenant-wide MFA policies"),

    # ─── Access control ───
    ("view:users", "View Users", "core", "View list of user accounts"),
    ("manage:users", "Manage Users", "core", "Create, edit, suspend and delete user accounts"),
    ("view:roles", "View Roles", "core", "View roles and permission sets"),
    ("manage:roles", "Manage Roles", "core", "Create and customize roles and permissions"),
    ("view:permission_matrix", "View Permission Matrix", "core", "Access the role permission matrix"),
    ("view:access_control", "View Access Control", "core", "View access control lists"),
    ("manage:access_control", "Manage Access Control", "core", "Administer access control and assignments"),

    # ─── Organization ───
    ("view:outlets", "View Outlets", "organization", "View restaurant outlets"),
    ("manage:outlets", "Manage Outlets", "organization", "Create and configure outlets"),
    ("view:tables", "View Tables", "organization", "View table layout and live status"),
    ("manage:tables", "Manage Tables", "organization", "Create tables and edit the floor plan"),
    ("transfer:tables", "Transfer Tables", "organization", "Move a running order to another table"),
    ("manage:reservations", "Manage Reservations", "organization", "Create, confirm and cancel bookings"),
    ("manage:waitlist", "Manage Waitlist", "organization", "Add to and seat from the waitlist"),
    ("view:master_data", "View Master Data", "organization", "View UOMs, tags, payment methods"),
    ("manage:master_data", "Manage Master Data", "organization", "Manage UOMs, tags and master data"),

    # ─── Menu ───
    ("view:menu_items", "View Menu Items", "menu", "Browse the menu"),
    ("manage:menu_items", "Manage Menu Items", "menu", "Create, edit and delete menu items"),
    ("view:recipes", "View Recipes", "menu", "View recipe / BOM definitions"),
    ("manage:recipes", "Manage Recipes", "menu", "Define ingredients and recipe lines"),
    ("manage:pricing_rules", "Manage Pricing Rules", "menu", "Configure happy-hour and day-part pricing"),
    ("manage:combos", "Manage Combos", "menu", "Create combo meals and bundle pricing"),

    # ─── Dine-in / orders ───
    ("view:orders", "View Orders", "dine_in", "View running and past orders"),
    ("manage:orders", "Manage Orders", "dine_in", "Create orders and modify items"),
    ("fire:kot", "Fire Orders to Kitchen", "dine_in", "Send courses to the kitchen"),

    # ─── Kitchen / KOT ───
    ("view:kot", "View KOTs", "kitchen", "View kitchen order tickets"),
    ("acknowledge:kot", "Acknowledge KOTs", "kitchen", "Accept an incoming ticket"),
    ("prepare:kot", "Mark KOTs Preparing", "kitchen", "Move a ticket to preparing"),
    ("ready:kot", "Mark KOTs Ready", "kitchen", "Signal food is ready"),
    ("serve:kot", "Mark KOTs Served", "kitchen", "Confirm items were served to the table"),
    ("cancel:kot", "Cancel KOTs", "kitchen", "Cancel a ticket already sent to the kitchen"),
    ("view:kitchen_analytics", "View Kitchen Analytics", "kitchen", "Prep times, backlog, throughput"),
    ("manage:kitchen_stations", "Manage Kitchen Stations", "kitchen", "Configure stations and routing"),

    # ─── Billing ───
    ("view:bills", "View Bills", "billing", "View bills and receipts"),
    ("manage:bills", "Manage Bills", "billing", "Generate and edit bills"),
    ("settle:bills", "Settle Bills", "billing", "Take payment and close a bill"),
    ("void:bills", "Void Bills", "billing", "Void a settled or draft bill"),
    ("refund:bills", "Refund Bills", "billing", "Issue refunds against a settled bill"),
    ("split:bills", "Split Bills", "billing", "Split a bill by item or by amount"),
    ("apply:discounts", "Apply Discounts", "billing", "Apply discounts at checkout"),
    ("approve:discounts", "Approve Discounts", "billing", "Approve discounts above the threshold"),
    ("generate:gst_invoice", "Generate GST Invoices", "billing", "Generate e-Invoice IRN"),

    # ─── Shifts & cash ───
    ("view:shifts", "View Shifts", "shift", "View register shifts and cash summaries"),
    ("manage:shifts", "Manage Shifts", "shift", "Open register shifts"),
    ("close:shifts", "Close Shifts", "shift", "Close shifts and reconcile the drawer"),
    ("manage:cash_movements", "Manage Cash Movements", "shift", "Record paid in/out, drops and pickups"),
    ("approve:cash_discrepancy", "Approve Cash Discrepancy", "shift", "Approve a drawer variance"),
    ("manage:day_close", "Manage Day Close", "shift", "Run and reconcile end of day"),

    # ─── Inventory ───
    ("view:inventory", "View Inventory", "inventory", "View ingredients and stock levels"),
    ("manage:inventory", "Manage Inventory", "inventory", "Create and edit inventory items"),
    ("view:stock", "View Stock", "inventory", "View stock on hand and movements"),
    ("adjust:stock", "Adjust Stock", "inventory", "Create and approve stock adjustments"),
    ("manage:wastage", "Manage Wastage", "inventory", "Log and approve wastage"),
    ("approve:wastage", "Approve Wastage", "inventory", "Approve wastage entries"),
    ("manage:transfers", "Manage Transfers", "inventory", "Create inter-outlet stock transfers"),
    ("receive:transfers", "Receive Transfers", "inventory", "Receive an incoming stock transfer"),
    ("manage:production", "Manage Production", "inventory", "Record prep and production batches"),

    # ─── Purchase ───
    ("view:purchase", "View Purchase", "purchase", "View PRs, POs, GRNs and vendor bills"),
    ("manage:purchase", "Manage Purchase", "purchase", "Create PRs, POs and vendor bills"),
    ("approve:purchase_orders", "Approve Purchase Orders", "purchase", "Approve a purchase order"),
    ("receive:grn", "Receive Goods", "purchase", "Record goods receipt and QC"),
    ("pay:vendor_bills", "Pay Vendor Bills", "purchase", "Record payments against vendor bills"),
    ("manage:vendors", "Manage Vendors", "purchase", "Create and edit vendors"),

    # ─── Staff ───
    ("view:staff", "View Staff", "staff", "View employees and rosters"),
    ("manage:staff", "Manage Staff", "staff", "Create and edit employees"),
    ("manage:roster", "Manage Roster", "staff", "Schedule shifts"),
    ("manage:attendance", "Manage Attendance", "staff", "Mark and edit attendance"),
    ("view:tips", "View Tips", "staff", "View tip amounts"),
    ("distribute:tips", "Distribute Tips", "staff", "Distribute the tip pool"),

    # ─── Customers ───
    ("view:customers", "View Customers", "customers", "View customer directory and history"),
    ("manage:customers", "Manage Customers", "customers", "Create and edit customers"),
    ("view:feedback", "View Feedback", "customers", "View ratings and comments"),
    ("manage:feedback", "Manage Feedback", "customers", "Acknowledge and resolve feedback"),
    ("view:complaints", "View Complaints", "customers", "View complaints"),
    ("resolve:complaints", "Resolve Complaints", "customers", "Resolve and close complaints"),

    # ─── Loyalty ───
    ("view:loyalty", "View Loyalty", "loyalty", "View loyalty accounts and points"),
    ("manage:loyalty", "Manage Loyalty", "loyalty", "Configure loyalty programs and tiers"),
    ("redeem:loyalty_points", "Redeem Loyalty Points", "loyalty", "Redeem points at checkout"),
    ("manage:gift_cards", "Manage Gift Cards", "loyalty", "Issue and void gift cards"),
    ("manage:wallets", "Manage Wallets", "loyalty", "Top up and adjust customer wallets"),

    # ─── Accounting ───
    ("view:accounting", "View Accounting", "accounting", "View COA and journal entries"),
    ("manage:accounting", "Manage Accounting", "accounting", "Create and edit accounts"),
    ("post:journal_entries", "Post Journal Entries", "accounting", "Post, lock and reverse entries"),
    ("manage:tax_codes", "Manage Tax Codes", "accounting", "Configure GST rates and HSN codes"),
    ("view:financial_reports", "View Financial Reports", "accounting", "View P&L and financial statements"),

    # ─── Reports ───
    ("view:reports", "View Reports", "reports", "Access the reports section"),
    ("view:sales_reports", "View Sales Reports", "reports", "Item, hourly, category and outlet sales"),
    ("view:inventory_reports", "View Inventory Reports", "reports", "Consumption and margin reports"),
    ("view:kitchen_reports", "View Kitchen Reports", "reports", "Kitchen performance reports"),

    # ─── Integrations ───
    ("view:integrations", "View Integrations", "integrations", "View connected integrations"),
    ("manage:integrations", "Manage Integrations", "integrations", "Configure integration settings"),
    ("manage:aggregators", "Manage Aggregators", "integrations", "Configure Zomato/Swiggy and sync menus"),
    ("manage:printers", "Manage Printers", "integrations", "Configure KOT and bill printers"),
    ("manage:whatsapp", "Manage WhatsApp", "integrations", "Manage WhatsApp sessions and campaigns"),

    # ─── System ───
    ("view:settings", "View Settings", "system", "Access settings"),
    ("manage:settings", "Manage Settings", "system", "Modify tenant settings"),
    ("view:audit", "View Audit Logs", "system", "View the audit trail"),
    ("manage:audit", "Manage Audit Logs", "system", "Export and manage audit records"),
    ("view:activity_logs", "View Activity Logs", "system", "View user activity logs"),
]


# Seeded role → permission codes
ROLE_PERMISSION_MAP: dict[str, list[str]] = {
    "Outlet Manager": [
        "view:dashboard", "use:copilot", "view:insights",
        "view:outlets", "manage:outlets", "view:tables", "manage:tables", "transfer:tables",
        "manage:reservations", "manage:waitlist", "view:master_data", "manage:master_data",
        "view:menu_items", "manage:menu_items", "view:recipes", "manage:recipes",
        "manage:pricing_rules", "manage:combos",
        "view:orders", "manage:orders", "fire:kot",
        "view:kot", "cancel:kot", "view:kitchen_analytics", "manage:kitchen_stations",
        "view:bills", "manage:bills", "settle:bills", "void:bills", "refund:bills",
        "split:bills", "apply:discounts", "approve:discounts", "generate:gst_invoice",
        "view:shifts", "manage:shifts", "close:shifts", "manage:cash_movements",
        "approve:cash_discrepancy", "manage:day_close",
        "view:inventory", "manage:inventory", "view:stock", "adjust:stock",
        "manage:wastage", "approve:wastage", "manage:transfers", "receive:transfers",
        "manage:production",
        "view:purchase", "manage:purchase", "approve:purchase_orders", "receive:grn",
        "pay:vendor_bills", "manage:vendors",
        "view:staff", "manage:staff", "manage:roster", "manage:attendance",
        "view:tips", "distribute:tips",
        "view:customers", "manage:customers", "view:feedback", "manage:feedback",
        "view:complaints", "resolve:complaints",
        "view:loyalty", "manage:loyalty", "redeem:loyalty_points", "manage:gift_cards",
        "manage:wallets",
        "view:accounting", "manage:accounting", "post:journal_entries", "manage:tax_codes",
        "view:financial_reports",
        "view:reports", "view:sales_reports", "view:inventory_reports", "view:kitchen_reports",
        "view:integrations", "manage:integrations", "manage:aggregators",
        "manage:printers", "manage:whatsapp",
        "view:settings", "manage:settings", "view:audit", "view:activity_logs",
        "view:users", "manage:users", "view:roles",
    ],
    "Cashier": [
        "view:dashboard",
        "view:menu_items", "view:orders", "manage:orders", "fire:kot",
        "view:tables", "view:bills", "manage:bills", "settle:bills", "split:bills",
        "apply:discounts", "view:customers", "manage:customers",
        "view:shifts", "manage:shifts", "manage:cash_movements",
        "view:reports", "view:sales_reports",
    ],
    "Captain": [
        "view:dashboard",
        "view:menu_items", "view:orders", "manage:orders", "fire:kot",
        "view:tables", "manage:tables", "transfer:tables",
        "manage:reservations", "manage:waitlist",
        "view:kot", "view:bills", "manage:bills", "apply:discounts",
        "view:customers", "view:shifts", "view:tips",
    ],
    "Waiter": [
        "view:dashboard", "view:menu_items", "view:orders", "view:tables", "view:kot",
    ],
    "Kitchen": [
        "view:dashboard", "view:menu_items",
        "view:kot", "acknowledge:kot", "prepare:kot", "ready:kot", "serve:kot",
        "view:kitchen_analytics",
    ],
    "Purchase Manager": [
        "view:dashboard",
        "view:inventory", "manage:inventory", "view:stock", "adjust:stock",
        "manage:wastage", "manage:transfers", "receive:transfers", "manage:production",
        "view:purchase", "manage:purchase", "approve:purchase_orders", "receive:grn",
        "pay:vendor_bills", "manage:vendors",
        "view:reports", "view:inventory_reports",
    ],
    "Accountant": [
        "view:dashboard",
        "view:accounting", "manage:accounting", "post:journal_entries", "manage:tax_codes",
        "view:financial_reports",
        "view:bills", "view:shifts", "close:shifts", "approve:cash_discrepancy",
        "manage:day_close", "generate:gst_invoice",
        "view:purchase", "view:reports", "view:sales_reports", "view:inventory_reports",
    ],
    "Viewer": [
        "view:dashboard", "view:outlets", "view:tables", "view:menu_items", "view:recipes",
        "view:orders", "view:kot", "view:bills", "view:shifts", "view:inventory",
        "view:stock", "view:purchase", "view:staff", "view:customers", "view:feedback",
        "view:loyalty", "view:accounting", "view:reports", "view:sales_reports",
        "view:inventory_reports", "view:kitchen_reports", "view:financial_reports",
    ],
}


# ─── Password utilities ──────────────────────────────────────────

def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed or not plain:
        return False
    try:
        pwd_bytes = plain.encode("utf-8")[:72]
        if hashed.startswith(("$2a$", "$2b$", "$2y$")):
            return bcrypt.checkpw(pwd_bytes, hashed.encode("utf-8"))
    except Exception:
        pass
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


def generate_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ─── JWT ─────────────────────────────────────────────────────────

def create_access_token(
    user_id: Any,
    tenant_id: Any,
    active_role_id: Any | None = None,
    expires_delta: timedelta | None = None,
    *,
    claims: dict[str, Any] | None = None,
) -> str:
    """Issue an access token.

    ``claims`` carries the self-contained identity microservices need. In a
    microservices split each service validates this token locally instead of
    calling auth on every request, so the token has to carry permissions,
    outlet scope and profile. Any key given here is merged into the payload
    and overrides the defaults.
    """
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    payload = {
        "sub": str(user_id),
        "tenant_id": str(tenant_id),
        "active_role_id": str(active_role_id) if active_role_id else None,
        "type": "access",
        "iat": now,
        "exp": expire,
    }
    if claims:
        for key, value in claims.items():
            if value is None:
                continue
            payload[key] = value
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(
    user_id: Any,
    tenant_id: Any,
    expires_delta: timedelta | None = None,
) -> str:
    """Issue a refresh token. Always unique, even within the same second.

    Without the ``jti`` the payload is only (sub, tenant_id, type, iat, exp),
    and ``iat`` has second resolution — so two logins by the same user in the
    same second produce byte-identical tokens. The refresh-token table has a
    UNIQUE constraint on the token hash, so the second insert raises
    IntegrityError, and since rotation revokes the token it replaces, a
    rotated token could be rejected as already-used.

    ``jti`` is a registered JWT claim for exactly this purpose. It is random,
    not sequential, so it leaks nothing about issue order.
    """
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(days=settings.refresh_token_expire_days))
    payload = {
        "sub": str(user_id),
        "tenant_id": str(tenant_id),
        "type": "refresh",
        "jti": uuid.uuid4().hex,
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_ws_ticket(outlet_id: Any, station_id: Any | None = None) -> str:
    """Short-lived token for the KDS WebSocket handshake (60s TTL)."""
    now = datetime.now(timezone.utc)
    payload = {
        "outlet_id": str(outlet_id),
        "station_id": str(station_id) if station_id else None,
        "type": "ws_ticket",
        "iat": now,
        "exp": now + timedelta(seconds=60),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str, expected_type: str | None = None) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc
    if expected_type and payload.get("type") != expected_type:
        raise ValueError("Invalid token type")
    return payload


def decode_access_token(token: str) -> dict:
    return decode_token(token, expected_type="access")


# ─── Seeding ─────────────────────────────────────────────────────

async def seed_permissions(db: AsyncSession) -> None:
    """Idempotently insert the permission catalogue and backfill Super Admin roles."""
    result = await db.execute(select(Permission))
    all_perms = {p.code: p for p in result.scalars().all()}

    added = False
    for code, name, module, description in DEFAULT_PERMISSIONS:
        if code not in all_perms:
            perm = Permission(code=code, name=name, module=module, description=description)
            db.add(perm)
            all_perms[code] = perm
            added = True
    if added:
        await db.flush()

    # Backfill any newly added permissions onto existing Super Admin roles
    db_perms = (await db.execute(select(Permission))).scalars().all()
    super_roles = (
        await db.execute(select(Role).where(Role.name == "Super Admin"))
    ).scalars().all()
    for role in super_roles:
        existing = set(
            (await db.execute(
                select(RolePermission.permission_id).where(RolePermission.role_id == role.id)
            )).scalars().all()
        )
        for perm in db_perms:
            if perm.id not in existing:
                db.add(RolePermission(role_id=role.id, permission_id=perm.id))
    await db.flush()


async def create_super_admin_role(db: AsyncSession, tenant_id) -> Role:
    role = Role(
        tenant_id=tenant_id,
        name="Super Admin",
        description="Full access to all modules and settings",
        is_system=True,
    )
    db.add(role)
    await db.flush()

    permissions = (await db.execute(select(Permission))).scalars().all()
    for perm in permissions:
        db.add(RolePermission(role_id=role.id, permission_id=perm.id))
    await db.flush()
    return role


async def seed_roles_for_tenant(db: AsyncSession, tenant_id) -> dict[str, Role]:
    """Create the standard restaurant roles and bind permissions. Idempotent per tenant."""
    existing = {
        r.name: r
        for r in (await db.execute(select(Role).where(Role.tenant_id == tenant_id))).scalars().all()
    }
    perm_by_code = {
        p.code: p
        for p in (await db.execute(select(Permission))).scalars().all()
    }

    roles: dict[str, Role] = {}
    for role_name, codes in ROLE_PERMISSION_MAP.items():
        role = existing.get(role_name)
        if role is None:
            role = Role(
                tenant_id=tenant_id,
                name=role_name,
                description=f"{role_name} role",
                is_system=True,
            )
            db.add(role)
            await db.flush()
            existing[role_name] = role

        existing_links = set(
            (await db.execute(
                select(RolePermission.permission_id).where(RolePermission.role_id == role.id)
            )).scalars().all()
        )
        for code in codes:
            perm = perm_by_code.get(code)
            if perm and perm.id not in existing_links:
                db.add(RolePermission(role_id=role.id, permission_id=perm.id))
        roles[role_name] = role

    await db.flush()
    return roles
