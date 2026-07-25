"""
mapper.py – Maps raw Open Food Facts column names → our DB column names.

Only columns listed in COLUMN_MAP are extracted from each chunk.
Everything else is silently dropped, keeping memory usage minimal.
"""
from __future__ import annotations

from typing import Any

import pandas as pd

# ── Column mapping ─────────────────────────────────────────────────────────────
# key   = exact column name in the TSV file
# value = attribute name on MasterCatalogProduct (or a logical alias)
COLUMN_MAP: dict[str, str] = {
    # Identification
    "code":                    "barcode",
    "product_name":            "name",
    "generic_name":            "generic_name",       # stored in short_description
    "brands":                  "brand",
    "quantity":                "quantity_str",        # raw string e.g. "250 g"
    "manufacturer":            "manufacturer",        # stored in supplier field

    # Classification
    "categories":              "category",
    "countries":               "country",             # stored in specifications
    "packaging":               "packaging",           # stored in specifications

    # Ingredients / Allergens
    "ingredients_text":        "ingredients",         # stored in specifications
    "allergens":               "allergens",           # stored in specifications
    "traces":                  "traces",              # stored in specifications

    # Nutrition (per 100g)
    "energy-kcal_100g":        "energy_kcal",
    "energy-kj_100g":          "energy_kj",
    "fat_100g":                "fat",
    "saturated-fat_100g":      "saturated_fat",
    "trans-fat_100g":          "trans_fat",
    "cholesterol_100g":        "cholesterol",
    "carbohydrates_100g":      "carbohydrates",
    "sugars_100g":             "sugars",
    "fiber_100g":              "fiber",
    "proteins_100g":           "protein",
    "salt_100g":               "salt",
    "sodium_100g":             "sodium",

    # Scores
    "nutriscore_grade":        "nutriscore_grade",
    "nutriscore_score":        "nutriscore_score",
    "nova_group":              "nova_group",

    # Media
    "image_url":               "image_url",
    "url":                     "product_url",

    # Metadata
    "last_updated_datetime":   "last_updated",
}

# Columns we actually need to SELECT from pandas (source side of the map)
REQUIRED_SOURCE_COLS: list[str] = list(COLUMN_MAP.keys())

# Numeric nutrition fields that must be cast to float
NUMERIC_COLS: set[str] = {
    "energy-kcal_100g", "energy-kj_100g", "fat_100g", "saturated-fat_100g",
    "trans-fat_100g", "cholesterol_100g", "carbohydrates_100g", "sugars_100g",
    "fiber_100g", "proteins_100g", "salt_100g", "sodium_100g",
    "nutriscore_score", "nova_group",
}


def build_nutrition_json(row: dict[str, Any]) -> str:
    """Serialise all nutrition fields as a compact JSON string."""
    import json
    nutrition = {
        "energy_kcal":     row.get("energy_kcal"),
        "energy_kj":       row.get("energy_kj"),
        "fat":             row.get("fat"),
        "saturated_fat":   row.get("saturated_fat"),
        "trans_fat":       row.get("trans_fat"),
        "cholesterol":     row.get("cholesterol"),
        "carbohydrates":   row.get("carbohydrates"),
        "sugars":          row.get("sugars"),
        "fiber":           row.get("fiber"),
        "protein":         row.get("protein"),
        "salt":            row.get("salt"),
        "sodium":          row.get("sodium"),
        "nutriscore_grade":row.get("nutriscore_grade"),
        "nutriscore_score":row.get("nutriscore_score"),
        "nova_group":      row.get("nova_group"),
    }
    # Drop None values to keep the JSON short
    nutrition = {k: v for k, v in nutrition.items() if v is not None}
    return json.dumps(nutrition, ensure_ascii=False)


def build_specifications_json(row: dict[str, Any]) -> str:
    """Pack all non-core enrichment fields as a JSON blob for specifications."""
    import json
    specs = {
        "generic_name":  row.get("generic_name"),
        "country":       row.get("country"),
        "packaging":     row.get("packaging"),
        "ingredients":   row.get("ingredients"),
        "allergens":     row.get("allergens"),
        "traces":        row.get("traces"),
        "product_url":   row.get("product_url"),
    }
    specs = {k: v for k, v in specs.items() if v}
    return json.dumps(specs, ensure_ascii=False) if specs else ""


def map_chunk(df: pd.DataFrame) -> list[dict[str, Any]]:
    """
    Given a raw pandas DataFrame chunk, return a list of dicts ready for
    the validator.  Only the columns we care about are extracted.
    """
    # Keep only columns that exist in this particular file
    cols_present = [c for c in REQUIRED_SOURCE_COLS if c in df.columns]
    df = df[cols_present].copy()

    # Rename to logical names
    rename_map = {src: COLUMN_MAP[src] for src in cols_present}
    df.rename(columns=rename_map, inplace=True)

    # Cast numeric cols (errors → NaN → None after conversion)
    for src_col, logical in COLUMN_MAP.items():
        if src_col in NUMERIC_COLS and logical in df.columns:
            df[logical] = pd.to_numeric(df[logical], errors="coerce")

    # Replace NaN with None so json-safe
    df = df.where(pd.notnull(df), other=None)

    return df.to_dict(orient="records")
