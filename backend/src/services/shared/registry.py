"""Service registry — the plugin manifest.

Each microservice is a self-contained module under ``src/services/<name>/``.
To plug one out, remove its directory. To plug one in, add it.

The registry declares:
  * name — matches the URL prefix: /api/v1/<name>/...
  * port — which port the service listens on when run standalone
  * database_url — the service's own database (never shared)
  * permissions — RBAC strings this service's endpoints require
  * publishes / subscribes — event bus topics
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ServiceDescriptor:
    name: str
    port: int
    db_name: str
    description: str
    permissions: tuple[str, ...]
    publishes: tuple[str, ...] = ()
    subscribes: tuple[str, ...] = ()
    enabled: bool = True

    # ── Module gating ──────────────────────────────────────────────────
    # ``kind`` says whether this service is shared platform machinery ("core")
    # or an industry vertical ("plugin"). Core services are never gated: they
    # are the thing a tenant always has.
    #
    # ``enforce_module_gate`` opts a service into the gateway's per-tenant
    # module check. It is deliberately default-FALSE. Turning it on for an
    # existing service is a policy change that must be made consciously, one
    # line at a time — and even then it only blocks a tenant that has an
    # explicit non-active row for this service's module key. A tenant with no
    # row at all is allowed, so switching the flag on can never break a
    # tenant that has never been put under module management.
    #
    # ``module_key`` names the module this service belongs to. Defaults to the
    # service name, which is what makes a self-contained vertical gate itself
    # with no extra configuration.
    kind: str = "core"
    # module_key: the switch this service is gated behind. Defaults to the
    # service's own name, so a vertical is its own module with no extra
    # configuration; only a service that shares one switch with others
    # (several services behind a single "pos" module, say) needs to set it.
    module_key: str | None = None
    # Gating is opt-in: turning it on is a policy change made consciously,
    # one line at a time. It blocks only a tenant with an explicit
    # non-active row for this module key; a tenant with no row at all is
    # allowed, so flipping the flag on can never break a tenant that has
    # never been under module management.
    enforce_module_gate: bool = False

    @property
    def route_prefix(self) -> str:
        return f"/api/v1/{self.name}"


def _env(key: str, default: str) -> str:
    return os.environ.get(key, default)


def _port(name: str, base: int, offset: int) -> int:
    return int(_env(f"SERVICE_PORT_{name.upper()}", str(base + offset)))


# ─── The registry ───────────────────────────────────────────────────────────
# Ports: 8010 is the API gateway. Each service gets a dedicated port so it
# can be deployed independently. Bases are chosen to leave room for scaling
# multiple instances of one service without port collisions.

_REGISTRY: dict[str, ServiceDescriptor] = {}
_ALIASES: dict[str, str] = {}


def _register(d: ServiceDescriptor) -> None:
    _REGISTRY[d.name] = d


_register(ServiceDescriptor(
    name="auth",
    port=_port("auth", 8100, 0),
    db_name="restaurantos_auth",
    description="Users, tenants, roles, permissions, API keys",
    permissions=("view:users", "manage:users", "view:roles", "manage:roles"),
    publishes=("user.created", "user.updated", "user.deactivated"),
))

_register(ServiceDescriptor(
    name="organization",
    port=_port("organization", 8100, 1),
    db_name="restaurantos_organization",
    description="Tenants, outlets, sections, tables, cost centres, UoM, number series",
    permissions=("manage:organization", "manage:outlets", "view:tables", "manage:tables"),
    publishes=("outlet.created", "outlet.updated", "table.status.changed"),
))

_register(ServiceDescriptor(
    name="menu",
    port=_port("menu", 8100, 2),
    db_name="restaurantos_menu",
    description="Categories, items, variants, addons, modifiers, combos, pricing rules",
    permissions=("view:menu", "manage:menu", "view:recipes", "manage:recipes"),
    publishes=("menu.item.created", "menu.item.updated", "menu.item.deactivated"),
    kind="plugin",
    module_key="menu",
    enforce_module_gate=True,
))

_register(ServiceDescriptor(
    name="pos",
    port=_port("pos", 8100, 3),
    db_name="restaurantos_pos",
    description="Orders, order items, table sessions, reservations, waitlist",
    permissions=("view:orders", "manage:orders"),
    publishes=("order.placed", "order.status.changed", "order.cancelled",
               "table_session.opened", "table_session.closed"),
    subscribes=("menu.item.updated", "menu.item.deactivated",
                "table.status.changed", "customer.updated",
                "kot.served", "bill.paid", "delivery.delivered",
                "table_session.closed"),
    kind="plugin",
    module_key="pos",
    enforce_module_gate=True,
))

_register(ServiceDescriptor(
    name="kitchen",
    port=_port("kitchen", 8100, 4),
    db_name="restaurantos_kitchen",
    description="KDS stations, KOT tickets, KOT item status, status logs",
    permissions=("prepare:kot", "cancel:kot"),
    publishes=("kot.fired", "kot.acknowledged", "kot.ready", "kot.served",
               "kot.cancelled", "kot.item.status.changed"),
    subscribes=("order.placed", "order.status.changed"),
    kind="plugin",
    module_key="kitchen",
    # A tenant that has explicitly suspended its kitchen (e.g. a pure
    # delivery-only branch with no in-house prep) should not reach KDS.
    # Gating here — as with every other vertical — blocks only a tenant
    # with an explicit non-active row; a never-onboarded tenant passes.
    enforce_module_gate=True,
))

_register(ServiceDescriptor(
    name="billing",
    port=_port("billing", 8100, 5),
    db_name="restaurantos_billing",
    description="Bills, bill items, payments, refunds, discounts, coupons, tax codes, tips",
    permissions=("view:bills", "manage:bills", "manage:pricing_rules",
                 "process:payments", "manage:refunds"),
    publishes=("bill.created", "bill.paid", "bill.refunded", "payment.received"),
    subscribes=("order.placed", "order.status.changed", "kot.item.status.changed"),
    kind="plugin",
    module_key="billing",
    enforce_module_gate=True,
))

_register(ServiceDescriptor(
    name="inventory",
    port=_port("inventory", 8100, 6),
    db_name="restaurantos_inventory",
    description="Items, categories, stock, batches, movements, wastage, adjustments, transfers",
    permissions=("view:inventory", "manage:inventory"),
    publishes=("stock.movement.created", "stock.low", "stock.out",
               "adjustment.approved", "wastage.recorded"),
    subscribes=("order.placed", "order.cancelled", "kot.item.status.changed",
                "grn.posted", "production.run.completed"),
    kind="plugin",
    module_key="inventory",
    enforce_module_gate=True,
))

_register(ServiceDescriptor(
    name="purchase",
    port=_port("purchase", 8100, 7),
    db_name="restaurantos_purchase",
    description="Vendors, purchase requests, POs, GRNs, vendor bills, vendor payments",
    permissions=("view:purchase", "manage:purchase"),
    publishes=("po.created", "po.approved", "grn.posted", "vendor_bill.created"),
    subscribes=("stock.out", "stock.low", "production.po.requested"),
    kind="plugin",
    module_key="purchase",
    enforce_module_gate=True,
))

_register(ServiceDescriptor(
    name="staff",
    port=_port("staff", 8100, 8),
    db_name="restaurantos_staff",
    description="Employees, HRMS studios, rosters, attendance, leaves, payroll, ATS, tips",
    permissions=(
        "view:staff", "manage:staff",
        "view:hrms", "manage:hrms", "edit:hrms", "delete:hrms",
        "manage:hrms_employees",
        "view:hrms_salary_structure", "manage:hrms_salary_structure",
        "view:hrms_attendance", "manage:hrms_attendance",
        "view:hrms_leaves", "manage:hrms_leaves",
        "view:hrms_payroll", "manage:hrms_payroll",
        "view:hrms_recruitment", "manage:hrms_recruitment",
        "view:hrms_performance", "manage:hrms_performance",
        "view:hrms_learning", "manage:hrms_learning",
        "view:hrms_exit", "manage:hrms_exit",
        "view:hrms_intelligence", "view:ess",
    ),
    publishes=("attendance.marked", "tip.recorded"),
    subscribes=("bill.paid",),
    kind="plugin",
    module_key="staff",
    enforce_module_gate=True,
))


_register(ServiceDescriptor(
    name="customers",
    port=_port("customers", 8100, 9),
    db_name="restaurantos_customers",
    description="Customers and their profiles",
    permissions=("view:customers", "manage:customers"),
    publishes=("customer.created", "customer.updated", "customer.deleted"),
    subscribes=("bill.paid",),
    kind="plugin",
    module_key="customers",
    enforce_module_gate=True,
))

_register(ServiceDescriptor(
    name="loyalty",
    port=_port("loyalty", 8100, 10),
    db_name="restaurantos_loyalty",
    description="Loyalty programs, accounts, wallets, point transactions",
    permissions=("view:loyalty", "manage:loyalty"),
    publishes=("loyalty.points.earned", "loyalty.points.redeemed"),
    subscribes=("customer.created", "bill.paid"),
    kind="plugin",
    module_key="loyalty",
    enforce_module_gate=True,
))

_register(ServiceDescriptor(
    name="accounting",
    port=_port("accounting", 8100, 11),
    db_name="restaurantos_accounting",
    description="Chart of accounts, journal entries, GST returns, tax payments",
    permissions=("view:accounting", "manage:accounting"),
    publishes=("journal_entry.posted",),
    subscribes=("bill.paid", "grn.posted", "adjustment.approved",
                "wastage.recorded", "payment.received"),
    kind="plugin",
    module_key="accounting",
    enforce_module_gate=True,
))

_register(ServiceDescriptor(
    name="reports",
    port=_port("reports", 8100, 12),
    db_name="restaurantos_reports",
    description="Read-model projections and analytics",
    permissions=("view:reports",),
    subscribes=("order.placed", "bill.paid", "stock.movement.created",
                "kot.ready", "attendance.marked",
                "expense.recorded", "withdrawal.recorded",
                "marketing.campaign.sent",
                "delivery.delivered", "production.run.completed"),
    kind="plugin",
    module_key="reports",
    enforce_module_gate=True,
))

_register(ServiceDescriptor(
    name="delivery",
    port=_port("delivery", 8100, 14),
    db_name="restaurantos_delivery",
    description="Delivery dispatch — delivery boys, delivery zones, live dispatch board",
    permissions=("view:delivery", "manage:delivery"),
    publishes=("delivery.created", "delivery.assigned", "delivery.delivered",
               "delivery.cancelled"),
    subscribes=("order.placed", "order.cancelled"),
    kind="plugin",
    module_key="delivery",
    enforce_module_gate=True,
))

_register(ServiceDescriptor(
    name="production",
    port=_port("production", 8100, 15),
    db_name="restaurantos_production",
    description="Production processes, runs and plans — raw-to-finished conversion",
    permissions=("view:production", "manage:production"),
    publishes=("production.run.completed", "production.po.requested"),
    kind="plugin",
    module_key="production",
    enforce_module_gate=True,
))

_register(ServiceDescriptor(
    name="marketing",
    port=_port("marketing", 8100, 16),
    db_name="restaurantos_marketing",
    description="Campaigns, banner ads and offer automation — marketing layer",
    permissions=("view:marketing", "manage:marketing"),
    publishes=("marketing.campaign.sent",),
    subscribes=("customer.created", "bill.paid"),
    kind="plugin",
    module_key="marketing",
    enforce_module_gate=True,
))

_register(ServiceDescriptor(
    name="printers",
    port=_port("printers", 8100, 17),
    db_name="restaurantos_printers",
    description="Printer & POS device registry — pairing, print destinations, routing rules, device health",
    permissions=("view:printers", "manage:printers"),
    publishes=("printer.registered", "printer.status.changed"),
    subscribes=("kot.fired", "bill.paid", "order.placed"),
    kind="plugin",
    module_key="printers",
    enforce_module_gate=True,
))


# ─── Platform control plane ─────────────────────────────────────────────────
# Sits beside the verticals but is never gated by them: it is the thing that
# switches modules on and off, so gating it would lock the platform admin out
# of the only place a module can be enabled. It is registered last so its port
# is clearly outside the vertical range, and its permissions use the
# ``platform:*`` namespace so a tenant role can never grant one of them.
_register(ServiceDescriptor(
    name="platform",
    port=_port("platform", 8100, 13),
    db_name="restaurantos_platform_admin",
    description=(
        "Platform control plane — super admin realm, tenant onboarding, "
        "per-tenant module lifecycle, dynamic permissions, ABAC policies, audit vault"
    ),
    permissions=(
        "platform:tenants",
        "platform:modules",
        "platform:roles",
        "platform:policies",
        "platform:audit",
        "platform:breakglass",
    ),
    publishes=(
        "platform.tenant.onboarded",
        "platform.module.activated",
        "platform.module.suspended",
        "platform.module.archived",
    ),
    subscribes=(),
    kind="core",
    module_key="platform",
    enforce_module_gate=False,
))

# ─── Lookup API ─────────────────────────────────────────────────────────────

def all_services() -> list[ServiceDescriptor]:
    return list(_REGISTRY.values())


# URL-prefix aliases → owning service. ``hrms`` and ``erp`` are both served
# by the staff service (it mounts the HRMS studio + ERP org routers under both
# /api/v1/hrms and /api/v1/erp as well as the canonical /api/v1/staff). They
# are not separate services: same port, same database, same module gate.
#
# The frontend was written against a richer retail-ERP surface (invoices,
# barcodes, crm, tax, ...) that the split hasn't fully built yet. These
# aliases route that legacy-first-segment onto the owning service so the
# gateway stops dying at the edge with SERVICE_NOT_FOUND; the owning service
# then answers with a clean per-route 404 until the real routes land in the
# build phases. Registering an alias is safe even before its routes exist.
_ALIASES: dict[str, str] = {
    "hrms": "staff",
    "erp": "staff",
    # Finance / back-office surfaces
    "tax": "accounting",
    "financial-reports": "accounting",
    "bank": "accounting",
    "fixed-assets": "accounting",
    "budgets": "accounting",
    "expense-claims": "accounting",
    # Commerce surfaces
    "invoices": "billing",
    "payments": "billing",
    "sales-returns": "billing",
    # Growth / analytics surfaces
    "analytics": "reports",
    "crm": "customers",
}


def get_descriptor(name: str) -> ServiceDescriptor | None:
    canonical = _ALIASES.get(name, name)
    return _REGISTRY.get(canonical)


def alias_target(name: str) -> str | None:
    """Return the canonical service an alias forwards to, or None.

    The gateway uses this to rewrite an aliased inbound prefix (e.g. ``/hrms``
    or ``/erp``) onto the owning service's canonical route prefix (``/staff``)
    before the hop, while still resolving identity + module gate from the
    owning service's descriptor.
    """
    return _ALIASES.get(name)



def enabled_services() -> list[ServiceDescriptor]:
    return [d for d in _REGISTRY.values() if d.enabled]


def service_names() -> list[str]:
    return list(_REGISTRY.keys())


def module_descriptor(module_key: str) -> ServiceDescriptor | None:
    """Resolve a module key to the descriptor that serves it.

    ``module_key`` defaults to the descriptor's name, so most keys resolve to
    the service of the same name and need no extra configuration. When several
    services share one module key, the first one wins — which is fine because
    the gateway only asks *which* descriptor gates this module, not all of
    them.
    """
    for d in _REGISTRY.values():
        if d.module_key == module_key:
            return d
    return None


def gated_services() -> list[ServiceDescriptor]:
    """Descriptors that opted into per-tenant module gating."""
    return [d for d in _REGISTRY.values() if d.enforce_module_gate]


def all_permissions() -> list[str]:
    seen: dict[str, None] = {}
    for d in _REGISTRY.values():
        for p in d.permissions:
            seen[p] = None
    return list(seen)


def base_url(d: ServiceDescriptor) -> str:
    """Where the gateway reaches this service over HTTP.

    Services register themselves with ``SERVICE_URL_<NAME>`` so that a service
    can be scaled horizontally behind a load balancer without touching code.
    """
    override = os.environ.get(f"SERVICE_URL_{d.name.upper()}")
    if override:
        return override.rstrip("/")
    host = os.environ.get("SERVICE_HOST", "127.0.0.1")
    return f"http://{host}:{d.port}"
