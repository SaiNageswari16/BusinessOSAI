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
    module_key: str | None = None
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
    # Gating the menu service would 404 every POS request in a tenant that has
    # no menu module row — POS and menu are inextricably linked (POS reads the
    # menu on every order). Only kitchen is gated: a tenant without a kitchen
    # (e.g. a pure-delivery cloud kitchen) genuinely should not reach KDS.
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
                "table.status.changed", "customer.updated"),
    kind="plugin",
    module_key="pos",
))

_register(ServiceDescriptor(
    name="kitchen",
    port=_port("kitchen", 8100, 4),
    db_name="restaurantos_kitchen",
    description="KDS stations, KOT tickets, KOT item status, status logs",
    permissions=("prepare:kot", "cancel:kot"),
    publishes=("kot.fired", "kot.acknowledged", "kot.ready", "kot.cancelled",
               "kot.item.status.changed"),
    subscribes=("order.placed", "order.status.changed"),
    kind="plugin",
    module_key="kitchen",
    # A tenant that has explicitly suspended its kitchen (e.g. a pure retail
    # or delivery-only branch) should not reach the KDS screens. Gating only
    # kitchen keeps POS/menu/billing reachable for every tenant.
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
                "grn.posted"),
))

_register(ServiceDescriptor(
    name="purchase",
    port=_port("purchase", 8100, 7),
    db_name="restaurantos_purchase",
    description="Vendors, purchase requests, POs, GRNs, vendor bills, vendor payments",
    permissions=("view:purchase", "manage:purchase"),
    publishes=("po.created", "po.approved", "grn.posted", "vendor_bill.created"),
    subscribes=("stock.out", "stock.low"),
))

_register(ServiceDescriptor(
    name="staff",
    port=_port("staff", 8100, 8),
    db_name="restaurantos_staff",
    description="Employees, rosters, attendance, tips, feedback, complaints",
    permissions=("view:staff", "manage:staff"),
    publishes=("attendance.marked", "tip.recorded"),
    subscribes=("bill.paid",),
))

_register(ServiceDescriptor(
    name="customers",
    port=_port("customers", 8100, 9),
    db_name="restaurantos_customers",
    description="Customers and their profiles",
    permissions=("view:customers", "manage:customers"),
    publishes=("customer.created", "customer.updated", "customer.deleted"),
    subscribes=("bill.paid",),
))

_register(ServiceDescriptor(
    name="loyalty",
    port=_port("loyalty", 8100, 10),
    db_name="restaurantos_loyalty",
    description="Loyalty programs, accounts, wallets, point transactions",
    permissions=("view:loyalty", "manage:loyalty"),
    publishes=("loyalty.points.earned", "loyalty.points.redeemed"),
    subscribes=("customer.created", "bill.paid"),
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
))

_register(ServiceDescriptor(
    name="reports",
    port=_port("reports", 8100, 12),
    db_name="restaurantos_reports",
    description="Read-model projections and analytics",
    permissions=("view:reports",),
    subscribes=("order.placed", "bill.paid", "stock.movement.created",
                "kot.ready", "attendance.marked"),
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


def get_descriptor(name: str) -> ServiceDescriptor | None:
    return _REGISTRY.get(name)


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
