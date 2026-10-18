"""Smoke-test the auth service against the real database.

Drives the full lifecycle: register -> login -> refresh -> rotate -> logout,
plus permission derivation, role management, and the negative cases that
matter for security (token reuse, wrong password, deactivated accounts,
cross-tenant isolation, privilege escalation).

Run against the service directly, or through the gateway:

    python smoke_auth.py                # direct, port 8100
    python smoke_auth.py --gateway      # through the edge, port 8000

The gateway run is the one that matters — it proves the unauthenticated
routes stay reachable through the edge, where the gateway does its own
token check.

Both runs expect a real Postgres and a real service; this is not a unit test.
Each run creates its own tenant, so repeated runs do not collide, and nothing
it creates is cleaned up.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
import uuid

ROOT = os.path.dirname(os.path.abspath(__file__))
RUN = uuid.uuid4().hex[:8]
sys.path.insert(0, ROOT)

from src.utils.security import create_access_token  # noqa: E402

# Default to the service's own port. ``--gateway`` points the same suite at the
# edge instead, which is the run that matters for the unauthenticated routes:
# /register, /login and /refresh carry no Authorization header, and the gateway
# rejects anything it cannot decode. AUTH_URL overrides either.
if "--gateway" in sys.argv:
    _DEFAULT = "http://127.0.0.1:8000/api/v1/auth"
else:
    _DEFAULT = "http://127.0.0.1:8100/api/v1/auth"
BASE = os.environ.get("AUTH_URL", _DEFAULT)

PASS, FAIL = [], []


def call(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, (json.loads(raw) if raw else None)
        except json.JSONDecodeError:
            return e.code, None


def check(label, condition, detail=""):
    (PASS if condition else FAIL).append(label)
    print(f"  [{'PASS' if condition else 'FAIL'}] {label}" + (f" — {detail}" if detail else ""))


def rows(payload):
    """A list response, or [] if the call failed.

    An error envelope is a dict, so iterating it yields strings and the next
    line dies with a TypeError instead of reporting the failure that caused it.
    """
    return payload if isinstance(payload, list) else []


print(f"\nAuth smoke test against {BASE}\n" + "=" * 62)

OWNER_EMAIL = f"owner-{RUN}@spiceroute.dev"
OWNER_PW = "correct-horse-battery"

# ─── 1. Register (unauthenticated, creates tenant + owner) ──────────────────

st, reg = call("POST", "/register", {
    "tenant_name": f"Spice Route {RUN}",
    "tenant_slug": f"spice-route-{RUN}",
    "email": OWNER_EMAIL,
    "password": OWNER_PW,
    "full_name": "Asha Menon",
})
check("register creates tenant + owner and returns tokens", st == 201, str(st))
check("register returns an access token", bool(reg and reg.get("access_token")), str(st))
check("register returns a refresh token", bool(reg and reg.get("refresh_token")), str(st))
check("expires_in is populated", bool(reg and reg.get("expires_in", 0) > 0),
      str(reg.get("expires_in") if reg else None))
owner_access = reg.get("access_token") if reg else None
owner_refresh = reg.get("refresh_token") if reg else None

st, dup = call("POST", "/register", {
    "tenant_name": "Dup", "tenant_slug": f"spice-route-{RUN}",
    "email": f"other-{RUN}@restaurantos.dev", "password": OWNER_PW, "full_name": "Dup",
})
check("duplicate tenant slug rejected (409)", st == 409, str(st))

st, _ = call("POST", "/register", {
    "tenant_name": "Bad", "tenant_slug": "Not Valid!", "email": "x@restaurantos.dev",
    "password": OWNER_PW, "full_name": "Bad",
})
check("invalid tenant slug rejected (422)", st == 422, str(st))

st, _ = call("POST", "/register", {
    "tenant_name": "Short Pw", "tenant_slug": f"short-{RUN}",
    "email": f"s-{RUN}@restaurantos.dev", "password": "abc", "full_name": "Short",
})
check("password under 8 chars rejected (422)", st == 422, str(st))

st, _ = call("POST", "/register", {
    "tenant_name": "Bad Email", "tenant_slug": f"be-{RUN}",
    "email": "not-an-email", "password": OWNER_PW, "full_name": "Bad",
})
check("malformed email rejected (422)", st == 422, str(st))

# ─── 2. The token actually works ────────────────────────────────────────────

st, me = call("GET", "/me", token=owner_access)
check("GET /me with the issued token", st == 200, str(st))
check("owner is flagged is_tenant_owner", bool(me and me.get("is_tenant_owner")), str(st))
check("owner starts active", (me or {}).get("status") == "active",
      (me or {}).get("status"))

st, _ = call("GET", "/me")
check("GET /me without a token rejected (401)", st == 401, str(st))

st, _ = call("GET", "/me", token="not.a.real.token")
check("GET /me with a garbage token rejected (401)", st == 401, str(st))

# ─── 3. Owner permissions come from the wildcard grant ──────────────────────

st, perms = call("GET", "/permissions", token=owner_access)
check("permission catalogue readable by owner", st == 200, str(st))
codes = {p["code"] for p in (perms or {}).get("permissions", [])} if isinstance(perms, dict) else set()
check("catalogue is non-trivial", len(codes) > 50, f"{len(codes)} codes")
check("catalogue has no malformed codes",
      not [c for c in codes if c.count(":") != 1 or c.startswith(":") or c.endswith(":")],
      str([c for c in codes if c.count(":") != 1][:5]))

# The bug this guards: the registry declared permissions=("view:reports") with
# no trailing comma, making it a string. Iterating it yielded characters.
check("catalogue has no single-character codes",
      not [c for c in codes if len(c) < 3], str([c for c in codes if len(c) < 3][:5]))

# ─── 4. Roles ───────────────────────────────────────────────────────────────

st, roles = call("GET", "/roles", token=owner_access)
check("default roles seeded on registration", st == 200, str(st))
role_slugs = {r["slug"] for r in rows(roles)}
check("seeded owner/manager/cashier roles present",
      {"owner", "manager", "cashier"}.issubset(role_slugs),
      str(sorted(role_slugs)))

st, dropped = call("POST", "/roles", {
    "name": "Menu Editor", "slug": f"menu-editor-{RUN}",
    "permissions": ["menu:*", "view:menu_items"],
}, token=owner_access)
check("create a custom role", st == 201, str(st))
check("wildcard resolves to concrete codes",
      bool(dropped and len(dropped.get("permissions", [])) == 2),
      str(dropped.get("permissions") if dropped else None))

st, _ = call("POST", "/roles", {
    "name": "Bad", "slug": f"bad-{RUN}", "permissions": ["typo:*"],
}, token=owner_access)
check("wildcard matching nothing rejected (422)", st == 422, str(st))

st, _ = call("POST", "/roles", {
    "name": "Bad2", "slug": f"bad2-{RUN}", "permissions": ["not:a:real:code"],
}, token=owner_access)
check("unknown permission code rejected (422)", st == 422, str(st))

st, _ = call("POST", "/roles", {
    "name": "Dup", "slug": f"menu-editor-{RUN}", "permissions": [],
}, token=owner_access)
check("duplicate role slug rejected (409)", st == 409, str(st))

# ─── 5. Users, and the permission boundary ──────────────────────────────────

CASHIER_EMAIL = f"cashier-{RUN}@spiceroute.dev"
CASHIER_PW = "till-drawer-99"
st, cashier = call("POST", "/users", {
    "email": CASHIER_EMAIL, "password": CASHIER_PW,
    "full_name": "Ravi Kumar", "role_slugs": ["cashier"],
}, token=owner_access)
check("owner creates a cashier", st == 201, str(st))
cashier_id = cashier.get("id") if cashier else None

st, _ = call("POST", "/users", {
    "email": CASHIER_EMAIL, "password": CASHIER_PW,
    "full_name": "Ravi Again", "role_slugs": ["cashier"],
}, token=owner_access)
check("duplicate email in tenant rejected (409)", st == 409, str(st))

st, users = call("GET", "/users", token=owner_access)
check("list users", st == 200 and any(u["id"] == cashier_id for u in rows(users)), str(st))

# A manager's own token must not let them create an owner.
st, mgr_login = call("POST", "/login", {"email": OWNER_EMAIL, "password": OWNER_PW})
st, mgr_role = call("POST", "/roles", {
    "name": "Scoped Manager", "slug": f"scoped-mgr-{RUN}",
    "permissions": ["manage:users"],
}, token=owner_access)
check("create a manage:users-only role", st == 201, str(st))

MGR_EMAIL = f"mgr-{RUN}@spiceroute.dev"
MGR_PW = "shift-lead-2026"
st, mgr = call("POST", "/users", {
    "email": MGR_EMAIL, "password": MGR_PW, "full_name": "Priya Nair",
    "role_slugs": [f"scoped-mgr-{RUN}"],
}, token=owner_access)
check("create a user with only manage:users", st == 201, str(st))

st, mgr_tokens = call("POST", "/login", {"email": MGR_EMAIL, "password": MGR_PW})
check("that user can log in", st == 200, str(st))
mgr_access = mgr_tokens.get("access_token") if mgr_tokens else None

st, _ = call("POST", "/users", {
    "email": f"escalate-{RUN}@restaurantos.dev", "password": OWNER_PW,
    "full_name": "Escalate", "is_tenant_owner": True,
}, token=mgr_access)
check("non-owner cannot create an owner (403)", st == 403, str(st))

st, _ = call("POST", "/roles", {
    "name": "Nope", "slug": f"nope-{RUN}", "permissions": ["*"],
}, token=mgr_access)
check("user without manage:roles cannot create roles (403)", st == 403, str(st))

# ─── 6. Login, and what it must not reveal ──────────────────────────────────

st, login = call("POST", "/login", {"email": OWNER_EMAIL, "password": OWNER_PW})
check("login with correct credentials", st == 200 and bool(login.get("access_token")), str(st))

st, wrong = call("POST", "/login", {"email": OWNER_EMAIL, "password": "wrong-password"})
check("login with wrong password rejected (401)", st == 401, str(st))
st2, nosuch = call("POST", "/login", {"email": f"ghost-{RUN}@restaurantos.dev", "password": "whatever"})
check("login for unknown email rejected (401)", st2 == 401, str(st2))
check("both failures return the same message (no user enumeration)",
      (wrong or {}).get("error", {}).get("message") == (nosuch or {}).get("error", {}).get("message"),
      f"{(wrong or {}).get('error', {}).get('message')!r} vs {(nosuch or {}).get('error', {}).get('message')!r}")

st, _ = call("POST", "/login", {"email": OWNER_EMAIL, "password": OWNER_PW,
                                "tenant_slug": "no-such-tenant"})
check("login with a bad tenant slug rejected (401)", st == 401, str(st))

# ─── 7. Refresh rotation and reuse detection ────────────────────────────────

st, pair = call("POST", "/login", {"email": OWNER_EMAIL, "password": OWNER_PW})
rt1 = pair.get("refresh_token") if pair else None

st, rotated = call("POST", "/refresh", {"refresh_token": rt1})
check("refresh exchanges a valid token", st == 200 and bool(rotated.get("access_token")), str(st))
st, me2 = call("GET", "/me", token=(rotated or {}).get("access_token"))
check("the refreshed access token works", st == 200, str(st))
check("rotation issues a NEW refresh token",
      bool(rotated) and rotated.get("refresh_token") != rt1, "")

# Replaying the spent token is the theft signal.
st, replay = call("POST", "/refresh", {"refresh_token": rt1})
check("reusing a spent refresh token rejected (401)", st == 401, str(st))

# ...and it must have revoked the whole family, including the rotated one.
st, _ = call("POST", "/refresh", {"refresh_token": (rotated or {}).get("refresh_token")})
check("reuse revoked the descendant token too (401)", st == 401, str(st))

st, fresh = call("POST", "/login", {"email": OWNER_EMAIL, "password": OWNER_PW})
check("owner can still log in after the revocation", st == 200, str(st))
owner_access = fresh.get("access_token") if fresh else owner_access

st, _ = call("POST", "/refresh", {"refresh_token": "not-a-real-refresh-token"})
check("bogus refresh token rejected (401)", st == 401, str(st))

# ─── 8. Logout ──────────────────────────────────────────────────────────────

st, pair = call("POST", "/login", {"email": OWNER_EMAIL, "password": OWNER_PW})
rt = pair.get("refresh_token") if pair else None
st, _ = call("POST", "/logout", {"refresh_token": rt})
check("logout returns 204", st == 204, str(st))
st, _ = call("POST", "/refresh", {"refresh_token": rt})
check("refresh after logout rejected (401)", st == 401, str(st))
st, _ = call("POST", "/logout", {"refresh_token": rt})
check("logout is idempotent (204 on an unknown token)", st == 204, str(st))

# ─── 9. Password change revokes sessions ────────────────────────────────────

st, pair = call("POST", "/login", {"email": OWNER_EMAIL, "password": OWNER_PW})
live_rt = pair.get("refresh_token") if pair else None
live_access = pair.get("access_token") if pair else None

NEW_PW = "a-brand-new-secret"
st, _ = call("POST", "/me/password",
             {"current_password": OWNER_PW, "new_password": NEW_PW}, token=live_access)
check("change own password (204)", st == 204, str(st))

st, _ = call("POST", "/refresh", {"refresh_token": live_rt})
check("password change revoked existing sessions (401)", st == 401, str(st))

st, _ = call("POST", "/login", {"email": OWNER_EMAIL, "password": OWNER_PW})
check("old password no longer works (401)", st == 401, str(st))

st, relog = call("POST", "/login", {"email": OWNER_EMAIL, "password": NEW_PW})
check("new password works", st == 200, str(st))
owner_access = relog.get("access_token") if relog else owner_access
OWNER_PW = NEW_PW

st, _ = call("POST", "/me/password",
             {"current_password": "not-the-password", "new_password": "whatever-123"},
             token=owner_access)
check("wrong current password rejected (400)", st == 400, str(st))

# ─── 10. Deactivation ends access ───────────────────────────────────────────

st, _ = call("PATCH", f"/users/{cashier_id}", {"status": "disabled"}, token=owner_access)
check("deactivate the cashier", st == 200, str(st))

st, _ = call("POST", "/login", {"email": CASHIER_EMAIL, "password": CASHIER_PW})
check("deactivated user cannot log in (403)", st == 403, str(st))

st, _ = call("PATCH", f"/users/{me['id']}", {"status": "disabled"}, token=owner_access)
check("cannot deactivate your own account (400)", st == 400, str(st))

# ─── 11. Cross-tenant isolation ─────────────────────────────────────────────

st, reg2 = call("POST", "/register", {
    "tenant_name": f"Other Kitchen {RUN}", "tenant_slug": f"other-{RUN}",
    "email": f"other-owner-{RUN}@restaurantos.dev", "password": OWNER_PW, "full_name": "Other",
})
check("register a second tenant", st == 201, str(st))
other_access = reg2.get("access_token") if reg2 else None

st, other_users = call("GET", "/users", token=other_access)
ids = {u["id"] for u in rows(other_users)}
check("second tenant does not see the first tenant's users",
      st == 200 and cashier_id not in ids, f"{len(ids)} users")

st, _ = call("GET", f"/users/{cashier_id}", token=other_access)
check("second tenant cannot fetch a foreign user (404)", st == 404, str(st))

# A token minted for a tenant the caller does not belong to must be honoured
# as that tenant — the tenant comes from the signed token, not the request.
forged = create_access_token(uuid.uuid4(), uuid.uuid4(),
                             claims={"permissions": ["*"], "is_tenant_owner": True})
st, forged_users = call("GET", "/users", token=forged)
check("a token for an unknown tenant sees no users",
      st == 200 and forged_users == [], f"{len(forged_users or [])} users")

# ─── 12. Outlet scoping in claims ───────────────────────────────────────────

st, scoped_role = call("POST", "/roles", {
    "name": "Kiosk Only", "slug": f"kiosk-{RUN}", "permissions": ["view:menu_items"],
}, token=owner_access)
check("create an outlet-scoped role", st == 201, str(st))
scoped_role_id = scoped_role.get("id") if scoped_role else None

OUTLET = str(uuid.uuid4())
st, kiosk = call("POST", "/users", {
    "email": f"kiosk-{RUN}@restaurantos.dev", "password": OWNER_PW, "full_name": "Kiosk",
}, token=owner_access)
kiosk_id = kiosk.get("id") if kiosk else None
check("create a user for outlet scoping", st == 201, str(st))

st, _ = call("POST", f"/users/{kiosk_id}/roles",
             {"role_slug": f"kiosk-{RUN}", "outlet_id": OUTLET}, token=owner_access)
check("grant a role scoped to one outlet", st == 200, str(st))

st, kiosk_login = call("POST", "/login", {"email": f"kiosk-{RUN}@restaurantos.dev", "password": OWNER_PW})
kiosk_access = kiosk_login.get("access_token") if kiosk_login else None

from src.utils.security import decode_access_token  # noqa: E402
claims = decode_access_token(kiosk_access) if kiosk_access else {}
check("outlet-scoped role lands in allowed_outlet_ids",
      str(OUTLET) in (claims.get("allowed_outlet_ids") or []),
      str(claims.get("allowed_outlet_ids")))
check("scoped role grants only its own permissions",
      set(claims.get("permissions") or []) == {"view:menu_items"},
      str(claims.get("permissions")))

st, owner_login = call("POST", "/login", {"email": OWNER_EMAIL, "password": OWNER_PW})
owner_access = owner_login.get("access_token") if owner_login else owner_access
owner_claims = decode_access_token(owner_access) if owner_access else {}
check("owner carries no outlet restriction (unrestricted)",
      (owner_claims.get("allowed_outlet_ids") or []) == [],
      str(owner_claims.get("allowed_outlet_ids")))
check("owner token carries a broad permission set",
      len(owner_claims.get("permissions") or []) > 50,
      f"{len(owner_claims.get('permissions') or [])} permissions")

print("\n" + "=" * 62)
print(f"  {len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("  FAILED: " + ", ".join(FAIL))
print("=" * 62 + "\n")
sys.exit(1 if FAIL else 0)
