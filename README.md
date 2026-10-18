# RestaurantOS — Backend

A microservices backend for restaurant operations: menu, floor/table management,
orders, kitchen, billing, inventory, and the rest of the target architecture in
[`PLAN.md`](PLAN.md).

**Current status:** 2 of 13 services are implemented — `organization` and
`menu`. See [Implementation status](#implementation-status).

---

## Quick start

From a clean machine with nothing installed:

```bash
# 1. Environment
conda create -n sales python=3.11 -y
conda activate sales
pip install -r requirements.txt

# 2. Configure
cp .env.example .env

# 3. Create the databases and tables
python scripts/bootstrap_schema.py

# 4. Verify the schema is correctly isolated
python scripts/verify_schema.py

# 5. Start the services
python run_services.py start
```

Step 5 also runs step 3 for any service that needs it, so 3 and 5 are
independently sufficient — but running 3 first means you see any schema error
before the services start.

> `conda run -n sales ...` is broken in this environment's conda 25.11.1 (it
> crashes with an unhandled error). Use `conda activate sales`, or call the
> interpreter directly at `C:\Users\abhil\anaconda3\envs\sales\python.exe`.

### Configuration

`.env` holds the Postgres connection:

| Variable | Default | Meaning |
|---|---|---|
| `POSTGRES_HOST` | `localhost` | Postgres host |
| `POSTGRES_PORT` | `5432` | Postgres port |
| `POSTGRES_USER` | `postgres` | Postgres user |
| `POSTGRES_PASSWORD` | — | **Set this** |
| `POSTGRES_DB` | `restaurantos` | Legacy monolith database |
| `DATABASE_URL` | *(empty)* | Overrides the five above entirely |

Each service's own database is `restaurantos_<name>`, resolved from the
registry in `src/services/shared/registry.py`. Per-service overrides:
`SERVICE_DATABASE_URL` or `DATABASE_URL_<NAME>`.

Other useful settings:

| Variable | Default | Meaning |
|---|---|---|
| `AUTO_CREATE_SCHEMA` | `true` | Services create their own schema on startup |
| `SKIP_MIGRATE` | unset | `1`/`true` makes `run_services.py start` skip the pre-flight migration |
| `SEED_DEMO_DATA` | `true` | Seed demo data on first boot |
| `PYTHON_BIN` | *(auto)* | Override the interpreter `run_services.py` uses |

---

## Architecture

One database per service. No service reads another's database, and no foreign
key crosses a service boundary — cross-service references are bare UUID
columns, and cross-service data is reached by HTTP call through the gateway.

```
                         ┌──────────────────┐
                         │  gateway  :8000  │
                         └────────┬─────────┘
              ┌──────────┬────────┼────────┬────────────┐
         ┌────▼────┐ ┌───▼───┐ ┌──▼───┐ ┌──▼────┐ ┌─────▼─────┐
         │ auth    │ │ org   │ │ menu │ │ pos   │ │ kitchen   │ ...
         │ :8100   │ │ :8101 │ │ :8102│ │ :8103 │ │ :8104     │
         └────┬────┘ └───┬───┘ └──┬───┘ └──┬────┘ └─────┬─────┘
              │          │        │       │            │
      restaurantos_auth  │  restaurantos_menu
                   restaurantos_organization
```

### The registry

Every service is declared once, in `src/services/shared/registry.py`:

```python
_register(ServiceDescriptor(
    name="menu",
    port=_port("menu", 8100, 2),        # 8102, or SERVICE_PORT_MENU
    db_name="restaurantos_menu",
    description="...",
    permissions=(...),
    publishes=(...),
    subscribes=(...),
))
```

To add a service: add an entry here, create `src/services/<name>/` with
`models.py`, `api.py`, and `main.py`. To remove one: delete its directory and
its registry entry.

| Service | Port | Database | Status |
|---|---|---|---|
| `auth` | 8100 | `restaurantos_auth` | not implemented |
| `organization` | 8101 | `restaurantos_organization` | **implemented** |
| `menu` | 8102 | `restaurantos_menu` | **implemented** |
| `pos` | 8103 | `restaurantos_pos` | not implemented |
| `kitchen` | 8104 | `restaurantos_kitchen` | not implemented |
| `billing` | 8105 | `restaurantos_billing` | not implemented |
| `inventory` | 8106 | `restaurantos_inventory` | not implemented |
| `purchase` | 8107 | `restaurantos_purchase` | not implemented |
| `staff` | 8108 | `restaurantos_staff` | not implemented |
| `customers` | 8109 | `restaurantos_customers` | not implemented |
| `loyalty` | 8110 | `restaurantos_loyalty` | not implemented |
| `accounting` | 8111 | `restaurantos_accounting` | not implemented |
| `reports` | 8112 | `restaurantos_reports` | not implemented |

### Adding a service

`src/services/menu/` is the reference. It needs three files:

**`models.py`** — tables, registered on this service's own base:

```python
from src.services.shared.service_db import service_base

ServiceBase = service_base("menu")   # NOT a shared base

class MenuCategory(ServiceBase, TimestampMixin):
    ...
```

**`api.py`** — a plain `APIRouter`. Mount it in `main.py`.

**`main.py`** — the ASGI app. **Import order matters here:** models must be
imported before `build_service`/`create_service_app` runs, or the service's
tables are not on its registry yet and startup creates an empty database.

```python
from src.services.menu import models      # noqa: F401  — must come first
from src.services.menu.api import router
from src.services.shared.service_factory import build_service

app, db = build_service("menu", routers=[router], tags=TAGS)
```

---

## Schema management

### The isolation rule

Each service's tables live in **that service's registry and nowhere else**.
`service_base(name)` returns a base with its own `MetaData` *and* its own
registry:

```python
def service_base(service_name: str) -> type[DeclarativeBase]:
    if service_name not in _BASES:
        _BASES[service_name] = declarative_base(
            metadata=MetaData(),                    # own MetaData
            name=f"{service_name.title()}ServiceBase",
        )
    return _BASES[service_name]
```

Both parts are load-bearing, and getting either wrong fails in a way that
looks like something else:

- **A subclass inherits `metadata`.** Writing `type(name, (ServiceBase,), ...)`
  gives the new base its parent's `MetaData` by attribute lookup, so every
  service's tables land in one shared registry. A single `create_all()` then
  emits every service's DDL into whatever database it is pointed at — this is
  the original bug, and it silently produced two databases with the same 18
  tables.
- **`cls=` keeps the parent's registry.** Passing `cls=ServiceBase` to
  `declarative_base` shares the mapper registry, so every model gets a primary
  mapper twice and import fails with
  `ArgumentError: Class 'X' already has a primary mapper defined.` That error
  is what made the services report "no models yet" — their models could not
  import at all.

`ServiceBase` itself is now a typed fallback for helpers that don't care which
service they're touching. Nothing maps tables onto it.

### Creating schemas

```bash
python scripts/bootstrap_schema.py              # all services
python scripts/bootstrap_schema.py menu         # only named ones
python scripts/bootstrap_schema.py --prune      # also drop foreign tables
```

This is idempotent. It creates each database (via the `postgres` maintenance
database, in `AUTOCOMMIT`, since Postgres rejects `CREATE DATABASE` inside a
transaction), then creates only that service's own tables. `--prune` is the
repair for a database that already has the wrong tables: it drops only tables
the service does *not* own, so a service's own data survives.

Services also create their own schema at startup — `ensure_service_schema()` in
`src/services/shared/service_app.py`, called from each service's lifespan. That
reads the service's own registry directly rather than importing every service's
models, so one service's broken import can't stop another from booting.

### Verifying

```bash
python scripts/verify_schema.py     # metadata isolation AND actual DB contents
python scripts/check_models.py      # why a service's models won't import
python scripts/list_tables.py       # what tables are actually in each database
```

`verify_schema.py` is the one to run after any schema change. It checks two
independent things: that no table is registered by two services, and that the
databases themselves contain only their own tables. It prints
`OK — every service's schema is isolated` when both hold.

`check_models.py` exists because `bootstrap_schema.py` reports a service whose
models *fail to import* the same way it reports one that has *no models* —
`no models yet`. Both are logged at different levels, but the summary line
looks identical. `check_models.py` prints the traceback so the two are
distinguishable, and asserts the isolation rule directly.

---

## Implementation status

**Implemented and working:** `organization`, `menu`.

The other 11 services exist as registry entries and get an empty database.
They start, report `no models yet`, and answer health checks — they just have
no endpoints.

### Legacy monolith

`src/models/`, `src/api/`, and `src/services/*.py` are the original
single-database application. It still runs against `restaurantos`. The
microservice split is additive: nothing there has been deleted, so the old app
keeps working while the new services come up.

`scripts/migrate_shared_to_services.py` copies organization data from the
legacy `restaurantos` database into `restaurantos_organization`.

---

## Development

### Running

```bash
python run_services.py start          # create schemas, then start everything
python run_services.py status
python run_services.py stop
python run_services.py restart
python run_services.py restart menu   # just one
python run_services.py migrate        # create schemas only, don't start
```

A single service directly:

```bash
python -m uvicorn src.services.menu.main:app --port 8102
```

Logs go to `backend/.services/logs/<service>.log`, PIDs to
`backend/.services/<service>.pid`. The directory is created on first `start`.

```powershell
# follow one service's log
Get-Content backend\.services\logs\menu.log -Wait -Tail 50
```

### Layout

```
backend/
├── run_services.py              process manager
├── scripts/
│   ├── bootstrap_schema.py      create databases + tables
│   ├── verify_schema.py         assert schema isolation
│   ├── check_models.py          diagnose model import failures
│   ├── list_tables.py           dump what's in each database
│   └── migrate_shared_to_services.py
├── src/
│   ├── config/settings.py       .env-backed settings
│   ├── database/                legacy monolith's base + init_db
│   ├── models/                  legacy monolith's models
│   ├── api/                     legacy monolith's routes
│   ├── services/                ← the microservices live here
│   │   ├── shared/
│   │   │   ├── registry.py          service manifest
│   │   │   ├── service_db.py        engine/session + service_base()
│   │   │   ├── service_app.py       shared app factory + schema bootstrap
│   │   │   ├── service_factory.py   build_service()
│   │   │   └── schema_bootstrap.py  CREATE DATABASE / CREATE TABLE
│   │   ├── organization/{models,api,main}.py
│   │   └── menu/{models,api,main}.py
│   └── gateway/main.py          API gateway
```

### Conventions

- **Never a foreign key across a service boundary.** `outlet_id` in the menu
  database is a bare UUID. The gateway resolves it by HTTP call.
- **Each service's models import their own base.** `service_base("<name>")`,
  never a shared or inherited one.
- **Models are imported before the app is built.** See
  [Adding a service](#adding-a-service).
- **Migrations are `create_all` only.** There is no Alembic yet. Adding a
  column to an existing table means either writing it by hand or dropping and
  re-seeding — this is the main thing standing between here and production.
- **The legacy app is read-only in practice.** New work goes in
  `src/services/`.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Two databases have the same tables | A shared `MetaData` somewhere | `python scripts/verify_schema.py`, then `bootstrap_schema.py --prune` |
| `already has a primary mapper defined` | `service_base()` shared a registry | Make sure `declarative_base()` is called without `cls=` |
| Service says `no models yet` | Its `models.py` failed to import | `python scripts/check_models.py <service>` |
| A service starts but its tables are empty | `models` imported after the app was built | Reorder `main.py` — models first |
| `CREATE DATABASE` fails | Postgres won't run it in a transaction | Use `bootstrap_schema.py`, which connects to `postgres` in `AUTOCOMMIT` |
| `Bootstrap failed for 'x': 'Table' object has no attribute 'exists'` | `Table` has no `exists()` | Use `inspect(conn).has_table(...)` — see `create_tables` |
| `SystemError: <built-in function kill> returned a result with an exception set` | `os.kill(pid, 0)` on Windows raises `SystemError`, not `OSError` | Use `_pid_alive()`, which shells out to `tasklist` |
| Gateway `/health` hangs for ~20s | It probed 13 services one at a time | Already fixed — it now probes concurrently |
| `status` shows the gateway as `starting` | Its 3s health timeout was too short | Already fixed — now 25s |
| A service shows `down` but works | A stale PID file was deleted on read | Already fixed — `_pid_alive` checks `tasklist` |
| `bus: degraded` | Redis isn't running | Expected. Events are delivered in-process only |
| `conda run -n sales` crashes | Broken conda 25.11.1 | Use `conda activate sales` |
| Port already in use | Stale process | `python run_services.py restart` |
