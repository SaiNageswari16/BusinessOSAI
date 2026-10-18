import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Auth ────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


# ─── User ────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=200)
    phone: str | None = None
    is_tenant_owner: bool = False
    outlet_ids: list[uuid.UUID] = Field(default_factory=list)


class UserResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    phone: str | None
    full_name: str
    avatar_url: str | None
    status: str
    is_tenant_owner: bool
    email_verified: bool
    last_login_at: datetime | None
    outlet_ids: list
    created_at: datetime


class MeResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    full_name: str
    phone: str | None
    is_tenant_owner: bool
    tenant_slug: str
    permissions: list[str]
    roles: list[str]
    active_role_id: uuid.UUID | None
    outlet_ids: list
    active_outlet_id: uuid.UUID | None


# ─── Role ────────────────────────────────────────────────────────

class RoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    permission_codes: list[str] = Field(default_factory=list)


class RoleResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: str | None
    is_system: bool
    is_active: bool
    permission_codes: list[str] = Field(default_factory=list)


class AssignRoleRequest(BaseModel):
    role_id: uuid.UUID
    outlet_id: uuid.UUID | None = None


# ─── Permission ──────────────────────────────────────────────────

class PermissionResponse(ORMBase):
    id: uuid.UUID
    code: str
    name: str
    module: str
    description: str | None


# ─── Outlet ──────────────────────────────────────────────────────

class OutletCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=1, max_length=20)
    outlet_type: str = "dine_in"
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    state_code: str | None = None
    pincode: str | None = None
    country: str = "IN"
    phone: str | None = None
    email: EmailStr | None = None
    gstin: str | None = None
    fssai_license: str | None = None
    pan: str | None = None
    timezone: str = "Asia/Kolkata"
    currency: str = "INR"
    opening_time: str | None = None
    closing_time: str | None = None


class OutletUpdate(BaseModel):
    name: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    state_code: str | None = None
    pincode: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    gstin: str | None = None
    fssai_license: str | None = None
    pan: str | None = None
    opening_time: str | None = None
    closing_time: str | None = None
    weekly_hours: dict | None = None
    is_active: bool | None = None
    settings: dict | None = None


class OutletResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    code: str
    outlet_type: str
    address_line1: str | None
    address_line2: str | None
    city: str | None
    state: str | None
    state_code: str | None
    pincode: str | None
    country: str
    phone: str | None
    email: str | None
    gstin: str | None
    fssai_license: str | None
    pan: str | None
    timezone: str
    currency: str
    opening_time: str | None
    closing_time: str | None
    weekly_hours: dict
    is_active: bool
    settings: dict
    created_at: datetime


# ─── Section ─────────────────────────────────────────────────────

class SectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    section_type: str = "ac_hall"
    capacity: int = 0
    sort_order: int = 0


class SectionResponse(ORMBase):
    id: uuid.UUID
    outlet_id: uuid.UUID
    name: str
    section_type: str
    capacity: int
    is_active: bool
    sort_order: int


# ─── Table ───────────────────────────────────────────────────────

class TableCreate(BaseModel):
    section_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=50)
    code: str = Field(min_length=1, max_length=20)
    seats: int = 4
    min_covers: int = 1
    max_covers: int = 6
    position_x: float | None = None
    position_y: float | None = None


class TableStatusUpdate(BaseModel):
    status: str = Field(description="free|occupied|reserved|billing|cleaning|blocked")


class TableResponse(ORMBase):
    id: uuid.UUID
    outlet_id: uuid.UUID
    section_id: uuid.UUID | None
    name: str
    code: str
    seats: int
    min_covers: int
    max_covers: int
    status: str
    is_active: bool
    position_x: float | None
    position_y: float | None


class FloorPlanUpdate(BaseModel):
    tables: list[dict]


# ─── Pagination ──────────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
