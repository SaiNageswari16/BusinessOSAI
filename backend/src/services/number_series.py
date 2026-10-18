"""Auto-generated document numbers based on NumberSeries config.

Number allocation and the caller's row insert MUST share one transaction —
we take a row lock with SELECT ... FOR UPDATE so concurrent cashiers can't
get the same number.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


# Default formats per module: (prefix_template, padding, reset_period)
MODULE_DEFAULTS: dict[str, tuple[str, int, str]] = {
    "order": ("ORD-{outlet}-%y%m-", 4, "monthly"),
    "kot": ("KOT-{outlet}-%y%m-", 4, "monthly"),
    "bill": ("INV-{outlet}-%y%m-", 4, "monthly"),
    "shift": ("SHF-{outlet}-%y%m-", 3, "monthly"),
    "purchase_request": ("PR-{outlet}-%y%m-", 4, "monthly"),
    "purchase_order": ("PO-{outlet}-%y%m-", 4, "monthly"),
    "grn": ("GRN-{outlet}-%y%m-", 4, "monthly"),
    "vendor_bill": ("VB-{outlet}-%y%m-", 4, "monthly"),
    "adjustment": ("ADJ-{outlet}-%y%m-", 4, "monthly"),
    "wastage": ("WST-{outlet}-%y%m-", 4, "monthly"),
    "production_batch": ("PRD-{outlet}-%y%m-", 4, "monthly"),
    "transfer": ("TRF-%y%m-", 4, "monthly"),
    "reservation": ("RSV-{outlet}-%y%m-", 4, "monthly"),
    "journal_entry": ("JE-%y%m-", 4, "monthly"),
    "gst_return": ("GSTR-%y%m-", 3, "monthly"),
}

MODULE_ALIASES: dict[str, list[str]] = {
    "invoice": ["bill", "bills", "invoice", "invoices"],
    "order": ["orders", "order", "sales_order"],
    "kot": ["kots", "kot", "kitchen_order"],
    "purchase_order": ["purchase_orders", "po"],
    "grn": ["goods_receipt_notes", "grn"],
}


def _format_prefix(template: str, outlet_code: str | None) -> str:
    now = datetime.now(timezone.utc)
    code = (outlet_code or "MAIN").upper()
    try:
        return now.strftime(template.replace("{outlet}", code))
    except Exception:
        return template.replace("{outlet}", code)


def _should_reset(reset_period: str, last_used: datetime | None) -> bool:
    if reset_period == "never" or last_used is None:
        return False
    now = datetime.now(timezone.utc)
    if reset_period == "monthly":
        return (last_used.year, last_used.month) != (now.year, now.month)
    if reset_period == "yearly":
        return last_used.year != now.year
    return False


async def _get_outlet_code(db: AsyncSession, outlet_id: uuid.UUID | None) -> str:
    if not outlet_id:
        return "MAIN"
    from src.models import Outlet
    code = await db.scalar(select(Outlet.code).where(Outlet.id == outlet_id))
    return code or "MAIN"


async def allocate_number(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    module: str,
    outlet_id: uuid.UUID | None = None,
) -> str:
    """Allocate the next number for a module. Call inside the caller's transaction."""
    from src.models import NumberSeries, Outlet

    module = (module or "").strip().lower()

    # Row lock on the series so concurrent allocations serialize
    stmt = (
        select(NumberSeries)
        .where(
            NumberSeries.tenant_id == tenant_id,
            NumberSeries.module == module,
            NumberSeries.outlet_id == outlet_id,
        )
        .with_for_update()
    )
    series = (await db.execute(stmt)).scalars().first()

    if series is None:
        prefix_tpl, padding, reset_period = MODULE_DEFAULTS.get(module, (f"{module.upper()}-", 4, "monthly"))
        outlet_code = await _get_outlet_code(db, outlet_id)
        series = NumberSeries(
            tenant_id=tenant_id,
            module=module,
            outlet_id=outlet_id,
            prefix=_format_prefix(prefix_tpl, outlet_code),
            suffix="",
            next_number=1,
            padding=padding,
            reset_period=reset_period,
            is_active=True,
        )
        db.add(series)
        await db.flush()
        # Re-select under lock now that the row exists
        series = (await db.execute(stmt)).scalars().one()

    # Reset counter on period rollover
    if series.reset_period and series.reset_period != "never" and series.updated_at:
        if _should_reset(series.reset_period, series.updated_at):
            series.next_number = 1
            prefix_tpl, _, _ = MODULE_DEFAULTS.get(module, (f"{module.upper()}-", 4, "monthly"))
            outlet_code = await _get_outlet_code(db, outlet_id)
            series.prefix = _format_prefix(prefix_tpl, outlet_code)

    number = series.next_number
    series.next_number = number + 1
    await db.flush()

    return f"{series.prefix or ''}{str(number).zfill(series.padding or 4)}{series.suffix or ''}"


async def ensure_series_for_outlet(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
) -> None:
    """Create default series rows for a new outlet."""
    from src.models import NumberSeries

    outlet_code = await _get_outlet_code(db, outlet_id)
    for module, (prefix_tpl, padding, reset_period) in MODULE_DEFAULTS.items():
        exists = await db.scalar(
            select(NumberSeries.id).where(
                NumberSeries.tenant_id == tenant_id,
                NumberSeries.module == module,
                NumberSeries.outlet_id == outlet_id,
            )
        )
        if not exists:
            db.add(NumberSeries(
                tenant_id=tenant_id,
                module=module,
                outlet_id=outlet_id,
                prefix=_format_prefix(prefix_tpl, outlet_code),
                padding=padding,
                reset_period=reset_period,
                next_number=1,
                is_active=True,
            ))
    await db.flush()
