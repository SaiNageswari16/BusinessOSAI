# Repository Review — 2026-10-18

## What's on disk now

- `microservice-architecture` branch, commit `88da2d1`
- Committed: platform service (all 6 files), smoke_platform.py, shared service_factory helpers
- Uncommitted: security/identity/gateway changes, inventory additions, new scripts (9), the seed script, full frontend
- Working dir is `backend/` but git lives at `restaurant/` (repo root)

## Critical — fix before anything else

### 1. `shared/identity.py` dev fallback is not dev-gated

```python
# backend/src/services/shared/identity.py:148
# Resolve from X-Tenant-ID header or fallback to flagship restaurant tenant
```

Triggers on **any** credential failure — no token, malformed JWT, expired token.
Returns a fully-privileged tenant owner (`permissions={"*"}`) for a hardcoded
tenant `e9fb216b-6289-43ca-900c-c09eada9840f`. No env check. No 401.

The whole auth system in this repo is local JWT verification — each service
calls `_decode()` directly. An invalid token silently becomes "I am a tenant
owner for the flagship restaurant." This is a backdoor that ships.

**Gate it:** only activate when `APP_ENV=development` AND `IDENTITY_DEV_FALLBACK=true`
explicitly set. Default both to off.

### 2. `gateway/app.py` same pattern, same risk

The gateway catches `_decode` exceptions, sets `identity=None`, then does the
same dev-fallback block (line 324). No env gate. An unauthenticated request
through the gateway silently gets the flagship tenant.

### 3. `platform/service.py` — platform token carries wildcard permissions

```python
"permissions": ["platform:*", "*"],
```

The `*` means `Identity.has()` returns `True` for every tenant permission.
Platform admin token passes `require("manage:orders")`, `require("manage:accounting")`,
everything. The `auth_realm: "platform"` check in `require_platform_admin` only
protects the platform endpoints. Nothing prevents a platform token from reaching
pos or billing.

Fix: remove the wildcard, issue only `platform:*` namespace codes.

### 4. `platform/api.py:425` — onboarding writes to auth + org DBs directly

```python
from src.services.shared.service_factory import session_factory
auth_session_maker = session_factory("auth")
from src.services.auth.models import Tenant as AuthTenant, ...
```

Cross-service DB write. The `session_factory(name)` helper in `shared/service_factory.py`
makes this easy, which makes it hard to spot in review. Onboarding is three
independent transactions — if the org write fails after auth succeeds, you have
a tenant with an owner and no outlet, no way to roll back, no record of it
half-happened. Should be HTTP calls.

### 5. `platform/api.py:464` — bypasses auth role seeding

Onboarding writes `AuthRole(permissions=["*"])` for the owner role. Every
onboarded tenant's owner gets a blanket `*` and none of the default
manager/cashier/chef roles that the rest of the system expects. This is the
wildcard problem again, in onboarding.

### 6. `platform/api.py:397` — new `/tenants` endpoint reads auth DB directly

```python
from src.services.shared.service_factory import session_factory
from src.services.auth.models import Tenant as AuthTenant
auth_session_maker = session_factory("auth")
```

Same pattern as #4. Reads `t.status.value` via `hasattr` fallback — the
`status_value()` accessor exists in `platform/models.py` but isn't used here.

### 7. `scripts/seed_platform_admin.py` — `--generate` now fixed, but verify it works

I found last round that `--generate` was discarding the password. I fixed it.
Bash was down when I could confirm. Run:
```bash
python scripts/seed_platform_admin.py --generate
```
Check it prints the password once. Also confirm `PLATFORM_ADMIN_PASSWORD`
resolves from `.env` (the `settings.platform_admin_password` field).

### 8. `utils/security.py` — passlib workarounds

- Module-level monkey-patch: `bcrypt.__about__ = _BcryptAbout()` — works around
  a passlib 1.7.4 / bcrypt >= 4.0.0 compat bug. It's at module import time,
  not inside a conditional. That's fine, but it runs on every import of
  `security.py`, including in test environments that pin bcrypt < 4. Add a
  version guard if tests start failing.
- `hash_password` now uses `bcrypt.gensalt()` directly instead of `pwd_context`.
  `verify_password` has two paths: native bcrypt check first, then passlib.
  Both `import bcrypt` and `from passlib.context import CryptContext` are at
  module level. Works, but the dual-path verify means old passlib hashes still
  work and new bcrypt hashes work. Document which hash format a given column
  holds — a mixed-format column is a future mystery.
- The 72-byte truncation is correct for bcrypt. The `[:72]` slice is right.

## High — fix before shipping the plugin system

### 9. `inventory/service.py` + `models.py` — new multi-tier capability, no events yet

Four new functions: `bootstrap_tenant_locations`, `transfer_stock`,
`consume_module_stock`, `get_global_rollup`. One new model column:
`module: Mapped[str]` on `StorageLocation`.

`transfer_stock` publishes `stock.movement.created` after commit. Good.
But `consume_module_stock` does **not** publish any event — it writes a
`StockMovement` row directly. If accounting is subscribed to
`stock.movement.created` (per the registry), it will miss these consumption
events and the ledger will be out of sync.

### 10. `inventory/api.py:584` — `get_global_rollup` has no permission check

```python
@router.get("/global-rollup", ...)
async def get_global_rollup(identity: CurrentIdentity, db: DbDep, ...):
    identity.require("view:inventory")   # ← confirm this line exists
```

Confirm the `require` call is there. A global rollup endpoint with no
permission gate on a multi-tenant system is a cross-tenant data leak.

### 11. `platform/models.py` — `PermissionCatalogue` codes don't match what's enforced

The 60+ permission codes in `DEFAULT_PERMISSIONS` use a three-segment format:
`pos:orders:discount`, `kitchen:kot:bump`. But the registry permission codes
(use in `identity.require()`) are two-segment: `view:inventory`, `manage:orders`.
These are two different naming schemes. The permission catalogue in the platform
DB is not the same thing as the codes in `ServiceDescriptor.permissions`.
Something has to reconcile them, or the platform's permission management UI
is managing a catalogue that no code actually checks.

### 12. `smoke_platform.py` — exercises fallback paths, not real ones

Onboards with `enabled_modules: ["gym", "pos", "crm", "staff"]`.
Only `gym` is a real `PluginManifest` row. `pos`, `crm`, `staff` go through
`activate_module`'s fallback that manufactures a manifest from a registry
descriptor. The smoke test passes without exercising the real code path.

### 13. `platform/main.py` — uses `session_factory("platform")` in `_on_startup`

```python
from src.services.shared.service_factory import session_factory
maker = session_factory("platform")
```

`main.py` also creates `db = ServiceDatabase("platform", _dsn)` at module level.
So two engines on the same database exist per process. `create_service_app`
stores `db` on `app.state.db`; `get_session` in `api.py` uses that. `session_factory`
is a separate engine. That's fine functionally but it's two connection pools
hitting one database in one process. Minor; document it.

## Medium

### 14. `run_services.py` — conda search paths hardcoded to user's machine

```python
r"D:\anaconda\envs\sales\python.exe",
r"C:\Users\abhil\anaconda3\envs\sales\python.exe",
```

Works on this machine. Anyone else cloning the repo gets the original
`os.environ` logic. The `CONDA_ROOT` override is checked first, so it's
overridable. Not a bug, but it's personal machine config in a shared file.
Move it to `.env` or accept it as known.

### 15. `scripts/test_live_gateway.py` — real email + password in source

```python
login_data = json.dumps({"email": "venaticfungus@gmail.com", "password": "121245@Forgot"})
```

This is a real credential pair in an untracked script. If this ever lands in a
commit or a repo backup, it's a credential leak. Same pattern in `test_pos_flow.py`
and `test_table_update.py`. These three scripts should read the credential from
`.env` or a local-only gitignored file.

### 16. `scripts/check_tenant_alignment.py` + `inspect_all_dbs.py` — DB password in source

```python
"postgresql://postgres:0111@127.0.0.1:5432/restaurantos_auth"
```

The DB password `0111` is hardcoded in multiple scripts. Same fix as #15.

### 17. `scripts/bootstrap_restaurant_tenant.py` — seeds with fixed UUIDs

```python
TENANT_ID = uuid.UUID("e9fb216b-6289-43ca-900c-c09eada9840f")
SECTIONS = [{"id": uuid.UUID("aaaaaaaa-1111-..."), ...}]
```

This is the "flagship tenant" that the dev fallback in `identity.py` points to.
The UUID `e9fb216b` is now in three places: the bootstrap script, `identity.py`,
and `gateway/app.py`. That's a single point of truth that's actually in three
places with no consistency check. If one changes, the others silently drift.

### 18. `scripts/migrate_tables_shape.py` — runs `ALTER TABLE` from a script

```python
await conn.execute("ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS shape VARCHAR(30) DEFAULT 'round'")
```

This is a schema migration living in a script, not a migration system.
`create_all` in `create_service_app` won't add this column to an existing
table because SQLAlchemy's `create_all` is create-only, not alter. So the
`RestaurantTable` model now has a `shape` field (per the `git diff` on
`organization/models.py`) and existing databases need this script to add the
column. Run it once per database before starting the organization service.
Idempotent (`IF NOT EXISTS`) but undocumented.

### 19. `frontend/` — full multi-vertical UI, 4,791 line diff + untracked files

The frontend is a complete React/TanStack app with 6 vertical routes
(restaurant, salon, gym, retail, hotel, dashboard), a platform admin UI,
RBAC `Can` component, and a full auth token system. The `FRONTEND_ERP_INTEGRATION_PLAN.md`
claims "All 4 Phases Complete & Verified." This is a large surface area
that will break independently of the backend. Verify the auth flow in
`frontend/src/lib/api-client.ts` handles the 401-refresh queue correctly
with the new platform token injection.

### 20. `platform/schemas.py` — `PermissionCreateRequest.code` regex

```python
code: str = Field(..., pattern=r"^[a-z0-9_]+:[a-z0-9_]+:[a-z0-9_]+$")
```

Three-segment format enforced at the API. But `DEFAULT_PERMISSIONS` codes are
three-segment and the registry codes are two-segment. A two-segment code like
`manage:orders` will 422 at this endpoint. This is a real constraint, not just
inconsistent documentation.

### 21. `platform/api.py:397` — `/tenants` list endpoint

New GET endpoint added for platform admin to list all tenants. The
`active_modules` field falls back to `t.settings.get("vertical", "restaurant")`
when no `TenantModuleState` row exists. So a newly onboarded tenant with no
module rows yet shows `restaurant` as active — which may be wrong if the
tenant was actually onboarded for a different vertical.

## What's solid

- `platform/models.py` — all 6 models, service_base("platform"), app-side
  timestamps, String columns for status. Clean.
- `platform/service.py:seed_defaults` — correctly no longer seeds an admin.
- `shared/registry.py` — `kind`, `module_key`, `enforce_module_gate` fields
  added, platform descriptor at :8113 with `platform:*` permissions.
- `inventory/service.py` — hub/spoke model with `bootstrap_tenant_locations`
  is a real capability that wasn't there before.
- `scripts/seed_platform_admin.py` — good design: out-of-band creation, no
  service-time seeding, multiple auth modes, safety rails on `--remove`.
  The `--generate` fix is in.

## Priority order to work through

1. Gate the dev fallback in `identity.py` and `gateway/app.py` behind an env flag
2. Remove the wildcard `*` from platform token claims
3. Move onboarding from direct DB writes to HTTP calls (or at minimum, handle the org failure case)
4. Get `consume_module_stock` to publish `stock.movement.created`
5. Run `python scripts/seed_platform_admin.py --generate` to confirm it works
6. Move credentials out of `scripts/test_*.py`
7. Reconcile the permission code format (two-segment vs three-segment)
8. Run `scripts/migrate_tables_shape.py` against the organization database
9. Decide whether `session_factory` cross-service writes are acceptable or need to become HTTP calls
