"""
validator.py – Per-row cleaning and validation.

Each function receives a single raw dict (post-mapping) and returns either a
cleaned dict or raises ValueError, which the importer catches and routes to
the failed-row sink.
"""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from config import ImporterConfig


# ── Helpers ────────────────────────────────────────────────────────────────────

_WHITESPACE_RE = re.compile(r"\s+")


def _clean_str(value: Any, max_len: int = 1024) -> str | None:
    """Strip, collapse whitespace, truncate, return None if empty."""
    if value is None:
        return None
    s = str(value).strip()
    s = _WHITESPACE_RE.sub(" ", s)
    if not s or s.lower() in ("nan", "null", "none", "undefined", "n/a"):
        return None
    return s[:max_len]


def _clean_float(value: Any) -> float | None:
    """Return a float or None for invalid / missing numeric values."""
    if value is None:
        return None
    try:
        f = float(value)
        # Reject nonsensical nutrition values
        if f < -1000 or f > 100_000:
            return None
        return round(f, 4)
    except (TypeError, ValueError):
        return None


def _is_valid_url(url: str | None) -> bool:
    if not url:
        return False
    try:
        r = urlparse(url)
        return r.scheme in ("http", "https") and bool(r.netloc)
    except Exception:
        return False


# ── Main entry point ───────────────────────────────────────────────────────────

def validate_and_clean(raw: dict[str, Any], cfg: ImporterConfig) -> dict[str, Any]:
    """
    Clean and validate a single mapped row.

    Returns a dict whose keys match MasterCatalogProduct columns.
    Raises ValueError with a descriptive message if the row should be skipped.
    """
    # ── name ──────────────────────────────────────────────────────────────────
    name = _clean_str(raw.get("name"), cfg.max_name_length)
    if not name and cfg.skip_missing_name:
        raise ValueError("missing product_name")
    name = name or "(unknown)"

    # ── barcode ───────────────────────────────────────────────────────────────
    barcode = _clean_str(raw.get("barcode"), 100)
    if not barcode and cfg.skip_missing_barcode:
        raise ValueError("missing barcode")

    # ── brand / supplier ──────────────────────────────────────────────────────
    brand        = _clean_str(raw.get("brand"), cfg.max_brand_length)
    manufacturer = _clean_str(raw.get("manufacturer"), 255)

    # ── category ──────────────────────────────────────────────────────────────
    category_raw = _clean_str(raw.get("category"), cfg.max_string_length)
    # OFF categories are comma-separated; take the first non-empty token
    category = None
    if category_raw:
        parts = [p.strip() for p in category_raw.split(",") if p.strip()]
        category = parts[0][:cfg.max_category_length] if parts else None

    # ── image_url ─────────────────────────────────────────────────────────────
    img_raw = _clean_str(raw.get("image_url"), cfg.max_string_length)
    image_url = img_raw if _is_valid_url(img_raw) else None

    # ── short_description: generic_name ───────────────────────────────────────
    short_desc = _clean_str(raw.get("generic_name"), 2000)

    # ── supplier (from manufacturer) ──────────────────────────────────────────
    supplier = manufacturer or brand  # fallback to brand if no manufacturer

    # ── Nutrition (per 100g) ──────────────────────────────────────────────────
    nutrition_keys = [
        "energy_kcal", "energy_kj", "fat", "saturated_fat", "trans_fat",
        "cholesterol", "carbohydrates", "sugars", "fiber", "protein",
        "salt", "sodium", "nutriscore_score", "nova_group",
    ]
    nutrition: dict[str, float | None] = {
        k: _clean_float(raw.get(k)) for k in nutrition_keys
    }

    # ── Scores (string) ───────────────────────────────────────────────────────
    nutriscore_grade = _clean_str(raw.get("nutriscore_grade"), 10)

    # ── Specifications blob ───────────────────────────────────────────────────
    specs_parts: dict[str, str | None] = {
        "generic_name": short_desc,
        "country":      _clean_str(raw.get("country"), 500),
        "packaging":    _clean_str(raw.get("packaging"), 500),
        "ingredients":  _clean_str(raw.get("ingredients"), 5000),
        "allergens":    _clean_str(raw.get("allergens"), 1000),
        "traces":       _clean_str(raw.get("traces"), 500),
        "product_url":  _clean_str(raw.get("product_url"), 1024),
        "nutriscore_grade": nutriscore_grade,
        **{k: str(v) for k, v in nutrition.items() if v is not None},
    }
    import json
    specifications = json.dumps(
        {k: v for k, v in specs_parts.items() if v},
        ensure_ascii=False,
    ) or None

    return {
        # Core identity
        "barcode":           barcode,
        "name":              name,
        "brand":             brand,
        "category":          category,
        "image_url":         image_url,
        "short_description": short_desc,
        "supplier":          supplier,
        "specifications":    specifications,
        "source":            "OPEN_FOOD_FACTS",
        # Defaults (not in OFF; set to 0 / None)
        "cost_price":        None,
        "mrp":               None,
        "sale_price":        None,
    }
