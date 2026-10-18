# RestaurantOS — Dynamic Plugin Platform Blueprint (v2)

**Goal:** a platform where *any* service module — restaurant, salon, gym, retail, clinic,
car wash, ticketing, anything — can be added or removed for any tenant without touching
shared code, and where the Platform Admin has a real, complete, audited control plane.

This replaces `ENTERPRISE_ERP_PLAN.md`. The original defined the *destination* well and the
*mechanism* loosely. This version makes the mechanism precise enough to build against.

---

## 0. Read this first: what "fully dynamic" actually buys you

Three layers. Confusing them is the single most common way plans like this become lies.

| Layer | What changes | Who changes it | Latency |
|---|---|---|---|
| **1. Arrival** — code exists | A plugin directory + manifest is deployed | CI / deploy | Minutes |
| **2. Registration** — the platform knows about it | Manifest is validated and indexed | On deploy, automatically | Seconds |
| **3. Activation** — a tenant has it on | Per-tenant state row flips to ACTIVE | **Platform Admin, at runtime** | **Instant** |

- **Layer 3 is fully dynamic.** A tenant goes from "no gym" to "gym live" in one admin
  click, no deploy, no restart. That is the real deliverable.
- **Layer 1 is a deployment.** New *code* cannot materialise in a running Python process
  without a deploy. Do not promise otherwise — nobody else can either, and the promise
  collapses on contact with production.
- **Layer 2 is validation, not authoring.** Manifests are checked-in data, machine-validated
  against a schema. No free-form module code.

**So: "anything can be plugged in" means "anything that ships as a conformant plugin."**
That is a strong guarantee, not a vague one — it is enforced by the conformance suite
(§11), which is what makes N-vertical possible instead of 4-vertical.

The one architectural rule that makes it all hold:

> **A plugin never modifies a core engine.** If activating a plugin requires changing core
> code, either a core primitive is missing (build it once, in core) or the plugin is
> modelled wrong (fix the model). No exceptions, ever.

---

## 1. Two corrections to v1

**v1 says the super admin "provisions databases".** That is not what this codebase does,
and it should not start doing it. Every service carries a bare `tenant_id` column and
filters on it — the pattern is already everywhere. **Shared schema, tenant-scoped rows,
enforced by Postgres Row-Level Security (§8).** Dedicated-DB tenants are a documented
escape hatch for regulated enterprise contracts, not the default. Per-tenant DB
provisioning is a years-long sharding project that buys nothing for the goal.

**v1 lists 4 verticals.** The list is the wrong abstraction. Verticals are *compositions of
capabilities* (§7). Once capabilities exist, salon/gym/retail are not 4 modules — they are
4 recipes over the same 6 primitives. That is what "anything" actually means.

---

## 2. The plugin contract

A plugin is a directory plus a manifest. The manifest is the entire interface between a
module and the platform — code reads nothing about it except by asking the registry.

```yaml
# plugins/car_wash/plugin.yaml  (illustrative — this is a NEW vertical, not one from v1)
id: plugin.carwash
version: 1.4.0
min_platform: 2.0            # refuses to activate on an older core
title: Car Wash & detailing

capabilities:                # core primitives this plugin consumes (§7)
  - catalog
  - metering                 # machine-hours, water usage
  - access                   # bay reservations
  - recurring                # unlimited-wash membership

entities:                    # data it OWNS. Lives in the plugin's own tables.
  car_bays:        { label: Bays,           singular: Bay }
  wash_cycles:    { label: Wash Cycles,    singular: "Wash Cycle" }
  membership_cards:{ label: Cards,         singular: Card }

permissions:                 # resolved through the dynamic permission engine (§6)
  view:car_bays
  manage:car_bays
  manage:wash_cycles
  override:machine_rate

events:                      # the ONLY way this plugin talks to the rest (§5)
  publishes: [cycle.started, cycle.completed, membership.renewed]
  subscribes: [billing.bill.paid, inventory.stock.low]

navigation:                  # UI is data-driven off this
  - key: carwash
    label: Car Wash
    icon: car
    children: [car_bays, wash_cycles, membership_cards]

settings_schema:             # JSON Schema — per-tenant config, no deploy to change
  type: object
  properties:
    machine_count:  { type: integer, minimum: 1, maximum: 64 }
    deposit_pct:    { type: number,   minimum: 0,  maximum: 0.5 }
    allow_walkins:  { type: boolean,  default: true }

hooks:                       # named extension points, opt-in
  on_order_paid: carwash.hooks.on_order_paid

data_policy:                 # what happens on deactivation (§3)
  export_on_deactivate: true
  retain_tables: true        # never drop
```

**A plugin may not have:** its own gateway route prefix outside the registry, direct reads
of another service's database, a global event subscription without a matching `subscribes`
declaration, or a permission code that is not in its manifest.

The manifest is validated at deploy time by `register_plugin()`. A bad manifest is a
failed deploy, not a runtime surprise.

---

## 3. Module lifecycle — a state machine, not a boolean

v1 had `enabled: true/false`. That is insufficient and is the source of v1's ugliest
unsolved problem ("what happens to the data?"). Replace with an explicit machine:

```
        deploy            validate            activate
NOT_INSTALLED ───────► INSTALLED ──────► MIGRATING ──────► ACTIVE
                         │                    │               │  │
                         │                     └── fail ──► INSTALL_FAILED
                         │                                        │
                         └── uninstall                       suspend
                                                              │
                                                              ▼
      ┌────────────────────────────────────────────── SUSPENDED
      │                                                   │
      └────────── reactivate (schema OK) ◄────────────────┘
                                                            │
                                          archive ─────────► ARCHIVED
                                                            │
                                                (read-only, retained forever)
```

Rules:

1. **Activation records versions.** `TenantModuleState` stores `activated_version` and
   `schema_version`. Enabling a plugin at `1.4.0` against data migrated to `1.2.0` is
   refused with a specific error — this is exactly the "re-enable after a migration while
   it was off" case v1 never addressed.
2. **Suspension is a soft stop.** Routing to the plugin's endpoints goes 404, event
   subscriptions go inert, navigation disappears. **Tables are untouched.** Re-activation
   is safe and reversible.
3. **Archival is terminal and honest.** Read-only API preserved for audit and for
   statutory retention windows (GST demands 5+ years). Nothing is deleted on any path.
4. **Migration is a distinct, lockable state.** A tenant mid-migration is not `ACTIVE`;
   other migrations against that tenant queue. Concurrent migrations are a data-loss
   vector and must not be possible.

State lives in the auth/platform domain:

```python
class TenantModuleState:
    tenant_id, plugin_id, state, activated_version, schema_version,
    config          JSONB   -- validated against settings_schema
    enabled_at, suspended_at, archived_at, activated_by (platform admin id)
```

---

## 4. Registry — replace the global `enabled` flag

Today, `src/services/shared/registry.py` has `enabled: bool` on every
`ServiceDescriptor`, which is process-global: it answers the same question for every
tenant. Delete that field and the concept. Replace with:

- **`ServiceDescriptor`** — static deployment facts: port, db name, route prefix,
  declared events, declared permissions, whether it is `core` or `plugin`.
- **`PluginManifest`** — the §2 document, indexed in a table at deploy time.
- **`TenantModuleState`** — the per-tenant, mutable, runtime state (§3).

Gateway resolution becomes a three-way join:
`route → descriptor → manifest → TenantModuleState(tenant, plugin)`. Disabled → 404 with
the standard `ErrorEnvelope`. Core services skip step 3 and are always on.

This is a small change with large consequences: it is the first place in the system where
"this tenant has gym, that tenant does not" is *true in code*.

---

## 5. The event bus is the plugin API — and it needs four things

The bus in `src/services/event_bus/bus.py` is already the right shape: Redis Streams,
**per-service consumer groups** (the shared-group bug is fixed and must never regress),
at-least-once delivery, local fallback with buffer flush. Keep it. Add four things, in
this order — every one is load-bearing:

**(a) Outbox.** A domain change and its event must commit in one transaction, in one
database. A service writes `(outbox.id, event_id, type, payload, occurred_at)` alongside
its data change; a relay process drains outboxes into Redis.
*Without this, a crash between the commit and the publish is a permanent revenue-with-no
journal-entry discrepancy, and that surfaces in the ledger, not as a bug report.*

**(b) Idempotency ledger.** `event_id` already exists on the envelope. Every consumer
records `(service, event_id)` in a `idempotency_ledger` table and checks before
dispatching. Handlers may assume they run once; the bus guarantees it. This is what makes
at-least-once delivery safe instead of merely tolerable.

**(c) Dead-letter + replay.** An event that fails N times (configurable) moves to a
`ros:events:dlq` stream with the last exception attached. The Platform Admin portal lists
it and can replay to a specific tenant. **An unrecoverable dropped event must never be
silent** — silent dead-lettering has already been seen in this codebase, and it was the
hardest failure to diagnose.

**(d) Reconciliation.** A scheduled job that compares source-of-truth counts across
service boundaries and reports the delta: `count(bill.paid) == count(journal_entry
where reference_type='bill')`, `count(grn.posted) == count(stock_movement from grn)`, etc.
A few declarative invariants, run hourly, surfaced in the audit vault. This is cheap, and
it is the only reason the platform can be trusted when something else is wrong.

**Event contracts are typed, not free-form.** Each declared event has a versioned JSON
Schema owned by the publisher. Subscribers are checked against the schema at deploy time.
This is the difference between "an event bus" and "a contract."

---

## 6. Dynamic permissions — one policy table, all five tiers

v1's five tiers are a good mental model and an unbuilt matrix. The implementation should
not be a 5-dimensional table. Two mechanisms cover it:

**RBAC: permissions as data, not code.** `roles.permissions` is already a JSONB list and
wildcard expansion already exists (`expand_wildcard`, `derived_permissions`). Promote the
catalogue from code (`PERMISSION_CATALOGUE`, built from `src/utils/security.py` + the
registry) to a `permission_catalogue` table with `code, module, tier, is_system`. Adding
`approve:grn` requires no deploy. Wildcards keep working. The registry declares codes for
its own service; the table is authoritative.

**ABAC: a small policy table with declarative primitives.** This is what actually delivers
Tier 3 (section), 4 (button) and 5 (field):

```python
class AccessPolicy:
    tenant_id | None          # None = platform-wide default
    subject: JSONB            # {"roles": ["captain"]}  OR {"is_tenant_owner": true}
    module: str
    resource: str             # "bill", "purchase_order", "customer.phone"
    operation: str            # view | create | update | delete | approve | export
    effect: str               # allow | deny | mask | limit
    params: JSONB             # {"max_pct": 10}  /  {"mask": "phone_partial"}
    condition: JSONB | None   # {"amount_gte": 5000}   — evaluated server-side
    priority: int
```

This one table covers every Tier-5 requirement v1 lists:
- *Cost concealment* → `effect=mask`, `resource=inventory_item.unit_cost`, roles ≠ manager.
- *PII masking* → `effect=mask`, `resource=customer.phone`, `params={"mask":"phone_partial"}`.
- *Discount thresholds* → `effect=limit`, `operation=apply_discount`,
  `params={"max_pct": 10}` for captain; a higher-priority row for manager at 30;
  anything above escalates through the approval engine (§9). That is the design working.

Denied-by-default, explicit allow, `deny` beats `allow`, highest `priority` wins on
conflict. Every evaluation is cheap: it is a filtered query on `(tenant_id, module,
resource, operation)`, cached in the identity token's permission set at issue time for the
`view`/`create`/`update` cases and evaluated inline only for `mask`/`limit`.

**One structural fix:** `is_platform_admin` exists as a column in two models and is
**not in the `Identity` dataclass or in the token** — the gateway forwards
`is_tenant_owner`, never platform-admin, so the flag is inert in microservice mode.
Platform-admin is a separate auth realm with its own token (§10), not a claim in the
tenant token. A tenant's JWT must never be able to carry cross-tenant power.

---

## 7. Capabilities, not verticals — this is what makes it "anything"

The reason salon and gym look like they'd require new core engines is that v1 conflated
*verticals* with *capabilities*. Six primitives, once present, cover every realistic
service business:

| Capability | Owned by | What it gives a plugin |
|---|---|---|
| `catalog` | menu / pricing-rules service | item, variant, unit of measure, pricing rule |
| `metering` | **new — small** | consumption of a measured resource: ml of dye, gym hour, seat-minute, machine-hour, units sold |
| `consumable` | inventory | bill-of-materials deduction from stock, shrinkage, batch/FEFO |
| `recurring` | **new — small** | subscription: plan, proration, renewal, dues, churn |
| `schedule` | staff / roster | shift, slot, roster, availability |
| `access` | **new — small** | grant + validate a physical or logical entitlement: turnstile, bay, shelf zone, KDS station |

Compositions — note these are recipes, not modules:

- **Restaurant** = catalog + consumable + metering(covers) + access(table/KDS)
- **Salon** = catalog + metering(booking-min) + schedule + access(chair) + consumable(dye 30ml)
- **Gym** = catalog + recurring(membership) + metering(session-hr) + access(turnstile) + schedule(classes)
- **Retail** = catalog + metering(units) + consumable(batch/expiry) + access(shelf)
- **Car wash** = catalog + metering(machine-hr) + access(bay) + recurring(unlimited card)
- **Clinic** = catalog + schedule + access(room) + recurring(package)
- **Event ticketing** = catalog + metering(seat-min) + access(gate) + recurring(season)

Salon's "30ml dye per haircut" stops being a gap in `inventory` and becomes the
`consumable` capability. Gym's "recurring dues" stops being a gap in `accounting` and
becomes `recurring`. **This is the concrete answer to "not just 4 or 5 modules".**

---

## 8. Data isolation — enforce at the database, not by convention

Today, isolation is a convention. `can_access_outlet()` in
`src/services/shared/identity.py` is an advisory helper; every query is individually
responsible for its own `tenant_id ==` predicate, and a missing one is a **silent
cross-tenant read**, not a 403. Across 13+ services and 93 files carrying `tenant_id`,
that is the platform's largest single risk.

Add **Postgres Row-Level Security as defence in depth:**

1. Each service, on every request, sets a session variable from the gateway-verified
   identity: `SET LOCAL ros.tenant_id = '…'; SET LOCAL ros.outlet_ids = '…';`
2. Every tenant-scoped table in every service DB gets one RLS policy:
   `USING (tenant_id::text = current_setting('ros.tenant_id'))`.
3. A query that forgets the predicate returns **zero rows**, not another tenant's data.
4. Platform-admin sessions get a separate `ros.scope = 'platform'` policy that is
   separately audited — never "RLS off".

This makes the failure mode safe and lets you stop worrying about review discipline on
every query. It is also the only mechanism that makes cross-tenant support tooling
legitimate. Keep the `tenant_id` application predicates too — RLS is a backstop, and
`SET LOCAL` inside a transaction is exactly as cheap.

The franchise/brand/holding tier from v1 §6 is a real gap: there is no brand node, no
franchise flag, no royalty computation. Model it as **`organization` growing a parent
pointer** (outlet → brand → enterprise) with an `ownership_type` (`direct` | `franchise`
| `hub` | `spoke`), and royalty as a first-class billing construct on the recurring
capability. Note it in the roadmap but do not put it in milestone 1.

---

## 9. Approvals and segregation of duties — with the concurrency rules v1 omitted

`ApprovalRequest` does not exist anywhere. `void_bill` is gated only by the
`void:bills` permission — a permission is not an approval, and the distinction is the whole
point of SoD.

```python
class ApprovalRequest:
    id, tenant_id, created_by, created_at
    module, action, target_type, target_id, target_snapshot   JSONB  -- the submitted state
    target_state_hash            -- sha256 of the target's current content at submit time
    threshold_rule               -- which policy row triggered this
    status          # pending | approved | rejected | superseded | expired | committed | failed
    decided_by, decided_at, decision_reason   (reason MANDATORY on approve)
    expires_at         -- 24h default; expiry auto-supersedes
    committed_at
```

The concurrency rules v1's diagram is missing:

1. **Staleness check at commit.** Recompute the target's state hash and compare to
   `target_state_hash`. Changed between submit and approve → status `superseded`, approver
   is told, and the maker must resubmit. **Never commit a stale approval.** This is the
   rule that makes the feature trustworthy rather than merely present.
2. **TTL.** A pending request expires. An expired request cannot be completed; it is
   superseded and a fresh one is raised.
3. **Race.** `UPDATE … SET status='approved' WHERE id=$1 AND status='pending'` — the
   atomic conditional update, not a check-then-write. Two approvers cannot both win.
4. **Maker ≠ checker, always**, enforced server-side: `created_by == decided_by` → 403,
   regardless of role. A maker cannot approve their own action at any threshold.
5. **Supervisor PIN** is a *second factor on the approval act*, not a replacement for the
   approval act. It authenticates that the right person pressed approve.
6. **Commit is separate from decide.** `approved` → the maker action re-runs with the
   approver's authority in a fresh transaction → `committed` (or `failed`, with the error
   attached and a notification). Approving is not itself the ledger change.

The three mandated approvals from v1 stay, and 3-way match finally gets an implementation:
`PO.line.quantity == GRN.line.received_quantity == VendorBill.line.billed_quantity`
within a declared tolerance, checked per line, computed from the entities that already
exist (`PurchaseOrder`, `GoodsReceiptNote`, `VendorBill`). Today those entities exist with
no matching logic at all — the data model was ready and the control was skipped.

---

## 10. Platform Admin — the exact power set

"Controls everything" needs to be an enumerated list to be a promise rather than a slogan.

**Can, without restriction:**
- Tenant lifecycle: create, suspend, cancel, export, migrate.
- Module lifecycle per tenant: activate, suspend, archive, retry migration (§3).
- Inject per-tenant plugin config, validated against the manifest's `settings_schema`.
- Author permission codes and role templates at runtime; grant/withdraw across tenants.
- Define ABAC policy rows; clone a tenant's policy set to a sibling tenant.
- Set quotas, licensing tiers, terminal/outlet/invoice-volume limits; enforce at the edge.
- Read the audit vault across tenants.
- View DLQ and replay events to a named tenant.
- **Global kill switch**: disable a plugin across all tenants instantly — the escape hatch
  when a shipped plugin is broken.
- Run reconciliation reports; investigate any discrepancy.

**Can, but only through break-glass, which is loud:**
- Cross-tenant write. Requires: separate break-glass credential with its own MFA, a
  justifying reason, an expiring session (≤ 1 hour), and a write to the audit vault that
  cannot be edited or deleted by anyone, including platform admins.
- Every break-glass action renders in a separate "Break-glass activity" panel. This is the
  control that lets the platform genuinely be all-powerful without becoming a backdoor.

**Cannot, under any circumstance:**
- Post to a tenant's general ledger directly. Only the accounting service posts, and only
  from an event or an approved action.
- Void a tenant's bill, reverse a payment, or alter an approval outcome. They route through
  the tenant's own approval engine, under the tenant's own policy.
- Delete tenant data. Archival only. Nothing is dropped on any path, ever.
- See or modify another tenant's plugin *code*. Code is versioned and distributed; admin
  sees version, health, and logs.

**Separate auth realm.** Platform-admin tokens are issued by a different endpoint, carry a
`scope: platform` and an optional `scope_tenant_id`, are short-lived, and are never issued
to tenant users. The tenant `Identity` dataclass stays clean — this is what §6's
structural fix enables.

---

## 11. Conformance suite — what actually makes "anything" true

This is the piece v1 lacked and the reason v1 reads like an aspiration. A test suite that
every plugin must pass at deploy time and in CI:

1. **Manifest validity** — schema-valid, IDs unique, all declared permissions resolvable
   in the catalogue, all `subscribes` topics published by someone, `min_platform` satisfied.
2. **Event conformance** — every event the plugin emits has a schema and matches it;
   every payload carries `tenant_id` and `event_id`.
3. **Boundary conformance** — static check: the plugin imports no other service's
   models, owns no FK to another service's table, reads no other service's DB.
4. **Lifecycle conformance** — activate → verify endpoints + nav appear; suspend → verify
   404 + nav gone + **tables intact and re-queryable after re-activation**; migrate →
   verify `schema_version` advanced; re-enable after a while → verify version gate.
5. **Ledger conformance** — the plugin's domain changes produce the events a reconciled
   ledger expects; run the §5(d) invariants green after a scripted happy path.
6. **Rollback conformance** — a plugin at v(n+1) against data at v(n) is refused with a
   specific error, not a crash.

Run it against **one deliberately ugly synthetic vertical** (§13, milestone 5) — a car wash
or gaming cafe — because the stress test is not "does salon work" but "did I have to touch
core to add something new". If the answer is yes, core grew a primitive; that is a success,
not a failure.

---

## 12. What is genuinely missing vs. already there

Honest state of play, because the roadmap depends on it:

| Area | State |
|---|---|
| Event bus, per-service consumer groups | **Built and correct.** Protect it. |
| Event contract typing, outbox, idempotency, DLQ, reconciliation | **Missing** — §5 |
| Module registry (per-tenant activation) | **Missing** — global `enabled` flag only |
| Module lifecycle states | **Missing** — boolean only |
| Permission catalogue as data + wildcards | **Partly built** — wildcards work, catalogue is code |
| ABAC policy table (mask / limit / threshold) | **Missing** |
| Platform-admin identity realm | **Missing** — `is_platform_admin` column is inert |
| Approval engine + SoD | **Missing** |
| 3-way match | **Missing** — entities exist, logic does not |
| RLS enforcement | **Missing** |
| Audit trail | **Legacy only** — `AuditLog` exists at `src/models/core.py:425` in the monolith; no service writes to it |
| GST calculation | **Built** — real, across billing + accounting |
| IRN / e-Way bill | **Missing** |
| Batch / FEFO | **Partly built** — `InventoryBatch.expiry_date` + index exist; no stock-out gate, no FSSAI |
| Capabilities (metering / recurring / access) | **Missing** — three small new engines |
| Franchise / brand hierarchy, royalty | **Missing** |
| Monolith still live alongside services | **Unresolved** — two audit and permission models in the tree |

Two housekeeping notes: `src/services/shifts/` is an empty directory; and journal amounts
are annotated `Mapped[float]` over a `Numeric(14,2)` column — the DB is right and the
Python side is not, which is exactly the wrong place to drift for a ledger.

---

## 13. Roadmap — re-sequenced by real dependency

v1's milestone 1 (Super Admin portal) first is backwards: the portal is a *consumer* of
the module registry and the platform-admin identity path, neither of which exists. Build
the portal first and you build a nice UI that cannot safely do anything, then rebuild the
portal's data layer later.

**M1 — Trustworthy events (foundation for everything else)**
Outbox + idempotency ledger + DLQ + reconciliation invariants. Typed event schemas.
*Do this before approvals, before RBAC, before the portal.* An accounting platform whose
ledger and its source events can diverge silently has no safe foundation for anything else.

**M2 — Per-tenant module activation**
`TenantModuleState`, module lifecycle state machine, delete the global `enabled` flag,
gateway three-way resolution, plugin manifest validation at deploy.
This is the first milestone that makes the goal *literally true in code*.

**M3 — Dynamic permissions**
Permission catalogue as a table. ABAC policy table with `mask`/`limit`/`allow`/`deny`.
Discount thresholds, cost concealment, PII masking, section and button gates — all from one
table. Token issuance updated to carry the expanded set.

**M4 — Approval engine and SoD**
`ApprovalRequest` with the six concurrency rules from §9. Wire POS voids, stock
write-offs, vendor payments. Implement 3-way match against the entities that already exist.

**M5 — Proof: one deliberately unfamiliar vertical**
Car wash or gaming cafe, built *only* from capabilities, manifest, and declared events.
Conformance suite green. Core touched zero times. **Then build salon for real**, reusing
the proof. Building salon and gym in parallel (v1's plan) doubles the cost of discovering
where the seam breaks; one synthetic vertical finds the same seams for a fifth of the work.

**M6 — Platform control plane**
Now that 1–5 exist, the portal can actually control something. Tenants, module lifecycle,
module config, roles, policy, quotas, audit vault, DLQ replay, kill switch, break-glass.

**M7 — Compliance**
Auditable event-sourced append-only ledger (a service with DB access must not be able to
UPDATE a posted row), IRN and e-Way bill, FSSAI FEFO stock-out gate. Compliance on top of
trusted events and approvals; not underneath them.

**M8 — Cut-over and the franchise tier**
Retire the live monolith. Brand/franchise hierarchy and royalty billing. Dedicated-DB
tenants as a documented enterprise escape hatch, only if a contract actually requires it.

---

## 14. Risks that will bite regardless

1. **Bus regression.** The shared-consumer-group bug was subtle and silent. Add a bus-level
   integration test that asserts each service's group is distinct and that an
   uninterested service still acks without dropping an interested service's event. This
   class of bug has already been found once; it will not announce itself again.
2. **Token drift.** The JWT carries more and more claims as this grows. If a claim
   outlives its validity (a suspended tenant's user still holds a live token), everything
   downstream is wrong. Set short access-token TTLs and treat claims as advisory except
   `tenant_id`.
3. **Migration lock contention.** At scale, "tenant X is migrating" blocks tenant X's
   plugin activation. Keep migrations idempotent and small; consider per-plugin lock
   granularity if it ever hurts.
4. **Cost of `config JSONB` flexibility.** Permissive config schemas become undeletable
   surface. Validate at write time against the manifest's `settings_schema` and refuse
   unknown keys — unknown keys are how config silently decays into a second schema.
5. **Projection lag.** `reports` is an eventually-consistent projection. Label it as such
   in every UI that reads it. An unlabelled stale number in a financial report is a trust
   problem, not a performance one.

---

## 15. Definition of done

The platform is done when all of these are simultaneously true:

- A conformant plugin can be activated for one tenant and suspended for another, with no
  deploy and no restart, and the suspended tenant's data is intact.
- Activating a plugin for the first time creates nothing in a shared schema and touches no
  other plugin.
- No plugin imports another service's models. Violations are caught at deploy time.
- A dropped event is never silent: it is in the DLQ, visible to the Platform Admin, and
  replayable.
- A maker cannot approve their own action; a stale approval cannot be committed.
- A tenant-scoped query that forgets its predicate returns zero rows.
- The Platform Admin can stop a broken plugin globally in one click.
- Every platform-admin write is attributable and uneditable.
