"""Shared helpers for the customers service.

Kept in its own module because both schemas (validation) and service (writes)
need the same normalisation, and importing service from schemas would be a
circular import — service imports the schemas it validates against.
"""
from __future__ import annotations

import uuid


def normalize_phone(value: str) -> str:
    """Strip separators so the same guest matches one row.

    The phone is the front-of-house lookup key AND part of the unique
    constraint. Storing "+91 98765 43210" and "9876543210" as two customers
    would both break the dedupe and defeat the lookup.
    """
    cleaned = "".join(ch for ch in value if ch.isdigit())
    return cleaned or value


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
