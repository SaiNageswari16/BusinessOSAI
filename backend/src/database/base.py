import uuid
import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class EntityStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class Base(DeclarativeBase):
    pass


def enum_values(enum_cls) -> list:
    """Persist enum *values* ("active"), not member names ("ACTIVE").

    SQLAlchemy's default Enum stores the member name. Our API and Pydantic
    layers speak lowercase values, so we normalise the column type to store
    values — otherwise binding a plain string like "dine_in" raises
    LookupError at flush time.
    """
    return [member.value for member in enum_cls]


def db_enum(enum_cls, **kw):
    """Build a value-storing Enum column type.

    The enum class MUST be passed positionally. SQLAlchemy only calls
    ``values_callable`` when it can derive ``enum_class`` from a positional
    argument (see ``Enum._parse_into_values``); without it the type is built
    with an empty label list and ``CREATE TYPE ... AS ENUM ()`` is emitted,
    which then rejects every insert.

    Use this instead of ``Enum(values_callable=enum_values, ...)`` directly.
    """
    kw.setdefault("values_callable", enum_values)
    return Enum(enum_cls, **kw)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )


class TenantScopedMixin:
    """Every tenant-owned row carries tenant_id for row-level isolation."""

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )


class OutletScopedMixin:
    """Most restaurant entities are scoped to a single outlet within the tenant."""

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("outlets.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
