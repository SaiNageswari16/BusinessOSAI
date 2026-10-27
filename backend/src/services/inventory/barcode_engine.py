"""Barcode generation and uniqueness for the inventory service.

Ported from the BusinessOSAI monolith's
``src/api/v1/inventory/identifiers.py`` (778 LOC), trimmed to what this
service actually owns.

The monolith generated against three tables across every tenant in one shared
database (``erp_products``, ``erp_master_catalog``, ``erp_inventory_batches``)
and had to check all three to guarantee a code was globally unique. This
service owns one database with two of those tables (``inventory_items`` and
``inventory_batches``) and no master catalogue, so the uniqueness check
covers items and lots — and it stays *within the tenant*, because this
service never sees another tenant's rows.

Two formats are produced:

  * **EAN-13** — GS1 in-store RCN. Twelve digits (restricted prefix, a
    tenant code, a sequence) plus a standard modulo-10 weighted checksum.
    Purely numeric, because a supermarket scanner expects digits.
  * **Code-128** — ``PREFIX-TENANT-SEQ-TOKEN``. Alphanumeric, for the
    warehouses that print their own labels.

The tenant code is derived from the tenant's UUID rather than stored: it is
derived deterministically, so it costs nothing and can never drift out of
sync with a table.
"""
from __future__ import annotations

import secrets
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.inventory.models import InventoryBatch, InventoryItem

# How many candidates we try before giving up. Each attempt is cheap, and
# the odds of exhausting them are vanishingly small, but a bounded loop is
# what stops a pathological tenant from spinning forever.
_MAX_ATTEMPTS = 250

EAN13 = "EAN-13"
CODE128 = "Code-128"


def tenant_code(tenant_id: uuid.UUID) -> str:
    """Four-digit tenant code derived from the tenant's UUID.

    Deterministic, so the same tenant always gets the same prefix in its
    barcodes — which is what makes a printed label traceable back to the
    tenant that issued it.
    """
    return f"{(tenant_id.int % 9000) + 1000:04d}"


def compute_ean13_checksum(twelve_digits: str) -> str:
    """Standard GS1 EAN-13 modulo-10 weighted checksum.

    Weights alternate 1, 3, 1, 3 from the left; the check digit is whatever
    brings the total up to the next multiple of ten.
    """
    total = 0
    for i, char in enumerate(twelve_digits):
        weight = 1 if (i % 2 == 0) else 3
        total += int(char) * weight
    mod = total % 10
    return str((10 - mod) % 10)


def format_barcode(
    tenant_id: uuid.UUID,
    seq_num: int,
    barcode_format: str = EAN13,
    prefix: str | None = None,
) -> tuple[str, str]:
    """Format a barcode string from a sequence number.

    This is the *pure* form — deterministic given its inputs, no database
    involved. It is what the reference called ``generate_tenant_barcode``,
    and it is used for the deterministic parts of generation.
    """
    code = tenant_code(tenant_id)
    if barcode_format.upper() == "CODE-128":
        p = (prefix or "BOS").upper().strip()
        return f"{p}-{code}-{seq_num % 100000:05d}", CODE128
    twelve = f"20{code}{seq_num % 1000000:06d}"
    return twelve + compute_ean13_checksum(twelve), EAN13


async def is_barcode_unique(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    barcode: str,
    exclude_item_id: uuid.UUID | None = None,
) -> bool:
    """Is this code free, across items AND lots, for this tenant?

    The monolith checked three tables across every tenant because its
    catalogue was shared. Here the estate is one tenant's, so the check is
    scoped to ``tenant_id`` — which also means two tenants *can* hold the
    same code, and that is correct: they are separate estates with separate
    labels.
    """
    clean = (barcode or "").strip()
    if not clean:
        return False

    item_stmt = select(InventoryItem.id).where(
        InventoryItem.tenant_id == tenant_id,
        InventoryItem.barcode == clean,
    )
    if exclude_item_id is not None:
        item_stmt = item_stmt.where(InventoryItem.id != exclude_item_id)
    if (await db.execute(item_stmt.limit(1))).scalar_one_or_none() is not None:
        return False

    batch_stmt = select(InventoryBatch.id).where(
        InventoryBatch.tenant_id == tenant_id,
        InventoryBatch.barcode == clean,
    )
    if (await db.execute(batch_stmt.limit(1))).scalar_one_or_none() is not None:
        return False

    return True


async def generate_unique_barcode(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    barcode_format: str = EAN13,
    prefix: str | None = None,
    exclude_item_id: uuid.UUID | None = None,
    existing_used_set: set[str] | None = None,
) -> tuple[str, str]:
    """Generate a barcode that is unique against items and lots.

    Ported from the reference's ``generate_globally_unique_barcode``. The
    randomness is kept (it is what makes two codes generated in the same
    second differ), and the uniqueness *verification* is kept — a random
    13-digit code colliding with an existing one is unlikely but not
    impossible, and a duplicate barcode on two shelves is a real-world
    failure worth spending a query to avoid.

    The reference raised an ``HTTPException(500)`` here; that is a leak of
    the web layer into the engine. The engine raises ``RuntimeError`` and
    the API maps it to the HTTP 500, keeping the two layers apart.
    """
    # The reference seeded its randomness from the total row count of the
    # whole shared monolith database; here the estate is one tenant's, so
    # the seed is scoped to the tenant. (The seed only makes the random
    # space look less uniform between tenants; uniqueness is still proven
    # by the lookup below.)
    global_total = (
        await db.execute(
            select(func.count(InventoryItem.id)).where(
                InventoryItem.tenant_id == tenant_id
            )
        )
    ).scalar() or 0

    code = tenant_code(tenant_id)
    is_code128 = barcode_format.upper() == "CODE-128"

    for attempt in range(_MAX_ATTEMPTS):
        if is_code128:
            p = (prefix or "BOS").upper().strip()
            rand_token = secrets.token_hex(3).upper()
            seq_part = (global_total + attempt + secrets.randbelow(1000)) % 100000
            candidate = f"{p}-{code}-{seq_part:05d}-{rand_token}"
            candidate_fmt = CODE128
        else:
            # GS1 EAN-13 in-store format: restricted prefix 20-29.
            prefix_digits = 20 + ((attempt // 40) % 10)
            seq = (
                global_total * 37
                + attempt * 7919
                + secrets.randbelow(900000)
                + 100000
            ) % 1000000
            twelve = f"{prefix_digits}{code}{seq:06d}"
            candidate = twelve + compute_ean13_checksum(twelve)
            candidate_fmt = EAN13

        if existing_used_set is not None and candidate in existing_used_set:
            continue

        if await is_barcode_unique(
            db, tenant_id, candidate, exclude_item_id=exclude_item_id
        ):
            if existing_used_set is not None:
                existing_used_set.add(candidate)
            return candidate, candidate_fmt

    raise RuntimeError(
        "Unable to generate a unique barcode after multiple attempts"
    )


def detect_format(barcode: str | None) -> str | None:
    """Which format an existing code is, judged by its shape.

    Used when listing barcodes so the caller can tell an EAN-13 from a
    Code-128 without a lookup table.
    """
    if not barcode:
        return None
    if len(barcode) == 13 and barcode.isdigit():
        return EAN13
    return CODE128
