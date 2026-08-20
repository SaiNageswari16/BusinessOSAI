"""Free-quantity promotional rules stored in tenant settings."""
import uuid
from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from src.api.deps import CurrentUserContext, require_permission
from src.database.session import get_db
from src.models import Tenant

router = APIRouter(prefix="/pos", tags=["POS - Free Quantity Rules"])

RuleType = Literal["min_cart_amount", "min_product_qty", "company_offer"]


class FreeQtyRule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(min_length=1, max_length=120)
    rule_type: RuleType = "min_cart_amount"
    threshold: float = Field(default=0, ge=0)
    trigger_product_id: Optional[str] = None
    trigger_product_name: Optional[str] = None
    free_product_id: Optional[str] = None
    free_product_name: Optional[str] = None
    free_qty: int = Field(default=1, ge=1)
    active: bool = True


class FreeQtyRulesPayload(BaseModel):
    rules: List[FreeQtyRule] = Field(default_factory=list)


class FreeQtyEvaluateRequest(BaseModel):
    cart_subtotal: float = Field(default=0, ge=0)
    cart_items: List[dict] = Field(default_factory=list)


class FreeQtyEvaluateResponse(BaseModel):
    rules_met: List[str] = Field(default_factory=list)
    rules_failed: List[dict] = Field(default_factory=list)
    can_add_free: bool = False


async def _get_tenant_settings(db: AsyncSession, tenant_id: uuid.UUID) -> dict:
    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return dict(tenant.settings or {}), tenant


def _evaluate_rules(rules: list, cart_subtotal: float, cart_items: list) -> FreeQtyEvaluateResponse:
    active = [r for r in rules if r.get("active", True)]
    met: list[str] = []
    failed: list[dict] = []

    for rule in active:
        rtype = rule.get("rule_type", "min_cart_amount")
        threshold = float(rule.get("threshold") or 0)
        name = rule.get("name") or "Rule"

        if rtype == "company_offer":
            met.append(name)
            continue

        if rtype == "min_cart_amount":
            if cart_subtotal >= threshold:
                met.append(name)
            else:
                failed.append({
                    "name": name,
                    "reason": f"Cart total {cart_subtotal:.2f} is below required {threshold:.2f}",
                })
            continue

        if rtype == "min_product_qty":
            trigger_id = rule.get("trigger_product_id")
            trigger_name = (rule.get("trigger_product_name") or "").lower()
            required_qty = int(threshold or 1)
            matched_qty = 0
            for item in cart_items:
                pid = str(item.get("product_id") or item.get("id") or "")
                pname = (item.get("product_name") or item.get("name") or "").lower()
                qty = int(item.get("quantity") or item.get("qty") or 0)
                if trigger_id and pid == str(trigger_id):
                    matched_qty += qty
                elif trigger_name and trigger_name in pname:
                    matched_qty += qty
            if matched_qty >= required_qty:
                met.append(name)
            else:
                failed.append({
                    "name": name,
                    "reason": f"Need qty {required_qty} of trigger product (have {matched_qty})",
                })

    return FreeQtyEvaluateResponse(
        rules_met=met,
        rules_failed=failed,
        can_add_free=len(met) > 0 or not active,
    )


@router.get("/free-qty-rules", response_model=List[FreeQtyRule])
async def list_free_qty_rules(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:pos"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    settings, _ = await _get_tenant_settings(db, ctx.tenant_id)
    return settings.get("free_qty_rules") or []


@router.put("/free-qty-rules", response_model=List[FreeQtyRule])
async def save_free_qty_rules(
    payload: FreeQtyRulesPayload,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:pos"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    settings, tenant = await _get_tenant_settings(db, ctx.tenant_id)
    settings["free_qty_rules"] = [r.model_dump() for r in payload.rules]
    tenant.settings = settings
    flag_modified(tenant, "settings")
    await db.commit()
    return payload.rules


@router.post("/free-qty-rules/evaluate", response_model=FreeQtyEvaluateResponse)
async def evaluate_free_qty_rules(
    payload: FreeQtyEvaluateRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:pos"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    settings, _ = await _get_tenant_settings(db, ctx.tenant_id)
    rules = settings.get("free_qty_rules") or []
    return _evaluate_rules(rules, payload.cart_subtotal, payload.cart_items)
