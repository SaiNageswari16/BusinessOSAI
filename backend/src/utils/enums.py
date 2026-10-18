"""Helpers for reading the value out of a column that may hold an enum.

Several models store status columns as `str`-derived enums. SQLAlchemy returns
the enum member on write but the raw string in some query projections, so a
comparison needs to work for both. `enum_value` normalises either to the string
that is actually stored in the database.
"""
# Re-exported so there is a single definition: the model layer uses this to
# make Enum columns persist lowercase values instead of member names.
from src.database.base import enum_values  # noqa: F401


def enum_value(value) -> str:
    """The stored string for an enum member, plain string, or None."""
    if value is None:
        return ""
    # Enum members expose .value; str-derived enums are also str instances,
    # so check for .value first
    if hasattr(value, "value"):
        return str(value.value)
    return str(value)


def as_enum(enum_cls, value, default=None):
    """Coerce a raw string back into an enum member, or `default` if unknown."""
    if value is None:
        return default
    if isinstance(value, enum_cls):
        return value
    for member in enum_cls:
        if str(member.value) == str(value):
            return member
    return default
