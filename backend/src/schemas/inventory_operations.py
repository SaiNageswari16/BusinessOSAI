import uuid
from typing import List, Optional
from pydantic import BaseModel, Field
from .inventory import TimestampSchema

# ==========================================
# Goods Receipt Note (GRN)
# ==========================================

class GoodsReceiptItemBase(BaseModel):
    product_id: uuid.UUID
    quantity_received: int = 0
    unit_price: float = 0.0

class GoodsReceiptItemCreate(GoodsReceiptItemBase):
    pass

class GoodsReceiptItemResponse(GoodsReceiptItemBase, TimestampSchema):
    id: uuid.UUID
    receipt_id: uuid.UUID
    class Config:
        from_attributes = True

class GoodsReceiptBase(BaseModel):
    receipt_number: str = Field(..., max_length=100)
    supplier: Optional[str] = Field(None, max_length=255)
    reference_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    status: str = Field(default="Completed", max_length=50)

class GoodsReceiptCreate(GoodsReceiptBase):
    items: List[GoodsReceiptItemCreate] = []

class GoodsReceiptUpdate(GoodsReceiptBase):
    receipt_number: Optional[str] = Field(None, max_length=100)
    items: Optional[List[GoodsReceiptItemCreate]] = None

class GoodsReceiptResponse(GoodsReceiptBase, TimestampSchema):
    id: uuid.UUID
    tenant_id: uuid.UUID
    items: List[GoodsReceiptItemResponse] = []
    class Config:
        from_attributes = True

# ==========================================
# Goods Issue
# ==========================================

class GoodsIssueItemBase(BaseModel):
    product_id: uuid.UUID
    quantity_issued: int = 0

class GoodsIssueItemCreate(GoodsIssueItemBase):
    pass

class GoodsIssueItemResponse(GoodsIssueItemBase, TimestampSchema):
    id: uuid.UUID
    issue_id: uuid.UUID
    class Config:
        from_attributes = True

class GoodsIssueBase(BaseModel):
    issue_number: str = Field(..., max_length=100)
    recipient: Optional[str] = Field(None, max_length=255)
    reference_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    status: str = Field(default="Completed", max_length=50)

class GoodsIssueCreate(GoodsIssueBase):
    items: List[GoodsIssueItemCreate] = []

class GoodsIssueUpdate(GoodsIssueBase):
    issue_number: Optional[str] = Field(None, max_length=100)
    items: Optional[List[GoodsIssueItemCreate]] = None

class GoodsIssueResponse(GoodsIssueBase, TimestampSchema):
    id: uuid.UUID
    tenant_id: uuid.UUID
    items: List[GoodsIssueItemResponse] = []
    class Config:
        from_attributes = True

# ==========================================
# Stock Movement
# ==========================================

class StockMovementBase(BaseModel):
    movement_number: str = Field(..., max_length=100)
    product_id: uuid.UUID
    source_location: str = Field(..., max_length=150)
    destination_location: str = Field(..., max_length=150)
    quantity: int
    notes: Optional[str] = None
    status: str = Field(default="Completed", max_length=50)

class StockMovementCreate(StockMovementBase):
    pass

class StockMovementUpdate(StockMovementBase):
    movement_number: Optional[str] = Field(None, max_length=100)
    product_id: Optional[uuid.UUID] = None
    source_location: Optional[str] = Field(None, max_length=150)
    destination_location: Optional[str] = Field(None, max_length=150)
    quantity: Optional[int] = None

class StockMovementResponse(StockMovementBase, TimestampSchema):
    id: uuid.UUID
    tenant_id: uuid.UUID
    class Config:
        from_attributes = True

# ==========================================
# Stock Adjustment
# ==========================================

class StockAdjustmentBase(BaseModel):
    adjustment_number: str = Field(..., max_length=100)
    product_id: uuid.UUID
    adjustment_type: str = Field(..., max_length=50)
    quantity_changed: int
    reason: Optional[str] = None
    status: str = Field(default="Completed", max_length=50)

class StockAdjustmentCreate(StockAdjustmentBase):
    pass

class StockAdjustmentUpdate(StockAdjustmentBase):
    adjustment_number: Optional[str] = Field(None, max_length=100)
    product_id: Optional[uuid.UUID] = None
    adjustment_type: Optional[str] = Field(None, max_length=50)
    quantity_changed: Optional[int] = None

class StockAdjustmentResponse(StockAdjustmentBase, TimestampSchema):
    id: uuid.UUID
    tenant_id: uuid.UUID
    class Config:
        from_attributes = True

# ==========================================
# Cycle Counting
# ==========================================

class CycleCountItemBase(BaseModel):
    product_id: uuid.UUID
    system_quantity: int = 0
    counted_quantity: Optional[int] = None
    variance: Optional[int] = None

class CycleCountItemCreate(CycleCountItemBase):
    pass

class CycleCountItemResponse(CycleCountItemBase, TimestampSchema):
    id: uuid.UUID
    cycle_count_id: uuid.UUID
    class Config:
        from_attributes = True

class CycleCountBase(BaseModel):
    count_number: str = Field(..., max_length=100)
    location: Optional[str] = Field(None, max_length=150)
    auditor: Optional[str] = Field(None, max_length=150)
    status: str = Field(default="In Progress", max_length=50)
    notes: Optional[str] = None

class CycleCountCreate(CycleCountBase):
    items: List[CycleCountItemCreate] = []

class CycleCountUpdate(CycleCountBase):
    count_number: Optional[str] = Field(None, max_length=100)
    items: Optional[List[CycleCountItemCreate]] = None

class CycleCountResponse(CycleCountBase, TimestampSchema):
    id: uuid.UUID
    tenant_id: uuid.UUID
    items: List[CycleCountItemResponse] = []
    class Config:
        from_attributes = True
