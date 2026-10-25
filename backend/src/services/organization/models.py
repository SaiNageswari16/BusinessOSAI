"""Organization service models — brands, outlets, sections, tables, cost
centres, UoM, floor plans, and royalty settlements.

These tables live in ``restaurantos_organization`` ONLY. Other services hold
``outlet_id`` / ``section_id`` / ``table_id`` / ``brand_id`` as bare UUID
columns with no foreign key — that is the boundary.

Hierarchy:  Enterprise Brand  →  Outlet (parent_outlet_id)  →  Section
  →  Table

A brand is the top of the tree for a tenant. An outlet can belong to a
brand and/or sit below a parent outlet (hub-and-spoke), giving the three
ownership shapes Petpooja supports: corporate-owned, franchisee-owned, and
hub/spoke.
"""
import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.services.shared.service_db import service_base

# This service's own base, not the shared ServiceBase. Two services' models
# imported into one process must land in two separate registries, or a single
# create_all() emits every service's DDL into every database.
ServiceBase = service_base("organization")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    from datetime import timezone

    return datetime.now(timezone.utc)


class TenantStatus(str, enum.Enum):
    TRIAL = "trial"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CANCELLED = "cancelled"


class OutletType(str, enum.Enum):
    DINE_IN = "dine_in"
    QSR = "qsr"
    CLOUD_KITCHEN = "cloud_kitchen"
    CAFE = "cafe"
    FOOD_COURT = "food_court"


class OwnershipType(str, enum.Enum):
    """How an outlet relates to the brand/enterprise above it."""

    DIRECT = "direct"        # corporate-owned
    FRANCHISE = "franchise"  # franchisee-owned, pays royalty
    HUB = "hub"              # central/parent outlet other outlets draw stock from
    SPOKE = "spoke"          # child outlet of a hub


class SectionType(str, enum.Enum):
    AC_HALL = "ac_hall"
    NON_AC_HALL = "non_ac_hall"
    GARDEN = "garden"
    ROOFTOP = "rooftop"
    PRIVATE_ROOM = "private_room"
    COUNTER = "counter"
    TERRACE = "terrace"


class TableStatus(str, enum.Enum):
    FREE = "free"
    OCCUPIED = "occupied"
    RESERVED = "reserved"
    BILLING = "billing"
    CLEANING = "cleaning"
    BLOCKED = "blocked"


class RoyaltyStatus(str, enum.Enum):
    PENDING = "pending"
    SETTLED = "settled"
    CANCELLED = "cancelled"


class TimestampMixin:
    """Timestamps set application-side, not by the DB.

    A server_default/onupdate function means SQLAlchemy has to re-SELECT the
    row after flush to learn the value. That lazy load lands outside the
    request's async context and blows up as MissingGreenlet when Pydantic
    serialises the response — so we generate the values in Python instead.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )


class Tenant(ServiceBase, TimestampMixin):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    status: Mapped[TenantStatus] = mapped_column(String(20), default=TenantStatus.TRIAL)
    plan: Mapped[str] = mapped_column(String(50), default="trial")
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)
    contact_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    trial_ends_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    outlets: Mapped[list["Outlet"]] = relationship(
        back_populates="tenant",
        primaryjoin="Tenant.id == Outlet.tenant_id",
        foreign_keys="Outlet.tenant_id",
        cascade="all, delete-orphan",
    )


class EnterpriseBrand(ServiceBase, TimestampMixin):
    """Top of a tenant's hierarchy. An outlet points at a brand to say who
    ultimately owns it; a royalty agreement points at a brand + a franchisee
    outlet to say how much the franchisee pays for that ownership."""

    __tablename__ = "enterprise_brands"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Outlet(ServiceBase, TimestampMixin):
    __tablename__ = "outlets"
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_tenant_outlet_code"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    outlet_type: Mapped[OutletType] = mapped_column(
        String(30), default=OutletType.DINE_IN
    )

    # ── Hierarchy ──
    brand_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("enterprise_brands.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    parent_outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("outlets.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    ownership_type: Mapped[OwnershipType] = mapped_column(
        String(20), default=OwnershipType.DIRECT
    )

    address_line1: Mapped[str | None] = mapped_column(String(300), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(300), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state_code: Mapped[str | None] = mapped_column(String(5), nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    country: Mapped[str] = mapped_column(String(5), default="IN")

    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    fssai_license: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pan: Mapped[str | None] = mapped_column(String(15), nullable=True)

    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata")
    currency: Mapped[str] = mapped_column(String(5), default="INR")

    opening_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    closing_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    weekly_hours: Mapped[dict] = mapped_column(JSONB, default=dict)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)

    tenant: Mapped["Tenant"] = relationship(
        back_populates="outlets",
        primaryjoin="Tenant.id == Outlet.tenant_id",
        foreign_keys=[tenant_id],
    )
    parent_outlet: Mapped["Outlet | None"] = relationship(
        remote_side=[id],
        back_populates="child_outlets",
        foreign_keys=[parent_outlet_id],
    )
    child_outlets: Mapped[list["Outlet"]] = relationship(
        back_populates="parent_outlet",
        cascade="all, delete-orphan",
        foreign_keys=[parent_outlet_id],
    )
    sections: Mapped[list["Section"]] = relationship(
        back_populates="outlet", cascade="all, delete-orphan"
    )
    tables: Mapped[list["RestaurantTable"]] = relationship(
        back_populates="outlet", cascade="all, delete-orphan"
    )
    cost_centers: Mapped[list["CostCenter"]] = relationship(
        back_populates="outlet", cascade="all, delete-orphan"
    )
    royalty_agreements: Mapped[list["RoyaltyAgreement"]] = relationship(
        back_populates="outlet",
        foreign_keys="RoyaltyAgreement.outlet_id",
        cascade="all, delete-orphan",
    )


class Section(ServiceBase, TimestampMixin):
    __tablename__ = "sections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("outlets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    section_type: Mapped[SectionType] = mapped_column(String(30), default=SectionType.AC_HALL)
    capacity: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    outlet: Mapped["Outlet"] = relationship(back_populates="sections")
    tables: Mapped[list["RestaurantTable"]] = relationship(
        back_populates="section", cascade="all, delete-orphan"
    )


class RestaurantTable(ServiceBase, TimestampMixin):
    __tablename__ = "restaurant_tables"
    __table_args__ = (UniqueConstraint("outlet_id", "code", name="uq_outlet_table_code"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("outlets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    section_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sections.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(50), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    seats: Mapped[int] = mapped_column(Integer, default=4)
    min_covers: Mapped[int] = mapped_column(Integer, default=1)
    max_covers: Mapped[int] = mapped_column(Integer, default=6)
    status: Mapped[TableStatus] = mapped_column(String(20), default=TableStatus.FREE, index=True)

    # Floor-plan geometry. A table's physical footprint on the floor — width
    # and height in the same units as position_x/y (typically cm or inches)
    # plus a rotation so a rectangular table can be placed sideways.
    shape: Mapped[str] = mapped_column(String(30), default="round")
    size_w: Mapped[float | None] = mapped_column(Float, nullable=True)
    size_h: Mapped[float | None] = mapped_column(Float, nullable=True)
    rotation: Mapped[float] = mapped_column(Float, default=0.0)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    position_x: Mapped[float | None] = mapped_column(nullable=True)
    position_y: Mapped[float | None] = mapped_column(nullable=True)

    outlet: Mapped["Outlet"] = relationship(back_populates="tables")
    section: Mapped["Section | None"] = relationship(back_populates="tables")


class FloorPlan(ServiceBase, TimestampMixin):
    """A named, versioned snapshot of an outlet's section + table layout.

    Lets a tenant keep, say, a "summer rooftop" variant alongside the
    default without disturbing the live one, and restore either at will."""

    __tablename__ = "floor_plans"
    __table_args__ = (UniqueConstraint("outlet_id", "name", name="uq_outlet_floorplan_name"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("outlets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Captured geometry for every table in the plan. One JSONB row keeps the
    # snapshot self-contained and restorable without touching the live
    # restaurant_tables rows until a restore is requested.
    layout: Mapped[dict] = mapped_column(JSONB, default=dict)


class CostCenter(ServiceBase, TimestampMixin):
    __tablename__ = "cost_centers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("outlets.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    center_type: Mapped[str] = mapped_column(String(50), default="operating")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    outlet: Mapped["Outlet | None"] = relationship(back_populates="cost_centers")


class UnitOfMeasure(ServiceBase, TimestampMixin):
    """Shared master data — every service needs a UoM id, only this service owns it."""

    __tablename__ = "units_of_measure"
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_tenant_uom_code"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    uom_type: Mapped[str] = mapped_column(String(30), default="quantity")  # weight|volume|quantity|length
    base_factor: Mapped[float] = mapped_column(Float, default=1.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class RoyaltyAgreement(ServiceBase, TimestampMixin):
    """Contract between a brand and a franchisee-owned outlet: what share of
    revenue (or a fixed fee) the franchisee pays, and over what window.

    The row itself is the agreement; a settlement is a separate, dated
    record that says "this much was actually paid for this window" so the
    ledger and the contract don't get confused.
    """

    __tablename__ = "royalty_agreements"
    __table_args__ = (
        CheckConstraint(
            "rate_pct IS NULL OR (rate_pct >= 0 AND rate_pct <= 100)",
            name="ck_royalty_rate_range",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("enterprise_brands.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("outlets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Two mutually exclusive ways to charge: a percentage of revenue, or a
    # fixed fee. Exactly one should be non-null; the endpoint validates.
    rate_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    fixed_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    # Settlement cadence — settled in arrears, on the first of the window.
    period: Mapped[str] = mapped_column(
        String(10), default="monthly", index=True
    )  # monthly | quarterly | annual
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    outlet: Mapped["Outlet"] = relationship(
        back_populates="royalty_agreements", foreign_keys=[outlet_id]
    )


class OutboxMessage(ServiceBase, TimestampMixin):
    """Transactional outbox row — one per event this service would emit.

    Written in the same transaction as the domain change so the two commit
    or roll back together. A relay marks rows published or dead; pending
    rows are what the relay picks up on crash-recovery. ``event_id`` is
    the bus dedupe key, so a re-delivered event is a no-op on the consumer
    side even if the relay over-publishes it.
    """

    __tablename__ = "outbox_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    type: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    source_service: Mapped[str] = mapped_column(String(50), default="organization")
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class RoyaltySettlement(ServiceBase, TimestampMixin):
    """One actual settlement event: "outlet X paid Y against agreement Z for
    window W, on date D." Kept separate from the agreement so the contract
    can be amended without rewriting history."""

    __tablename__ = "royalty_settlements"
    __table_args__ = (
        UniqueConstraint(
            "agreement_id", "period_start", "period_end",
            name="uq_settlement_window",
        ),
        CheckConstraint(
            "period_start <= period_end", name="ck_settlement_window_order",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    agreement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("royalty_agreements.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("outlets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    base_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2), nullable=True
    )
    """Revenue (or the fixed base) the settlement was computed from."""
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    """Actual amount paid/owed for this window."""
    status: Mapped[RoyaltyStatus] = mapped_column(
        String(20), default=RoyaltyStatus.PENDING, index=True
    )
    settled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
