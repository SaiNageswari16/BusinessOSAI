# PetPooja Build Contract — parallel-agent rules, template & event payloads

Read this BEFORE writing code. It pins the shared conventions so parallel agents never conflict.

## 1. File ownership (hard rule — touch ONLY your own)

| Workstream | Owns (create/edit) | Must NOT touch |
|---|---|---|
| A — flow closure + advance orders | `pos/events.py` (new), `pos/main.py`, `pos/models.py`, `pos/schemas.py`, `pos/api.py`, `organization/events.py` (new), `organization/main.py` | `kitchen/`, any other service |
| B — delivery service | `delivery/` (entire new dir) | everything else |
| C — production service | `production/` (new), `inventory/events.py` (new), `inventory/main.py`, `inventory/models.py`, `purchase/events.py` (new), `purchase/main.py` | `pos/`, `menu/` |
| D — finance ops | `accounting/models.py`, `accounting/schemas.py`, `accounting/service.py`, `accounting/api_finance.py` (new), `accounting/main.py` | other services |
| E — platform plans + marketing | `platform/models.py`, `platform/schemas.py`, `platform/api.py`, `marketing/` (new) | `loyalty/`, `billing/` |
| F — reports + kitchen + printers | `reports/`, `kitchen/api.py` (KOT-by-number + `table_id` in kot payload), `kitchen/schemas.py` | `pos/`, `organization/` |
| H — frontend | `frontend/` only | `backend/` |

Shared files already claimed by the coordinator (do NOT edit): `shared/registry.py` (all 3 new-service descriptors + topic wiring DONE), `.env`, `event_bus/`, `gateway/`, `run_services.py`.

## 2. New-service skeleton (template = loyalty service)

Copy the shape of `backend/src/services/loyalty/` into the new dir:
- `__init__.py` — empty
- `models.py` — `ServiceBase = service_base("<name>")` (from `shared/service_db`); every table `ServiceBase, TimestampMixin` (define the mixin like loyalty: `created_at`/`updated_at` NOT NULL app-side); cross-service ids are **bare UUID columns, no FK** (document each in the module docstring like loyalty does). ALWAYS include `OutboxMessage` + `ConsumedEvent` models (copy loyalty/models.py:262-322 verbatim, rename `source_service` default).
- `schemas.py` — pydantic request/response; `OrmModel` base from `shared/schemas_common` if present else define locally (check what loyalty imports).
- `service.py` — pure business logic raising a `<Name>Error` (like `svc.BillingError`); `api.py` — thin FastAPI routes → 404/409/403 mapping (`HTTPException`); tenant scoping via `identity.tenant_id`; outlet scoping via `identity.can_access_outlet(outlet_id)` (copy any loyalty route that does this).
- `outbox.py` — copy loyalty/outbox.py, rename logger + `source_service`.
- `events.py` — consumers (only if the service subscribes): pattern below.
- `main.py` — copy loyalty/main.py structure: `build_service("<name>", [router], on_startup=_on_startup, on_shutdown=_on_shutdown, tags=TAGS)`; `_relay = OutboxRelay(None)`; in `_on_startup`: `_relay._db = app.state.db; install_service_ledger(app.state.db); await _relay.start()`; import your `events` module for side-effect registration; module-level `db` from `build_service` return.

Registry/DB bootstrap/port are ALREADY done (registry entries exist: delivery=8114, production=8115, marketing=8116; `run_services.py` + `migrate` are registry-driven).

## 3. Event consumer pattern (from accounting/events.py — the house rules)

```python
@bus.on("<topic>")
async def _on_<topic>(event: Event) -> None:
    data = event.data or {}
    tenant = _coerce_uuid(event.tenant_id) or _coerce_uuid(data.get("tenant_id"))
    if tenant is None:
        return
    db = _handler_db()          # own session from module-level `db` (main.py), never a request session
    try:
        # 1. structural idempotency guard (dedupe by (tenant, ref_kind, ref_id)) —
        #    the durable consumed_events ledger in the consumer loop is layer 1,
        #    this guard is layer 2 for in-ledger-dedup misses
        # 2. domain write (+ record_event outbox row IN THE SAME transaction)
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception(...)   # log, never swallow — a dead consumer must not look alive
    finally:
        await db.close()
```

Publish rules: write the outbox row BEFORE commit in the same txn (`outbox.record_event(db, type=..., data=..., tenant_id=..., outlet_id=...)`); then `await bus.publish(event, local=True)` for in-process handlers; the relay handles cross-process.

## 4. Event payload contracts (pinned — build against these keys)

- `order.placed` (pos): `order_id, order_number, order_type(dine_in|takeaway|delivery|aggregator|qsr), table_id?, customer_id?`
- `order.cancelled` (pos): `order_id, order_number, reason?`
- `order.status.changed` (pos): `order_id, from, to`
- `table_session.opened` (pos): `table_session_id, table_id, outlet_id, order_id?`
- `table_session.closed` (pos): `table_session_id, table_id, order_id?`
- `bill.paid` (billing, settled-only): `bill_id, bill_number, order_id?, order_number, status, subtotal, tax_total, cgst_total, sgst_total, igst_total, cess_total, service_charge, grand_total, paid_amount, change_amount, is_credit_sale, covers, cash_amount, payment_method, cashier_id?, waiter_id?, customer_gstin?, lines[{menu_item_id,name,qty,unit_price}]`
- `bill.created` (billing, unpaid): same shape, status=draft
- `bill.refunded` (billing): `bill_id, bill_number, payment_id, method, refund_amount, order_id?, reason`
- `kot.fired` / `kot.acknowledged` / `kot.ready` / `kot.served` / `kot.cancelled` (kitchen): `kot_id, kot_number, order_id, station_id, status, from_status?` — F adds `table_id` to the dict in `kitchen/api.py _emit_kot_event` (defensive: consumers must work if `table_id` is absent → fall back to order lookup).
- NEW `delivery.created` (delivery): `delivery_id, order_id, outlet_id, zone_id?, status=assigned?`
- NEW `delivery.assigned`: `delivery_id, order_id, boy_id, boy_name`
- NEW `delivery.delivered`: `delivery_id, order_id, delivered_at`
- NEW `delivery.cancelled`: `delivery_id, order_id, reason`
- NEW `production.run.completed`: `run_id, process_id, output_qty, output_items[{item_id?, name, qty}], raw_deductions[{item_id?, name, qty, uom}], outlet_id`
- NEW `production.po.requested`: `run_id, outlet_id, lines[{item_id?, name, qty, uom}]`
- NEW `expense.recorded`: `expense_id, amount, category, payment_mode, account_id?, date`
- NEW `withdrawal.recorded`: `withdrawal_id, amount, method, account_id, status`
- NEW `marketing.campaign.sent`: `campaign_id, channel, recipients, sent_count`

## 5. Consumer assignments (who reacts to what)

- pos: `kot.served` → order SERVED (idempotent: only if current status < served per the `_allowed_to` state machine in pos/service.py); `bill.paid` (status settled) → order SETTLED + close the order's open TableSession (emit `table_session.closed`); `delivery.delivered` → order SERVED (delivery-type orders); `table_session.closed` → (no-op marker, emit order.status.changed if order still open? NO — only close session + leave order)
- organization: `table_session.opened` → table OCCUPIED; `table_session.closed` → table FREE; `order.placed` (dine_in + table_id) → table OCCUPIED; `bill.paid` settled + table_session.closed keep table coherent. All via `record_event(db, type="table.status.changed", ...)` outbox in organization (pattern organization/api.py:415).
- delivery: `order.placed` (order_type delivery) → create unassigned `Delivery`; `order.cancelled` → cancel open delivery.
- inventory: `production.run.completed` → stock movements (deduct raws, add finished goods) using existing movement/stock-in machinery (`inventory/service.py` stock_in / movements); write `stock.movement.created` outbox as inventory already does.
- purchase: `production.po.requested` → create a direct `PurchaseOrder` (status draft→approved, source=production) + `po.created` outbox.
- marketing: `customer.created` → welcome-offer draft (log only unless a campaign is active), `bill.paid` → campaign trigger evaluation (opt-out-aware).
- reports: extend projections with `grn.posted`, `purchase.vendor_bill`, `expense.recorded`, `withdrawal.recorded`, `marketing.campaign.sent`, `delivery.delivered`, `production.run.completed`.

## 6. Verification gate (every agent must run before reporting done)

1. `python -m pyflakes <files touched>` (or the repo pyflakes path) — zero errors.
2. Import smoke: `python -c "import sys; sys.path.insert(0,'.'); import src.services.<name>.main"` from `backend/` — must import clean (catches the 3 boot-bug classes: import NameError, undefined model, missing module).
3. No `git commit`, no `git add` — the coordinator commits in waves.
4. Report format: files created/changed (with one-line purpose each), endpoints added, events wired, pyflakes+import result, open risks.

## 7. House rules (from project memory — do not break)

- Never cross-write another service's DB. Events + outbox only. Cross-service ids are bare UUID columns.
- Dedupe gate lives in the consumer loop (`dedupe.py`); handlers must NOT call `bus.mark_seen`; use the structural guard instead.
- Per-tenant on every query; per-outlet where the screen is outlet-local.
- Money = `Numeric(14,2)`; Decimals in service layer.
- New RBAC codes follow the `<verb>:<noun>` namespace; register them in the registry descriptor's `permissions` tuple — WAIT: registry is frozen for this wave; list needed codes in your report instead, coordinator adds them.
- Consumer handlers: own session, commit/rollback, log-and-raise-on-error, structural idempotency.
