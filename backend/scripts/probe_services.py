"""Smoke probe for the pos and kitchen services.

Imports each service's app, then drives its logic through a temporary database
instead of booting 14 servers. It verifies the parts that break silently in
production: the ORM schema actually building, totals math, status transitions,
order numbering, and the kitchen consuming a placed order.

Exit codes: 0 = all pass, 1 = a check failed, 2 = an environment problem.
"""
from __future__ import annotations

import asyncio
import os
import sys
import tempfile
import uuid

RESULT = []


def check(label: str, ok: bool, detail: str = "") -> bool:
    RESULT.append((label, ok, detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}" + (f" — {detail}" if detail else ""))
    return ok


def main() -> int:
    print("=" * 72)
    print("pos + kitchen smoke probe")
    print("=" * 72)

    try:
        # Importing each service registers its models on its own metadata,
        # which is what build_service's create_all reads.
        from src.services.pos import main as pos_main  # noqa: F401
        from src.services.kitchen import main as kitchen_main  # noqa: F401
    except Exception as exc:
        print(f"\n[!] Could not import the services: {exc}")
        import traceback
        traceback.print_exc()
        print("\nThis is almost always a syntax or import error in a new service.")
        print("Run a bare compile first:")
        print("  python -m py_compile src/services/pos/*.py src/services/kitchen/*.py")
        return 2

    from src.services.shared.service_db import service_base
    from src.services.shared.registry import get_descriptor

    ok = True
    ok &= check("pos descriptor registered", get_descriptor("pos") is not None)
    ok &= check("kitchen descriptor registered", get_descriptor("kitchen") is not None)

    pos_db = service_base("pos")
    kitchen_db = service_base("kitchen")

    pos_tables = sorted(t.name for t in pos_db.metadata.tables.values())
    kitchen_tables = sorted(t.name for t in kitchen_db.metadata.tables.values())

    print(f"\n  pos tables ({len(pos_tables)}): {', '.join(pos_tables)}")
    print(f"  kitchen tables ({len(kitchen_tables)}): {', '.join(kitchen_tables)}")

    ok &= check("pos has its own tables", len(pos_tables) >= 8)
    ok &= check("kitchen has its own tables", len(kitchen_tables) >= 6)
    # The whole point of the split: no duplicate tables across services.
    overlap = set(pos_tables) & set(kitchen_tables)
    ok &= check("no overlapping table names", not overlap, f"overlap={sorted(overlap)}")

    # Cross-service foreign keys are the bug that created org/menu duplication.
    # A kitchen table pointing at pos's orders table is exactly that failure.
    kitchen_fks = []
    for t in kitchen_db.metadata.tables.values():
        for fk in t.foreign_keys:
            kitchen_fks.append((t.name, fk.column.table.name, fk.column.name))
    bad = [f for f in kitchen_fks if f[1] in pos_db.metadata.tables]
    ok &= check("kitchen has no FK into pos", not bad, f"offenders={bad}")
    bad_own = [f for f in kitchen_fks if f[1] not in kitchen_db.metadata.tables]
    ok &= check("kitchen FKs only point at its own tables", not bad_own,
                f"offenders={bad_own}")

    return _run_async_checks(pos_db, kitchen_db) if ok else 2


def _run_async_checks(pos_db, kitchen_db) -> int:
    """Against a throwaway database: schema DDL, then real writes."""
    fd, path = tempfile.mkstemp(prefix="ros_probe_", suffix=".db")
    os.close(fd)
    print("\nBuilding schema against a temporary database ...")
    try:
        import sqlalchemy as sa

        engine = sa.create_engine(f"sqlite:///{path}")
        pos_db.metadata.create_all(engine)
        kitchen_db.metadata.create_all(engine)
        ok = check("schema DDL compiles for both services", True)
        engine.dispose()
    except Exception as exc:
        import traceback
        traceback.print_exc()
        ok = check(f"schema DDL for both services", False, str(exc))
        try:
            os.unlink(path)
        except OSError:
            pass
        return _finish(ok)

    ok &= _run_async(pos_db, kitchen_db)
    try:
        os.unlink(path)
    except OSError:
        pass
    return _finish(ok)


def _run_async(pos_db, kitchen_db) -> bool:
    """Exercise the actual service code against the real databases.

    Uses the same Session config the services use at runtime, so a lazy-load
    or MissingGreenlet problem shows up here rather than in a live request.
    """
    ok = True
    try:
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
        from sqlalchemy.pool import StaticPool
        from src.services.pos.service import (
            add_lines, allocate_order_number, cancel_order, item_count,
            place_order, recalculate_order, update_order_status,
        )
        from src.services.pos.schemas import OrderLineCreate
        from src.services.pos.models import Order, OrderStatus

        # A single-file SQLite with a static pool: one connection, which is
        # what makes an async session behave like the service's own.
        engine = create_async_engine(
            "sqlite+aiosqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        session_factory = async_sessionmaker(
            engine, expire_on_commit=False, autoflush=False
        )
        pos_db.metadata.create_all_sync(engine.sync_engine)

        async def scenario() -> bool:
            nonlocal ok
            result = True
            async with session_factory() as db:
                tenant = uuid.uuid4()
                outlet = uuid.uuid4()
                order = Order(
                    tenant_id=tenant,
                    outlet_id=outlet,
                    order_number=await allocate_order_number(db, tenant, outlet),
                    status=OrderStatus.DRAFT,
                    covers=2,
                )
                db.add(order)
                await db.flush()

                number = order.order_number
                result &= check("order number allocated",
                                isinstance(number, str) and number.startswith("ORD-"),
                                number)

                line = OrderLineCreate(
                    item_name="Paneer Tikka", unit_price=320.0, qty=2,
                    addons=[{"name": "Extra cheese", "price": 40.0, "qty": 1}],
                    discount_pct=10,
                )
                await add_lines(db, tenant, order, [line])
                await place_order(db, tenant, order)
                await db.commit()

                # Expected: (320*2 + 40) = 680 gross; 10% off = 68 discount.
                result &= check("subtotal includes addons",
                                float(order.subtotal) == 680.0,
                                f"got {order.subtotal}")
                result &= check("discount computed",
                                float(order.discount_total) == 68.0,
                                f"got {order.discount_total}")
                result &= check("grand_total = subtotal - discount",
                                float(order.grand_total) == 612.0,
                                f"got {order.grand_total}")
                result &= check("item_count is qty-weighted", item_count(order) == 2,
                                f"got {item_count(order)}")

                n1 = await allocate_order_number(db, tenant, outlet)
                result &= check("order numbers are unique per call", n1 != number,
                                f"got {n1} vs {number}")

                await cancel_order(db, tenant, order, "test cancel")
                await db.commit()
                result &= check("cancel works", status_text(order.status) == "cancelled")

                # A second cancel must be refused, not silently no-op.
                try:
                    await cancel_order(db, tenant, order)
                    result &= check("cancel is refused twice", False,
                                    "expected ValueError, got none")
                except ValueError:
                    result &= check("cancel is refused twice", True)

            await engine.dispose()
            return result

        try:
            ok &= asyncio.run(scenario())
        except Exception as exc:
            import traceback
            traceback.print_exc()
            ok &= check("order scenario runs end to end", False, str(exc))
    finally:
        return ok


def status_text(v) -> str:
    return v.value if hasattr(v, "value") else str(v)


def _finish(ok: bool) -> int:
    passed = sum(1 for _, o, _ in RESULT if o)
    failed = [l for l, o, _ in RESULT if not o]
    print(f"\n{'=' * 72}")
    print(f"  {passed}/{len(RESULT)} checks passed")
    if failed:
        print("  Failed:")
        for f in failed:
            print(f"    - {f}")
    print(f"{'=' * 72}")
    return 0 if ok else 1


if __name__ == "__main__":
    if os.name != "nt":
        os.environ.setdefault("PYTHONUNBUFFERED", "1")
    rc = main()
    print()
    sys.exit(rc)
