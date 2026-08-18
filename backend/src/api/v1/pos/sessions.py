from typing import Annotated
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, get_current_user_context
from src.database.session import get_db
from src.models import POSSession, POSSessionStatus
from src.schemas.erp import POSSessionCreate, POSSessionClose, POSSessionResponse

router = APIRouter(prefix="/sessions", tags=["POS - Sessions"])

@router.post("/open", response_model=POSSessionResponse)
async def open_session(
    payload: POSSessionCreate,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Open a new POS register session."""
    stmt = select(POSSession).where(
        POSSession.user_id == ctx.user.id,
        POSSession.status == POSSessionStatus.OPEN
    ).order_by(POSSession.created_at.desc())
    result = await db.execute(stmt)
    existing = result.scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="A session is already open for this user.")

    session = POSSession(
        user_id=ctx.user.id,
        tenant_id=ctx.user.tenant_id,
        starting_cash=payload.starting_cash,
        status=POSSessionStatus.OPEN
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session

@router.post("/{session_id}/close", response_model=POSSessionResponse)
async def close_session(
    session_id: uuid.UUID,
    payload: POSSessionClose,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Close an open POS register session."""
    stmt = select(POSSession).where(
        POSSession.id == session_id,
        POSSession.user_id == ctx.user.id
    )
    result = await db.execute(stmt)
    session = result.scalars().first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.status == POSSessionStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Session is already closed.")

    from sqlalchemy import func
    session.status = POSSessionStatus.CLOSED
    session.closing_time = func.now()
    session.expected_cash = payload.expected_cash
    session.actual_cash = payload.actual_cash
    session.discrepancy_reason = payload.discrepancy_reason

    await db.commit()
    await db.refresh(session)
    return session

@router.get("/current", response_model=POSSessionResponse)
async def get_current_session(
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Get the currently open POS session for the user."""
    stmt = select(POSSession).where(
        POSSession.user_id == ctx.user.id,
        POSSession.status == POSSessionStatus.OPEN
    ).order_by(POSSession.created_at.desc())
    result = await db.execute(stmt)
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="No active session found.")
    return session
