"""
Workflow Engine — Approval Workflows, Notification Templates,
Document Templates, Automation Rules, Custom Fields
"""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import (
    ApprovalWorkflow,
    NotificationTemplate,
    DocumentTemplate,
    AutomationRule,
    CustomField,
    EntityStatus,
)
from src.schemas.erp import (
    ApprovalWorkflowCreate,
    ApprovalWorkflowResponse,
    ApprovalWorkflowUpdate,
    NotificationTemplateCreate,
    NotificationTemplateResponse,
    NotificationTemplateUpdate,
    DocumentTemplateCreate,
    DocumentTemplateResponse,
    DocumentTemplateUpdate,
    AutomationRuleCreate,
    AutomationRuleResponse,
    AutomationRuleUpdate,
    CustomFieldCreate,
    CustomFieldResponse,
    CustomFieldUpdate,
)
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/erp", tags=["Core ERP - Workflow Engine"])


def _parse_status(value: str) -> EntityStatus:
    try:
        return EntityStatus(value.lower())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid status: {value}") from exc


# ─── Approval Workflows ───────────────────────────────────────────

@router.get("/approval-workflows", response_model=PaginatedResponse[ApprovalWorkflowResponse])
async def list_approval_workflows(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    module: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    query = select(ApprovalWorkflow).where(ApprovalWorkflow.tenant_id == ctx.tenant_id)
    if module:
        query = query.where(ApprovalWorkflow.module == module)
    if search:
        query = query.where(ApprovalWorkflow.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(ApprovalWorkflow.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/approval-workflows", response_model=ApprovalWorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_approval_workflow(
    payload: ApprovalWorkflowCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    wf = ApprovalWorkflow(
        tenant_id=ctx.tenant_id,
        company_id=payload.company_id,
        name=payload.name,
        module=payload.module,
        description=payload.description,
        steps=payload.steps or [],
        is_active=payload.is_active,
        status=_parse_status(payload.status),
    )
    db.add(wf)
    await db.flush()
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="created", entity_type="approval_workflow", entity_id=wf.id,
                          new_values=payload.model_dump(mode="json"),
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.commit()
    return wf


@router.get("/approval-workflows/{wf_id}", response_model=ApprovalWorkflowResponse)
async def get_approval_workflow(
    wf_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    wf = await db.scalar(select(ApprovalWorkflow).where(
        ApprovalWorkflow.id == wf_id, ApprovalWorkflow.tenant_id == ctx.tenant_id
    ))
    if not wf:
        raise HTTPException(status_code=404, detail="Approval workflow not found")
    return wf


@router.patch("/approval-workflows/{wf_id}", response_model=ApprovalWorkflowResponse)
async def update_approval_workflow(
    wf_id: uuid.UUID,
    payload: ApprovalWorkflowUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    wf = await db.scalar(select(ApprovalWorkflow).where(
        ApprovalWorkflow.id == wf_id, ApprovalWorkflow.tenant_id == ctx.tenant_id
    ))
    if not wf:
        raise HTTPException(status_code=404, detail="Approval workflow not found")

    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates:
        updates["status"] = _parse_status(updates["status"])
    for key, value in updates.items():
        setattr(wf, key, value)

    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="updated", entity_type="approval_workflow", entity_id=wf.id,
                          new_values=updates,
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.commit()
    return wf


@router.delete("/approval-workflows/{wf_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_approval_workflow(
    wf_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    wf = await db.scalar(select(ApprovalWorkflow).where(
        ApprovalWorkflow.id == wf_id, ApprovalWorkflow.tenant_id == ctx.tenant_id
    ))
    if not wf:
        raise HTTPException(status_code=404, detail="Approval workflow not found")
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="deleted", entity_type="approval_workflow", entity_id=wf.id,
                          old_values={"name": wf.name},
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.delete(wf)
    await db.commit()


# ─── Notification Templates ───────────────────────────────────────

@router.get("/notification-templates", response_model=PaginatedResponse[NotificationTemplateResponse])
async def list_notification_templates(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    channel: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    query = select(NotificationTemplate).where(NotificationTemplate.tenant_id == ctx.tenant_id)
    if channel:
        query = query.where(NotificationTemplate.channel == channel)
    if search:
        query = query.where(NotificationTemplate.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(NotificationTemplate.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/notification-templates", response_model=NotificationTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_notification_template(
    payload: NotificationTemplateCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tpl = NotificationTemplate(
        tenant_id=ctx.tenant_id,
        name=payload.name,
        event=payload.event,
        channel=payload.channel,
        subject=payload.subject,
        body=payload.body,
        variables=payload.variables or [],
        is_active=payload.is_active,
        status=_parse_status(payload.status),
    )
    db.add(tpl)
    await db.flush()
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="created", entity_type="notification_template", entity_id=tpl.id,
                          new_values=payload.model_dump(mode="json"),
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.commit()
    return tpl


@router.get("/notification-templates/{tpl_id}", response_model=NotificationTemplateResponse)
async def get_notification_template(
    tpl_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tpl = await db.scalar(select(NotificationTemplate).where(
        NotificationTemplate.id == tpl_id, NotificationTemplate.tenant_id == ctx.tenant_id
    ))
    if not tpl:
        raise HTTPException(status_code=404, detail="Notification template not found")
    return tpl


@router.patch("/notification-templates/{tpl_id}", response_model=NotificationTemplateResponse)
async def update_notification_template(
    tpl_id: uuid.UUID,
    payload: NotificationTemplateUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tpl = await db.scalar(select(NotificationTemplate).where(
        NotificationTemplate.id == tpl_id, NotificationTemplate.tenant_id == ctx.tenant_id
    ))
    if not tpl:
        raise HTTPException(status_code=404, detail="Notification template not found")

    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates:
        updates["status"] = _parse_status(updates["status"])
    for key, value in updates.items():
        setattr(tpl, key, value)

    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="updated", entity_type="notification_template", entity_id=tpl.id,
                          new_values=updates,
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.commit()
    return tpl


@router.delete("/notification-templates/{tpl_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification_template(
    tpl_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tpl = await db.scalar(select(NotificationTemplate).where(
        NotificationTemplate.id == tpl_id, NotificationTemplate.tenant_id == ctx.tenant_id
    ))
    if not tpl:
        raise HTTPException(status_code=404, detail="Notification template not found")
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="deleted", entity_type="notification_template", entity_id=tpl.id,
                          old_values={"name": tpl.name},
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.delete(tpl)
    await db.commit()


# ─── Document Templates ───────────────────────────────────────────

@router.get("/document-templates", response_model=PaginatedResponse[DocumentTemplateResponse])
async def list_document_templates(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    document_type: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    query = select(DocumentTemplate).where(DocumentTemplate.tenant_id == ctx.tenant_id)
    if document_type:
        query = query.where(DocumentTemplate.document_type == document_type)
    if search:
        query = query.where(DocumentTemplate.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(DocumentTemplate.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/document-templates", response_model=DocumentTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_document_template(
    payload: DocumentTemplateCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    dt = DocumentTemplate(
        tenant_id=ctx.tenant_id,
        name=payload.name,
        document_type=payload.document_type,
        format=payload.format,
        description=payload.description,
        template_content=payload.template_content,
        variables=payload.variables or [],
        is_default=payload.is_default,
        status=_parse_status(payload.status),
    )
    db.add(dt)
    await db.flush()
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="created", entity_type="document_template", entity_id=dt.id,
                          new_values=payload.model_dump(mode="json", exclude={"template_content"}),
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.commit()
    return dt


@router.get("/document-templates/{dt_id}", response_model=DocumentTemplateResponse)
async def get_document_template(
    dt_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    dt = await db.scalar(select(DocumentTemplate).where(
        DocumentTemplate.id == dt_id, DocumentTemplate.tenant_id == ctx.tenant_id
    ))
    if not dt:
        raise HTTPException(status_code=404, detail="Document template not found")
    return dt


@router.patch("/document-templates/{dt_id}", response_model=DocumentTemplateResponse)
async def update_document_template(
    dt_id: uuid.UUID,
    payload: DocumentTemplateUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    dt = await db.scalar(select(DocumentTemplate).where(
        DocumentTemplate.id == dt_id, DocumentTemplate.tenant_id == ctx.tenant_id
    ))
    if not dt:
        raise HTTPException(status_code=404, detail="Document template not found")

    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates:
        updates["status"] = _parse_status(updates["status"])
    for key, value in updates.items():
        setattr(dt, key, value)

    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="updated", entity_type="document_template", entity_id=dt.id,
                          new_values={k: v for k, v in updates.items() if k != "template_content"},
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.commit()
    return dt


@router.delete("/document-templates/{dt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document_template(
    dt_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    dt = await db.scalar(select(DocumentTemplate).where(
        DocumentTemplate.id == dt_id, DocumentTemplate.tenant_id == ctx.tenant_id
    ))
    if not dt:
        raise HTTPException(status_code=404, detail="Document template not found")
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="deleted", entity_type="document_template", entity_id=dt.id,
                          old_values={"name": dt.name},
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.delete(dt)
    await db.commit()


# ─── Automation Rules ─────────────────────────────────────────────

@router.get("/automation-rules", response_model=PaginatedResponse[AutomationRuleResponse])
async def list_automation_rules(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    module: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    query = select(AutomationRule).where(AutomationRule.tenant_id == ctx.tenant_id)
    if module:
        query = query.where(AutomationRule.module == module)
    if search:
        query = query.where(AutomationRule.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(AutomationRule.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/automation-rules", response_model=AutomationRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_automation_rule(
    payload: AutomationRuleCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    rule = AutomationRule(
        tenant_id=ctx.tenant_id,
        name=payload.name,
        module=payload.module,
        trigger_event=payload.trigger_event,
        conditions=payload.conditions or {},
        actions=payload.actions or [],
        is_active=payload.is_active,
        status=_parse_status(payload.status),
    )
    db.add(rule)
    await db.flush()
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="created", entity_type="automation_rule", entity_id=rule.id,
                          new_values=payload.model_dump(mode="json"),
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.commit()
    return rule


@router.get("/automation-rules/{rule_id}", response_model=AutomationRuleResponse)
async def get_automation_rule(
    rule_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    rule = await db.scalar(select(AutomationRule).where(
        AutomationRule.id == rule_id, AutomationRule.tenant_id == ctx.tenant_id
    ))
    if not rule:
        raise HTTPException(status_code=404, detail="Automation rule not found")
    return rule


@router.patch("/automation-rules/{rule_id}", response_model=AutomationRuleResponse)
async def update_automation_rule(
    rule_id: uuid.UUID,
    payload: AutomationRuleUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    rule = await db.scalar(select(AutomationRule).where(
        AutomationRule.id == rule_id, AutomationRule.tenant_id == ctx.tenant_id
    ))
    if not rule:
        raise HTTPException(status_code=404, detail="Automation rule not found")

    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates:
        updates["status"] = _parse_status(updates["status"])
    for key, value in updates.items():
        setattr(rule, key, value)

    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="updated", entity_type="automation_rule", entity_id=rule.id,
                          new_values=updates,
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.commit()
    return rule


@router.delete("/automation-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_automation_rule(
    rule_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    rule = await db.scalar(select(AutomationRule).where(
        AutomationRule.id == rule_id, AutomationRule.tenant_id == ctx.tenant_id
    ))
    if not rule:
        raise HTTPException(status_code=404, detail="Automation rule not found")
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="deleted", entity_type="automation_rule", entity_id=rule.id,
                          old_values={"name": rule.name},
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.delete(rule)
    await db.commit()


# ─── Custom Fields ────────────────────────────────────────────────

@router.get("/custom-fields", response_model=PaginatedResponse[CustomFieldResponse])
async def list_custom_fields(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    entity_type: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
):
    query = select(CustomField).where(CustomField.tenant_id == ctx.tenant_id)
    if entity_type:
        query = query.where(CustomField.entity_type == entity_type)
    if search:
        query = query.where(CustomField.field_label.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(CustomField.entity_type, CustomField.sort_order).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/custom-fields", response_model=CustomFieldResponse, status_code=status.HTTP_201_CREATED)
async def create_custom_field(
    payload: CustomFieldCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cf = CustomField(
        tenant_id=ctx.tenant_id,
        entity_type=payload.entity_type,
        field_name=payload.field_name,
        field_label=payload.field_label,
        field_type=payload.field_type,
        is_required=payload.is_required,
        options=payload.options,
        default_value=payload.default_value,
        sort_order=payload.sort_order,
        status=_parse_status(payload.status),
    )
    db.add(cf)
    await db.flush()
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="created", entity_type="custom_field", entity_id=cf.id,
                          new_values=payload.model_dump(mode="json"),
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.commit()
    return cf


@router.get("/custom-fields/{cf_id}", response_model=CustomFieldResponse)
async def get_custom_field(
    cf_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cf = await db.scalar(select(CustomField).where(
        CustomField.id == cf_id, CustomField.tenant_id == ctx.tenant_id
    ))
    if not cf:
        raise HTTPException(status_code=404, detail="Custom field not found")
    return cf


@router.patch("/custom-fields/{cf_id}", response_model=CustomFieldResponse)
async def update_custom_field(
    cf_id: uuid.UUID,
    payload: CustomFieldUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cf = await db.scalar(select(CustomField).where(
        CustomField.id == cf_id, CustomField.tenant_id == ctx.tenant_id
    ))
    if not cf:
        raise HTTPException(status_code=404, detail="Custom field not found")

    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates:
        updates["status"] = _parse_status(updates["status"])
    for key, value in updates.items():
        setattr(cf, key, value)

    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="updated", entity_type="custom_field", entity_id=cf.id,
                          new_values=updates,
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.commit()
    return cf


@router.delete("/custom-fields/{cf_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_field(
    cf_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cf = await db.scalar(select(CustomField).where(
        CustomField.id == cf_id, CustomField.tenant_id == ctx.tenant_id
    ))
    if not cf:
        raise HTTPException(status_code=404, detail="Custom field not found")
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="deleted", entity_type="custom_field", entity_id=cf.id,
                          old_values={"field_name": cf.field_name, "entity_type": cf.entity_type},
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.delete(cf)
    await db.commit()
