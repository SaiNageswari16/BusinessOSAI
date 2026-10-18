"""Shared helpers for the staff service."""
from __future__ import annotations

import uuid


def coerce_uuid(value) -> uuid.UUID | None:
    """Parse a UUID out of event data, tolerating anything malformed.

    Event payloads are JSON, so every UUID arrives as a string. Assigning a
    string to a UUID column raises "invalid input syntax for type uuid" on
    insert — the first event-driven update would then fail every time.
    """
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None
