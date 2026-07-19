import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Auth ────────────────────────────────────────────────────────

class TenantRegisterRequest(BaseModel):
    tenant_name: str = Field(min_length=2, max_length=255)
    tenant_slug: str | None = Field(default=None, max_length=100)
    admin_name: str = Field(min_length=2, max_length=255)
    admin_email: EmailStr
    admin_password: str = Field(min_length=8, max_length=128)
    company_name: str = Field(min_length=2, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    tenant_slug: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    must_change_password: bool = False
    requires_role_selection: bool = False


class RefreshRequest(BaseModel):
    refresh_token: str


class RoleSummary(ORMModel):
    id: uuid.UUID
    name: str
    is_default: bool = False


class UserMeResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    full_name: str
    employee_id: str | None
    phone: str | None
    avatar_initials: str | None
    status: str
    mfa_enabled: bool
    must_change_password: bool = False
    active_role_id: uuid.UUID | None = None
    tenant_slug: str | None = None
    is_tenant_owner: bool = False
    permissions: list[str]
    roles: list[RoleSummary]





# ─── Shared ──────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str


class CompanyBase(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    legal_name: str = Field(min_length=2, max_length=255)
    company_type: str | None = None
    gst_number: str | None = None
    pan_number: str | None = None
    registration_number: str | None = None
    industry: str | None = None
    country: str | None = None
    state: str | None = None
    city: str | None = None
    address: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    website: str | None = None
    default_currency_code: str = "INR"
    timezone: str = "Asia/Kolkata"
    language: str = "en"
    financial_year_start_month: int = Field(default=4, ge=1, le=12)
    tax_config_label: str | None = None
    plan: str | None = None
    logo_initials: str | None = Field(default=None, max_length=5)
    established_date: date | None = None
    status: str = "active"


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: str | None = None
    legal_name: str | None = None
    company_type: str | None = None
    gst_number: str | None = None
    pan_number: str | None = None
    registration_number: str | None = None
    industry: str | None = None
    country: str | None = None
    state: str | None = None
    city: str | None = None
    address: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    website: str | None = None
    default_currency_code: str | None = None
    timezone: str | None = None
    language: str | None = None
    financial_year_start_month: int | None = Field(default=None, ge=1, le=12)
    tax_config_label: str | None = None
    plan: str | None = None
    logo_initials: str | None = None
    established_date: date | None = None
    status: str | None = None


class CompanyResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    legal_name: str
    company_type: str | None
    gst_number: str | None
    pan_number: str | None
    registration_number: str | None
    industry: str | None
    country: str | None
    state: str | None
    city: str | None
    address: str | None
    phone: str | None
    email: str | None
    website: str | None
    default_currency_code: str
    timezone: str
    language: str
    financial_year_start_month: int
    tax_config_label: str | None
    plan: str | None
    logo_initials: str | None
    established_date: date | None
    status: str
    created_at: datetime
    updated_at: datetime


class BranchBase(BaseModel):
    company_id: uuid.UUID
    region_id: uuid.UUID | None = None
    zone_id: uuid.UUID | None = None
    code: str = Field(min_length=2, max_length=30)
    name: str = Field(min_length=2, max_length=255)
    manager_user_id: uuid.UUID | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    has_warehouse: bool = False
    working_hours: str | None = None
    opening_date: date | None = None
    status: str = "active"


class BranchCreate(BranchBase):
    pass


class BranchUpdate(BaseModel):
    region_id: uuid.UUID | None = None
    zone_id: uuid.UUID | None = None
    code: str | None = None
    name: str | None = None
    manager_user_id: uuid.UUID | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    has_warehouse: bool | None = None
    working_hours: str | None = None
    opening_date: date | None = None
    status: str | None = None


class BranchResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID
    region_id: uuid.UUID | None
    zone_id: uuid.UUID | None
    code: str
    name: str
    manager_user_id: uuid.UUID | None
    address: str | None
    city: str | None
    state: str | None
    country: str | None
    phone: str | None
    email: str | None
    has_warehouse: bool
    working_hours: str | None
    opening_date: date | None
    status: str
    created_at: datetime
    updated_at: datetime


class DepartmentBase(BaseModel):
    company_id: uuid.UUID
    branch_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None
    name: str
    code: str
    head_user_id: uuid.UUID | None = None
    status: str = "active"


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    branch_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None
    name: str | None = None
    code: str | None = None
    head_user_id: uuid.UUID | None = None
    status: str | None = None


class DepartmentResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID
    branch_id: uuid.UUID | None
    parent_id: uuid.UUID | None
    name: str
    code: str
    head_user_id: uuid.UUID | None
    status: str
    created_at: datetime
    updated_at: datetime


class DesignationBase(BaseModel):
    company_id: uuid.UUID
    name: str
    level: str | None = None
    status: str = "active"


class DesignationCreate(DesignationBase):
    pass


class DesignationUpdate(BaseModel):
    name: str | None = None
    level: str | None = None
    status: str | None = None


class DesignationResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID
    name: str
    level: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class RoleBase(BaseModel):
    name: str
    description: str | None = None
    permission_codes: list[str] = Field(default_factory=list)
    status: str = "active"


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    permission_codes: list[str] | None = None
    status: str | None = None


class PermissionResponse(ORMModel):
    id: uuid.UUID
    code: str
    name: str
    module: str
    description: str | None


class RoleResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: str | None
    is_system: bool
    status: str
    permissions: list[PermissionResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str | None = Field(default=None, min_length=8, max_length=128)
    send_invite: bool = False
    must_change_password: bool | None = None
    full_name: str
    employee_id: str | None = None
    phone: str | None = None
    avatar_initials: str | None = None
    role_ids: list[uuid.UUID] = Field(default_factory=list)
    branch_ids: list[uuid.UUID] = Field(default_factory=list)
    default_role_id: uuid.UUID | None = None
    status: str = "active"


class UserUpdate(BaseModel):
    full_name: str | None = None
    employee_id: str | None = None
    phone: str | None = None
    avatar_initials: str | None = None
    role_ids: list[uuid.UUID] | None = None
    branch_ids: list[uuid.UUID] | None = None
    default_role_id: uuid.UUID | None = None
    status: str | None = None
    must_change_password: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    full_name: str
    employee_id: str | None
    phone: str | None
    avatar_initials: str | None
    status: str
    mfa_enabled: bool
    must_change_password: bool
    last_login_at: datetime | None
    roles: list[RoleSummary] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(default="", max_length=128)
    new_password: str = Field(min_length=8, max_length=128)



class SelectRoleRequest(BaseModel):
    role_id: uuid.UUID




class RegionBase(BaseModel):
    company_id: uuid.UUID
    name: str = Field(min_length=2, max_length=150)
    code: str = Field(min_length=2, max_length=20)
    country: str | None = None
    manager_user_id: uuid.UUID | None = None
    status: str = "active"


class RegionCreate(RegionBase):
    pass


class RegionUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    country: str | None = None
    manager_user_id: uuid.UUID | None = None
    status: str | None = None


class RegionResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID
    name: str
    code: str
    country: str | None
    manager_user_id: uuid.UUID | None
    status: str
    created_at: datetime
    updated_at: datetime


class ZoneBase(BaseModel):
    region_id: uuid.UUID
    name: str = Field(min_length=2, max_length=150)
    manager_user_id: uuid.UUID | None = None
    status: str = "active"


class ZoneCreate(ZoneBase):
    pass


class ZoneUpdate(BaseModel):
    name: str | None = None
    manager_user_id: uuid.UUID | None = None
    status: str | None = None


class ZoneResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    region_id: uuid.UUID
    name: str
    manager_user_id: uuid.UUID | None
    status: str
    created_at: datetime
    updated_at: datetime


class TeamBase(BaseModel):
    department_id: uuid.UUID
    branch_id: uuid.UUID | None = None
    name: str = Field(min_length=2, max_length=150)
    lead_user_id: uuid.UUID | None = None
    status: str = "active"


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    name: str | None = None
    lead_user_id: uuid.UUID | None = None
    status: str | None = None


class TeamResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    department_id: uuid.UUID
    branch_id: uuid.UUID | None
    name: str
    lead_user_id: uuid.UUID | None
    status: str
    created_at: datetime
    updated_at: datetime


class BusinessUnitBase(BaseModel):
    company_id: uuid.UUID
    name: str = Field(min_length=2, max_length=150)
    head_user_id: uuid.UUID | None = None
    status: str = "active"


class BusinessUnitCreate(BusinessUnitBase):
    pass


class BusinessUnitUpdate(BaseModel):
    name: str | None = None
    head_user_id: uuid.UUID | None = None
    status: str | None = None


class BusinessUnitResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID
    name: str
    head_user_id: uuid.UUID | None
    status: str
    created_at: datetime
    updated_at: datetime


class AuditLogResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID | None
    module: str
    action: str
    entity_type: str | None
    entity_id: uuid.UUID | None
    old_values: dict | None
    new_values: dict | None
    ip_address: str | None
    user_agent: str | None
    status: str
    created_at: datetime
    user_name: str | None = None
    user_email: str | None = None


# ─── Financial / Accounting Schemas ─────────────────────────────────────────


class FiscalYearBase(BaseModel):
    company_id: uuid.UUID
    name: str = Field(min_length=4, max_length=20)
    start_date: date
    end_date: date
    status: str = "open"


class FiscalYearCreate(FiscalYearBase):
    pass


class FiscalYearUpdate(BaseModel):
    name: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: str | None = None


class FiscalYearResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID
    name: str
    start_date: date
    end_date: date
    status: str
    created_at: datetime
    updated_at: datetime


class CurrencyBase(BaseModel):
    code: str = Field(min_length=2, max_length=10)
    symbol: str = Field(min_length=1, max_length=5)
    exchange_rate: float = 1.0
    decimal_places: int = 2
    is_default: bool = False
    status: str = "active"


class CurrencyCreate(CurrencyBase):
    pass


class CurrencyUpdate(BaseModel):
    symbol: str | None = None
    exchange_rate: float | None = None
    decimal_places: int | None = None
    is_default: bool | None = None
    status: str | None = None


class CurrencyResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    code: str
    symbol: str
    exchange_rate: float
    decimal_places: int
    is_default: bool
    status: str
    created_at: datetime
    updated_at: datetime


class TaxConfigurationBase(BaseModel):
    company_id: uuid.UUID
    name: str = Field(min_length=2, max_length=150)
    tax_type: str = Field(min_length=2, max_length=50)
    rate_percent: float
    components: str | None = None
    status: str = "active"


class TaxConfigurationCreate(TaxConfigurationBase):
    pass


class TaxConfigurationUpdate(BaseModel):
    name: str | None = None
    tax_type: str | None = None
    rate_percent: float | None = None
    components: str | None = None
    status: str | None = None


class TaxConfigurationResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID
    name: str
    tax_type: str
    rate_percent: float
    components: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class PaymentTermBase(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    days: int = 0
    credit_limit: float | None = None
    late_fee_percent: float | None = None
    status: str = "active"


class PaymentTermCreate(PaymentTermBase):
    pass


class PaymentTermUpdate(BaseModel):
    name: str | None = None
    days: int | None = None
    credit_limit: float | None = None
    late_fee_percent: float | None = None
    status: str | None = None


class PaymentTermResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    days: int
    credit_limit: float | None
    late_fee_percent: float | None
    status: str
    created_at: datetime
    updated_at: datetime


class CostCenterBase(BaseModel):
    department_id: uuid.UUID
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=2, max_length=150)
    budget_amount: float | None = 0
    status: str = "active"


class CostCenterCreate(CostCenterBase):
    pass


class CostCenterUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    budget_amount: float | None = None
    status: str | None = None


class CostCenterResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    department_id: uuid.UUID
    code: str
    name: str
    budget_amount: float
    expense_amount: float
    status: str
    created_at: datetime
    updated_at: datetime


class NumberSeriesBase(BaseModel):
    company_id: uuid.UUID
    module_name: str = Field(min_length=2, max_length=100)
    prefix: str = Field(min_length=1, max_length=50)
    padding: int = 5
    current_number: int | None = 0
    status: str = "active"


class NumberSeriesCreate(NumberSeriesBase):
    pass


class NumberSeriesUpdate(BaseModel):
    prefix: str | None = None
    padding: int | None = None
    current_number: int | None = None
    status: str | None = None


class NumberSeriesResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID
    module_name: str
    prefix: str
    current_number: int
    padding: int
    status: str
    created_at: datetime
    updated_at: datetime


# ─── Workspaces ───────────────────────────────────────────────────

class WorkspaceBase(BaseModel):
    company_id: uuid.UUID
    branch_id: uuid.UUID | None = None
    name: str = Field(min_length=2, max_length=150)
    theme: str = "light"
    language: str = "en"
    timezone: str = "Asia/Kolkata"
    status: str = "active"


class WorkspaceCreate(WorkspaceBase):
    pass


class WorkspaceUpdate(BaseModel):
    company_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    name: str | None = None
    theme: str | None = None
    language: str | None = None
    timezone: str | None = None
    status: str | None = None


class WorkspaceResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID
    branch_id: uuid.UUID | None
    name: str
    theme: str
    language: str
    timezone: str
    status: str
    created_at: datetime
    updated_at: datetime


# ─── API Keys ─────────────────────────────────────────────────────

class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    service: str = Field(min_length=2, max_length=100)
    env: str = "Production"
    status: str = "active"


class ApiKeyResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    service: str
    env: str
    secret_key: str
    status: str
    last_used_at: datetime | None
    created_at: datetime
    updated_at: datetime


# ─── MFA Policies ─────────────────────────────────────────────────

class MfaPolicyCreate(BaseModel):
    role_id: uuid.UUID | None = None
    methods: str = "Authenticator"
    timeout: str = "12 hours"
    restrict_ip: bool = False
    status: str = "active"


class MfaPolicyResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    role_id: uuid.UUID | None
    methods: str
    timeout: str
    restrict_ip: bool
    status: str
    created_at: datetime
    updated_at: datetime



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


# ─── HRMS — Employee & Attendance Schemas ───────────────────────────

from datetime import date


class EmployeeBase(BaseModel):
    employee_code: str | None = Field(None, max_length=50)
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    phone: str | None = Field(None, max_length=50)
    date_of_birth: date | None = None
    date_of_joining: date
    employment_type: str = "Full-Time"  # Full-Time|Part-Time|Contract|Internship
    status: str = "Active"  # Active|On Leave|Inactive
    basic_salary: float | None = None
    company_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    designation_id: uuid.UUID | None = None
    manager_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    employee_code: str | None = None
    full_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    date_of_birth: date | None = None
    date_of_joining: date | None = None
    employment_type: str | None = None
    status: str | None = None
    basic_salary: float | None = None
    company_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    designation_id: uuid.UUID | None = None
    manager_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None


class EmployeeResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_code: str
    full_name: str
    email: str
    phone: str | None
    date_of_birth: date | None
    date_of_joining: date
    employment_type: str
    status: str
    basic_salary: float | None
    company_id: uuid.UUID | None
    branch_id: uuid.UUID | None
    department_id: uuid.UUID | None
    designation_id: uuid.UUID | None
    manager_id: uuid.UUID | None
    user_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    temporary_password: str | None = None


class EmployeeBulkCreate(BaseModel):
    employees: list[EmployeeCreate]


class EmployeeDocumentCreate(BaseModel):
    document_name: str = Field(min_length=1, max_length=200)
    document_type: str = Field(min_length=1, max_length=100)  # Contract|ID Proof|NDA|compliance
    file_path: str = Field(min_length=1, max_length=500)
    expiry_date: date | None = None
    status: str = "Valid"


class EmployeeDocumentUpdate(BaseModel):
    document_name: str | None = None
    document_type: str | None = None
    file_path: str | None = None
    expiry_date: date | None = None
    status: str | None = None


class EmployeeDocumentResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    document_name: str
    document_type: str
    file_path: str
    upload_date: date
    expiry_date: date | None
    status: str
    created_at: datetime
    updated_at: datetime


class AttendanceRecordCreate(BaseModel):
    employee_id: uuid.UUID
    date: date
    check_in: datetime | None = None
    check_out: datetime | None = None
    hours_worked: float | None = None
    status: str = "Present"  # Present|Absent|Late|Half Day|On Leave
    method: str = "Biometric"  # Biometric|GPS|Face|Manual
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None


class AttendanceRecordUpdate(BaseModel):
    check_in: datetime | None = None
    check_out: datetime | None = None
    hours_worked: float | None = None
    status: str | None = None
    method: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None


class AttendanceRecordResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    employee_code: str | None = None
    date: date
    check_in: datetime | None
    check_out: datetime | None
    hours_worked: float | None
    status: str
    method: str
    latitude: float | None
    longitude: float | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class ClockInRequest(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None
    method: str = "Manual"
    employee_id: uuid.UUID | None = None


class ClockOutRequest(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None
    employee_id: uuid.UUID | None = None


class BiometricDeviceCreate(BaseModel):
    device_code: str = Field(min_length=1, max_length=50)
    location: str = Field(min_length=1, max_length=150)
    model: str = Field(min_length=1, max_length=100)
    enrolled_employees: int = 0
    status: str = "Online"


class BiometricDeviceUpdate(BaseModel):
    location: str | None = None
    model: str | None = None
    enrolled_employees: int | None = None
    status: str | None = None


class BiometricDeviceResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    device_code: str
    location: str
    model: str
    enrolled_employees: int
    last_sync: datetime | None
    status: str
    created_at: datetime
    updated_at: datetime


class FaceRecognitionLogCreate(BaseModel):
    employee_id: uuid.UUID | None = None
    confidence: float
    location: str
    action: str = "Check-In"
    status: str = "Verified"


class FaceRecognitionLogResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID | None
    employee_name: str | None = None
    timestamp: datetime
    confidence: float
    location: str
    action: str
    status: str
    created_at: datetime


class AttendanceCorrectionCreate(BaseModel):
    date: date
    original_status: str
    original_check_in: datetime | None = None
    original_check_out: datetime | None = None
    corrected_status: str
    corrected_check_in: datetime | None = None
    corrected_check_out: datetime | None = None
    reason: str


class AttendanceCorrectionResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    date: date
    original_status: str
    original_check_in: datetime | None
    original_check_out: datetime | None
    corrected_status: str
    corrected_check_in: datetime | None
    corrected_check_out: datetime | None
    reason: str
    status: str
    reviewed_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class CorrectionReviewRequest(BaseModel):
    status: str  # Approved|Rejected


class HrmsDashboardStats(BaseModel):
    total_employees: int
    active_employees: int
    on_leave: int
    new_joinees: int
    avg_attendance: float
    attrition_rate: float
# ─── HRMS — Leaves & Payroll Schemas ───────────────────────────────────

class LeaveRequestCreate(BaseModel):
    leave_type: str  # Annual|Sick|Casual|Maternity|Unpaid
    from_date: date
    to_date: date
    days_requested: int
    reason: str | None = None


class LeaveRequestUpdate(BaseModel):
    status: str  # Approved|Rejected


class LeaveRequestResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    department: str | None = None
    leave_type: str
    from_date: date
    to_date: date
    days_requested: int
    reason: str | None
    status: str
    approved_by: uuid.UUID | None = None
    approved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class LeaveBalanceResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    leave_type: str
    total_days: int
    used_days: int
    balance: int


class SalaryStructureCreate(BaseModel):
    employee_id: uuid.UUID
    basic_salary: float
    hra: float = 0.0
    other_allowances: float = 0.0
    pf_deduction: float = 0.0
    esi_deduction: float = 0.0
    tds_deduction: float = 0.0
    other_deductions: float = 0.0


class SalaryStructureResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    designation: str | None = None
    department: str | None = None
    basic_salary: float
    hra: float
    other_allowances: float
    pf_deduction: float
    esi_deduction: float
    tds_deduction: float
    other_deductions: float
    net_salary: float
    created_at: datetime
    updated_at: datetime


class PayslipCreate(BaseModel):
    employee_id: uuid.UUID
    month: int
    year: int
    status: str = "Processing"


class PayslipResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    employee_code: str | None = None
    month: int
    year: int
    basic_salary: float
    hra: float
    other_allowances: float
    pf_deduction: float
    esi_deduction: float
    tds_deduction: float
    other_deductions: float
    gross_salary: float
    net_salary: float
    status: str
    pdf_url: str | None
    created_at: datetime
    updated_at: datetime

class LeavePolicyCreate(BaseModel):
    name: str
    leave_type: str
    entitled_days: int
    applicable_to: str = "All"

class LeavePolicyResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    leave_type: str
    entitled_days: int
    applicable_to: str
    created_at: datetime
    updated_at: datetime

class PayGradeCreate(BaseModel):
    name: str
    designation_id: uuid.UUID
    basic_salary: float
    hra: float = 0.0
    other_allowances: float = 0.0
    pf_deduction: float = 0.0
    esi_deduction: float = 0.0
    tds_deduction: float = 0.0

class PayGradeResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    designation_id: uuid.UUID
    designation_name: str | None = None
    basic_salary: float
    hra: float
    other_allowances: float
    pf_deduction: float
    esi_deduction: float
    tds_deduction: float
    created_at: datetime
    updated_at: datetime

<<<<<<< HEAD
# -------------------------------------------------------------------------
# POS MODULE SCHEMAS
# -------------------------------------------------------------------------

# --- Categories ---
class POSCategoryCreate(BaseModel):
    name: str
    description: str | None = None
    color: str | None = None
    icon: str | None = None
    is_active: bool = True

class POSCategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    color: str | None
    icon: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Products ---
class POSProductCreate(BaseModel):
    name: str
    brand: str | None = None
    sku: str | None = None
    barcode: str | None = None
    description: str | None = None
    image_url: str | None = None
    category_id: uuid.UUID | None = None
    purchase_price: float = 0.0
    mrp: float = 0.0
    selling_price: float
    tax_percent: float = 5.0
    discount: float = 0.0
    stock: int = 0
    reorder_level: int = 10
    is_active: bool = True

class POSProductUpdate(BaseModel):
    name: str | None = None
    brand: str | None = None
    sku: str | None = None
    barcode: str | None = None
    description: str | None = None
    image_url: str | None = None
    category_id: uuid.UUID | None = None
    purchase_price: float | None = None
    mrp: float | None = None
    selling_price: float | None = None
    tax_percent: float | None = None
    discount: float | None = None
    stock: int | None = None
    reorder_level: int | None = None
    is_active: bool | None = None

class POSProductResponse(BaseModel):
    id: uuid.UUID
    name: str
    brand: str | None
    sku: str | None
    barcode: str | None
    description: str | None
    image_url: str | None
    category_id: uuid.UUID | None
    category_name: str | None = None
    purchase_price: float
    mrp: float
    selling_price: float
    tax_percent: float
    discount: float
    stock: int
    reorder_level: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class POSProductBulkCreate(BaseModel):
    products: list[POSProductCreate]

class POSProductBulkResponse(BaseModel):
    created_count: int
    skipped_count: int
    errors: list[str]



class POSTransactionItemBase(BaseModel):
    product_id: uuid.UUID
    quantity: int
    unit_price: float
    discount: float = 0.0

class POSTransactionItemCreate(POSTransactionItemBase):
    pass

class POSTransactionItemResponse(POSTransactionItemBase):
    id: uuid.UUID
    transaction_id: uuid.UUID
    subtotal: float

    model_config = ConfigDict(from_attributes=True)


class POSPaymentBase(BaseModel):
    payment_method: str
    amount: float
    reference_number: str | None = None

class POSPaymentCreate(POSPaymentBase):
    pass

class POSPaymentResponse(POSPaymentBase):
    id: uuid.UUID
    transaction_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)


class POSTransactionBase(BaseModel):
    customer_id: uuid.UUID | None = None
    subtotal: float
    tax_amount: float = 0.0
    discount_amount: float = 0.0
    total_amount: float

class POSTransactionCreate(POSTransactionBase):
    items: list[POSTransactionItemCreate]
    payments: list[POSPaymentCreate]

class POSTransactionResponse(POSTransactionBase):
    id: uuid.UUID
    cashier_id: uuid.UUID
    receipt_number: str
    status: str
    
    parent_transaction_id: uuid.UUID | None = None
    delivery_status: str | None = None
    delivery_address: str | None = None
    driver_name: str | None = None

    created_at: datetime
    updated_at: datetime
    items: list[POSTransactionItemResponse] = []
    payments: list[POSPaymentResponse] = []

    model_config = ConfigDict(from_attributes=True)

class POSCheckoutPayload(BaseModel):
    """
    Combined payload received from the frontend POSTerminal cart.
    """
    session_id: uuid.UUID
    customer_id: uuid.UUID | None = None
    
    # Support for Hold/Resume, Refunds, Delivery
    status: str = "completed"
    parent_transaction_id: uuid.UUID | None = None
    delivery_status: str | None = None
    delivery_address: str | None = None
    driver_name: str | None = None

    items: list[POSTransactionItemCreate]
    payments: list[POSPaymentCreate]
    subtotal: float
    tax_amount: float = 0.0
    discount_amount: float = 0.0
    total_amount: float


class POSSessionCreate(BaseModel):
    starting_cash: float = 0.0


class POSSessionClose(BaseModel):
    expected_cash: float
    actual_cash: float
    discrepancy_reason: str | None = None


class POSSessionResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    starting_cash: float
    status: str
    closing_time: datetime | None = None
    expected_cash: float | None = None
    actual_cash: float | None = None
    discrepancy_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

# ─── HRMS — Recruitment Schemas ──────────────────────────────────

class JobOpeningBase(BaseModel):
    title: str
    department: str
    location: str
    type: str = "Full-Time"
    experience: str
    openings: int = 1
    status: str = "Open"
    description: str
    threshold_score: int = 70
    portals: list[str] = []
    criteria: str


class JobOpeningCreate(JobOpeningBase):
    pass


class JobOpeningUpdate(BaseModel):
    title: str | None = None
    department: str | None = None
    location: str | None = None
    type: str | None = None
    experience: str | None = None
    openings: int | None = None
    status: str | None = None
    description: str | None = None
    threshold_score: int | None = None
    portals: list[str] | None = None
    criteria: str | None = None


class JobOpeningResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    title: str
    department: str
    location: str
    type: str
    experience: str
    openings: int
    applicants_count: int
    posted_date: date
    status: str
    description: str
    threshold_score: int
    portals: list[str]
    criteria: str
    created_at: datetime
    updated_at: datetime


class ApplicantBase(BaseModel):
    name: str
    email: str
    job_id: uuid.UUID | None = None
    experience: str
    resume_text: str | None = None
    source: str = "Careers Page"
    expected_salary: float | None = None


class ApplicantCreate(ApplicantBase):
    pass


class ApplicantUpdate(BaseModel):
    rating: int | None = None
    stage: str | None = None
    expected_salary: float | None = None
    proposed_salary: float | None = None


class ApplicantResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    email: str
    job_id: uuid.UUID
    job_title: str
    applied_date: date
    experience: str
    rating: int
    stage: str
    source: str
    match_score: int
    resume_text: str | None
    expected_salary: float | None = None
    proposed_salary: float | None = None
    notes_json: list[dict] = []
    created_at: datetime
    updated_at: datetime


class InterviewBase(BaseModel):
    applicant_id: uuid.UUID
    interviewer_name: str
    date: str
    time: str
    duration: int = 60
    type: str = "Technical"
    mode: str = "Video Call"


class InterviewCreate(InterviewBase):
    pass


class InterviewUpdate(BaseModel):
    status: str | None = None
    feedback: str | None = None


class InterviewResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    applicant_id: uuid.UUID
    candidate: str
    job_title: str
    interviewer_name: str
    date: str
    time: str
    duration: int
    type: str
    mode: str
    meeting_link: str | None
    status: str
    feedback: str | None
    created_at: datetime
    updated_at: datetime


class OfferLetterBase(BaseModel):
    applicant_id: uuid.UUID
    ctc: float
    expiry_date: date
    joining_date: date
    signer_name: str
    custom_template: str | None = None


class OfferLetterCreate(OfferLetterBase):
    pass


class OfferLetterUpdate(BaseModel):
    status: str | None = None
    email_sent: bool | None = None


class OfferLetterResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    applicant_id: uuid.UUID
    candidate: str
    role: str
    ctc: float
    offer_date: date
    expiry_date: date
    joining_date: date
    signer_name: str
    status: str
    email_sent: bool
    custom_template: str | None
    created_at: datetime
    updated_at: datetime


class OnboardingTaskSchema(BaseModel):
    task: str
    assignedTo: str
    status: str = "Pending"


class OnboardingBase(BaseModel):
    applicant_id: uuid.UUID
    start_date: date
    tasks: list[OnboardingTaskSchema] = []


class OnboardingCreate(OnboardingBase):
    pass


class OnboardingUpdate(BaseModel):
    progress: int | None = None
    tasks: list[OnboardingTaskSchema] | None = None


class OnboardingResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    applicant_id: uuid.UUID
    new_hire: str
    role: str
    start_date: date
    progress: int
    tasks_json: list[dict]
    created_at: datetime
    updated_at: datetime


# ─── Performance Schemas ──────────────────────────────────────────

class PerformanceGoalBase(BaseModel):
    employee_id: uuid.UUID | None = None
    employee_name: str
    title: str
    description: str | None = None
    target_date: date
    weight: int = 10
    progress: int = 0
    status: str = "Not Started"


class PerformanceGoalCreate(PerformanceGoalBase):
    pass


class PerformanceGoalUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    target_date: date | None = None
    weight: int | None = None
    progress: int | None = None
    status: str | None = None


class PerformanceGoalResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID | None
    employee_name: str
    title: str
    description: str | None
    target_date: date
    weight: int
    progress: int
    status: str
    created_at: datetime
    updated_at: datetime


class PerformanceKpiBase(BaseModel):
    metric: str
    target: str
    current: str
    unit: str
    achievement: int = 0


class PerformanceKpiCreate(PerformanceKpiBase):
    pass


class PerformanceKpiResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    metric: str
    target: str
    current: str
    unit: str
    achievement: int
    created_at: datetime
    updated_at: datetime


class PerformanceAppraisalBase(BaseModel):
    employee_id: uuid.UUID
    employee_name: str
    department: str
    period: str
    self_score: int = 0
    manager_score: int = 0
    final_score: int = 0
    rating: str = "Meets Expectations"
    reviewer: str
    status: str = "Pending"


class PerformanceAppraisalCreate(PerformanceAppraisalBase):
    pass


class PerformanceAppraisalUpdate(BaseModel):
    self_score: int | None = None
    manager_score: int | None = None
    final_score: int | None = None
    rating: str | None = None
    status: str | None = None


class PerformanceAppraisalResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str
    department: str
    period: str
    self_score: int
    manager_score: int
    final_score: int
    rating: str
    reviewer: str
    status: str
    created_at: datetime
    updated_at: datetime


class PerformanceIncentiveBase(BaseModel):
    employee_name: str
    department: str
    type: str
    basis: str
    amount: float
    status: str = "Pending"


class PerformanceIncentiveCreate(PerformanceIncentiveBase):
    pass


class PerformanceIncentiveResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_name: str
    department: str
    type: str
    basis: str
    amount: float
    status: str
    created_at: datetime
    updated_at: datetime


# ─── Learning Schemas ─────────────────────────────────────────────

class LearningCourseBase(BaseModel):
    title: str
    category: str
    instructor: str
    duration: str
    enrolled: int = 0
    completion: int = 0
    status: str = "Active"


class LearningCourseCreate(LearningCourseBase):
    pass


class LearningCourseResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    title: str
    category: str
    instructor: str
    duration: str
    enrolled: int
    completion: int
    status: str
    created_at: datetime
    updated_at: datetime


class LearningCertificateBase(BaseModel):
    employee_name: str
    cert_name: str
    issuer: str
    issued_date: str
    expiry_date: str = "N/A"
    status: str = "Valid"


class LearningCertificateCreate(LearningCertificateBase):
    pass


class LearningCertificateResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_name: str
    cert_name: str
    issuer: str
    issued_date: str
    expiry_date: str
    status: str
    created_at: datetime
    updated_at: datetime


class LearningAssessmentBase(BaseModel):
    title: str
    course_name: str
    due_date: str
    participants: int = 0
    avg_score: int = 0
    status: str = "Active"


class LearningAssessmentCreate(LearningAssessmentBase):
    pass


class LearningAssessmentResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    title: str
    course_name: str
    due_date: str
    participants: int
    avg_score: int
    status: str
    created_at: datetime
    updated_at: datetime


# ─── Exit Management Schemas ─────────────────────────────────────

class ExitResignationBase(BaseModel):
    employee_id: uuid.UUID
    employee_name: str
    department: str
    designation: str
    last_working_day: date
    reason: str
    status: str = "Pending"


class ExitResignationCreate(ExitResignationBase):
    pass


class ExitResignationUpdate(BaseModel):
    status: str | None = None
    last_working_day: date | None = None


class ExitResignationResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str
    department: str
    designation: str
    resign_date: date
    last_working_day: date
    reason: str
    status: str
    created_at: datetime
    updated_at: datetime


class ExitClearanceTaskBase(BaseModel):
    employee_id: uuid.UUID
    employee_name: str
    department: str
    task: str
    status: str = "Pending"
    assigned_to: str


class ExitClearanceTaskCreate(ExitClearanceTaskBase):
    pass


class ExitClearanceTaskUpdate(BaseModel):
    status: str | None = None


class ExitClearanceTaskResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str
    department: str
    task: str
    status: str
    assigned_to: str
    created_at: datetime
    updated_at: datetime


class ExitFinalSettlementBase(BaseModel):
    employee_id: uuid.UUID
    employee_name: str
    last_working_day: date
    components_json: list[dict] = []


class ExitFinalSettlementCreate(ExitFinalSettlementBase):
    pass


class ExitFinalSettlementResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str
    last_working_day: date
    components_json: list[dict]
    created_at: datetime
    updated_at: datetime


class ExitExperienceLetterBase(BaseModel):
    employee_id: uuid.UUID
    employee_name: str
    designation: str
    from_date: date
    to_date: date
    issued_on: str = "—"
    status: str = "Pending"


class ExitExperienceLetterCreate(ExitExperienceLetterBase):
    pass


class ExitExperienceLetterUpdate(BaseModel):
    status: str | None = None
    issued_on: str | None = None


class ExitExperienceLetterResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str
    designation: str
    from_date: date
    to_date: date
    issued_on: str
    status: str
    created_at: datetime
    updated_at: datetime
ponents_json: list[dict] = []


class ExitFinalSettlementCreate(ExitFinalSettlementBase):
    pass


class ExitFinalSettlementResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str
    last_working_day: date
    components_json: list[dict]
    created_at: datetime
    updated_at: datetime


class ExitExperienceLetterBase(BaseModel):
    employee_id: uuid.UUID
    employee_name: str
    designation: str
    from_date: date
    to_date: date
    issued_on: str = "—"
    status: str = "Pending"


class ExitExperienceLetterCreate(ExitExperienceLetterBase):
    pass


class ExitExperienceLetterUpdate(BaseModel):
    status: str | None = None
    issued_on: str | None = None


class ExitExperienceLetterResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str
    designation: str
    from_date: date
    to_date: date
    issued_on: str
    status: str
    created_at: datetime
    updated_at: datetime




