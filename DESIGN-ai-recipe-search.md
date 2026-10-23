# Design: Global Realtime AI Recipe Search

A concrete, buildable implementation plan for the "global realtime AI recipe
search" feature in RestaurantOS. All file paths are relative to
`c:\Users\abhil\Desktop\restaurant\`. This document is a design, not code —
each section names the exact files, functions, and endpoint shapes an
implementer should produce.

---

## 0. Where this lives and how the pieces fit

The new feature is a **menu-service capability** (it produces a recipe and
reconciles it with the inventory BOM), so the new backend module goes in the
menu service. It **depends on three cross-service HTTP calls** that already
have a working pattern (`menu/api.py:651-671` is the reference for the
inventory `cost-lookup` call; `inventory/api.py:239-260` is the reference for
the menu `recipe-lines` call):

| Dependency | Reuse / change | Why |
|---|---|---|
| LLM cascade | **Extend** `src/services/ai_service.py` | The Gemini/OpenAI/Anthropic cascade + `_fallback` already exist (`ai_service.py:163`). This feature needs *structured JSON* output, *multimodal* input, and *retry+cache+rate-limit* — none of which `answer_question()` has. Add a second public entry point rather than polluting `answer_question()`. |
| Inventory stock + cost | **New** `menu/api.py` helper that calls `GET /api/v1/inventory/items/cost-lookup` | The existing `item_food_cost` already proves this call works (`menu/api.py:651-671`). The recipe-reconcile endpoint needs stock **and** `reorder_level` in one shot, which `cost-lookup` already returns but not `reorder_level` — see §4.2 for the one-line inventory change. |
| Purchase PO / PR creation | **New** cross-service calls from menu to `POST /api/v1/purchase/purchase-orders` and `POST /api/v1/purchase/purchase-requests` | The existing auto path (`purchase/api.py:125` `_on_stock_low`) already creates a **PR** from `stock.low`. The user wants a *draft PO* for missing items *and* a *PR* for low-stock items, triggered by **this recipe's** reconciliation — a new, explicit trigger. We reuse `svc.create_order` / `svc.create_request` behind a new menu-side "generate restock orders" endpoint. |

Key architectural decision: **the AI recipe-search endpoint is new and lives in
the menu service**; it does NOT replace the existing keyword `search_recipes()`
(`menu/api.py:212`). The keyword search stays as the **degraded fallback** when
no LLM key is configured (§8). The recipe page keeps its current debounced
catalog search and *adds* a second "AI Search" input that hits the new endpoint.

---

## 1. New backend module: `ai_recipe_search`

### 1.1 File location

Create **`backend/src/services/menu/ai_recipe_search.py`** — a single new module
in the menu service. It is *imported by* `menu/api.py` (new endpoints, §2),
not a standalone ASGI app (it has no DB of its own; it's logic + LLM + cache).
No new service descriptor in `registry.py` is needed.

### 1.2 Data structures (Pydantic, in the same module)

```python
# ── Normalized ingredient line (what every source yields) ──
class NormalizedIngredient(BaseModel):
    name: str
    """Human-readable ingredient, e.g. 'basmati rice'."""
    qty_per_portion: float
    """Quantity for ONE portion, in the item's own unit. Mirrors
    RecipeLine.qty semantics (menu/schemas.py:224)."""
    unit: str
    """'g' | 'ml' | 'kg' | 'piece' | ... ."""
    wastage_pct: float = 0.0
    is_optional: bool = False
    note: str = ""
    """Optional prep note ('soaked 30 min')."""
    inventory_code: str | None = None
    """If the source knew a stock code (catalog/seed case), carry it.
    LLM-generated recipes leave this None — the reconcile step maps the
    name to an inventory item via fuzzy match against /items (see §4)."""

# ── Normalized recipe (the adapter output of every source) ──
class NormalizedRecipe(BaseModel):
    name: str
    description: str | None = None
    item_type: str = "non_veg"   # veg | non_veg | beverage
    base_price: float | None = None
    yield_qty: float = 1.0
    instructions: str | None = None
    ingredients: list[NormalizedIngredient]
    source: str
    """'llm' | 'zomato' | 'swiggy' | 'catalog' — which adapter produced it."""
    source_id: str | None = None
    """Stable external id (zomato dish id, catalog CAT- code) for the cache key."""
    confidence: float = 1.0
    """0..1. LLM sets it from the model; catalog=1.0; aggregator default 0.7."""

# ── The LLM's requested structured JSON shape ──
class _RecipeJson(BaseModel):
    name: str
    description: str | None = None
    item_type: Literal["veg", "non_veg", "beverage"] = "non_veg"
    base_price: float | None = None
    yield_qty: float = 1.0
    instructions: str | None = None
    confidence: float = Field(default=1.0, ge=0, le=1)
    ingredients: list[NormalizedIngredient]
```

`_RecipeJson` is the **single source of truth for the JSON schema** we ask the
LLM to produce. It is also used as the Pydantic validator that turns raw
model text into a `NormalizedRecipe` (§8.2).

### 1.3 Function signatures

```python
# ── Source adapter interface (each source yields a NormalizedRecipe) ──
class RecipeSource(Protocol):
    name: str
    async def search(
        self,
        query: str,
        image_b64: str | None,
        image_mime: str | None,
        limit: int,
    ) -> list[NormalizedRecipe]: ...

def llm_source() -> RecipeSource            # Gemini/Claude (multimodal + JSON)
def zomato_source() -> RecipeSource | None  # None if zomato key empty
def swiggy_source() -> RecipeSource | None  # None if swiggy key empty
def catalog_source() -> RecipeSource          # wrap the 9 static CATALOG recipes

# ── LLM structured call (the core of the module) ──
async def _generate_recipe_llm(
    query: str,
    image_b64: str | None,
    image_mime: str | None,
) -> tuple[NormalizedRecipe | None, str | None]:
    """One LLM round-trip with provider failover + retry + backoff.
    Returns (recipe_or_None, provider_name). provider None => used fallback.
    Uses the _RecipeJson structured schema; retries once on malformed JSON
    before declaring failure (§8.2)."""

# ── The public entry point the new endpoint calls ──
async def ai_recipe_search(
    query: str,
    image_b64: str | None = None,
    image_mime: str | None = None,
    portions: int = 1,
    limit: int = 5,
) -> list[NormalizedRecipe]:
    """Fan out to every *enabled* source (llm, zomato, swiggy, catalog),
    merge, de-dupe by name+source_id, sort by confidence, return top N.
    The LLM path is the only one that actually costs money; the others are
    free, so they always run when their key/config is present."""

# ── Cache + rate limiter (module-level singletons, self-contained) ──
def _cache_key(query: str, image_hash: str | None) -> str
    """Lowercase, whitespace-normalize the query; append the image SHA-1 if an
    image was supplied. This is what 'chicken dum biryani ' and
    'chicken dum  biryani' collapse to."""

class LLMResultCache:
    """In-memory LRU+TTL cache keyed on _cache_key.  No Redis dependency —
    lives in the menu process.  Bounded by maxsize."""
    def __init__(self, maxsize: int, ttl_seconds: int): ...
    def get(self, key: str) -> NormalizedRecipe | None
    def set(self, key: str, value: NormalizedRecipe, source: str) -> None

class TokenBucketRateLimiter:
    """Per-provider token bucket.  capacity = burst, rate = req/sec.  Guards
    every _generate_recipe_llm call so a busy page can't hammer Gemini."""
    def __init__(self, capacity: int, rate: float): ...
    async def acquire(self, provider: str) -> None
    """Awaits until a token is available (with a max-wait that raises →
    the caller falls through to the next provider, not to an infinite wait)."""

llm_cache: LLMResultCache         # built from settings on first use
llm_rate_limiter: TokenBucketRateLimiter
```

> **Concurrency note:** the rate limiter and cache are per-process in-memory.
> The menu service runs as a single process (registry port 8102, `menu/main.py`),
> so there is no multi-process consistency problem. If the menu service is ever
> scaled to N replicas, each replica gets its own bucket — acceptable for a
> "don't hammer the LLM" guardrail; a shared Redis bucket is a follow-up.

### 1.4 LLM call shape (Gemini + Claude, both multimodal + structured JSON)

The module builds **one** JSON-output prompt and feeds it to whichever
provider the cascade reaches, in this order (driven by `settings.ai_provider`,
default `gemini`, then the others always appended so one outage is not a total
outage — same logic as `ai_service.answer_question`, lines 178-186):

**Prompt template** (text + optional image parts):

```
SYSTEM (both providers):
"You are a professional chef. Return ONLY valid JSON matching this schema.
For each ingredient give name, qty_per_portion (float, for ONE portion),
unit ('g'|'ml'|'kg'|'piece'|...), optional wastage_pct, optional note,
is_optional. If an image was provided, identify the dish from it.
Fields: {name, description, item_type, base_price, yield_qty,
instructions, confidence, ingredients: [...]}. No prose, no markdown."

USER:
"Recipe for: {query}. Portions requested: {portions}.
{if image: 'A photo of the dish is attached.'}"
```

**Gemini** (`generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`):
- `contents[0].parts` = `[ {"text": user_prompt} ]` **plus**, when
  `image_b64` is present,
  `[ {"inline_data": {"mime_type": image_mime, "data": image_b64}} ]`.
- `generationConfig.responseMimeType = "application/json"`,
  `responseSchema` = the `_RecipeJson` schema (Gemini supports it),
  `maxOutputTokens = settings.ai_max_tokens`.
- Parse: `candidates[0].content.parts[0].text` → `json.loads` → `_RecipeJson`.

**Claude** (`api.anthropic.com/v1/messages`):
- `messages[0].content` = array of blocks: `{"type":"text","text":user_prompt}`
  **plus**, when an image is present,
  `{"type":"image","source":{"type":"base64","media_type":image_mime,"data":image_b64}}`.
- `system` = the system prompt; `max_tokens = settings.ai_max_tokens`.
- Claude has no `responseSchema`; rely on the "return only JSON" instruction
  and validate with `_RecipeJson` (§8.2).
- Parse: join `content[].text` → `json.loads` → `_RecipeJson`.

Both providers keep the existing `_TIMEOUT = httpx.Timeout(30.0, connect=5.0)`
(`ai_service.py:27`). On exception or a 429/5xx, that provider yields `None`
and the cascade moves to the next — **this is the "if one fails the other
catches up" failover the user asked for.** The retry-with-backoff (§1.5) is
applied *within* a provider before we declare it failed and move on.

### 1.5 Retry + backoff (per provider, before failover)

```python
async def _with_retry(fn, *, attempts: int = 2, base_delay: float = 0.4):
    """fn() -> NormalizedRecipe | None.  Retry transient errors (network, 429,
    5xx) with exponential backoff (base * 2**i, capped at 2s).  A malformed-JSON
    result is NOT retried here — that is a single *repair* retry owned by
    _generate_recipe_llm (§8.2)."""
```

Backoff delays: `0.4s` then `0.8s`. A 429 from Gemini/Claude is treated as
transient and retried once; a second 429 (still throttled) hands off to the
next provider in the cascade rather than looping.

### 1.6 Settings the module reads (new fields, §7)

- `ai_recipe_cache_maxsize` (default 256), `ai_recipe_cache_ttl_seconds` (300)
- `ai_recipe_rate_capacity` (default 10), `ai_recipe_rate_per_second` (default 2)
- `ai_multimodal_enabled` (default `True`) — master gate for the image path
- `zomato_enabled`/`zomato_api_key`, `swiggy_enabled`/`swiggy_api_key`
  (already exist, `settings.py:132-137`; currently empty → adapters disabled)

---

## 2. New / modified menu endpoints

All in `menu/api.py` (mounted at `/api/v1/menu`, `registry.py:94-98`).
Permission: **read endpoints** use `view:recipes` (already a menu permission,
`registry.py:98`); the **generate-restock** endpoint is a write and uses
`manage:purchase` (the act of creating POs/PRs is a purchase-domain write).

### 2.1 `POST /api/v1/menu/ai-recipe-search`

```
Request (JSON body):
{
  "query":   "chicken dum biryani",   // free text; "" => browse top recipes
  "image_b64": "<optional base64>",    // dish photo, when ai_multimodal_enabled
  "image_mime": "image/jpeg",
  "portions": 4,
  "limit": 5
}

Response (JSON):
{
  "recipes": [ <NormalizedRecipe> ... ],   // merged, de-duped, top `limit`
  "sources": ["llm", "catalog"],           // which adapters contributed
  "provider": "gemini",                    // winning LLM provider, or null
  "from_cache": false,
  "portions": 4
}
```

Implementation (new function in `menu/api.py`):

```python
@router.post("/ai-recipe-search", tags=["ai-recipes"])
async def ai_recipe_search_endpoint(
    payload: AiRecipeSearchRequest, identity: CurrentIdentity, db: DbDep,
) -> AiRecipeSearchResponse:
    identity.require("view:recipes")
    ...
```

Data flow: `ai_recipe_search()` (§1.3) → returns `list[NormalizedRecipe]` →
wrap in the response envelope. If **no source contributed a recipe** (no keys,
all failed), the response carries `recipes: []` and the endpoint **falls back
to the existing keyword search** internally so the page never shows an empty
box (see §8.1).

### 2.2 `POST /api/v1/menu/ai-recipe-reconcile`

Takes **one** `NormalizedRecipe` (or, for catalog-sourced recipes, a `catalog_code`)
plus a portion count, and returns the per-ingredient in/low/missing table
required by requirement #3.

```
Request:
{
  "recipe": { ...NormalizedRecipe... },     // or
  "catalog_code": "CAT-BIRYANI-CHICK",       // catalog shortcut (resolves codes)
  "portions": 4
}

Response:
{
  "name": "...",
  "portions": 4,
  "lines": [
    {
      "inventory_item_id": "uuid-or-null",   // null when unresolved
      "name": "basmati rice",
      "unit": "g",
      "qty_per_portion": 120.0,
      "wastage_pct": 3.0,
      "required_for_n": 485.8,               // qty/N*(portions)*(1+w/100), reuse
                                              // recipe_breakdown math (api.py:593)
      "available_stock": 1200.0,
      "reorder_level": 500.0,
      "standard_cost": 85.0,
      "line_cost": 41343.0,
      "status": "in_stock" | "low" | "missing",
      "shortfall": 0.0,
      "suggested_vendor_id": "uuid-or-null",
      "suggested_po_qty": 0.0
    }, ...
  ],
  "total_cost": 12345.0,
  "cost_known": true,
  "low_count": 2,
  "missing_count": 1
}
```

**Status logic (the heart of requirement #3), per line:**

```
if inventory_item_id is None:
    status = "missing"          # ingredient can't even be mapped to stock
elif available_stock <= 0:
    status = "missing"         # mapped but nothing in the store
elif available_stock < required_for_n and available_stock <= reorder_level:
    status = "low"            # enough-ish but at/below reorder threshold
elif available_stock < required_for_n:
    status = "low"            # can't cover this service, but above reorder level
else:
    status = "in_stock"       # covers the requested customer count
```

The requirement says "low / missing at the requested customer count" — the
`required_for_n` is computed with the **same formula** the existing
`recipe_breakdown` uses (`menu/api.py:593`:
`per_portion / yield_qty * portions * (1 + wastage_pct/100)`), so the numbers
the page already shows for catalog recipes and the numbers this new endpoint
shows are consistent. The new piece is the **stock join + status**, which the
existing `recipe_breakdown` deliberately does *not* do (`api.py:554-564`).

Implementation helper (new, in `menu/api.py`):

```python
async def _reconcile_recipe(
    db, identity, recipe: NormalizedRecipe, portions: int,
) -> ReconcileResponse:
    """1. Fetch live stock+cost in ONE inventory call (cost-lookup, §4.2).
       2. Map each ingredient name -> inventory item id (fuzzy, §4.1).
       3. Compute required/shortfall/status per line (§2.2 above).
       4. For each low/missing line, pick a vendor via VendorItem (§5).
       5. Return the reconciled table."""
```

### 2.3 `POST /api/v1/menu/ai-recipe-reorder`  ("generate restock orders")

The explicit trigger for the PO/PR automation (requirements #4, §5). Takes the
reconciled lines and produces the orders, returning their ids.

```
Request:
{
  "lines": [ {
      "inventory_item_id": "uuid",
      "name": "basmati rice",
      "status": "missing",        // "missing" => draft PO; "low" => PR
      "suggested_po_qty": 600.0,  // what to order to cover this service + buffer
      "unit_price": 85.0,
      "vendor_id": "uuid"        // picked by the reconcile step (§5)
  }, ... ],
  "outlet_id": "uuid"
}

Response:
{
  "po_created":  [ { "po_id": "uuid", "po_number": "PO-XXXX", "lines": 1 } ],
  "pr_created":  [ { "pr_id": "uuid", "pr_number": "PR-XXXX", "lines": 1 } ],
  "skipped":     [ { "inventory_item_id": "...", "reason": "no vendor" } ],
  "idempotent":  [ { "inventory_item_id": "...", "reason": "open PO exists" } ]
}
```

Data flow and idempotency: §5. This endpoint is **write** (`manage:purchase`).

---

## 3. The two global sources + adapter interface

Requirement #6: two sources — **LLM-generated recipes** and **Zomato/Swiggy
menus**. Both are expressed as `RecipeSource` adapters (§1.3) yielding
`NormalizedRecipe`. A third, always-available source (the static catalog,
`catalog.py`) is added so the page *always* has something to show even with
zero keys — this is what makes §8.1's "degrade gracefully" real.

### 3.1 LLM adapter (`llm_source()`)

Wraps `ai_recipe_search()`'s LLM branch. When `query` is empty and no image,
it instead returns the *top N catalog recipes re-labelled* — so "AI search with
no keys" still yields results (§8.1). Gated on `settings.ai_enabled` and at
least one of `gemini_api_key` / `anthropic_api_key` / `openai_api_key`.

### 3.2 Zomato adapter (`zomato_source()`)

```python
class ZomatoSource(RecipeSource):
    name = "zomato"
    def __init__(self, api_key: str): ...
    async def search(self, query, image_b64, image_mime, limit) -> list[NormalizedRecipe]:
        # GET https://www.zomato.com/api/v5/restaurants?count=1&query=<q>
        # -> list of restaurants; for each, GET its menu, flatten dishes.
        # A Zomato dish yields one NormalizedRecipe per dish; ingredients are
        # taken from the dish's ingredient list when present, else None
        # (Zomato menus are sparse — a dish may have no ingredient breakdown,
        #  in which case the reconcile step maps the dish NAME to stock, not
        #  its ingredients; the recipe still shows, and "missing" lines appear
        #  for anything the kitchen must source that isn't mapped).
```

**Gating:** returns `None` from `zomato_source()` when
`settings.zomato_enabled` is False **or** `settings.zomato_api_key` is empty
(`settings.py:132-133`). `ai_recipe_search()` skips `None` adapters, so the
feature runs on LLM + catalog + Swiggy when Zomato is off. No change to
`ai_recipe_search()` is needed when a key is later filled in — the adapter
activates automatically on the next request (settings are lru_cached at
`settings.py:200`, so a key change requires a restart or cache bump).

### 3.3 Swiggy adapter (`swiggy_source()`)

Swiggy has **no public docs API**; it is a first-party integration. The
`swiggy_api_key` exists but there is no stable public endpoint. Design:

```python
class SwiggySource(RecipeSource):
    name = "swiggy"
    # Swiggy item search: POST {swiggy_menu_base}/v1/menu/list  (auth: key)
    # Map Swiggy's "add-on" and "ingredients" fields to NormalizedIngredient
    # when present; else the recipe is name-only (sparse, like Zomato).
```

**Gating:** `settings.swiggy_enabled`/`settings.swiggy_api_key`
(`settings.py:134-135`), both currently empty → `swiggy_source()` returns
`None`, so Swiggy degrades out of the mix with no code change. The `base_url`
is a **new** setting (§7): `swiggy_menu_base` (default
`https://api.swiggy.com/api`), because Swiggy has no single canonical URL.

> Both aggregator adapters are **best-effort and cached** (§1.6) — they must
> not add latency to a page load. Their own rate limits are protected by the
> same per-provider `TokenBucketRateLimiter` (§1.3) when `ai_recipe_search()`
> fans out; the cache TTL for aggregator results is longer (§7) because a
> restaurant menu doesn't change minute-to-minute.

### 3.4 Catalog adapter (`catalog_source()`)

Wraps the 9 `CatalogRecipe`s in `catalog.py`. Each is already a
`NormalizedRecipe` (name/description/item_type/base_price/yield_qty/
instructions + lines → `NormalizedIngredient`, with `inventory_code` carried
from `CatalogLine.inventory_code` and `source="catalog"`,
`source_id=code`). This is the **always-available, free, offline** source.
`confidence=1.0` because it is authoritative for the local kitchen.

---

## 4. Inventory reconciliation in concrete terms

### 4.1 Name → inventory-item mapping (the new join)

LLM/aggregator ingredients carry a **name**, not an `inventory_item_id`.
Reconciliation must map name → item. Two tiers:

1. **Code fast-path (catalog only):** `catalog_source` recipes carry
   `inventory_code` already (e.g. `INV-RICE`). The reconcile step resolves
   them via the inventory service's `GET /items?search=<code>` or, better, a
   one-shot lookup by code. This is exactly what the seed does for codes
   (`seed_catalog.py:32-74` `_inventory_code_to_id_map`), but at runtime over
   HTTP.
2. **Fuzzy name match (LLM/aggregator):** call
   `GET /api/v1/inventory/items?search=<name>` (existing `list_items`,
   `inventory/api.py:337-359` + the `?search=` param pattern in
   `menu/api.py:178`), take the top item by name match. Cache the mapping in
   `llm_cache`'s sibling (`_name_to_item_cache`, a second small LRU) so the
   same ingredient across recipes / requests maps once.

**One-line inventory change (§4.2) so the reconcile gets everything in one
call:** add `reorder_level` to the `cost-lookup` response.

### 4.2 Inventory change: extend `cost-lookup`

`cost_lookup` (`inventory/api.py:266-334`) already returns `standard_cost` and
`total_available`. The reconcile also needs **`reorder_level`** (the low-stock
threshold, `models.py:181`) to compute "low" vs "missing" (§2.2). One line:

```python
# inventory/api.py cost_lookup, the found[i] dict (line 318-325):
found[str(it.id)] = {
    ...
    "reorder_level": float(it.reorder_level or 0.0),   # ← add
}
```

and the "not found" fallback (line 332) gets `"reorder_level": 0.0`. No schema
change, no new endpoint — `cost-lookup` already accepts a comma list of ids
(line 270), so the reconcile passes every resolved `inventory_item_id` in one
HTTP call and gets stock + cost + threshold back together.

### 4.3 The reconcile algorithm (module-level, in `menu/api.py` or
`ai_recipe_search.py`)

```python
async def _reconcile_lines(db, identity, recipe, portions):
    # 1. Resolve every ingredient to an inventory_item_id (§4.1).
    # 2. Batch: ids = [resolved ids]; call /items/cost-lookup?ids=...
    #    (§4.2) → {id: {name, code, standard_cost, total_available,
    #                   reorder_level, found}}.
    # 3. For each line:
    #      required_for_n = qty_per_portion / yield_qty * portions * (1+w/100)
    #      available = stock[id].total_available (0 if not found)
    #      reorder   = stock[id].reorder_level
    #      status    = per §2.2 truth table
    #      shortfall = max(0, required_for_n - available)
    #      line_cost = required_for_n * standard_cost (None if cost unknown)
    #      suggested_po_qty = (reorder_level*2 - available) if status low,
    #                         else shortfall  # buffer the reorder to 2x level
    #      suggested_vendor_id = pick_vendor(id)  # §5
    # 4. total_cost = sum(line_cost); cost_known = any line_cost is not None
    return ReconcileResponse(...)
```

This **reuses the `recipe_breakdown` scaling math verbatim** (`api.py:593`) and
**the `cost-lookup` join pattern** (`api.py:651-671`), so the numbers are
consistent with what the page already computes client-side
(`recipes.tsx:158-179`).

---

## 5. Purchase-order automation (3 behaviors)

The user chose **all three**: (a) auto-create a **draft PO** for *missing*
ingredients, (b) auto-create a **PR** for *low-stock* ingredients, (c) a
manual **"Reorder" button**. (a) and (b) are the `POST /ai-recipe-reorder`
endpoint (§2.3); (c) is a frontend button that calls the same endpoint with a
single line, or the existing `POST /purchase-requests` (`purchase/api.py:230`).

### 5.1 Vendor selection (`pick_vendor`)

Requirement #4: pick a vendor via `VendorItem` ("highest / cheapest price or
most-suggested"). The rule: **cheapest active `VendorItem`** for the item,
falling back to the one with the highest `suggested_qty` if prices tie. This
lives in a new purchase-side helper (or a cross-service read — but `VendorItem`
is in the purchase DB, so it belongs there). New function in
`purchase/api.py` (or `purchase/service.py`):

```python
@router.get("/vendor-items/recommend", tags=["purchase"])
async def recommend_vendor(
    identity: CurrentIdentity, db: DbDep,
    inventory_item_id: uuid.UUID,
) -> RecommendVendorResponse:
    """Return the cheapest active VendorItem for the item, with its
    last_purchase_price and suggested_qty, so the menu service's reorder
    endpoint can fill unit_price + vendor_id. 404 when no vendor carries it."""
```

```python
async def pick_vendor(db, tenant_id, inventory_item_id) -> VendorItem | None:
    rows = await db.execute(
        select(VendorItem).where(
            VendorItem.tenant_id == tenant_id,
            VendorItem.inventory_item_id == inventory_item_id,
            VendorItem.is_active.is_(True),
        ).order_by(VendorItem.last_purchase_price.asc(),
                   VendorItem.suggested_qty.desc())
    )
    return rows.scalars().first()
```

### 5.2 What gets created

For each line in the reorder payload (§2.3):

- **`status == "missing"`** → **draft PO**. Group missing lines *by vendor*
  (each PO has one `vendor_id`, `models.py:281`), create via
  `svc.create_order(db, tenant, outlet, vendor_id, [POLineIn(...)],
  notes="ai-recipe-reorder", created_by=identity.user_id)`
  (`service.py:186-238`). A PO is *draft* (default `POStatus.DRAFT`),
  not auto-sent — mirroring the existing `POST /purchase-orders`
  (`purchase/api.py:316-335`).
- **`status == "low"`** → **PR**. Create via
  `svc.create_request(db, tenant, outlet, [PRLineIn(...)],
  notes="ai-recipe-reorder: low stock", requested_by=...)` then
  `svc.set_pr_status(..., PRStatus.SUBMITTED)` — the *exact* two calls the
  existing auto-path `_on_stock_low` makes (`purchase/api.py:161-168`),
  so the new low-stock trigger is behaviorally identical to a `stock.low`
  event.

`POLineIn.unit_price` comes from `VendorItem.last_purchase_price`
(`models.py:193`) / `suggested_qty` informs `ordered_qty`.

### 5.3 Idempotency (don't double-create)

Before creating, check for an open document covering the same item:

```python
# For each inventory_item_id:
#   open PR:  PurchaseRequest (tenant, outlet, status in [SUBMITTED, APPROVED])
#              whose lines include this item  (see purchase/api.py:149-155)
#   open PO:  PurchaseOrder (tenant, outlet, status in [DRAFT, SENT,
#              CONFIRMED, PARTIAL]) whose lines include this item
# If found → mark skipped in the "idempotent" list, do not create.
```

This mirrors the exact idempotency guard in `_on_stock_low`
(`purchase/api.py:133-155`: "a stock.low for the same item with an open PR is
not new work"). Because the reorder endpoint groups lines by item, one missing
ingredient across two recipe searches cannot spawn two POs — the second search
finds the open PO and skips.

### 5.4 Where each trigger lives

| Behavior | Trigger | Code |
|---|---|---|
| (a) Draft PO for missing | `POST /ai-recipe-reorder` line with `status="missing"` | new endpoint (§2.3) → `svc.create_order` |
| (b) PR for low | `POST /ai-recipe-reorder` line with `status="low"` | new endpoint (§2.3) → `svc.create_request` + `set_pr_status` |
| (c) Manual "Reorder" | frontend button on a single reconciled line → same endpoint with 1 line | `purchaseService.reorderLine()` (§6) |
| existing auto | `stock.low` / `stock.out` event → PR | `_on_stock_low` (`purchase/api.py:125`) — **unchanged** |

The existing event-driven PR path stays. The new endpoint is a *proactive*
trigger (the chef is planning a service and wants stock now), complementary
to the *reactive* event path.

---

## 6. Frontend changes

Files: `frontend/src/routes/recipes.tsx` (modify),
`frontend/src/services/menuService.ts` (add 2 methods),
`frontend/src/services/purchaseService.ts` (**new**).

### 6.1 `purchaseService.ts` (new)

```ts
import { apiClient } from "../lib/api-client";

export interface ReorderLine {
  inventory_item_id: string;
  name: string;
  status: "in_stock" | "low" | "missing";
  suggested_po_qty: number;
  unit_price: number | null;
  vendor_id: string | null;
}

export interface ReorderResult {
  po_created: { po_id: string; po_number: string; lines: number }[];
  pr_created: { pr_id: string; pr_number: string; lines: number }[];
  skipped:    { inventory_item_id: string; reason: string }[];
  idempotent: { inventory_item_id: string; reason: string }[];
}

export const purchaseService = {
  /** (a)+(b): batch generate POs (missing) + PRs (low) for a set of lines. */
  async generateRestockOrders(
    lines: ReorderLine[], outletId: string,
  ): Promise<ReorderResult> {
    return apiClient.post<ReorderResult>("/api/v1/menu/ai-recipe-reorder",
      { lines, outlet_id: outletId });
  },
  /** (c): manual single-line "Reorder" — same endpoint, one line. */
  async reorderLine(line: ReorderLine, outletId: string): Promise<ReorderResult> {
    return apiClient.post<ReorderResult>("/api/v1/menu/ai-recipe-reorder",
      { lines: [line], outlet_id: outletId });
  },
};
```

### 6.2 `menuService.ts` (add 2 methods + types)

```ts
// Types mirror §2.1/§2.2
export interface AiRecipeSearchPayload {
  query: string; image_b64?: string; image_mime?: string;
  portions: number; limit: number;
}
export interface AiRecipeResult {
  name: string; ingredients: { name: string; qty_per_portion: number;
    unit: string; wastage_pct: number; is_optional: boolean; note?: string }[];
  source: string; confidence: number; item_type: string;
  base_price: number | null; instructions: string | null;
}
export interface AiReconcileLine {
  inventory_item_id: string | null; name: string; unit: string;
  qty_per_portion: number; wastage_pct: number; required_for_n: number;
  available_stock: number; reorder_level: number;
  standard_cost: number | null; line_cost: number | null;
  status: "in_stock" | "low" | "missing"; shortfall: number;
  suggested_vendor_id: string | null; suggested_po_qty: number;
}
export interface AiReconcileResult {
  name: string; portions: number; lines: AiReconcileLine[];
  total_cost: number | null; cost_known: boolean;
  low_count: number; missing_count: number;
}

export const menuService = {
  ...
  async aiRecipeSearch(p: AiRecipeSearchPayload):
    Promise<{ recipes: AiRecipeResult[]; sources: string[]; provider: string | null;
              from_cache: boolean }> {
    return apiClient.post("/api/v1/menu/ai-recipe-search", p);
  },
  async aiRecipeReconcile(
    p: { recipe?: AiRecipeResult; catalog_code?: string; portions: number },
  ): Promise<AiReconcileResult> {
    return apiClient.post("/api/v1/menu/ai-recipe-reconcile", p);
  },
};
```

### 6.3 `recipes.tsx` — components to add / modify

Add (do NOT replace the existing catalog search; the AI search is additive):

1. **`AiSearchBox`** — a second input row under the existing catalog search:
   - text input (placeholder "AI search: a dish, or snap a photo…")
   - an **image upload/capture button** (`<input type="file" accept="image/*">`)
     that reads the file via `URL.createObjectURL` / `FileReader.readAsDataURL`
     and stores `image_b64` + `image_mime` in state. Gated: only send the image
     when present; the backend ignores it when `ai_multimodal_enabled` is off.
   - a **portions** selector (reuse the existing `portions` state, lines 86/326).
   - on submit (debounced 400ms, or on image attach + "Identify"), call
     `menuService.aiRecipeSearch(...)` → `setAiResults(...)`.
   - show `sources` + `provider` + `from_cache` as a small status line under
     the results (e.g. "from gemini, 2 sources, cached").
2. **`AiResultCard`** — renders each `AiRecipeResult`: name, source badge
   (LLM / Zomato / Swiggy / Catalog), confidence, ingredient count, base price.
   Clicking it calls `menuService.aiRecipeReconcile({ recipe, portions })`
   → `setReconciled(...)`. (For catalog-sourced recipes, pass
   `catalog_code` instead to reuse the code fast-path, §4.1.)
3. **`ReconcileTable`** — the "minute-detail" table (requirement #5): one row
   per `AiReconcileLine` with columns `name`, `unit`, `per portion`,
   `required (N portions)`, `in stock`, `cost`, **`status` badge**
   (`in_stock`→success, `low`→warning, `missing`→critical), `shortfall`.
   Reuse the existing `StatusBadge` (`recipes.tsx:18`, used at line 451).
   This is the per-ingredient "in stock / low / missing" the user asked for.
4. **Per-line "Reorder" button** (behavior c) — on each `low`/`missing` row,
   a small button calling `purchaseService.reorderLine(line, activeOutletId)`;
   toast on success with the created `pr_number` / `po_number`.
5. **Batch "Generate PO / Reorder" button** (behaviors a+b) — one button above
   the table: "Generate restock orders for N missing + M low". On click, map
   every `low`/`missing` line to a `ReorderLine` (using `suggested_vendor_id`,
   `suggested_po_qty`, `unit_price`) and call
   `purchaseService.generateRestockOrders(...)`; render the returned
   `po_created` / `pr_created` / `skipped` / `idempotent` lists in a result
   panel.

State additions to the component:
`aiQuery, aiImage (b64+mime), aiResults, aiSelected, reconciled, reorderResult`.
All new UI sits **below** the existing catalog panel; the existing catalog
search + breakdown flow is untouched, so a checkout with no keys still works
(§8.1).

**No react-query** is introduced — consistent with the page's current
`useState`/`useMemo` style (`recipes.tsx:1`), keeping the diff minimal.

---

## 7. Settings / env additions

Add to `Settings` in `backend/src/config/settings.py` (AI block is
`settings.py:93-102`; aggregators `131-137`):

```python
# After ai_max_tokens (line 102):
ai_multimodal_enabled: bool = Field(default=True, alias="AI_MULTIMODAL_ENABLED")
ai_recipe_cache_maxsize: int = Field(default=256, alias="AI_RECIPE_CACHE_MAXSIZE")
ai_recipe_cache_ttl_seconds: int = Field(default=300, alias="AI_RECIPE_CACHE_TTL_SECONDS")
ai_rate_capacity: int = Field(default=10, alias="AI_RATE_CAPACITY")
ai_rate_per_second: float = Field(default=2.0, alias="AI_RATE_PER_SECOND")
# Aggregator base URLs (Zomato has a known URL; Swiggy needs one)
swiggy_menu_base: str = Field(default="https://api.swiggy.com/api", alias="SWIGGY_MENU_BASE")
zomato_menu_base: str = Field(default="https://www.zomato.com/api/v5", alias="ZOMATO_MENU_BASE")
```

`.env.example` additions (after the AI block, `backend/.env.example:74-83`,
and after Aggregators `:107-113`):

```
# AI recipe search (multimodal + cache + rate limit)
AI_MULTIMODAL_ENABLED=true
AI_RECIPE_CACHE_MAXSIZE=256
AI_RECIPE_CACHE_TTL_SECONDS=300
AI_RATE_CAPACITY=10
AI_RATE_PER_SECOND=2
# Aggregator base URLs
ZOMATO_MENU_BASE=https://www.zomato.com/api/v5
SWIGGY_MENU_BASE=https://api.swiggy.com/api
```

No new LLM model settings are required — `ai_model_gemini` /
`ai_model_anthropic` / `ai_model_openai` already exist (`settings.py:99-101`)
and the multimodal + JSON paths use the *same* model names (Gemini and Claude
vision models are selected by these fields; if a user wants a vision-specific
model they set `AI_MODEL_GEMINI` / `AI_MODEL_ANTHROPIC` to it). This keeps the
config surface unchanged.

---

## 8. Risks / edge cases — mapped to code

### 8.1 Empty keys → must degrade to keyword search + local catalog

`ai_recipe_search()` (§1.3) builds its source list as
`[llm_source(), zomato_source(), swiggy_source(), catalog_source()]` and
**skips any adapter that returned `None`** from its factory (§3.2/§3.3). With
zero keys, only `catalog_source()` (and any enabled aggregator) contributes.
If the resulting `recipes` list is empty (no catalog match and no aggregator),
`POST /ai-recipe-search` **internally falls back to the existing
`search_recipes()` keyword path** (`menu/api.py:212-284`), wrapping its
`RecipeSearchResponse` results into `NormalizedRecipe` (source=`"catalog"`),
so the frontend never sees an empty box. This is the "graceful degrade"
guarantee: the page's *current* behavior is the floor.

### 8.2 LLM returns malformed JSON → validate + one repair retry

`_generate_recipe_llm` (§1.3) parses the model text with `_RecipeJson.model_validate_json(raw)`.
On `ValidationError`:
1. **Repair retry (once):** send a follow-up message to the *same* provider,
   `"Your last output was not valid JSON. The schema was: {...}. Return ONLY
   valid JSON."` and re-parse. (Cheap, same provider, no new LLM round-trip
   cost beyond the retry.)
2. If still invalid, treat the provider as failed and **fail over** to the next
   provider in the cascade (§1.4) — which re-parses from scratch.
3. If all providers fail, `_generate_recipe_llm` returns `(None, None)` and
   `ai_recipe_search()` relies on the other sources / the §8.1 fallback.

The `confidence` field (§1.2) is clamped to [0,1] by Pydantic
(`Field(ge=0, le=1)`); a model that returns `confidence: 0.9` is fine,
`confidence: "high"` is rejected → repair path.

### 8.3 External API rate limits (Zomato/Swiggy)

- Each aggregator adapter wraps its HTTP call in its own
  `TokenBucketRateLimiter` instance (capacity 5, rate 1/sec) so a busy page
  doesn't exhaust a shared key. The `TokenBucketRateLimiter.acquire()`
  **max-wait** raises on exhaustion; the adapter catches it and returns `[]`
  for that source (the other sources still populate the response) rather than
  blocking the whole request.
- Results are cached under the same `llm_cache` with a *longer* TTL
  (`aggregator_cache_ttl_seconds`, default 3600) — a menu doesn't change
  intraminute; this is what "caching so we don't hammer the external APIs"
  means concretely.
- A 429 from Zomato/Swiggy → log + skip that source for this request (no
  retry loop; the cache + bucket already suppress the next request).

### 8.4 PO idempotency (don't double-create)

Handled by the §5.3 guard: before creating a PO/PR, query for an open PR
(status `SUBMITTED`/`APPROVED`) or open PO (status `DRAFT`/`SENT`/`CONFIRMED`/
`PARTIAL`) whose lines include the item. Match → record in the response's
`idempotent` list and skip. This is the *same* query the existing
`_on_stock_low` runs (`purchase/api.py:149-155`), so the two paths cannot
create a duplicate of each other either: a `stock.low` event that arrives
after the reorder already made a PR finds the open PR and no-ops.

### 8.5 Cost of LLM calls

- **Cache first:** every `ai_recipe_search` call checks `llm_cache`
  (`_cache_key`, §1.3) before touching a provider. Identical query + image
  within the TTL is free.
- **Rate limit:** the per-provider `TokenBucketRateLimiter` caps sustained
  LLM requests to `ai_rate_per_second` (default 2).
- **Only the LLM path costs money.** Catalog and (when enabled) aggregator
  sources are free; the cache covers them too, just with a longer TTL.
- **`ai_enabled` master gate:** when `settings.ai_enabled` is False
  (`settings.py:94`, default False in `.env`), `llm_source()` returns `None`
  and *no* LLM call is ever made — the feature is fully LLM-free.
- **max tokens:** `ai_max_tokens` (`settings.py:102`, default 2048) bounds
  output; the recipe JSON is small, so the cost per miss is one bounded
  call.

### 8.6 Other edge cases to handle in the implement

- **Unresolvable ingredient** (name maps to no inventory item): line is
  `inventory_item_id=null`, `status="missing"`, `available_stock=0`. It still
  renders in the table and still counts toward `missing_count` — the chef
  sees it as "must source", which is the correct signal, not an error.
- **`portions=0`**: rejected by the schema (`portions: int = Field(ge=1)`).
- **Large recipe / many lines**: `cost-lookup` accepts a comma list of ids
  (`inventory/api.py:286`); cap the list at 200 ids per call and batch if a
  recipe is huge (rare).
- **Inventory service offline**: the reconcile helper (like
  `item_food_cost`, `api.py:651-671`) catches the HTTP error and returns
  `standard_cost=null` / `total_available=0` lines with `cost_known=false` —
  the table still shows names + required, just not stock. This matches the
  existing "silent zero is the wrong signal" rule (`api.py:639`).

---

## 9. Files: create vs. modify (checklist)

**Create**
- `backend/src/services/menu/ai_recipe_search.py` (module, §1)
- `frontend/src/services/purchaseService.ts` (§6.1)

**Modify**
- `backend/src/services/menu/api.py` — add 3 endpoints (`ai-recipe-search`,
  `ai-recipe-reconcile`, `ai-recipe-reorder`, §2) + `_reconcile_lines`
  helper (§4.3); import `ai_recipe_search` module.
- `backend/src/services/menu/schemas.py` — add
  `AiRecipeSearchRequest/Response`, `AiReconcileRequest/Response`,
  `ReorderLineIn`, `RestockResult` Pydantic models (§2).
- `backend/src/services/ai_service.py` — **extend** (do not replace) with a
  structured-JSON multimodal entry point (§1.4); leave `answer_question()`
  intact for the copilot.
- `backend/src/services/inventory/api.py` — one line: add
  `reorder_level` to `cost-lookup` (§4.2).
- `backend/src/services/purchase/api.py` — add
  `GET /vendor-items/recommend` + `pick_vendor` (§5.1); extend
  `POST /purchase-orders` / `POST /purchase-requests` with the idempotency
  guard from §5.3 (or run the guard inside the new menu endpoint, either way
  — recommend the menu endpoint so it owns its own dedupe).
- `backend/src/config/settings.py` + `backend/.env.example` (§7).
- `frontend/src/routes/recipes.tsx` (§6.3: `AiSearchBox`, `AiResultCard`,
  `ReconcileTable`, per-line + batch Reorder buttons).
- `frontend/src/services/menuService.ts` (§6.2: `aiRecipeSearch`,
  `aiRecipeReconcile` + types).

---

## 10. Requirement → code map (quick index)

| # | Requirement | Concrete code |
|---|---|---|
| 1 | Global realtime AI recipe search | `POST /menu/ai-recipe-search` (§2.1) + `ai_recipe_search` (§1.3) |
| 2 | Multimodal + failover | `ai_service.py` extended multimodal structured call, cascade (§1.4); image input in `AiSearchBox` (§6.3) |
| 3 | Reconcile ingredients vs. current inventory (in/low/missing @ N) | `POST /menu/ai-recipe-reconcile` (§2.2) + `_reconcile_lines` (§4.3); status truth table §2.2 |
| 4 | Auto-PO (missing) + auto-PR (low) + manual Reorder | `POST /menu/ai-recipe-reorder` (§2.3, §5.2); `Reorder` button (§6.3) |
| 5 | Break down recipe to minute detail | `ReconcileTable`, one row per ingredient with all fields (§6.3, §2.2 response shape) |
| 6 | Global data (LLM + Zomato/Swiggy) | `RecipeSource` adapters (§3) yielding `NormalizedRecipe` |
| 7 | Caching + rate limiting | `LLMResultCache` + `TokenBucketRateLimiter` (§1.6, §1.3) |
