"""Permission catalogue and default roles.

There are two sources of permission codes and they do not fully agree:

* ``src.utils.security.DEFAULT_PERMISSIONS`` — the legacy monolith's
  catalogue. Codes like ``manage:menu_items``, ``view:orders``.
* Each service's ``permissions=`` tuple in the registry. Codes like
  ``manage:menu``, ``manage:organization``.

The services check the *registry* codes (``identity.require("manage:menu")``),
and several of those appear nowhere in the legacy catalogue — so a role built
only from the legacy map grants ``manage:menu_items`` and then gets a 403 from
every menu write. This module is the single place that reconciles the two: the
catalogue is their union, and the default roles below grant the registry codes.

Wildcards are expanded at token-issue time by :func:`derived_permissions`, so
a role that grants ``menu:*`` keeps working when a new menu permission is
added. That is the reason roles store patterns rather than flat lists.
"""
from __future__ import annotations

from src.services.shared.registry import all_services
from src.utils.security import DEFAULT_PERMISSIONS
from src.utils.security import ROLE_PERMISSION_MAP as LEGACY_ROLE_MAP


def _catalogue() -> dict[str, tuple[str, str]]:
    """code -> (name, module). The union of both sources."""
    out: dict[str, tuple[str, str]] = {}

    for code, name, module, _description in DEFAULT_PERMISSIONS:
        out[code] = (name, module)

    # A service's declared permissions are authoritative for that service,
    # even when the legacy catalogue has never heard of the code.
    for descriptor in all_services():
        for code in descriptor.permissions:
            if code not in out:
                module = code.split(":", 1)[0] if ":" in code else descriptor.name
                out[code] = (code.replace(":", " ").replace("_", " ").title(), module)

    return out


PERMISSION_CATALOGUE: dict[str, tuple[str, str]] = _catalogue()

# Every valid code, for validation and wildcard expansion.
ALL_PERMISSION_CODES: frozenset[str] = frozenset(PERMISSION_CATALOGUE)

# module -> codes in it. Powers module wildcards like "menu:*".
_CODES_BY_MODULE: dict[str, set[str]] = {}
for _code, (_name, _module) in PERMISSION_CATALOGUE.items():
    _CODES_BY_MODULE.setdefault(_module, set()).add(_code)


def expand_wildcard(pattern: str) -> set[str]:
    """Resolve ``"<something>:*"`` to concrete codes.

    Two kinds of pattern, tried in this order:

    1. A **verb prefix** — ``"view:*"`` is every code starting ``view:``.
    2. A **module** — ``"menu:*"`` is every code whose module is ``menu``.
       Its codes are ``view:menu`` / ``manage:menu``, which do not start with
       ``menu:``, so a prefix match alone would silently grant nothing.

    The two do not collide: ``view`` and ``manage`` are verbs, never modules,
    and no module name is also a verb prefix.
    """
    stem = pattern[:-1]  # "menu:*" -> "menu:"
    by_prefix = {c for c in ALL_PERMISSION_CODES if c.startswith(stem)}
    if by_prefix:
        return by_prefix
    return set(_CODES_BY_MODULE.get(pattern[:-2], ()))  # "menu:*" -> "menu"


def derived_permissions(grants: list[str] | None) -> list[str]:
    """Expand a role's grant list into concrete codes.

    ``"view:*"`` and ``"menu:*"`` expand as described in
    :func:`expand_wildcard`; ``"*"`` expands to the whole catalogue. An exact
    code passes through unchanged — including one not in the catalogue, since
    a service may add a code before this module is regenerated. Unknown codes
    are kept rather than dropped, so a typo surfaces as a 403 on the one
    endpoint that uses it instead of silently vanishing here.
    """
    out: set[str] = set()
    for grant in grants or []:
        if grant == "*":
            out |= ALL_PERMISSION_CODES
        elif grant.endswith(":*"):
            out |= expand_wildcard(grant)
        else:
            out.add(grant)
    return sorted(out)


def unknown_permissions(grants: list[str] | None) -> list[str]:
    """Grants that resolve to nothing. Used to reject a role at creation time.

    A wildcard that matches no code is almost certainly a typo, and a role
    that silently grants nothing is worse than one that fails loudly.
    """
    bad: list[str] = []
    for grant in grants or []:
        if grant == "*":
            continue
        if grant.endswith(":*"):
            if not expand_wildcard(grant):
                bad.append(grant)
        elif grant not in ALL_PERMISSION_CODES:
            bad.append(grant)
    return bad


def modules() -> dict[str, int]:
    """Module -> how many codes it holds. For the catalogue endpoint."""
    return {m: len(c) for m, c in sorted(_CODES_BY_MODULE.items())}


# ─── Default roles ──────────────────────────────────────────────────────────
#
# Seeded per tenant at registration. These grant the *registry* codes the
# services actually check, plus the legacy codes staff-facing screens use.
# Wildcards keep them stable as services add permissions.

_TENANT_OWNER_GRANTS = ["*"]

_MANAGER_GRANTS = [
    "view:*",
    "manage:organization", "manage:outlets", "manage:tables",
    "manage:menu", "manage:recipes", "manage:pricing_rules",
    "manage:orders", "fire:kot", "view:kot", "cancel:kot",
    "manage:users", "view:roles",
    "manage:settings", "view:audit",
    # HRMS / staff-management (run payroll, manage employees, leaves, ATS).
    "view:hrms", "manage:hrms", "edit:hrms", "delete:hrms",
    "manage:hrms_employees",
    "view:hrms_attendance", "manage:hrms_attendance",
    "view:hrms_leaves", "manage:hrms_leaves",
    "view:hrms_payroll", "manage:hrms_payroll",
    "view:staff", "manage:staff",
]

_CASHIER_GRANTS = [
    "view:dashboard", "view:menu", "view:orders", "manage:orders", "fire:kot",
    "view:tables", "view:bills", "manage:bills", "settle:bills",
    "view:customers", "manage:customers", "view:reports", "view:sales_reports",
]

_CAPTAIN_GRANTS = [
    "view:dashboard", "view:menu", "view:orders", "manage:orders", "fire:kot",
    "view:tables", "manage:tables", "transfer:tables", "view:kot",
    "manage:reservations", "manage:waitlist", "view:bills", "manage:bills",
]

_KITCHEN_GRANTS = [
    "view:kot", "acknowledge:kot", "prepare:kot", "ready:kot", "serve:kot",
    "view:menu", "view:recipes",
]

_STORE_GRANTS = [
    "view:inventory", "manage:inventory", "view:stock", "adjust:stock",
    "manage:wastage", "manage:transfers", "receive:transfers",
    "view:purchase", "manage:purchase", "receive:grn", "view:vendors",
]

DEFAULT_ROLES: dict[str, dict] = {
    "owner": {
        "name": "Owner",
        "description": "Tenant owner. Full access, including billing and settings.",
        "permissions": _TENANT_OWNER_GRANTS,
    },
    "manager": {
        "name": "Manager",
        "description": "Runs day-to-day operations across all outlets.",
        "permissions": _MANAGER_GRANTS,
    },
    "cashier": {
        "name": "Cashier",
        "description": "Billing and settlement at the counter.",
        "permissions": _CASHIER_GRANTS,
    },
    "captain": {
        "name": "Captain",
        "description": "Takes orders and manages the floor.",
        "permissions": _CAPTAIN_GRANTS,
    },
    "kitchen": {
        "name": "Kitchen",
        "description": "Kitchen display — sees and progresses KOTs.",
        "permissions": _KITCHEN_GRANTS,
    },
    "store": {
        "name": "Store Keeper",
        "description": "Inventory, transfers and goods receipt.",
        "permissions": _STORE_GRANTS,
    },
}


def legacy_role_grants() -> dict[str, list[str]]:
    """The monolith's role definitions, for reference when migrating.

    Kept as a function rather than a module constant so importing this module
    does not depend on the legacy map's shape at import time.
    """
    return {name: list(codes) for name, codes in LEGACY_ROLE_MAP.items()}
