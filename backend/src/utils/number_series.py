"""Auto-generated document / entry numbers based on NumberSeries config."""
import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import NumberSeries


async def generate_number(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    module: str,
    company_id: uuid.UUID | None = None,
    fallback_prefix: str = "",
) -> str:
    """Return the next number for *module* / *company_id*, or a UUID-based fallback."""
    query = (
        select(NumberSeries)
        .where(
            NumberSeries.tenant_id == tenant_id,
            NumberSeries.module_name == module,
            NumberSeries.status == "active",
        )
        .order_by(NumberSeries.created_at.asc())
        .limit(1)
    )
    if company_id:
        query = query.where(NumberSeries.company_id == company_id)

    series = await db.scalar(query)

    if series:
        series.current_number += 1
        return (
            f"{series.prefix}{str(series.current_number).zfill(series.padding)}"
        )

    # Fallback: short date + random suffix
    import datetime
    suffix = str(uuid.uuid4())[:8].upper()
    prefix = fallback_prefix or module[:4].upper()
    return f"{prefix}-{datetime.date.today().strftime('%Y%m%d')}-{suffix}"
