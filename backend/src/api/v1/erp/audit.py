from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission
from src.database.session import get_db
from src.models import AuditLog, User
from src.schemas.erp import AuditLogResponse
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/erp", tags=["Core ERP - Audit"])


@router.get("/audit-logs", response_model=PaginatedResponse[AuditLogResponse])
async def list_audit_logs(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    module: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = (
        select(AuditLog, User)
        .outerjoin(User, AuditLog.user_id == User.id)
        .where(AuditLog.tenant_id == ctx.tenant_id)
    )
    if module:
        query = query.where(AuditLog.module == module)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    
    items = []
    for log, usr in result.all():
        log_dict = {
            "id": log.id,
            "tenant_id": log.tenant_id,
            "user_id": log.user_id,
            "module": log.module,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "old_values": log.old_values,
            "new_values": log.new_values,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "status": log.status,
            "created_at": log.created_at,
            "user_name": usr.full_name if usr else "System",
            "user_email": usr.email if usr else None
        }
        items.append(log_dict)

    return paginate(items, total or 0, page, page_size)
