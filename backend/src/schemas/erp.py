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

