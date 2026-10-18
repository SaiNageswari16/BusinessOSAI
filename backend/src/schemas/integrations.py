"""Integration schemas — aggregators, printers, AI copilot."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from src.models.loyalty import AggregatorName


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Aggregators ─────────────────────────────────────────────────

class AggregatorConfigCreate(BaseModel):
    outlet_id: uuid.UUID
    aggregator: AggregatorName
    api_key: str | None = Field(default=None, max_length=255)
    api_secret: str | None = Field(default=None, max_length=255)
    restaurant_id: str | None = Field(default=None, max_length=100)
    auto_accept: bool = False
    menu_sync_enabled: bool = False
    settings: dict = Field(default_factory=dict)


class AggregatorConfigUpdate(BaseModel):
    api_key: str | None = Field(default=None, max_length=255)
    api_secret: str | None = Field(default=None, max_length=255)
    restaurant_id: str | None = Field(default=None, max_length=100)
    auto_accept: bool | None = None
    menu_sync_enabled: bool | None = None
    settings: dict | None = None
    is_active: bool | None = None


class AggregatorConfigResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    aggregator: str
    restaurant_id: str | None
    is_active: bool
    auto_accept: bool
    menu_sync_enabled: bool
    last_synced_at: str | None
    settings: dict
    created_at: datetime


class AggregatorOrderMapResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    aggregator: str
    aggregator_order_id: str
    order_id: uuid.UUID
    synced_at: str | None
    sync_status: str


class AggregatorOrderIn(BaseModel):
    """Normalised payload pushed by an aggregator webhook."""

    aggregator: AggregatorName
    aggregator_order_id: str = Field(min_length=1, max_length=100)
    customer_name: str | None = Field(default=None, max_length=200)
    customer_phone: str | None = Field(default=None, max_length=30)
    order_type: str = Field(default="delivery", max_length=20)
    notes: str | None = None
    items: list[dict] = Field(default_factory=list)


class MenuSyncResult(BaseModel):
    aggregator: str
    outlet_id: uuid.UUID
    items_synced: int = 0
    categories_synced: int = 0
    errors: list[str] = Field(default_factory=list)
    synced_at: datetime


# ─── Printers ────────────────────────────────────────────────────

class PrinterCreate(BaseModel):
    outlet_id: uuid.UUID
    name: str = Field(min_length=1, max_length=100)
    printer_type: str = Field(default="bill", pattern="^(kot|bill|label|report)$")
    connection: str = Field(default="network", pattern="^(usb|network|bluetooth)$")
    address: str | None = Field(default=None, max_length=100)
    port: int | None = Field(default=None, ge=1, le=65535)
    paper_width_mm: int = Field(default=80, ge=58, le=210)
    is_default: bool = False


class PrinterUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    printer_type: str | None = Field(default=None, pattern="^(kot|bill|label|report)$")
    connection: str | None = Field(default=None, pattern="^(usb|network|bluetooth)$")
    address: str | None = Field(default=None, max_length=100)
    port: int | None = Field(default=None, ge=1, le=65535)
    paper_width_mm: int | None = Field(default=None, ge=58, le=210)
    is_default: bool | None = None
    is_active: bool | None = None


class PrinterResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    name: str
    printer_type: str
    connection: str
    address: str | None
    port: int | None
    paper_width_mm: int
    is_default: bool
    is_active: bool
    created_at: datetime


class PrintJobRequest(BaseModel):
    """Escapes a KOT or bill to the local print bridge."""
    printer_id: uuid.UUID | None = None
    copies: int = Field(default=1, ge=1, le=10)
    reprint: bool = False


class PrintJobResponse(BaseModel):
    job_id: str
    printer_name: str | None
    job_type: str
    copies: int
    queued_at: datetime


# ─── AI copilot ──────────────────────────────────────────────────

class CopilotChatRequest(BaseModel):
    outlet_id: uuid.UUID | None = None
    message: str = Field(min_length=1)
    history: list[dict] = Field(default_factory=list)


class CopilotChatResponse(BaseModel):
    reply: str
    data: dict | None = None
    provider: str | None = None
    suggestions: list[str] = Field(default_factory=list)


class MenuEngineeringRow(BaseModel):
    menu_item_id: uuid.UUID
    item_name: str
    category_name: str | None = None
    qty_sold: int
    net_amount: float
    margin_pct: float | None = None
    classification: str = "dog"


class MenuEngineeringReport(BaseModel):
    outlet_id: uuid.UUID
    date_from: str
    date_to: str
    stars: list[MenuEngineeringRow] = Field(default_factory=list)
    plowhorses: list[MenuEngineeringRow] = Field(default_factory=list)
    puzzles: list[MenuEngineeringRow] = Field(default_factory=list)
    dogs: list[MenuEngineeringRow] = Field(default_factory=list)


class DemandForecastRow(BaseModel):
    day: str
    predicted_covers: int
    predicted_orders: int
    predicted_sales: float
    confidence: float | None = None


class DemandForecastReport(BaseModel):
    outlet_id: uuid.UUID
    rows: list[DemandForecastRow] = Field(default_factory=list)
    model: str = "moving_average"


class PriceOptimizationRow(BaseModel):
    menu_item_id: uuid.UUID
    item_name: str
    current_price: float
    suggested_price: float
    expected_margin_delta: float
    rationale: str


class PriceOptimizationResponse(BaseModel):
    outlet_id: uuid.UUID
    rows: list[PriceOptimizationRow] = Field(default_factory=list)
