"""Order service — the running-order lifecycle for dine-in, QSR and delivery.

Every price, tax and discount decision is made here so the POS, the KDS and the
bill all agree on the same numbers. Order rows carry denormalised totals that
this module recalculates on each mutation.

Tax model: item-level tax on (unit_price + addons - line discount). Service
charge and round-off are order-level and applied at bill time.
"""
import uuid
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models import (
    Combo,
    MenuItem,
    MenuItemVariant,
    Order,
    OrderItem,
    OrderItemAddon,
    OrderItemCourse,
    OrderItemStatus,
    OrderStatus,
    OrderType,
    PricingRule,
    RestaurantTable,
    Section,
    TableSession,
    TableSessionStatus,
    TableStatus,
    TaxCode,
)
from src.schemas.orders import OrderCreate, OrderItemIn
from src.services.kot_service import _status_value
from src.services.number_series import allocate_number

TWO_PLACES = Decimal("0.01")


def _d(value) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _money(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _load_order(db: AsyncSession, tenant_id: uuid.UUID, order_id: uuid.UUID) -> Order:
    order = (
        await db.execute(
            select(Order)
            .options(
                selectinload(Order.items).selectinload(OrderItem.addons),
                selectinload(Order.courses),
                selectinload(Order.table),
                selectinload(Order.kots),
            )
            .where(Order.id == order_id, Order.tenant_id == tenant_id)
        )
    ).scalars().first()
    if order is None:
        raise ValueError("Order not found")
    return order


def _check_table_available(db_table: RestaurantTable) -> None:
    if db_table is not None and _status_value(db_table.status) != TableStatus.FREE.value:
        raise ValueError(
            f"Table {db_table.name or db_table.code} is "
            f"{_status_value(db_table.status)} and cannot take a new order"
        )


async def _resolve_item_price(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    item: OrderItemIn,
    outlet_id: uuid.UUID,
) -> tuple[Decimal, MenuItem | None, MenuItemVariant | None, str, uuid.UUID | None, uuid.UUID | None]:
    """Resolve price, station and tax for a requested line.

    Returns (unit_price, menu_item, variant, item_name, station_id, tax_code_id).
    """
    if item.menu_item_id is None and item.combo_id is None:
        raise ValueError("Each line needs either menu_item_id or combo_id")

    menu_item: MenuItem | None = None
    variant: MenuItemVariant | None = None
    combo: Combo | None = None

    if item.menu_item_id:
        menu_item = (
            await db.execute(
                select(MenuItem)
                .options(selectinload(MenuItem.variants), selectinload(MenuItem.addon_groups))
                .where(MenuItem.id == item.menu_item_id, MenuItem.tenant_id == tenant_id)
            )
        ).scalars().first()
        if menu_item is None:
            raise ValueError(f"Menu item {item.menu_item_id} not found")
        if not menu_item.is_active:
            raise ValueError(f"{menu_item.name} is no longer on the menu")
        if not menu_item.is_available:
            raise ValueError(f"{menu_item.name} is sold out")
        item_name = menu_item.name
    else:
        combo = (
            await db.execute(
                select(Combo)
                .options(selectinload(Combo.items))
                .where(Combo.id == item.combo_id, Combo.tenant_id == tenant_id)
            )
        ).scalars().first()
        if combo is None:
            raise ValueError(f"Combo {item.combo_id} not found")
        if not combo.is_active:
            raise ValueError(f"{combo.name} is no longer available")
        item_name = combo.name

    if variant is None and item.variant_id and menu_item is not None:
        variant = next((v for v in menu_item.variants or [] if v.id == item.variant_id), None)
        if variant is None:
            raise ValueError("Selected portion size does not belong to this item")

    if menu_item is not None and variant is None:
        # Fall back to the default portion, else the item's base price
        variant = next((v for v in menu_item.variants or [] if v.is_default), None)

    if item.unit_price_override is not None:
        unit_price = _money(_d(item.unit_price_override))
    elif variant is not None:
        unit_price = _money(_d(variant.price))
    elif combo is not None:
        unit_price = _money(_d(combo.combo_price))
    else:
        unit_price = _money(_d(menu_item.base_price))

    # Happy-hour / day-part rules can still lower the price
    unit_price = await _apply_pricing_rules(
        db, tenant_id, outlet_id,
        item.menu_item_id, unit_price,
    )

    station_id = (
        item.kitchen_station_id
        or (menu_item.kitchen_station_id if menu_item else None)
    )
    tax_code_id = menu_item.tax_code_id if menu_item else None

    return unit_price, menu_item, variant, item_name, station_id, tax_code_id


async def _apply_pricing_rules(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID | None,
    menu_item_id: uuid.UUID | None,
    unit_price: Decimal,
) -> Decimal:
    """Apply the highest-priority active pricing rule that matches right now."""
    if menu_item_id is None:
        return unit_price

    now = datetime.now().time()
    weekday = now.weekday()  # 0 = Monday, matching the model's convention

    stmt = (
        select(PricingRule)
        .where(
            PricingRule.tenant_id == tenant_id,
            PricingRule.is_active.is_(True),
        )
    )
    rules = (await db.execute(stmt)).scalars().all()

    candidates = []
    for rule in rules:
        # Outlet-scoped rules only apply to their outlet
        if rule.outlet_id and outlet_id and rule.outlet_id != outlet_id:
            continue
        # A rule with an item scope only applies to that item
        if rule.menu_item_id and rule.menu_item_id != menu_item_id:
            continue
        days = rule.days_of_week or []
        if days and weekday not in [int(d) for d in days]:
            continue
        if rule.valid_from and rule.valid_to:
            try:
                start = datetime.strptime(rule.valid_from, "%H:%M").time()
                end = datetime.strptime(rule.valid_to, "%H:%M").time()
                if start <= end:
                    if not (start <= now <= end):
                        continue
                else:  # rule spans midnight
                    if not (now >= start or now <= end):
                        continue
            except ValueError:
                continue
        candidates.append(rule)

    if not candidates:
        return unit_price

    best = max(candidates, key=lambda r: (r.priority or 0))
    if best.discount_pct:
        unit_price = unit_price * (Decimal("1") - _d(best.discount_pct) / Decimal("100"))
    elif best.discount_amount:
        unit_price = unit_price - _d(best.discount_amount)

    return _money(max(unit_price, Decimal("0")))


def _tax_split(tax_code: TaxCode | None) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    """(cgst, sgst, igst, cess) percentages from a tax code."""
    if tax_code is None:
        return Decimal("0"), Decimal("0"), Decimal("0"), Decimal("0")
    return (
        _d(tax_code.cgst_pct),
        _d(tax_code.sgst_pct),
        _d(tax_code.igst_pct),
        _d(tax_code.cess_pct),
    )


def _compute_line_total(
    unit_price: Decimal,
    qty: int,
    addons_total: Decimal,
    discount_pct: Decimal | None,
    tax_code: TaxCode | None,
) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    """Return (line_total, discount_amount, tax_amount, tax_pct)."""
    gross = unit_price * Decimal(qty) + addons_total

    discount_amount = Decimal("0")
    if discount_pct:
        discount_amount = _money(gross * _d(discount_pct) / Decimal("100"))

    taxable = gross - discount_amount

    cgst, sgst, igst, cess = _tax_split(tax_code)
    tax_pct = cgst + sgst + igst + cess
    tax_amount = _money(taxable * tax_pct / Decimal("100"))

    line_total = _money(taxable + tax_amount)
    return line_total, discount_amount, tax_amount, tax_pct


async def create_order(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    payload: OrderCreate,
    *,
    waiter_id: uuid.UUID | None = None,
) -> Order:
    """Create a running order with its items, opening a table session if dine-in."""
    if payload.order_type == OrderType.DINE_IN and payload.table_id is None:
        raise ValueError("Dine-in orders need a table_id")

    table: RestaurantTable | None = None
    if payload.table_id:
        table = (
            await db.execute(
                select(RestaurantTable)
                .options(selectinload(RestaurantTable.section))
                .where(
                    RestaurantTable.id == payload.table_id,
                    RestaurantTable.tenant_id == tenant_id,
                )
            )
        ).scalars().first()
        if table is None:
            raise ValueError("Table not found")
        _check_table_available(table)

    order_number = await allocate_number(db, tenant_id, "order", payload.outlet_id)

    order = Order(
        tenant_id=tenant_id,
        outlet_id=payload.outlet_id,
        order_number=order_number,
        order_type=payload.order_type,
        status=OrderStatus.DRAFT,
        table_id=payload.table_id,
        section_id=table.section_id if table else None,
        covers=payload.covers,
        waiter_id=waiter_id or payload.waiter_id,
        customer_id=payload.customer_id,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        notes=payload.notes,
        is_parcel=payload.is_parcel,
        aggregator_name=payload.aggregator_name,
        aggregator_order_id=payload.aggregator_order_id,
        token_number=await _next_token(db, tenant_id, payload.outlet_id, payload.order_type),
    )
    db.add(order)
    await db.flush()

    # Table becomes occupied and gets an open session
    if table is not None:
        table.status = TableStatus.OCCUPIED
        db.add(TableSession(
            tenant_id=tenant_id,
            outlet_id=payload.outlet_id,
            table_id=table.id,
            order_id=order.id,
            status=TableSessionStatus.ACTIVE,
            covers=payload.covers,
            waiter_id=order.waiter_id,
            started_at=_now_iso(),
        ))

    if payload.items:
        await add_items(db, tenant_id, order, payload.items)

    await db.flush()
    return order


async def _next_token(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    order_type: OrderType,
) -> int | None:
    """Token numbers only matter for takeaway / QSR counters."""
    if order_type not in (OrderType.TAKEAWAY, OrderType.QSR):
        return None
    stmt = select(Order.token_number).where(
        Order.tenant_id == tenant_id,
        Order.outlet_id == outlet_id,
        Order.token_number.is_not(None),
    )
    tokens = (await db.execute(stmt)).scalars().all()
    return (max(tokens) + 1) if tokens else 1


async def add_items(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    order: Order,
    items: list[OrderItemIn],
) -> list[OrderItem]:
    """Append lines to a running order (repeat / additional round)."""
    created: list[OrderItem] = []

    for item_in in items:
        (
            unit_price,
            menu_item,
            variant,
            item_name,
            station_id,
            tax_code_id,
        ) = await _resolve_item_price(db, tenant_id, item_in, order.outlet_id)

        tax_code = None
        if tax_code_id:
            tax_code = (
                await db.execute(
                    select(TaxCode).where(
                        TaxCode.id == tax_code_id, TaxCode.tenant_id == tenant_id
                    )
                )
            ).scalars().first()

        addons_total = Decimal("0")
        addon_rows: list[tuple[OrderItemAddon, Decimal]] = []
        for addon_in in item_in.addons:
            price = _d(addon_in.price)
            addons_total += price * Decimal(addon_in.qty)
            addon_rows.append((OrderItemAddon(
                tenant_id=tenant_id,
                addon_id=addon_in.addon_id,
                modifier_id=addon_in.modifier_id,
                name=addon_in.name,
                price=price,
                qty=addon_in.qty,
            ), price))

        line_total, discount_amount, tax_amount, tax_pct = _compute_line_total(
            unit_price, item_in.qty, _money(addons_total),
            _d(item_in.discount_pct) if item_in.discount_pct is not None else None,
            tax_code,
        )

        order_item = OrderItem(
            tenant_id=tenant_id,
            order_id=order.id,
            menu_item_id=item_in.menu_item_id,
            variant_id=variant.id if variant else item_in.variant_id,
            combo_id=item_in.combo_id,
            item_name=item_name,
            variant_name=variant.name if variant else None,
            unit_price=unit_price,
            qty=item_in.qty,
            status=OrderItemStatus.ORDERED,
            course_number=item_in.course_number,
            notes=item_in.notes,
            discount_pct=item_in.discount_pct,
            discount_amount=discount_amount,
            tax_code_id=tax_code_id,
            tax_amount=tax_amount,
            total=line_total,
            kitchen_station_id=station_id,
        )
        db.add(order_item)
        await db.flush()

        for addon_row, _ in addon_rows:
            addon_row.order_item_id = order_item.id
            db.add(addon_row)

        created.append(order_item)

    # Register any newly referenced courses
    await _ensure_courses(db, tenant_id, order)

    await recalculate_order(db, order)
    return created


async def _ensure_courses(db: AsyncSession, tenant_id: uuid.UUID, order: Order) -> None:
    """Create the course bookkeeping rows for every course the order uses."""
    existing = {
        c.course_number: c
        for c in (order.courses or [])
    }
    used = {
        (i.course_number or 1)
        for i in order.items or []
        if _status_value(i.status) != OrderItemStatus.CANCELLED.value
    }

    for number in sorted(used):
        if number not in existing:
            course = OrderItemCourse(
                tenant_id=tenant_id,
                order_id=order.id,
                course_number=number,
                name={1: "Starters", 2: "Main course", 3: "Dessert"}.get(number),
                status="pending",
            )
            db.add(course)
            existing[number] = course

    # Drop courses whose items were all cancelled
    for number, course in existing.items():
        if number not in used and _status_value(course.status) == "pending":
            await db.delete(course)


async def recalculate_order(db: AsyncSession, order: Order) -> Order:
    """Recompute the denormalised order totals from live lines."""
    subtotal = Decimal("0")
    discount_total = Decimal("0")
    tax_total = Decimal("0")

    for item in order.items or []:
        if _status_value(item.status) == OrderItemStatus.CANCELLED.value:
            continue
        gross = _d(item.unit_price) * Decimal(int(item.qty or 1))
        # Addons are priced on top of the item line
        addons_total = sum(
            (_d(a.price) * Decimal(int(a.qty or 1)) for a in item.addons or []),
            Decimal("0"),
        )
        subtotal += gross + addons_total
        discount_total += _d(item.discount_amount)
        tax_total += _d(item.tax_amount)

    order.subtotal = _money(subtotal)
    order.discount_total = _money(discount_total)
    order.tax_total = _money(tax_total)
    # Service charge is decided at bill time; the order keeps the line-level view
    order.grand_total = _money(subtotal - discount_total + tax_total)

    await db.flush()
    return order


async def update_item_qty(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    order_id: uuid.UUID,
    order_item_id: uuid.UUID,
    *,
    qty: int | None = None,
    notes: str | None = None,
    discount_pct: float | None = None,
    course_number: int | None = None,
) -> OrderItem:
    """Adjust a line that hasn't reached the kitchen yet, or void a fired one."""
    order = await _load_order(db, tenant_id, order_id)
    item = next((i for i in order.items or [] if i.id == order_item_id), None)
    if item is None:
        raise ValueError("Order item not found")

    status = _status_value(item.status)

    if qty == 0:
        # A fired line must be voided through the KOT so the kitchen sees it
        if status in (OrderItemStatus.SENT_TO_KITCHEN.value,
                      OrderItemStatus.PREPARING.value,
                      OrderItemStatus.READY.value):
            from src.services.kot_service import cancel_fired_item
            await cancel_fired_item(
                db, tenant_id, item.id, reason="removed by captain"
            )
        else:
            item.status = OrderItemStatus.CANCELLED
        await recalculate_order(db, order)
        return item

    if status in (OrderItemStatus.READY.value, OrderItemStatus.SERVED.value):
        raise ValueError(
            "This item is already with the guest — cancel it from the bill instead"
        )

    if qty is not None:
        item.qty = qty
    if notes is not None:
        item.notes = notes
    if discount_pct is not None:
        item.discount_pct = discount_pct
    if course_number is not None:
        item.course_number = course_number

    tax_code = None
    if item.tax_code_id:
        tax_code = (
            await db.execute(
                select(TaxCode).where(TaxCode.id == item.tax_code_id)
            )
        ).scalars().first()

    addons_total = sum(
        (_d(a.price) * Decimal(int(a.qty or 1)) for a in item.addons or []),
        Decimal("0"),
    )
    line_total, discount_amount, tax_amount, _ = _compute_line_total(
        _d(item.unit_price), int(item.qty or 1), _money(addons_total),
        _d(item.discount_pct) if item.discount_pct is not None else None,
        tax_code,
    )
    item.discount_amount = discount_amount
    item.tax_amount = tax_amount
    item.total = line_total

    await _ensure_courses(db, tenant_id, order)
    await recalculate_order(db, order)
    return item


async def place_order(db: AsyncSession, tenant_id: uuid.UUID, order_id: uuid.UUID) -> Order:
    """Mark a draft order as placed so it appears on the floor board."""
    order = await _load_order(db, tenant_id, order_id)
    if _status_value(order.status) != OrderStatus.DRAFT.value:
        return order
    order.status = OrderStatus.PLACED
    order.placed_at = _now_iso()
    await db.flush()
    return order


async def cancel_order(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    order_id: uuid.UUID,
    *,
    reason: str | None = None,
) -> Order:
    """Cancel a whole order and release its table."""
    order = await _load_order(db, tenant_id, order_id)
    if _status_value(order.status) in (OrderStatus.SETTLED.value,):
        raise ValueError("A settled order cannot be cancelled — refund the bill instead")

    for item in order.items or []:
        if _status_value(item.status) != OrderItemStatus.SERVED.value:
            item.status = OrderItemStatus.CANCELLED

    order.status = OrderStatus.CANCELLED
    order.closed_at = _now_iso()
    if reason:
        order.notes = (order.notes or "") + f"\n[CANCELLED] {reason}".rstrip()

    await release_table(db, tenant_id, order)
    await recalculate_order(db, order)
    return order


async def release_table(db: AsyncSession, tenant_id: uuid.UUID, order: Order) -> None:
    """Close the table session and mark the table free."""
    if order.table_id is None:
        return

    stmt = (
        select(TableSession)
        .where(
            TableSession.order_id == order.id,
            TableSession.status == TableSessionStatus.ACTIVE,
        )
    )
    sessions = (await db.execute(stmt)).scalars().all()
    now = _now_iso()
    for session in sessions:
        session.status = TableSessionStatus.CLOSED
        session.ended_at = now

    table = (
        await db.execute(
            select(RestaurantTable).where(
                RestaurantTable.id == order.table_id,
                RestaurantTable.tenant_id == tenant_id,
            )
        )
    ).scalars().first()
    if table is not None:
        table.status = TableStatus.CLEANING  # staff flip it back to available


async def request_bill(db: AsyncSession, tenant_id: uuid.UUID, order_id: uuid.UUID) -> Order:
    order = await _load_order(db, tenant_id, order_id)
    order.status = OrderStatus.BILL_REQUESTED
    await db.flush()
    return order


async def transfer_table(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    order_id: uuid.UUID,
    target_table_id: uuid.UUID,
) -> Order:
    """Move a running order (and its session) to another table."""
    order = await _load_order(db, tenant_id, order_id)
    if _status_value(order.status) in (OrderStatus.SETTLED.value, OrderStatus.CANCELLED.value):
        raise ValueError("This order is already closed")

    target = (
        await db.execute(
            select(RestaurantTable)
            .options(selectinload(RestaurantTable.section))
            .where(
                RestaurantTable.id == target_table_id,
                RestaurantTable.tenant_id == tenant_id,
            )
        )
    ).scalars().first()
    if target is None:
        raise ValueError("Target table not found")
    if target.id != order.table_id:
        _check_table_available(target)

    # Release the old table
    old_table = None
    if order.table_id:
        old_table = (
            await db.execute(
                select(RestaurantTable).where(
                    RestaurantTable.id == order.table_id,
                    RestaurantTable.tenant_id == tenant_id,
                )
            )
        ).scalars().first()

    session = (
        await db.execute(
            select(TableSession).where(
                TableSession.order_id == order.id,
                TableSession.status == TableSessionStatus.ACTIVE,
            )
        )
    ).scalars().first()

    if old_table is not None:
        old_table.status = TableStatus.CLEANING

    order.table_id = target.id
    order.section_id = target.section_id
    if session is not None:
        session.table_id = target.id
    target.status = TableStatus.OCCUPIED

    await db.flush()
    return order


async def merge_order(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    source_order_id: uuid.UUID,
    target_order_id: uuid.UUID,
) -> Order:
    """Fold one order's items into another (guests joining a table)."""
    if source_order_id == target_order_id:
        raise ValueError("Cannot merge an order into itself")

    source = await _load_order(db, tenant_id, source_order_id)
    target = await _load_order(db, tenant_id, target_order_id)

    if _status_value(source.status) in (OrderStatus.SETTLED.value, OrderStatus.CANCELLED.value):
        raise ValueError("The source order is already closed")
    if _status_value(target.status) in (OrderStatus.SETTLED.value, OrderStatus.CANCELLED.value):
        raise ValueError("The target order is already closed")

    live_items = [
        i for i in source.items or []
        if _status_value(i.status) != OrderItemStatus.CANCELLED.value
    ]
    if not live_items:
        raise ValueError("The source order has no live items to merge")

    for item in live_items:
        item.order_id = target.id

    target.covers = (target.covers or 0) + (source.covers or 0)
    source.covers = 0

    # Move the source session onto the target table, then close the old order
    session = (
        await db.execute(
            select(TableSession).where(
                TableSession.order_id == source.id,
                TableSession.status == TableSessionStatus.ACTIVE,
            )
        )
    ).scalars().first()
    if session is not None and target.table_id:
        session.order_id = target.id
        session.table_id = target.table_id

    source.status = OrderStatus.CANCELLED
    source.closed_at = _now_iso()
    source.notes = (source.notes or "") + f"\n[MERGED INTO {target.order_number}]"

    await release_table(db, tenant_id, source)

    # The target order may need courses the source introduced
    await _refresh_target_courses(db, target)
    await recalculate_order(db, target)
    return target


async def _refresh_target_courses(db: AsyncSession, order: Order) -> None:
    await db.flush()
    await db.refresh(order, attribute_names=["items", "courses"])
    await _ensure_courses(db, order.tenant_id, order)


async def split_order(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    order_id: uuid.UUID,
    *,
    order_item_ids: list[uuid.UUID],
    target_order_id: uuid.UUID | None = None,
    new_table_id: uuid.UUID | None = None,
    covers: int | None = None,
) -> Order:
    """Split selected lines onto another order — either an existing one or a new table."""
    source = await _load_order(db, tenant_id, order_id)
    if _status_value(source.status) in (OrderStatus.SETTLED.value, OrderStatus.CANCELLED.value):
        raise ValueError("This order is already closed")

    wanted = {str(i) for i in order_item_ids}
    moving = [
        i for i in source.items or []
        if str(i.id) in wanted
        and _status_value(i.status) != OrderItemStatus.CANCELLED.value
    ]
    if not moving:
        raise ValueError("No live items matched the split request")

    fired = [
        i for i in moving
        if _status_value(i.status) in (
            OrderItemStatus.SENT_TO_KITCHEN.value,
            OrderItemStatus.PREPARING.value,
            OrderItemStatus.READY.value,
            OrderItemStatus.SERVED.value,
        )
    ]
    if fired:
        raise ValueError(
            "Only items that have not reached the kitchen can be split off. "
            "Fire and bill them separately instead."
        )

    if target_order_id:
        target = await _load_order(db, tenant_id, target_order_id)
    else:
        table = None
        if new_table_id:
            table = (
                await db.execute(
                    select(RestaurantTable)
                    .options(selectinload(RestaurantTable.section))
                    .where(
                        RestaurantTable.id == new_table_id,
                        RestaurantTable.tenant_id == tenant_id,
                    )
                )
            ).scalars().first()
            if table is None:
                raise ValueError("Target table not found")
            _check_table_available(table)

        target = Order(
            tenant_id=tenant_id,
            outlet_id=source.outlet_id,
            order_number=await allocate_number(db, tenant_id, "order", source.outlet_id),
            order_type=source.order_type,
            status=OrderStatus.PLACED,
            table_id=new_table_id,
            section_id=table.section_id if table else None,
            covers=covers or 1,
            waiter_id=source.waiter_id,
            customer_id=source.customer_id,
            customer_name=source.customer_name,
            customer_phone=source.customer_phone,
            placed_at=_now_iso(),
        )
        db.add(target)
        await db.flush()

        if table is not None:
            table.status = TableStatus.OCCUPIED
            db.add(TableSession(
                tenant_id=tenant_id,
                outlet_id=source.outlet_id,
                table_id=table.id,
                order_id=target.id,
                status=TableSessionStatus.ACTIVE,
                covers=target.covers,
                waiter_id=target.waiter_id,
                started_at=_now_iso(),
            ))

    for item in moving:
        item.order_id = target.id

    source.covers = max((source.covers or 1) - (covers or len(moving)), 1)
    target.covers = (target.covers or 0) + (covers or len(moving))

    await _refresh_target_courses(db, target)
    await recalculate_order(db, source)
    await recalculate_order(db, target)
    return target


async def seat_waitlist_entry(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    outlet_id: uuid.UUID,
    table_id: uuid.UUID,
    customer_name: str,
    customer_phone: str,
    covers: int,
    waiter_id: uuid.UUID | None = None,
) -> Order:
    """Turn a walk-in into a seated dine-in order."""
    return await create_order(db, tenant_id, OrderCreate(
        outlet_id=outlet_id,
        order_type=OrderType.DINE_IN,
        table_id=table_id,
        covers=covers,
        customer_name=customer_name,
        customer_phone=customer_phone,
        waiter_id=waiter_id,
        items=[],
    ))
