"""Organization service models — outlets, sections, tables, cost centres, UoM.

These tables live in ``restaurantos_organization`` ONLY. Other services hold
``outlet_id`` / ``section_id`` / ``table_id`` as bare UUID columns with no
foreign key — that is the boundary.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
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
    sections: Mapped[list["Section"]] = relationship(
        back_populates="outlet", cascade="all, delete-orphan"
    )
    tables: Mapped[list["RestaurantTable"]] = relationship(
        back_populates="outlet", cascade="all, delete-orphan"
    )
    cost_centers: Mapped[list["CostCenter"]] = relationship(
        back_populates="outlet", cascade="all, delete-orphan"
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
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    position_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    position_y: Mapped[float | None] = mapped_column(Float, nullable=True)

    outlet: Mapped["Outlet"] = relationship(back_populates="tables")
    section: Mapped["Section | None"] = relationship(back_populates="tables")


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
