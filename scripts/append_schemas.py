"""Append new ERP schemas to erp.py"""

SCHEMAS = """

# --- Workflow Engine Schemas ---

class ApprovalWorkflowCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    module: str = Field(min_length=1, max_length=100)
    description: str | None = None
    company_id: uuid.UUID | None = None
    steps: list | None = None
    is_active: bool = True
    status: str = "active"


class ApprovalWorkflowUpdate(BaseModel):
    name: str | None = None
    module: str | None = None
    description: str | None = None
    steps: list | None = None
    is_active: bool | None = None
    status: str | None = None


class ApprovalWorkflowResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID | None
    name: str
    module: str
    description: str | None
    steps: list | None
    is_active: bool
    status: str
    created_at: datetime
    updated_at: datetime


class NotificationTemplateCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    event: str = Field(min_length=1, max_length=100)
    channel: str = "email"
    subject: str | None = None
    body: str | None = None
    variables: list | None = None
    is_active: bool = True
    status: str = "active"


class NotificationTemplateUpdate(BaseModel):
    name: str | None = None
    event: str | None = None
    channel: str | None = None
    subject: str | None = None
    body: str | None = None
    variables: list | None = None
    is_active: bool | None = None
    status: str | None = None


class NotificationTemplateResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    event: str
    channel: str
    subject: str | None
    body: str | None
    variables: list | None
    is_active: bool
    status: str
    created_at: datetime
    updated_at: datetime


class DocumentTemplateCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    document_type: str = Field(min_length=1, max_length=100)
    format: str = "pdf"
    description: str | None = None
    template_content: str | None = None
    variables: list | None = None
    is_default: bool = False
    status: str = "active"


class DocumentTemplateUpdate(BaseModel):
    name: str | None = None
    document_type: str | None = None
    format: str | None = None
    description: str | None = None
    template_content: str | None = None
    variables: list | None = None
    is_default: bool | None = None
    status: str | None = None


class DocumentTemplateResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    document_type: str
    format: str
    description: str | None
    template_content: str | None
    variables: list | None
    is_default: bool
    status: str
    created_at: datetime
    updated_at: datetime


class AutomationRuleCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    module: str = Field(min_length=1, max_length=100)
    trigger_event: str = Field(min_length=1, max_length=100)
    conditions: dict | None = None
    actions: list | None = None
    is_active: bool = True
    status: str = "active"


class AutomationRuleUpdate(BaseModel):
    name: str | None = None
    module: str | None = None
    trigger_event: str | None = None
    conditions: dict | None = None
    actions: list | None = None
    is_active: bool | None = None
    status: str | None = None


class AutomationRuleResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    module: str
    trigger_event: str
    conditions: dict | None
    actions: list | None
    is_active: bool
    run_count: int
    last_run_at: datetime | None
    status: str
    created_at: datetime
    updated_at: datetime


class CustomFieldCreate(BaseModel):
    entity_type: str = Field(min_length=1, max_length=100)
    field_name: str = Field(min_length=1, max_length=100)
    field_label: str = Field(min_length=1, max_length=200)
    field_type: str = "text"
    is_required: bool = False
    options: list | None = None
    default_value: str | None = None
    sort_order: int = 0
    status: str = "active"


class CustomFieldUpdate(BaseModel):
    field_label: str | None = None
    field_type: str | None = None
    is_required: bool | None = None
    options: list | None = None
    default_value: str | None = None
    sort_order: int | None = None
    status: str | None = None


class CustomFieldResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    entity_type: str
    field_name: str
    field_label: str
    field_type: str
    is_required: bool
    options: list | None
    default_value: str | None
    sort_order: int
    status: str
    created_at: datetime
    updated_at: datetime


# --- Master Data Schemas ---

class GeographyCountryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    iso_code: str = Field(min_length=2, max_length=3)
    phone_code: str | None = None
    currency_code: str | None = None
    states: list | None = None
    status: str = "active"


class GeographyCountryUpdate(BaseModel):
    name: str | None = None
    phone_code: str | None = None
    currency_code: str | None = None
    states: list | None = None
    status: str | None = None


class GeographyCountryResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    iso_code: str
    phone_code: str | None
    currency_code: str | None
    states: list | None
    status: str
    created_at: datetime
    updated_at: datetime


class LocationCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=2, max_length=200)
    location_type: str = "office"
    company_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    status: str = "active"


class LocationUpdate(BaseModel):
    name: str | None = None
    location_type: str | None = None
    branch_id: uuid.UUID | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    status: str | None = None


class LocationResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID | None
    branch_id: uuid.UUID | None
    code: str
    name: str
    location_type: str
    address: str | None
    city: str | None
    state: str | None
    country: str | None
    latitude: float | None
    longitude: float | None
    status: str
    created_at: datetime
    updated_at: datetime


class WorkCalendarCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    calendar_type: str = "standard"
    company_id: uuid.UUID | None = None
    working_days: list | None = None
    shifts: list | None = None
    holidays: list | None = None
    is_default: bool = False
    status: str = "active"


class WorkCalendarUpdate(BaseModel):
    name: str | None = None
    calendar_type: str | None = None
    working_days: list | None = None
    shifts: list | None = None
    holidays: list | None = None
    is_default: bool | None = None
    status: str | None = None


class WorkCalendarResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID | None
    name: str
    calendar_type: str
    working_days: list | None
    shifts: list | None
    holidays: list | None
    is_default: bool
    status: str
    created_at: datetime
    updated_at: datetime


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    entity_type: str = "any"
    color: str = "#6366f1"
    description: str | None = None
    status: str = "active"


class TagUpdate(BaseModel):
    name: str | None = None
    entity_type: str | None = None
    color: str | None = None
    description: str | None = None
    status: str | None = None


class TagResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    entity_type: str
    color: str
    description: str | None
    status: str
    created_at: datetime
    updated_at: datetime


# --- System Settings Schemas ---

class SystemSettingUpdate(BaseModel):
    key: str = Field(min_length=1, max_length=100)
    value: str | None = None
    category: str = "general"
    description: str | None = None
    is_public: bool = False


class SystemSettingResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    key: str
    value: str | None
    category: str
    description: str | None
    is_public: bool
    created_at: datetime
    updated_at: datetime


class SystemSettingsBatchUpdate(BaseModel):
    settings: list[SystemSettingUpdate]
"""

with open("backend/src/schemas/erp.py", "a", encoding="utf-8") as f:
    f.write(SCHEMAS)

print("Done - schemas appended successfully")
