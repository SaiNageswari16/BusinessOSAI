"""Menu service schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from src.services.menu.models import CategoryType, ItemType, PricingRuleType


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Categories ──────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    name: str = Field(max_length=100)
    slug: str = Field(max_length=100)
    description: str | None = None
    category_type: CategoryType = CategoryType.FOOD
    is_veg_only: bool = False
    sort_order: int = 0
    available_from: str | None = None
    available_to: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    description: str | None = None
    is_veg_only: bool | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    available_from: str | None = None
    available_to: str | None = None


class CategoryResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    slug: str
    description: str | None
    category_type: CategoryType
    is_veg_only: bool
    is_active: bool
    sort_order: int
    available_from: str | None
    available_to: str | None
    created_at: datetime


# ─── Variants / addons ───────────────────────────────────────────────────────

class VariantCreate(BaseModel):
    name: str = Field(max_length=100)
    price_delta: float = 0
    is_default: bool = False
    sort_order: int = 0


class VariantResponse(OrmModel):
    id: uuid.UUID
    menu_item_id: uuid.UUID
    name: str
    price_delta: float
    is_default: bool
    is_active: bool
    sort_order: int


class AddonGroupCreate(BaseModel):
    name: str = Field(max_length=100)
    min_select: int = 0
    max_select: int = 1
    sort_order: int = 0


class AddonGroupResponse(OrmModel):
    id: uuid.UUID
    menu_item_id: uuid.UUID
    name: str
    min_select: int
    max_select: int
    is_active: bool
    sort_order: int


class AddonCreate(BaseModel):
    # Redundant with {group_id} in the path — optional there, optional here.
    group_id: uuid.UUID | None = None
    name: str = Field(max_length=100)
    price: float = 0
    sort_order: int = 0


class AddonResponse(OrmModel):
    id: uuid.UUID
    group_id: uuid.UUID
    name: str
    price: float
    is_active: bool
    sort_order: int


# ─── Items ───────────────────────────────────────────────────────────────────

class ItemCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    name: str = Field(max_length=200)
    code: str = Field(max_length=30)
    description: str | None = None
    item_type: ItemType = ItemType.VEG
    short_name: str | None = Field(default=None, max_length=50)
    base_price: float = Field(default=0, ge=0)
    cost_price: float | None = Field(default=None, ge=0)
    mrp: float | None = Field(default=None, ge=0)
    prep_time_minutes: int | None = None
    serving_size: str | None = None
    kitchen_station_id: uuid.UUID | None = None
    tax_code_id: uuid.UUID | None = None
    hsn_code: str | None = None
    track_inventory: bool = False
    image_url: str | None = None
    tags: list[str] = Field(default_factory=list)
    sort_order: int = 0


class ItemUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = None
    item_type: ItemType | None = None
    short_name: str | None = Field(default=None, max_length=50)
    category_id: uuid.UUID | None = None
    base_price: float | None = Field(default=None, ge=0)
    cost_price: float | None = Field(default=None, ge=0)
    mrp: float | None = Field(default=None, ge=0)
    prep_time_minutes: int | None = None
    serving_size: str | None = None
    kitchen_station_id: uuid.UUID | None = None
    tax_code_id: uuid.UUID | None = None
    hsn_code: str | None = None
    is_active: bool | None = None
    is_available: bool | None = None
    track_inventory: bool | None = None
    image_url: str | None = None
    tags: list[str] | None = None
    sort_order: int | None = None


class ItemResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    category_id: uuid.UUID | None
    name: str
    code: str
    description: str | None
    item_type: ItemType
    short_name: str | None
    is_active: bool
    is_available: bool
    base_price: float
    cost_price: float | None
    mrp: float | None
    prep_time_minutes: int | None
    serving_size: str | None
    kitchen_station_id: uuid.UUID | None
    tax_code_id: uuid.UUID | None
    hsn_code: str | None
    track_inventory: bool
    image_url: str | None
    tags: list
    sort_order: int
    created_at: datetime
    updated_at: datetime


class ItemDetailResponse(ItemResponse):
    """Item plus its variants and addon groups — the POS pricing view."""

    variants: list[VariantResponse] = Field(default_factory=list)
    addon_groups: list[AddonGroupResponse] = Field(default_factory=list)


# ─── Modifiers ───────────────────────────────────────────────────────────────

class ModifierGroupCreate(BaseModel):
    name: str = Field(max_length=100)
    min_select: int = 0
    max_select: int = 1


class ModifierGroupResponse(OrmModel):
    id: uuid.UUID
    name: str
    min_select: int
    max_select: int
    is_active: bool


class ModifierCreate(BaseModel):
    # Redundant with {group_id} in the path — optional there, optional here.
    group_id: uuid.UUID | None = None
    name: str = Field(max_length=100)
    price_delta: float = 0
    sort_order: int = 0


class ModifierResponse(OrmModel):
    id: uuid.UUID
    group_id: uuid.UUID
    name: str
    price_delta: float
    is_active: bool
    sort_order: int


# ─── Recipes ─────────────────────────────────────────────────────────────────

class RecipeLineCreate(BaseModel):
    inventory_item_id: uuid.UUID
    qty: float = Field(gt=0)
    uom_id: uuid.UUID | None = None
    wastage_pct: float = Field(default=0, ge=0, le=100)
    is_optional: bool = False


class RecipeLineResponse(OrmModel):
    id: uuid.UUID
    inventory_item_id: uuid.UUID
    qty: float
    uom_id: uuid.UUID | None
    wastage_pct: float
    is_optional: bool


class RecipeCreate(BaseModel):
    name: str = Field(max_length=200)
    variant_id: uuid.UUID | None = None
    yield_qty: float = 1
    yield_uom_id: uuid.UUID | None = None
    instructions: str | None = None
    lines: list[RecipeLineCreate] = Field(default_factory=list)


class RecipeResponse(OrmModel):
    id: uuid.UUID
    menu_item_id: uuid.UUID
    variant_id: uuid.UUID | None
    name: str
    yield_qty: float
    yield_uom_id: uuid.UUID | None
    instructions: str | None
    is_active: bool
    lines: list[RecipeLineResponse] = Field(default_factory=list)


# ─── Recipe catalog (RAG-style search + breakdown) ───────────────────────────


class RecipeSearchResponse(BaseModel):
    """One ranked result from the predefined-recipe catalog search."""

    item_id: uuid.UUID
    code: str
    name: str
    description: str | None
    item_type: str
    base_price: float
    yield_qty: float
    instructions: str | None
    ingredient_count: int
    score: float
    """Weighted match score: name hit (x4) + description/tag hit (x2) +
    shared-ingredient hit (x1 per ingredient)."""
    match_reasons: list[str] = Field(default_factory=list)
    """Human-readable explanation of why this result matched the query."""


class RecipeBreakdownLine(BaseModel):
    """One ingredient row of a scaled recipe breakdown.

    ``inventory_item_id`` is the join key. The menu service owns the BOM
    (qty per portion, wastage) and the scaling math. Live stock, cost,
    item name, and code come from the inventory service — the frontend joins
    on ``inventory_item_id`` and populates ``name``, ``code``, ``unit``,
    ``available_stock``, ``standard_cost``, ``line_cost``, ``is_sufficient``,
    and ``shortfall`` before rendering.
    """

    inventory_item_id: uuid.UUID
    """Join key into the inventory service's item list."""

    name: str = ""
    """Inventory item name. Populated by the frontend from the inventory
    item list."""

    code: str = ""
    """Inventory item code. Populated by the frontend."""

    unit: str = ""
    """Human-readable unit of measure, e.g. ``g``, ``ml``, ``piece``.
    Populated by the frontend."""

    qty_per_portion: float
    """Quantity per single portion (the recipe line's raw qty, in the item's
    unit of measure)."""

    wastage_pct: float = 0.0
    """Wastage/trim loss percentage baked into the recipe line. Drives the
    required-for-N calculation: ``qty_per_portion * N * (1 + wastage_pct/100)``."""

    required_for_n: float
    """Total quantity required for ``portions`` servings, inclusive of
    wastage: ``qty_per_portion * portions * (1 + wastage_pct/100)``."""

    available_stock: float = 0.0
    """Live available stock across all locations. Populated by the frontend
    from the inventory service. ``0.0`` until the frontend joins it."""

    is_sufficient: bool = False
    """True if ``available_stock >= required_for_n``. Set by the frontend."""

    shortfall: float = 0.0
    """How much is short, if any. Zero when ``is_sufficient``. Set by the
    frontend."""

    standard_cost: float | None = None
    """Per-unit cost. Populated by the frontend from the inventory item's
    ``standard_cost`` field."""

    line_cost: float | None = None
    """``required_for_n * standard_cost``. Populated by the frontend."""


class RecipeBreakdownResponse(BaseModel):
    """Full scaled recipe breakdown with live inventory data."""

    item_id: uuid.UUID
    name: str
    yield_qty: float
    portions: int
    """The requested scale factor (``N`` in ``qty_per_portion * N``)."""
    total_cost: float | None
    """Sum of all ``line_cost`` values. Null if any line has a null cost."""
    cost_known: bool
    lines: list[RecipeBreakdownLine] = Field(default_factory=list)
    shortage_lines: list[RecipeBreakdownLine] = Field(default_factory=list)
    """Subset of ``lines`` where ``is_sufficient`` is False."""


# ─── Combos ──────────────────────────────────────────────────────────────────

class ComboItemCreate(BaseModel):
    menu_item_id: uuid.UUID
    variant_id: uuid.UUID | None = None
    qty: int = 1


class ComboCreate(BaseModel):
    name: str = Field(max_length=200)
    code: str = Field(max_length=30)
    description: str | None = None
    combo_price: float = Field(ge=0)
    items: list[ComboItemCreate] = Field(default_factory=list)


class ComboItemResponse(OrmModel):
    id: uuid.UUID
    menu_item_id: uuid.UUID
    variant_id: uuid.UUID | None
    qty: int


class ComboResponse(OrmModel):
    id: uuid.UUID
    name: str
    code: str
    description: str | None
    combo_price: float
    is_active: bool
    items: list[ComboItemResponse] = Field(default_factory=list)


# ─── Pricing rules ───────────────────────────────────────────────────────────

class PricingRuleCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    name: str = Field(max_length=150)
    rule_type: PricingRuleType = PricingRuleType.HAPPY_HOUR
    conditions: dict = Field(default_factory=dict)
    discount_pct: float = Field(default=0, ge=0, le=100)
    priority: int = 0


class PricingRuleResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    rule_type: PricingRuleType
    conditions: dict
    discount_pct: float
    priority: int
    is_active: bool


# ─── AI recipe search (global + LLM + inventory reconcile + auto-PO) ─────────
#
# These back the three menu endpoints under tag "ai":
#   POST /ai/recipe-search   — global recipe search: catalog keyword match +
#                              LLM (Gemini first, Claude failover, multimodal)
#   POST /ai/recipe-reconcile — reconcile a recipe against live inventory
#   POST /ai/recipe-reorder  — auto-create draft POs for the missing/low lines
#
# The search response shape is the frontend contract; reconcile lines carry
# the live figures the frontend renders (available stock, shortfall, status).

from typing import Literal


class AiRecipeSearchRequest(BaseModel):
    query: str | None = None
    """Free-text dish query, e.g. "chicken curry with rice". At least one of
    query or image_b64 must be provided."""
    image_b64: str | None = None
    """Optional base64 image of the dish — sent to the vision provider as an
    image part (Gemini inline_data / Anthropic image block) to help it
    identify the dish when the text alone is ambiguous. No data: prefix."""
    image_mime: str | None = None
    """MIME type of image_b64. Defaults to image/jpeg."""
    portions: int = Field(default=1, ge=1)
    limit: int = Field(default=5, ge=1, le=25)
    provider: Literal["auto", "gemini", "claude", "openai"] = "auto"
    """Which LLM to use. 'auto' (default) runs the configured cascade —
    Gemini first, then Claude (Anthropic), then OpenAI — so if one is down or
    unkeyed the next catches up. A named provider forces that one only."""


class AiRecipeIngredient(BaseModel):
    """One ingredient of a recipe result. Accepts ``qty`` or
    ``qty_per_portion`` — the LLM prompt asks for ``qty``; both keys parse
    and normalize to ``qty_per_portion``."""
    name: str
    inventory_code: str | None = None
    """Static catalog code (e.g. INV-CHKN) when the source knew one; null for
    LLM-generated ingredients, which reconcile by name."""
    inventory_item_id: uuid.UUID | None = None
    """Resolved to a real inventory item UUID when possible (catalog code ->
    live inventory lookup; fuzzy name -> inventory item name). Null when the
    ingredient could not be matched to stock."""
    qty_per_portion: float | None = None
    qty: float | None = None
    """Alias of qty_per_portion — accepted from LLM/clients, normalized on
    input to qty_per_portion by the response validation below."""
    unit: str = ""
    wastage_pct: float = 0.0
    is_optional: bool = False
    note: str = ""

    @field_validator("qty_per_portion", mode="before")
    @classmethod
    def _norm_qty(cls, v):
        return v if isinstance(v, (int, float)) else None

    @model_validator(mode="after")
    def _fill_from_alias(self):
        if self.qty_per_portion is None and self.qty is not None:
            self.qty_per_portion = float(self.qty)
        if self.qty_per_portion is None:
            self.qty_per_portion = 0.0
        return self


class AiRecipeSearchIngredient(AiRecipeIngredient):
    """Same shape as AiRecipeIngredient — kept as a named alias so existing
    imports (reconcile request/response) don't break."""


class AiRecipeResult(BaseModel):
    """One recipe from any source (catalog, LLM, zomato, swiggy).

    The normalized dataclass ``to_dict()`` (ai_recipe_search.py) and a full
    recipe POSTed by the client both validate against this — so the search
    and reconcile endpoints share one shape.
    """
    recipe_id: str
    """The catalog code (CAT-...) for catalog results, or a generated
    'llm:' id for LLM-generated results."""
    name: str
    description: str | None = None
    item_type: Literal["veg", "non_veg", "beverage"] = "non_veg"
    base_price: float | None = None
    yield_qty: float = 1.0
    instructions: str | None = None
    confidence: float = 1.0
    """0..1 — how sure we are this is the dish the query meant."""
    source: str = "catalog"
    """'catalog' | 'llm' | 'zomato' | 'swiggy' — which recipe source produced
    this result."""
    ingredients: list[AiRecipeIngredient] = Field(default_factory=list)


class AiRecipeSearchResponse(BaseModel):
    """The AI recipe-search response — the exact frontend contract.

    ``results`` always comes back (HTTP 200) even when the LLM path degraded;
    ``provider_used`` + ``error`` explain the LLM side, and each result
    carries its own ``source`` field ('catalog' | 'llm')."""
    results: list[AiRecipeResult]
    """Merged, deduped (by name) list of catalog keyword matches plus the
    LLM-generated recipe (when one was produced)."""
    provider_used: Literal["gemini", "claude", "openai", "none"]
    """Which provider produced the LLM result ('claude' = the Anthropic
    provider); 'none' when no key is configured or every provider failed.
    Catalog results are still returned in that case."""
    error: str | None = None
    """A short, human-readable reason when the LLM path degraded (no LLM keys
    configured, every provider failed, malformed LLM JSON, ...). Null when
    the LLM succeeded or was not requested. The response is still 200 —
    catalog results still come back."""


class AiReconcileRequest(BaseModel):
    """Reconcile a predefined catalog recipe (by code or name) or a full
    recipe object against live inventory. Inputs, by precedence:
    ``recipe_name_or_id`` > ``recipe_id`` > ``recipe``."""
    recipe_name_or_id: str | None = None
    """The contract's primary field: a catalog code ('CAT-...'), a menu-item
    name, or an item/recipe id. Resolved server-side; unknown values return
    404 with a clear detail. ``recipe_id``/``recipe`` remain as alternatives
    for clients that already have the full object."""
    recipe_id: str | None = None
    """A catalog code (CAT-...) or the recipe_id of a search result."""
    recipe: AiRecipeResult | None = None
    """A full recipe object to reconcile — either one returned by
    /ai/recipe-search or a hand-built one. At least one of recipe_id or
    recipe must be provided."""
    portions: int = Field(default=1, ge=1)
    inventory_item_ids: dict[str, uuid.UUID] | None = None
    """Optional name-or-code -> inventory item id overrides, resolved by the
    client. Takes precedence over the server-side code/name resolution."""


class AiReconcileLine(BaseModel):
    """One reconciled ingredient line — the minute detail the frontend shows:
    live stock vs what the recipe needs, per ingredient."""
    name: str
    unit: str = ""
    qty_per_portion: float = 0.0
    wastage_pct: float = 0.0
    inventory_item_id: uuid.UUID | None = None
    """Null when the ingredient could not be mapped to any stock item."""
    required_for_n: float = 0.0
    """(qty_per_portion / yield_qty) * portions * (1 + wastage_pct/100) — the
    quantity the kitchen must actually pull for this batch."""
    available_stock: float = 0.0
    reorder_level: float = 0.0
    standard_cost: float | None = None
    """Per-unit cost from the inventory service; null when unknown."""
    line_cost: float | None = None
    """required_for_n * standard_cost; null when the cost is unknown."""
    status: Literal["in_stock", "low", "missing"] = "missing"
    """'missing' = no matching inventory item, or available <= 0;
    'low' = available < required (or at/below the reorder level);
    'in_stock' otherwise."""
    shortfall: float = 0.0
    """How much more is needed: max(0, required - available)."""
    suggested_po_qty: float = 0.0
    """What the reorder step would order for this line: enough to cover the
    shortfall and refill to at least the reorder buffer
    (max(required, reorder_level*2) - available). 0 when in_stock."""
    vendor_id: uuid.UUID | None = None
    """The vendor that carries this item (active VendorItem row), for the
    reorder step; null when no vendor is configured for the item."""
    suggested_qty: float | None = None
    """The vendor's agreed reorder quantity (VendorItem.suggested_qty); null
    when the vendor has none set."""


class AiReconcileResponse(BaseModel):
    name: str
    portions: int
    lines: list[AiReconcileLine] = Field(default_factory=list)
    total_cost: float | None = None
    """Sum of line_cost across lines whose cost is known; null when any cost
    is unknown or there are no lines."""
    cost_known: bool = False
    """True only when every line's standard_cost came back from inventory."""
    low_count: int = 0
    missing_count: int = 0
    total: dict | None = None
    """The summary block: ``{lines, in_stock, low, missing, total_cost,
    cost_known}`` — mirrors the top-level counters so the frontend can read
    one grouped object. Null when the response was produced without the
    summary (defensive default)."""


class RecipeReconcileLine(BaseModel):
    """One line of the reconciled recipe, as the PO-creation step consumes it.

    Shaped to the exact reorder contract so the frontend can pass reconcile
    output straight into /ai/recipe-reorder: every field has a default, so a
    partial line (just an item id) is valid. ``shortfall`` plus
    ``reorder_level`` is the default suggested order quantity — enough to
    cover the gap AND refill to the reorder level (the buffer)."""
    inventory_item_id: uuid.UUID
    name: str | None = None
    required_for_n: float = 0.0
    available_stock: float = 0.0
    reorder_level: float = 0.0
    status: Literal["in_stock", "low", "missing"] = "missing"
    shortfall: float = 0.0
    standard_cost: float | None = None
    line_cost: float | None = None


class AiReorderLineIn(BaseModel):
    """One line to reorder — mirrors AiReconcileLine so the frontend can pass
    reconcile output here almost verbatim. 'missing' lines become draft POs;
    'low' lines become purchase requests."""
    inventory_item_id: uuid.UUID | None = None
    """The live stock item to order. May be null when the ingredient could
    not be matched to inventory (reconcile's status='missing' with no id) —
    such lines are reported skipped, never 500."""
    name: str | None = None
    """The ingredient name, stamped into the document line notes so
    procurement can see what the order is for."""
    status: Literal["in_stock", "low", "missing"] = "missing"
    """From the reconcile step: 'missing' -> draft PO, 'low' -> purchase
    request. Anything not 'low' (and not in_stock) is ordered as a PO."""
    suggested_po_qty: float = Field(default=0.0, ge=0.0)
    """How much to order. 0 lets the server compute it: the vendor's agreed
    suggested qty, or a minimal 1 unit — never a zero-qty line."""
    shortfall: float = 0.0
    """Copied through from reconcile for the record."""
    reorder_level: float = 0.0
    """Copied through from reconcile for the record."""
    available_stock: float = 0.0
    required_for_n: float = 0.0
    unit_price: float | None = None
    """Override the vendor's last purchase price. Null = use VendorItem."""


class AiReorderRequest(BaseModel):
    recipe_name_or_id: str | None = None
    """The contract's primary input: a catalog code ('CAT-...'), a menu-item
    name, or an item id. When supplied (and ``lines`` is empty) the server
    runs its own reconcile and derives the missing/low lines — the frontend
    only passes the recipe reference + portions. If ``lines`` is present it
    wins (the richer pass-through from /ai/recipe-reconcile)."""
    portions: int = Field(default=1, ge=1)
    """Portions the reconcile (and therefore the order quantities) scale to
    when lines are derived server-side from recipe_name_or_id."""
    lines: list[AiReorderLineIn] = Field(default_factory=list)
    """Reconcile lines to turn into purchase documents. 'missing' lines
    become draft POs; 'low' lines become purchase requests."""
    outlet_id: uuid.UUID | None = None
    """The outlet the documents are for; null when the tenant has a single
    outlet (resolved from the caller's identity)."""
    recipe_name: str | None = None
    """Which recipe this reorder came from — stamped into the document notes
    so procurement can see the origin. Defaults to ``recipe_name_or_id``."""


class AiReorderSkipped(BaseModel):
    inventory_item_id: uuid.UUID | None = None
    reason: str


class AiReorderCreated(BaseModel):
    id: uuid.UUID
    """The created document's id (PO or PR)."""
    number: str
    """Human document number, e.g. 'PO-XXXXXXXX' / 'PR-XXXXXXXX'."""
    lines: int
    """How many lines the created document carries."""


class AiReorderCreatedLine(BaseModel):
    inventory_item_id: uuid.UUID
    ordered_qty: float
    unit_price: float = 0.0
    notes: str | None = None
    """The stamped 'ai-recipe-reorder: ...' note (recipe origin + status)."""


class AiReorderResponse(BaseModel):
    created: bool = False
    """True when at least one document (PO or PR) was created by this call."""
    po_id: uuid.UUID | None = None
    """The contract's primary field: the created draft PO's id when exactly
    one PO was created; null when none (created=false) or when the gaps
    spanned several vendors (see ``po_created`` — all the POs)."""
    po_number: str | None = None
    """The created PO's human number, e.g. 'PO-XXXX' (same scope as
    ``po_id``)."""
    lines: list[AiReorderCreatedLine] = Field(default_factory=list)
    """The ordered lines across the created PO(s): item, qty, vendor
    price. Empty when nothing was created."""
    reason: str | None = None
    """Why nothing was created when ``created`` is false (e.g. 'an open
    PO/PR already covers every line', 'no active vendor configured');
    null when a PO was created."""
    po_created: list[AiReorderCreated] = Field(default_factory=list)
    """Draft purchase orders created for the missing lines, one per vendor."""
    pr_created: list[AiReorderCreated] = Field(default_factory=list)
    """Purchase requests created for the low lines."""
    idempotent: list[AiReorderSkipped] = Field(default_factory=list)
    """Lines that were NOT re-ordered because an open PO or PR already covers
    the same inventory item (or no vendor carries it)."""
    note: str = ""
    """One-line human summary: how many documents were created and how many
    lines were skipped."""
