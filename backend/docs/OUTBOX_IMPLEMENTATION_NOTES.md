# Outbox Implementation — Status & Finish Steps

> Last updated: 2026-10-18. Covers the transactional outbox rolled out to the four
> ledger services (billing, pos, kitchen, inventory). Plan item §5(a) from
> `ENTERPRISE_ERP_PLAN_V2.md` is the design reference.

## What is implemented

- `outbox_messages` table in each of the four service databases
  (`restaurantos_billing`, `restaurantos_pos`, `restaurantos_kitchen`, `restaurantos_inventory`).
- Each service has an `outbox.py` with `OutboxRelay` (background asyncio task, 1 s poll,
  `FOR UPDATE SKIP LOCKED`, 5 retries, dead-letter after).
- `main.py` in each service wires the relay into the app lifespan (`on_startup`/`on_shutdown`).
- All request-handler publish sites in the four services call `_outbox(db, event)` before
  `bus.publish(event, local=True)`, so the outbox row and the domain change commit in the
  same transaction.
- Consumer-driven publishes (kitchen's `_on_order_placed` → `kot.fired`, inventory's
  `_on_bill_paid` → `stock.out`) also write outbox rows in the handler's own session.

## Verified so far

- All four relays running: probe rows went `pending → published` within 6 s on each.
- Real gateway order → `order.placed` outbox row written → relay drained to `published`.
- Real bill settlement → `bill.paid` outbox row → relay drained.

## What is still missing to make the chain fully live

The outbox guarantees the event is *durable in Postgres*. The relay then publishes it to the
event bus. Right now the bus is running in **degraded in-process-only mode** because
Redis is not installed on this machine. That means cross-service delivery (billing's
`bill.paid` reaching the inventory service's `_on_bill_paid` handler) does not happen yet.

### Steps to finish

1. **Install Redis** (one of these):
   ```
   choco install -y redis-mjackson
   # or
   winget install Redis.Redis   # then open a NEW terminal
   # or
   docker run -d --name ros-redis -p 6379:6379 redis:7-alpine
   ```
2. **Confirm port 6379 is listening:**
   ```
   netstat -ano | findstr :6379
   ```
3. **Run the provided probe to confirm cross-process delivery:**
   ```
   cd backend
   python scripts/probe_eventbus.py
   ```
   Exit code 0 = events cross processes; 1 = Redis up but delivery failed; 2 = Redis not running.
4. **Restart the fleet:**
   ```
   python run_services.py restart all
   ```
5. **Verify end-to-end:** settle a bill through the gateway, then check
   `restaurantos_billing.outbox_messages` (should show `bill.paid` → `published`),
   `restaurantos_inventory.outbox_messages` (should show `stock.out` → `published`),
   and the accounting service's journal entry for that bill.

## Honest limitations

- The relay calls `bus.publish(local=False)` — this is for cross-process delivery. If Redis
  is up, it goes to the Redis stream. If not, the relay's publish silently no-ops in-process
  (in-memory buffer that dies with the process). The outbox row remains `published`
  either way, so there is no retry trigger for a Redis-down relay failure.
- The `kot.fired` outbox writes in kitchen's `_on_order_placed` consumer are committed
  *after* the KOT rows are already committed, so they are best-effort, not atomically
  guaranteed with the KOT creation. This is the known "consumer-driven event" case.
- DLQ is the relay's `status='dead'` state; there is no separate `ros:events:dlq` stream
  yet (that is plan item §5(c), not yet implemented).
- No reconciliation invariants yet (plan item §5(d)).
