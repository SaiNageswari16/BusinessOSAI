"""AI recipe search / reconcile / auto-reorder — the menu service's LLM-backed
global recipe page.

Three endpoint implementations, mounted on the menu router in ``api.py``:

* ``POST /ai-recipe-search``   — fan a free-text or image query out to the
  configured LLM cascade (Gemini first, Claude/Anthropic as the "if one fails
  the other catches up" failover, OpenAI last), plus the always-available
  static catalog (and Zomato/Swiggy when their keys are set). Every result is
  a normalized recipe; each ingredient is resolved to a live inventory item
  id in-process (code first, fuzzy name fallback) so the UI can show live
  stock without another round-trip.
* ``POST /ai-recipe-reconcile``— take a recipe (catalog code, menu-item name,
  or a full recipe object) + portions, fetch live stock / cost / reorder level
  from the inventory service, and classify every line in_stock / low /
  missing with the shortfall and a suggested order quantity.
* ``POST /ai-recipe-reorder``  — turn missing/low lines into purchase
  documents: a draft PO for missing lines, a purchase request for low lines,
  grouped by vendor, idempotent against items that already have an open PO
  or PR.

Graceful degrade, in every path:

* No LLM key at all  -> the search still returns catalog results, 200, with
  a ``note`` saying so. Never a 500.
* Inventory service down  -> reconcile lines report "unknown" stock/cost
  (available=0, cost=None, status=missing when unresolved) instead of
  crashing the request.
* Purchase service down  -> reorder reports each line skipped with a reason;
  nothing is half-created.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import time
import uuid
from collections import OrderedDict
from typing import Protocol

import httpx
from fastapi import HTTPException, status

from src.config.settings import get_settings
from src.services import ai_service
from src.services.menu.catalog import CATALOG, CatalogRecipe, catalog_by_code
from src.services.menu.schemas import (
    AiReconcileLine,
    AiReconcileRequest,
    AiReconcileResponse,
    AiRecipeIngredient,
    AiRecipeResult,
    AiRecipeSearchIngredient,
    AiRecipeSearchRequest,
    AiRecipeSearchResponse,
    AiReorderCreated,
    AiReorderCreatedLine,
    AiReorderLineIn,
    AiReorderRequest,
    AiReorderResponse,
    AiReorderSkipped,
)

logger = logging.getLogger(__name__)


# ─── Cross-service plumbing ──────────────────────────────────────────────────


def _identity_headers(identity) -> dict[str, str]:
    """Forwarded-identity headers for a trusted service-to-service call.

    The menu service calls inventory/purchase internally on a request's own
    identity, so it sets the same headers the gateway would set: tenant,
    user, permissions, owner. The receiving service trusts them by the same
    convention every other cross-service call in this codebase uses.
    """
    return {
        "X-Identity-Tenant-Id": str(identity.tenant_id),
        "X-Identity-User-Id": str(identity.user_id),
        "X-Identity-Email": identity.email,
        "X-Identity-Permissions": ",".join(sorted(identity.permissions)),
        "X-Identity-Is-Owner": "true" if identity.is_tenant_owner else "false",
        "X-Identity-Active-Outlet": (
            str(identity.active_outlet_id) if identity.active_outlet_id else ""
        ),
        "X-Identity-Allowed-Outlets": ",".join(
            str(o) for o in sorted(identity.allowed_outlet_ids, key=str)
        ),
    }


async def _inventory_items(client, identity) -> list[dict]:
    """The tenant's inventory items, via the menu->inventory pattern
    (registry base_url + X-Identity headers). One call; the caller builds
    code/name indexes over the result in-process. Degrades to [] on outage."""
    from src.services.shared.registry import base_url, get_descriptor

    desc = get_descriptor("inventory")
    if desc is None:
        return []
    try:
        resp = await client.get(
            f"{base_url(desc)}/api/v1/inventory/items",
            headers=_identity_headers(identity),
        )
        if resp.status_code == 200:
            return resp.json() or []
    except Exception as exc:  # noqa: BLE001 — an inventory outage must not 500 search
        logger.warning("Inventory item fetch failed: %s", exc)
    return []


async def _inventory_cost_lookup(client, identity, item_ids: list[uuid.UUID]) -> dict[str, dict]:
    """Live stock + cost + reorder level for ids, via cost-lookup.

    Returns ``str(id) -> {standard_cost, total_available, reorder_level}``.
    Unknown or outage-masked ids are simply absent — the caller treats an
    absent entry as "unknown stock/cost", not zero.
    """
    from src.services.shared.registry import base_url, get_descriptor

    desc = get_descriptor("inventory")
    if desc is None or not item_ids:
        return {}
    out: dict[str, dict] = {}
    try:
        resp = await client.get(
            f"{base_url(desc)}/api/v1/inventory/items/cost-lookup",
            params={"ids": ",".join(str(i) for i in item_ids)},
            headers=_identity_headers(identity),
        )
        if resp.status_code == 200:
            for it in resp.json().get("items", []):
                if it.get("found"):
                    out[str(it["id"])] = it
    except Exception as exc:  # noqa: BLE001
        logger.warning("Inventory cost-lookup failed: %s", exc)
    return out


def _item_indexes(items: list[dict]) -> tuple[dict[str, uuid.UUID], list[tuple[str, uuid.UUID]]]:
    """Build (code -> id) and [(lowercase name, id)] indexes over the live
    inventory item list. Used to resolve ingredient codes/names to real ids
    in-process — one HTTP fetch, no repeated lookups."""
    code_index: dict[str, uuid.UUID] = {}
    name_index: list[tuple[str, uuid.UUID]] = []
    for it in items:
        iid = uuid.UUID(it["id"])
        code_index[(it.get("code") or "").lower()] = iid
        name_index.append(((it.get("name") or "").lower(), iid))
    return code_index, name_index


def _resolve_from_index(
    ing: AiRecipeIngredient,
    overrides: dict[str, uuid.UUID] | None,
    code_index: dict[str, uuid.UUID],
    name_index: list[tuple[str, uuid.UUID]],
) -> uuid.UUID | None:
    """Resolve one ingredient to a live inventory item UUID.

    Resolution order:
      1. explicit client override (``overrides`` by name or code),
      2. the ingredient's ``inventory_code`` matched against the live item
         list's ``code`` field,
      3. fuzzy name: exact, then substring, against the live item list.
    Unknown ingredients come back ``None`` — they show as
    ``inventory_item_id: null`` and reconcile as ``missing``.
    """
    target: uuid.UUID | None = None
    if overrides:
        for key, val in overrides.items():
            if key and (
                key.lower() == ing.name.lower()
                or (ing.inventory_code or "").lower() == key.lower()
            ):
                target = val
                break
    if target is None and ing.inventory_code:
        target = code_index.get(ing.inventory_code.lower())
    if target is None:
        needle = ing.name.lower().strip()
        if needle:
            exact = next((iid for nm, iid in name_index if nm == needle), None)
            if exact is not None:
                target = exact
            else:
                # Shortest-matching name wins so "paneer" matches "paneer"
                # before "paneer (small cubes)".
                candidates = sorted(
                    ((len(nm), iid) for nm, iid in name_index
                     if needle in nm or nm in needle),
                )
                if candidates:
                    target = candidates[0][1]
    return target


# ─── Catalog keyword matches ──────────────────────────────────────────────────


def _catalog_matches(query: str, limit: int) -> list[AiRecipeResult]:
    """Lexical score over the static catalog — the no-key fallback floor.

    Same spirit as the existing ``GET /items/search`` scoring (name hits
    weigh most, description/tags next, shared-ingredient hits least).
    Always available, so recipe search works with zero LLM keys.
    """
    terms = [t for t in query.lower().replace(",", " ").split() if t]
    scored: list[tuple[float, int]] = []
    for idx, spec in enumerate(CATALOG):
        score, _reasons = _catalog_score(spec, terms)
        if terms and score <= 0:
            continue
        scored.append((score, idx))

    scored.sort(key=lambda t: (-t[0], t[1]))
    out: list[AiRecipeResult] = []
    for _s, idx in scored[:limit]:
        out.append(_catalog_to_result(CATALOG[idx]))
    return out


def _catalog_to_result(spec: CatalogRecipe) -> AiRecipeResult:
    """One static catalog spec -> a normalized recipe result.

    The catalog lines already carry the stable inventory codes, so they
    resolve faster (and more reliably) than LLM ingredient names at
    reconcile time — that is why catalog lines keep their code while LLM
    lines do not.
    """
    return AiRecipeResult(
        recipe_id=spec.code,
        name=spec.name,
        description=spec.description or None,
        item_type=spec.item_type,  # type: ignore[arg-type]
        base_price=spec.base_price,
        yield_qty=spec.yield_qty,
        instructions=spec.instructions or None,
        confidence=1.0,
        source="catalog",
        ingredients=[
            AiRecipeIngredient(
                name=ln.name or ln.inventory_code,
                inventory_code=ln.inventory_code,
                inventory_item_id=None,
                qty_per_portion=ln.qty,
                unit=ln.unit,
                wastage_pct=ln.wastage_pct,
                is_optional=ln.is_optional,
                note=ln.note,
            )
            for ln in spec.lines
        ],
    )


# ─── Aggregator sources (Zomato / Swiggy) — key-gated, safe no-ops ──────────


class RecipeSource(Protocol):
    """A global recipe source. Implementations plug into the fan-out the same
    way: ``search(query, image, limit) -> list[AiRecipeResult]``. Sources that
    are unconfigured (missing key) simply return [] — they never raise, so an
    aggregator outage can never break a recipe search."""

    name: str

    async def search(
        self,
        query: str | None,
        image_b64: str | None,
        image_mime: str | None,
        limit: int,
    ) -> list[AiRecipeResult]: ...


def zomato_source() -> RecipeSource | None:
    """Zomato's restaurant/dish search — gated on ZOMATO_ENABLED +
    ZOMATO_API_KEY. With either missing this returns None so the fan-out skips
    it entirely; nothing is invented or hard-coded when the key is empty."""
    s = get_settings()
    if not s.zomato_enabled or not s.zomato_api_key:
        return None

    class _ZomatoSource:
        name = "zomato"

        async def search(self, query, image_b64, image_mime, limit):
            out: list[AiRecipeResult] = []
            if not (query or "").strip():
                return out
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(
                        f"{s.zomato_menu_base}/restaurants",
                        params={"query": query, "count": limit or 5},
                        headers={"user-key": s.zomato_api_key},
                    )
                    if resp.status_code != 200:
                        return out
                    for rest in (resp.json().get("restaurants") or [])[: (limit or 5)]:
                        out.append(AiRecipeResult(
                            recipe_id=str(rest.get("id", "")),
                            name=rest.get("name", "Unknown dish"),
                            description=" | ".join(rest.get("cuisines", [])) or None,
                            source="zomato",
                            confidence=0.5,
                        ))
            except Exception:  # noqa: BLE001 — an aggregator outage must not break search
                logger.warning("Zomato source failed; returning empty", exc_info=True)
                return []
            return out

    return _ZomatoSource()


def swiggy_source() -> RecipeSource | None:
    """Swiggy menu search — gated on SWIGGY_ENABLED + SWIGGY_API_KEY. Same
    safe-no-op contract as Zomato: unconfigured or unreachable means []."""
    s = get_settings()
    if not s.swiggy_enabled or not s.swiggy_api_key:
        return None

    class _SwiggySource:
        name = "swiggy"

        async def search(self, query, image_b64, image_mime, limit):
            out: list[AiRecipeResult] = []
            if not (query or "").strip():
                return out
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        f"{s.swiggy_menu_base}/v1/menu/list",
                        json={"query": query},
                        headers={"X-Auth-Token": s.swiggy_api_key},
                    )
                    if resp.status_code != 200:
                        return out
                    for item in (resp.json().get("items") or [])[: (limit or 5)]:
                        out.append(AiRecipeResult(
                            recipe_id=str(item.get("id", "")),
                            name=item.get("name", "Unknown item"),
                            description=item.get("description"),
                            source="swiggy",
                            confidence=0.4,
                        ))
            except Exception:  # noqa: BLE001
                logger.warning("Swiggy source failed; returning empty", exc_info=True)
                return []
            return out

    return _SwiggySource()


def _catalog_score(spec, terms: list[str]) -> tuple[float, list[str]]:
    """Local lexical scoring for a static catalog spec (no DB access)."""
    if not terms:
        return 1.0, ["Full catalog"]

    inv_names = [(ln.name or ln.inventory_code).lower() for ln in spec.lines]
    blob = " ".join([
        spec.name.lower(),
        (spec.description or "").lower(),
        (spec.instructions or "").lower(),
        " ".join(spec.tags).lower(),
    ])

    score = 0.0
    for term in terms:
        hit = False
        if term in spec.name.lower():
            score += 4.0
            hit = True
        if term in blob:
            score += 2.0
            hit = True
        for iname in inv_names:
            if iname and term in iname:
                score += 1.0
                hit = True
                break
        if not hit and any(term in n or n in term for n in inv_names if n):
            score += 0.5
    return score, []


# ─── LLM recipe (Gemini -> Claude failover, multimodal) ──────────────────────

_LLM_RECIPE_SYSTEM = (
    "You are a professional chef and recipe database. Given a dish query "
    "(and optionally a photo of the dish), return the recipe as STRICT JSON "
    "— no prose, no markdown fences, no commentary. Schema: "
    '{"name": str, "description": str|null, '
    '"item_type": "veg"|"non_veg"|"beverage", '
    '"base_price": number|null (typical restaurant selling price in INR), '
    '"yield_qty": number (portions one batch makes, default 1), '
    '"ingredients": [{"name": str, "qty_per_portion": number, "unit": str '
    '("g"|"ml"|"kg"|"piece"|"tsp"|"tbsp"|"cup"|"ltr"|...), '
    '"wastage_pct": number (expected trim loss %, 0-100, default 0)}]}. '
    "qty_per_portion is the quantity for ONE portion, in the named unit. "
    "Use common kitchen ingredient names (e.g. 'chicken', 'basmati rice', "
    "'cream', 'garam masala', 'butter'). 6-12 ingredients."
)


def _parse_llm_recipe(text: str) -> AiRecipeResult | None:
    """Parse the model's JSON back into a result. Returns None on any
    malformation — the caller treats that as a failed provider."""
    import json
    import re as _re

    cleaned = _re.sub(r"```(?:json)?\s*|\s*```", "", text.strip())
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(cleaned[start:end + 1])
    except (ValueError, TypeError):
        return None
    if not isinstance(data, dict) or not data.get("name"):
        return None

    ingredients: list[AiRecipeIngredient] = []
    for raw in data.get("ingredients") or []:
        if not isinstance(raw, dict) or not raw.get("name"):
            continue
        try:
            qty = float(raw.get("qty_per_portion") or 0)
            wastage = float(raw.get("wastage_pct") or 0)
        except (TypeError, ValueError):
            qty, wastage = 0.0, 0.0
        if qty <= 0:
            continue
        ingredients.append(AiRecipeSearchIngredient(
            name=str(raw["name"]),
            inventory_code=None,
            inventory_item_id=None,
            qty_per_portion=qty,
            unit=str(raw.get("unit") or ""),
            wastage_pct=max(0.0, min(100.0, wastage)),
        ))
    if not ingredients:
        return None

    item_type = data.get("item_type")
    if item_type not in ("veg", "non_veg", "beverage"):
        item_type = "non_veg"
    base_price = data.get("base_price")
    try:
        base_price = float(base_price) if base_price is not None else None
    except (TypeError, ValueError):
        base_price = None
    yield_qty = data.get("yield_qty")
    try:
        yield_qty = float(yield_qty) if yield_qty else 1.0
    except (TypeError, ValueError):
        yield_qty = 1.0

    return AiRecipeResult(
        recipe_id=f"llm:{uuid.uuid4().hex[:12]}",
        name=str(data["name"]),
        description=data.get("description"),
        item_type=item_type,  # type: ignore[arg-type]
        base_price=base_price,
        yield_qty=yield_qty,
        confidence=0.8,
        source="llm",
        ingredients=ingredients,
    )


def _no_keys_message(s) -> str | None:
    """Clear 'why the LLM path is off' string, or None when a key IS set."""
    if s.gemini_api_key or s.anthropic_api_key or s.openai_api_key:
        return None
    return (
        "No LLM API keys configured (GEMINI_API_KEY / ANTHROPIC_API_KEY / "
        "OPENAI_API_KEY are all empty) — LLM results unavailable, returning "
        "catalog keyword matches only."
    )


# The LLM providers map to the settings' key fields, so 'claude' (the
# human-facing name the request's ``provider`` field accepts) resolves to the
# Anthropic key.
_PROVIDER_KEY: dict[str, str] = {
    "gemini": "gemini_api_key",
    "claude": "anthropic_api_key",
    "openai": "openai_api_key",
}


def _provider_pref(provider: str | None) -> str | None:
    """Request's 'auto'/'gemini'/'claude'/'openai' -> cascade key or None.

    'claude' is the human-facing name; internally the cascade key is
    'anthropic'.
    """
    if not provider or provider == "auto":
        return None
    key = provider if provider in ("gemini", "openai", "anthropic") else _PROVIDER_KEY.get(provider)
    return key if key in ("gemini", "openai", "anthropic") else None


async def _llm_recipe(
    query: str | None,
    image_b64: str | None,
    image_mime: str | None,
    portions: int,
    provider: str,
    identity,
) -> tuple[AiRecipeResult | None, str | None, str | None, bool]:
    """One LLM recipe generation with Gemini->Claude->OpenAI failover.

    Returns ``(recipe_or_None, provider_key, note, from_cache)`` where
    ``provider_key`` is the raw cascade name ('gemini' / 'anthropic' /
    'openai' / None) — the endpoint maps it to the response's human-facing
    provider name. ``note`` explains a degraded LLM path (no key, provider
    outage, rate limit); None when the LLM call succeeded.
    """
    s = get_settings()
    wanted = _provider_pref(provider)

    query_norm = (query or "").strip()
    has_material = bool(query_norm) or bool(image_b64)
    if not has_material:
        return None, None, "Provide a query and/or an image to search for.", False

    # Cache is keyed by (query, image, portions, provider) — a repeat
    # request is free and must NOT burn a rate-limit token.
    cache_key = _cache_key(query_norm, portions, image_b64)
    hit = _llm_cache_get((cache_key, wanted))
    if hit is not None:
        return hit[0], hit[1], None, True

    # Rate limit the LLM hop only — catalog matches are free.
    per_min = max(1, int(getattr(s, "ai_recipe_rate_limit_per_min", 5)))
    try:
        await _get_limiter(per_min).acquire(identity.tenant_id, max_wait=2.0)
    except TimeoutError:
        return None, None, (
            f"Rate limit exceeded: at most {per_min} LLM recipe-search requests "
            "per minute per tenant. Catalog results below were still returned; "
            "wait a moment and retry."
        ), False

    # A forced provider that has no key configured: say so plainly rather
    # than letting the cascade silently hand off to another engine.
    if wanted is not None:
        key_attr = _PROVIDER_KEY.get(wanted, wanted)
        if not getattr(s, key_attr, None):
            return None, None, (
                f"No API key configured for provider '{wanted}' — showing "
                "catalog keyword matches only."
            ), False
    elif not s.ai_enabled:
        no_keys = _no_keys_message(s)
        if no_keys:
            return None, None, no_keys, False

    user = (
        f"Recipe for: {query_norm or '(see attached photo)'}. "
        f"Portions requested: {portions}. "
        + ("A photo of the dish is attached — identify it from the image "
           "when the text is ambiguous. " if image_b64 else "")
        + "Return ONLY the JSON recipe."
    )

    raw, prov = await ai_service.generate_structured(
        _LLM_RECIPE_SYSTEM,
        user,
        image_b64=image_b64,
        image_mime=image_mime or ("image/jpeg" if image_b64 else None),
        schema=ai_service._recipe_json_schema_hint(),
        provider_pref=wanted,
    )
    note: str | None = None
    recipe: AiRecipeResult | None = None
    if raw:
        recipe = _parse_llm_recipe(raw)
        if recipe is None:
            note = ("The LLM returned malformed JSON; showing catalog keyword "
                    "matches instead.")
    if recipe is None and note is None:
        note = _no_keys_message(s) or ("All configured LLM providers failed "
                                       "or were unavailable; showing catalog "
                                       "keyword matches instead.")

    if recipe is not None:
        _llm_cache_set((cache_key, prov), recipe, prov)
    return recipe, prov, note, False


# ─── Rate limiting + caching (in-memory, per-process) ────────────────────────


class _TokenBucket:
    """Per-tenant token bucket — ~5 recipe-search requests/minute.

    ``acquire`` waits up to ``max_wait`` seconds for a token; on timeout it
    raises so the caller can return 429 instead of blocking a page load.
    """

    def __init__(self, capacity: int, refill_per_sec: float) -> None:
        self._capacity = capacity
        self._rate = refill_per_sec
        self._tokens: dict[uuid.UUID, float] = {}
        self._last: dict[uuid.UUID, float] = {}
        self._lock = asyncio.Lock()

    async def acquire(self, tenant: uuid.UUID, max_wait: float = 2.0) -> None:
        deadline = time.monotonic() + max_wait
        while True:
            async with self._lock:
                now = time.monotonic()
                last = self._last.get(tenant, now)
                self._tokens[tenant] = min(
                    self._capacity,
                    self._tokens.get(tenant, self._capacity) + (now - last) * self._rate,
                )
                self._last[tenant] = now
                if self._tokens[tenant] >= 1.0:
                    self._tokens[tenant] -= 1.0
                    return
            if time.monotonic() >= deadline:
                raise TimeoutError(f"rate limited for tenant {tenant}")
            await asyncio.sleep(0.05)


_limiter: _TokenBucket | None = None


def _get_limiter(per_minute: int) -> _TokenBucket:
    """Lazy per-process token bucket, sized from the per-minute limit."""
    global _limiter
    if _limiter is None:
        _limiter = _TokenBucket(capacity=max(1, per_minute),
                                refill_per_sec=max(1, per_minute) / 60.0)
    return _limiter


# Cache key: (normalized query | image hash | portions, provider_key) -> recipe.
# The provider is part of the key so a cached Gemini result is not served when
# the caller explicitly forced 'claude' — they asked for a different engine.
_llm_cache: "OrderedDict[tuple[str, str | None], tuple[float, AiRecipeResult, str | None]]" = OrderedDict()


def _cache_key(query: str, portions: int, image_b64: str | None) -> str:
    norm = " ".join(query.lower().split())
    img = hashlib.sha1(image_b64.encode("utf-8", "ignore")).hexdigest()[:12] if image_b64 else ""
    return f"{norm}|{portions}|{img}"


def _llm_cache_get(
    key: tuple[str, str | None],
) -> tuple[AiRecipeResult, str | None] | None:
    s = get_settings()
    entry = _llm_cache.get(key)
    if entry is None:
        return None
    ts, recipe, prov = entry
    if time.monotonic() - ts > s.ai_recipe_cache_ttl_seconds:
        _llm_cache.pop(key, None)
        return None
    _llm_cache.move_to_end(key)
    return recipe, prov


def _llm_cache_set(
    key: tuple[str, str | None], recipe: AiRecipeResult, prov: str | None,
) -> None:
    s = get_settings()
    _llm_cache[key] = (time.monotonic(), recipe, prov)
    _llm_cache.move_to_end(key)
    while len(_llm_cache) > s.ai_recipe_cache_maxsize:
        _llm_cache.popitem(last=False)


# ─── Vendoring / PO creation helpers (for /ai/recipe-reorder) ────────────────


async def _fetch_vendor_rows(
    client, identity, item_ids: list[uuid.UUID]
) -> dict[uuid.UUID, dict[str, object]]:
    """Per-item: {inventory_item_id -> {vendor_id, last_purchase_price}}.

    One call to the purchase service's active vendor items; the item with the
    most recent (highest-seen) purchase price wins, so 'first active vendor
    carrying that item' follows naturally. Degrades to {} on outage.
    """
    from src.services.shared.registry import base_url, get_descriptor

    desc = get_descriptor("purchase")
    if desc is None or not item_ids:
        return {}
    out: dict[uuid.UUID, dict[str, object]] = {}
    try:
        resp = await client.get(
            f"{base_url(desc)}/api/v1/purchase/vendor-items",
            params={"inventory_item_ids": ",".join(str(i) for i in item_ids)},
            headers=_identity_headers(identity),
        )
        if resp.status_code == 200:
            for row in resp.json() or []:
                iid = row.get("inventory_item_id")
                if not iid:
                    continue
                try:
                    key = uuid.UUID(iid)
                except (ValueError, TypeError):
                    continue
                entry = out.setdefault(key, {"vendor_id": None,
                                             "last_purchase_price": 0.0,
                                             "suggested_qty": 0.0})
                prev_price = float(entry["last_purchase_price"] or 0.0)
                new_price = float(row.get("last_purchase_price") or 0.0)
                if new_price >= prev_price:
                    entry["vendor_id"] = row.get("vendor_id")
                    entry["last_purchase_price"] = new_price
                    entry["suggested_qty"] = float(row.get("suggested_qty") or 0.0)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Vendor-item lookup failed: %s", exc)
    return out


async def _first_active_vendor(client, identity) -> uuid.UUID | None:
    """The tenant's default vendor: first active Vendor row."""
    from src.services.shared.registry import base_url, get_descriptor

    desc = get_descriptor("purchase")
    if desc is None:
        return None
    try:
        # The vendors list endpoint takes ``active_only`` (default true); the
        # explicit is_active flag is there too, but the safe form is
        # active_only so we never fetch the very default-vendors list we
        # mean to skip.
        resp = await client.get(
            f"{base_url(desc)}/api/v1/purchase/vendors",
            params={"active_only": "true", "limit": 1},
            headers=_identity_headers(identity),
        )
        if resp.status_code == 200:
            rows = resp.json() or []
            if rows:
                return uuid.UUID(rows[0]["id"])
    except Exception as exc:  # noqa: BLE001
        logger.warning("Vendor list fetch failed: %s", exc)
    return None


async def _open_po_pr_items(
    client, identity, item_ids: list[uuid.UUID]
) -> set[uuid.UUID]:
    """Inventory item ids that already have an open PO or PR — the
    idempotency gate. A duplicate draft PO/PR for the same ingredient is
    the most common mistake this endpoint exists to prevent."""
    from src.services.shared.registry import base_url, get_descriptor

    desc = get_descriptor("purchase")
    if desc is None or not item_ids:
        return set()
    want = set(item_ids)
    out: set[uuid.UUID] = set()

    # Which document states count as "open" — i.e. still going to become
    # real purchase activity, so re-ordering the same item would duplicate
    # it. A terminal document (received/cancelled/rejected/converted) leaves
    # room for a fresh order of the same ingredient.
    open_states = {
        "/purchase-orders": {"draft", "sent", "confirmed", "partial"},
        "/purchase-requests": {"submitted", "approved"},
    }
    for path, states in open_states.items():
        try:
            resp = await client.get(
                f"{base_url(desc)}/api/v1/purchase{path}",
                params={"limit": 500},
                headers=_identity_headers(identity),
            )
            if resp.status_code != 200:
                continue
            for row in resp.json() or []:
                if row.get("status") not in states:
                    continue
                for line in row.get("lines") or []:
                    iid = line.get("inventory_item_id")
                    if not iid:
                        continue
                    try:
                        parsed = uuid.UUID(str(iid))
                    except (ValueError, TypeError):
                        continue
                    if parsed in want:
                        out.add(parsed)
        except Exception as exc:  # noqa: BLE001 — an outage degrades to "no skips"
            logger.warning("Open PO/PR fetch failed for %s: %s", path, exc)
    return out


async def _create_purchase_request(
    client,
    identity,
    outlet_id: uuid.UUID,
    lines: list[dict],
) -> dict[str, object] | None:
    """POST one purchase request (the 'low stock' artifact) to the purchase
    service. ``lines`` is a list of dicts
    ``{inventory_item_id, qty, notes}``. Returns the created PR dict or None
    on any failure — a low-stock PR is a suggestion, so a failure just means
    'nothing created', not an error.
    """
    from src.services.shared.registry import base_url, get_descriptor

    desc = get_descriptor("purchase")
    if desc is None or not lines:
        return None
    try:
        payload = {
            "outlet_id": str(outlet_id),
            "lines": [
                {
                    "inventory_item_id": str(l["inventory_item_id"]),
                    "qty": l["qty"],
                    "notes": l.get("notes"),
                }
                for l in lines
            ],
            "notes": "Auto-request: AI recipe reorder — low stock ingredients",
        }
        resp = await client.post(
            f"{base_url(desc)}/api/v1/purchase/purchase-requests",
            json=payload,
            headers=_identity_headers(identity),
        )
        if resp.status_code in (200, 201):
            return resp.json()
        logger.warning(
            "Purchase-request create failed: %s %s",
            resp.status_code, resp.text[:200],
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Purchase-request create error: %s", exc)
    return None


async def _create_purchase_order(
    client,
    identity,
    outlet_id: uuid.UUID | None,
    vendor_id: uuid.UUID,
    lines: list[dict],
) -> dict[str, object] | None:
    """POST one draft PO to the purchase service via the registry base_url +
    X-Identity headers. ``lines`` is a list of dicts
    ``{inventory_item_id, ordered_qty, unit_price, notes}``. Returns the
    created PO response dict or None on any failure."""
    from src.services.shared.registry import base_url, get_descriptor

    desc = get_descriptor("purchase")
    if desc is None:
        return None
    try:
        payload = {
            "outlet_id": str(outlet_id) if outlet_id else None,
            "vendor_id": str(vendor_id),
            "lines": [
                {
                    "inventory_item_id": str(l["inventory_item_id"]),
                    "ordered_qty": l["ordered_qty"],
                    "unit_price": l.get("unit_price", 0.0),
                    "notes": l.get("notes"),
                }
                for l in lines
            ],
            "notes": "Auto-draft: AI recipe reorder — missing/low stock ingredients",
        }
        resp = await client.post(
            f"{base_url(desc)}/api/v1/purchase/purchase-orders",
            json=payload,
            headers=_identity_headers(identity),
        )
        if resp.status_code in (200, 201):
            return resp.json()
        logger.warning(
            "Purchase-order create failed: %s %s",
            resp.status_code, resp.text[:200],
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Purchase-order create error: %s", exc)
    return None


# ─── Endpoints (mounted onto the menu router in api.py, tag "ai") ──────────


def _human_provider(provider_key: str | None) -> str:
    """Cascade key -> the human name the response contract exposes:
    'anthropic' is shown as 'claude'; anything else passes through, and a
    missing provider is 'none'."""
    if provider_key is None:
        return "none"
    return "claude" if provider_key == "anthropic" else provider_key


async def ai_recipe_search_endpoint(
    payload: AiRecipeSearchRequest, identity, db
) -> AiRecipeSearchResponse:
    """POST /ai/recipe-search — global realtime AI recipe search.

    Fans out to every available source in parallel:
      * LLM — the configured cascade (Gemini first, Claude/Anthropic as the
        "if one fails the other catches up" failover, OpenAI last),
        multimodal when ``image_b64`` is present.
      * Zomato / Swiggy — only when their enable flag + key are set
        (default: off, safe no-op that returns []).
      * the static catalog — always; the no-key floor.
    Results are merged, deduped by name, and every ingredient is resolved to
    a live inventory item id so the UI can show stock without a second call.
    Always 200: when the LLM path degrades, ``note`` says why and the
    catalog results still come back.
    """
    identity.require("view:recipes")

    # Free sources, run in parallel so a slow aggregator never delays the
    # catalog floor.
    catalog_results = _catalog_matches(payload.query or "", payload.limit)

    async def _run_source(src: RecipeSource | None) -> list[AiRecipeResult]:
        if src is None:
            return []
        try:
            return await src.search(payload.query, payload.image_b64,
                                   payload.image_mime, payload.limit)
        except Exception:  # noqa: BLE001 — one source failing must not sink the rest
            return []

    # LLM — Gemini first, Claude failover, multimodal when an image is attached.
    llm_result: AiRecipeResult | None = None
    provider_key: str | None = None
    note: str | None = None
    from_cache = False
    try:
        llm_result, provider_key, note, from_cache = await _llm_recipe(
            payload.query,
            payload.image_b64,
            payload.image_mime,
            payload.portions,
            payload.provider,
            identity,
        )
    except TimeoutError:
        note = ("Rate limit exceeded for the LLM recipe path — catalog results "
                "are returned; retry in a moment.")

    # Merge: LLM on top when present, then aggregators, then catalog.
    merged: list[AiRecipeResult] = []
    if llm_result is not None:
        merged.append(llm_result)

    zomato_hits: list[AiRecipeResult] = []
    swiggy_hits: list[AiRecipeResult] = []
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0)) as client:
        zomato_hits, swiggy_hits = await asyncio.gather(
            _run_source(zomato_source()),
            _run_source(swiggy_source()),
        )
        seen = {r.name.lower().strip() for r in merged}
        for r in [*zomato_hits, *swiggy_hits, *catalog_results]:
            key = r.name.lower().strip()
            if key in seen:
                continue
            seen.add(key)
            merged.append(r)

        # Resolve each ingredient to a live inventory item id (code first,
        # fuzzy name fallback — one HTTP fetch, in-process indexes).
        await _resolve_item_ids(client, identity, merged)

    max_results = max(1, int(get_settings().ai_recipe_max_results or 0))
    limit = min(payload.limit, max_results)

    return AiRecipeSearchResponse(
        results=merged[:limit],
        provider_used=_human_provider(provider_key),
        error=note,
    )


async def _resolve_item_ids(
    client, identity, recipes: list[AiRecipeResult]
) -> list[AiRecipeResult]:
    """Fill ``inventory_item_id`` on every ingredient of every recipe from
    the tenant's live inventory item list (code first, then fuzzy name).
    One HTTP fetch; in-process indexes after that. Unknown ingredients stay
    None and reconcile as 'missing'."""
    items = await _inventory_items(client, identity)
    code_index, name_index = _item_indexes(items)
    for r in recipes:
        for ing in r.ingredients:
            ing.inventory_item_id = _resolve_from_index(
                ing, None, code_index, name_index
            )
    return recipes


def _catalog_to_recipe_result(spec) -> AiRecipeResult:
    """A catalog spec -> the normalized result shape reconcile/reorder work on."""
    return AiRecipeResult(
        recipe_id=spec.code,
        name=spec.name,
        description=spec.description or None,
        item_type=spec.item_type,
        base_price=spec.base_price,
        yield_qty=spec.yield_qty,
        instructions=spec.instructions or None,
        source="catalog",
        ingredients=[
            AiRecipeSearchIngredient(
                name=ln.name or ln.inventory_code,
                inventory_code=ln.inventory_code,
                inventory_item_id=None,
                qty_per_portion=ln.qty,
                unit=ln.unit,
                wastage_pct=ln.wastage_pct,
            )
            for ln in spec.lines
        ],
    )


async def _resolve_recipe_ref(
    db, identity, ref: str
) -> AiRecipeResult | None:
    """Resolve a 'recipe_name_or_id' string to a normalized recipe.

    Order: catalog code (exact match on 'CAT-...') > menu-item name or id
    (tenant-scoped, with an active recipe). None when nothing matches — the
    caller turns that into a 404 with a helpful detail. Async because it
    reads the menu DB; the pure parts stay testable by passing a real or
    fake db session."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from src.services.menu.models import MenuItem, Recipe

    spec = catalog_by_code().get(ref)
    if spec is not None:
        return _catalog_to_recipe_result(spec)

    # Menu item by id or by name (tenant-scoped).
    item = None
    try:
        parsed_ref = uuid.UUID(ref)
        item = await db.scalar(
            select(MenuItem).where(MenuItem.id == parsed_ref,
                                  MenuItem.tenant_id == identity.tenant_id)
        )
    except (ValueError, TypeError):
        item = await db.scalar(
            select(MenuItem).where(
                MenuItem.tenant_id == identity.tenant_id,
                MenuItem.name.ilike(ref),
            )
        )
    if item is not None:
        recipe = await db.scalar(
            select(Recipe)
            .where(Recipe.menu_item_id == item.id,
                   Recipe.tenant_id == identity.tenant_id,
                   Recipe.is_active.is_(True))
            .options(selectinload(Recipe.lines))
            .order_by(Recipe.updated_at.desc())
        )
        if recipe is not None:
            # Recipe lines carry no names — the inventory item ids are what
            # matters; reconcile resolves each against the live item list to
            # get names/units for display.
            yield_qty = float(recipe.yield_qty or 1) or 1.0
            raw_type = str(item.item_type or "non_veg")
            return AiRecipeResult(
                recipe_id=ref,
                name=item.name,
                item_type=raw_type if raw_type in ("veg", "non_veg", "beverage") else "non_veg",
                yield_qty=yield_qty,
                source="catalog",
                ingredients=[
                    AiRecipeSearchIngredient(
                        name="",
                        inventory_item_id=ln.inventory_item_id,
                        qty_per_portion=float(ln.qty or 0),
                        unit="",
                        wastage_pct=float(ln.wastage_pct or 0),
                        is_optional=bool(ln.is_optional),
                    )
                    for ln in recipe.lines
                ],
            )
    return None


async def ai_recipe_reconcile_endpoint(
    payload: AiReconcileRequest, identity, db
) -> AiReconcileResponse:
    """POST /ai/recipe-reconcile — reconcile a recipe against live inventory.

    Recipe inputs, by precedence:
      1. ``recipe`` — a full recipe object (the richest, when the caller has
         one in hand, e.g. from /ai/recipe-search),
      2. ``recipe_name_or_id`` / ``recipe_id`` — a catalog code ('CAT-...'),
         a menu-item name, or an item/recipe id, resolved server-side.
    """
    identity.require("view:recipes")

    recipe: AiRecipeResult
    if payload.recipe is not None:
        recipe = payload.recipe
    else:
        ref = payload.recipe_name_or_id or payload.recipe_id
        if not ref:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide 'recipe_name_or_id' (a catalog code or "
                       "menu-item name), 'recipe_id', or a full 'recipe' "
                       "object.",
            )
        recipe = await _resolve_recipe_ref(db, identity, ref)
        if recipe is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Unknown recipe '{ref}'. Pass a catalog code "
                       "(CAT-...), a menu-item name, an item id, or a full "
                       "recipe object.",
            )

    portions = payload.portions
    yield_qty = recipe.yield_qty or 1.0

    # Resolve each ingredient to a live inventory item id.
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
        items = await _inventory_items(client, identity)
        code_index, name_index = _item_indexes(items)

        resolved: list[tuple[AiRecipeSearchIngredient, uuid.UUID | None]] = [
            (ing, _resolve_from_index(ing, payload.inventory_item_ids,
                                      code_index, name_index))
            for ing in recipe.ingredients
        ]

        ids = [iid for _i, iid in resolved if iid is not None]
        lookup = await _inventory_cost_lookup(client, identity, ids)

        # Vendor + suggested qty per resolved item, so each line can carry
        # its reorder destination ('which vendor, how much they'd sell me').
        vendor_rows = await _fetch_vendor_rows(client, identity, ids)

    lines: list[AiReconcileLine] = []
    total_cost = 0.0
    cost_known = True
    low_count = 0
    missing_count = 0
    for ing, iid in resolved:
        per_portion = float(ing.qty_per_portion or 0)
        wastage = float(ing.wastage_pct or 0)
        required = per_portion / yield_qty * portions * (1 + wastage / 100.0)

        entry = lookup.get(str(iid)) if iid else None
        available = float(entry.get("total_available", 0.0)) if entry else 0.0
        reorder = float(entry.get("reorder_level", 0.0)) if entry else 0.0
        unit_cost = entry.get("standard_cost") if entry else None

        # Vendor + agreed suggested qty for this item (from the purchase
        # service), so the line carries its reorder destination.
        vrow = vendor_rows.get(iid) if iid else None
        vendor_id = None
        suggested_qty = None
        if vrow and vrow.get("vendor_id"):
            try:
                vendor_id = uuid.UUID(str(vrow["vendor_id"]))
            except (ValueError, TypeError):
                vendor_id = None
            sq = vrow.get("suggested_qty")
            suggested_qty = float(sq) if sq else None

        if iid is None:
            st: str = "missing"
        elif available <= 0:
            st = "missing"
        elif available <= reorder or available < required:
            st = "low"
        else:
            st = "in_stock"
        if st == "low":
            low_count += 1
        elif st == "missing":
            missing_count += 1

        shortfall = max(0.0, required - available)

        # Suggested PO qty: enough to cover the shortfall AND refill to the
        # reorder buffer. 0 when in stock.
        if st == "in_stock":
            suggested = 0.0
        else:
            target = max(required, reorder * 2.0) if reorder else required
            suggested = round(max(0.0, target - available), 4)

        if unit_cost is None:
            cost_known = False
            line_cost = None
        else:
            line_cost = round(required * float(unit_cost), 4)
            total_cost += required * float(unit_cost)

        # A nameless ingredient (menu-DB recipe) falls back to the live
        # inventory item's name/unit, when the lookup carries them.
        name = ing.name or (entry.get("name") if entry else None) or str(iid or "")
        unit = ing.unit or (entry.get("code") if entry else "") or ""
        vrow = vendor_rows.get(iid) if iid else None
        vendor_id = (
            uuid.UUID(str(vrow["vendor_id"]))
            if vrow and vrow.get("vendor_id") else None
        )

        lines.append(AiReconcileLine(
            name=name,
            unit=unit,
            qty_per_portion=round(per_portion / yield_qty, 4),
            wastage_pct=wastage,
            inventory_item_id=iid,
            required_for_n=round(required, 4),
            available_stock=available,
            reorder_level=reorder,
            standard_cost=float(unit_cost) if unit_cost is not None else None,
            line_cost=line_cost,
            status=st,  # type: ignore[arg-type]
            shortfall=round(shortfall, 4),
            suggested_po_qty=suggested,
            vendor_id=vendor_id,
            suggested_qty=(
                (float(vrow["suggested_qty"]) or None)
                if vrow and vrow.get("suggested_qty") else None
            ),
        ))

    total_block = {
        "lines": len(lines),
        "in_stock": max(0, len(lines) - low_count - missing_count),
        "low": low_count,
        "missing": missing_count,
        "total_cost": round(total_cost, 2) if cost_known and lines else None,
        "cost_known": cost_known and bool(lines),
    }

    return AiReconcileResponse(
        name=recipe.name,
        portions=portions,
        lines=lines,
        total_cost=round(total_cost, 2) if cost_known and lines else None,
        cost_known=cost_known and bool(lines),
        low_count=low_count,
        missing_count=missing_count,
        total=total_block,
    )


async def _reconcile_to_reorder_lines(
    recipe: AiRecipeResult,
    portions: int,
    identity,
    outlet_id: uuid.UUID | None,
) -> list[AiReorderLineIn]:
    """Reconcile a recipe against live inventory and return the missing/low
    lines, shaped for /ai/recipe-reorder. Reuses the exact same code ->
    item-id + cost-lookup plumbing as the reconcile endpoint, so the
    server-side reorder path and the frontend's pass-through path cannot
    disagree about what "short" means."""
    yield_qty = recipe.yield_qty or 1.0
    lines: list[AiReorderLineIn] = []
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
        items = await _inventory_items(client, identity)
        code_index, name_index = _item_indexes(items)
        resolved = [
            (ing, _resolve_from_index(ing, None, code_index, name_index))
            for ing in recipe.ingredients
        ]
        ids = [iid for _i, iid in resolved if iid is not None]
        lookup = await _inventory_cost_lookup(client, identity, ids)
        for ing, iid in resolved:
            per_portion = float(ing.qty_per_portion or 0)
            wastage = float(ing.wastage_pct or 0)
            required = per_portion / yield_qty * portions * (1 + wastage / 100.0)
            entry = lookup.get(str(iid)) if iid else None
            available = float(entry.get("total_available", 0.0)) if entry else 0.0
            reorder = float(entry.get("reorder_level", 0.0)) if entry else 0.0
            if iid is None or available <= 0:
                st = "missing"
            elif available <= reorder or available < required:
                st = "low"
            else:
                continue  # in stock — not a reorder line
            if st == "in_stock":
                continue
            if st == "low":
                suggested = 0.0
            else:
                target = max(required, reorder * 2.0) if reorder else required
                suggested = round(max(0.0, target - available), 4)
            lines.append(AiReorderLineIn(
                inventory_item_id=iid,
                name=ing.name,
                status=st,  # type: ignore[arg-type]
                suggested_po_qty=suggested,
                shortfall=round(max(0.0, required - available), 4),
                reorder_level=reorder,
                available_stock=available,
                required_for_n=round(required, 4),
            ))
    return lines


def _order_qty_for(line: AiReorderLineIn, vendor_row: dict | None) -> float:
    """How much to order for one line — pure, so it is unit-testable.

    Precedence: the client's own ``suggested_po_qty`` (usually shortfall +
    reorder buffer, computed during reconcile) > the vendor's agreed
    ``suggested_qty`` > a minimal 1.0, so a line never hits the purchase
    service's ``ordered_qty > 0`` validation.
    """
    qty = round(max(float(line.suggested_po_qty or 0.0), 0.0), 4)
    if qty > 0:
        return qty
    vendor_suggested = float((vendor_row or {}).get("suggested_qty") or 0.0)
    # Never return 0: both POLineIn and PRLineIn require a positive quantity,
    # so a line that reaches the purchase service always validates.
    return round(max(vendor_suggested, 1.0), 4)


def _classify_reorder_lines(
    lines: list[AiReorderLineIn],
    open_items: set[uuid.UUID],
) -> tuple[list[AiReorderLineIn], list[AiReorderLineIn], list[AiReorderSkipped]]:
    """Split the incoming lines into (missing, low, idempotent-skipped) —
    pure, so the split itself can be tested without any HTTP.

    'missing' lines -> draft POs; 'low' lines -> purchase requests. Lines
    whose inventory item already has an open PO or PR are skipped (reported,
    not ordered again) — that is the idempotency guard."""
    missing: list[AiReorderLineIn] = []
    low: list[AiReorderLineIn] = []
    idempotent: list[AiReorderSkipped] = []
    for l in lines:
        if l.inventory_item_id is None:
            idempotent.append(AiReorderSkipped(
                inventory_item_id=None,
                reason="No resolvable inventory item for this line — "
                       "reconcile reported it as an unknown ingredient",
            ))
            continue
        if l.inventory_item_id in open_items:
            idempotent.append(AiReorderSkipped(
                inventory_item_id=l.inventory_item_id,
                reason="Open PO or PR already exists for this item",
            ))
            continue
        if l.status == "low":
            low.append(l)
        else:
            # 'missing' (and anything unclassified) is ordered as a PO.
            missing.append(l)
    return missing, low, idempotent


async def ai_recipe_reorder_endpoint(
    payload: AiReorderRequest, identity, db
) -> AiReorderResponse:
    """POST /ai/recipe-reorder — auto-create purchase documents for gaps.

    'missing' lines become a **draft purchase order** (grouped per vendor so
    one vendor's items stay on one document); 'low' lines become a
    **purchase request** — the same two artifacts the stock.low auto-path
    produces, so procurement sees AI-triggered and stock-triggered restocks
    in one place. Only items without an open PO/PR are created
    (idempotency). Everything is a draft: nothing is sent to a vendor.

    Contract input: ``{recipe_name_or_id, portions}`` — when the caller does
    not pass its own ``lines``, this endpoint runs the reconcile step
    internally (same math as /ai/recipe-reconcile) and derives the
    missing/low lines from the live inventory. A pre-built ``lines`` array
    (the reconcile pass-through) wins when present.
    """
    identity.require("manage:purchase")

    lines_in = list(payload.lines)
    recipe_ref = payload.recipe_name_or_id
    portions = payload.portions

    # Server-side derivation: recipe reference + portions, no lines yet.
    if not lines_in:
        if not recipe_ref:
            return AiReorderResponse(
                created=False,
                reason="Nothing to reorder — pass 'recipe_name_or_id' (+ "
                       "'portions') or a 'lines' array from "
                       "/ai/recipe-reconcile.",
            )
        recipe = await _resolve_recipe_ref(db, identity, recipe_ref)
        if recipe is None:
            return AiReorderResponse(
                created=False,
                reason=f"Unknown recipe '{recipe_ref}' — no PO created. "
                       "Pass a catalog code (CAT-...) or a menu-item name.",
            )
        lines_in = await _reconcile_to_reorder_lines(
            recipe, portions, identity, payload.outlet_id
        )
        if not lines_in:
            return AiReorderResponse(
                created=False,
                reason="Recipe is fully in stock at this portion size — "
                       "nothing to order.",
            )
        recipe_ref = recipe.name

    if payload.recipe_name is None:
        payload.recipe_name = recipe_ref

    # Resolve the outlet. Purchase documents require one, so when the client
    # did not pick one: the identity's single allowed outlet or active
    # outlet; a multi-outlet tenant with neither is rejected early —
    # guessing an outlet for a PO is a procurement decision, not a
    # convenience.
    outlet_id = payload.outlet_id
    if outlet_id is None:
        allowed = list(identity.allowed_outlet_ids)
        if len(allowed) == 1:
            outlet_id = allowed[0]
        elif identity.active_outlet_id is not None:
            outlet_id = identity.active_outlet_id
    if outlet_id is None:
        return AiReorderResponse(
            created=False,
            reason="outlet_id could not be resolved for this tenant — "
                   "no PO created. Pass 'outlet_id' explicitly.",
        )

    item_ids = [l.inventory_item_id for l in lines_in if l.inventory_item_id]

    created_lines: list[dict] = []

    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0)) as client:
        # Idempotency gate: skip items that already have an open PO or PR.
        open_items = await _open_po_pr_items(client, identity, item_ids)
        missing, low, idempotent = _classify_reorder_lines(lines_in, open_items)

        # Vendor selection: the vendor that carries the item (VendorItem
        # rows) with its last agreed price, else the tenant's default
        # active vendor.
        #
        # A PO is still created even when no vendor carries the item and no
        # vendor exists at all: the purchase service's create_order 404s on
        # an unknown vendor, so we skip the whole document with a clear
        # 'idempotent' reason — but when SOME vendor exists (even one that
        # doesn't carry this particular item) we use it, because the
        # 'first active vendor carrying that item, else the tenant's
        # default/first vendor' rule says a default vendor is a valid PO
        # destination.
        vendor_rows = await _fetch_vendor_rows(
            client, identity, [l.inventory_item_id for l in missing if l.inventory_item_id]
        )
        default_vendor = await _first_active_vendor(client, identity)

        def _vendor_price(line: AiReorderLineIn) -> tuple[uuid.UUID | None, float, bool]:
            """(vendor_id, unit_price, ok) for one missing line."""
            price = float(line.unit_price or 0.0)
            row = vendor_rows.get(line.inventory_item_id) if line.inventory_item_id else None
            if row and row.get("vendor_id"):
                try:
                    vid = uuid.UUID(str(row["vendor_id"]))
                except (ValueError, TypeError):
                    vid = None
                if vid is not None:
                    if price <= 0:
                        price = float(row.get("last_purchase_price") or 0.0)
                    return vid, price, True
            if default_vendor is not None:
                return default_vendor, price, True
            return None, price, False

        # ── missing lines -> one draft PO per vendor ──────────────────────
        # (vendor_id -> [(line, ordered_qty, unit_price)]) — the price is the
        # client override when set, else the vendor's last agreed price.
        groups: dict[uuid.UUID, list[tuple[AiReorderLineIn, float, float]]] = {}
        no_vendor_at_all = default_vendor is None and not any(
            (r or {}).get("vendor_id") for r in vendor_rows.values()
        )
        for l in missing:
            vendor_id, price, ok = _vendor_price(l)
            if not ok or vendor_id is None:
                # No vendor at all for this tenant — every line reports
                # that; the response reason says it plainly.
                idempotent.append(AiReorderSkipped(
                    inventory_item_id=l.inventory_item_id,
                    reason=("No active vendor configured for this tenant — "
                            "add a vendor before auto-POs can be created"),
                ))
                continue
            row = vendor_rows.get(l.inventory_item_id)
            ordered = _order_qty_for(l, row)
            groups.setdefault(vendor_id, []).append((l, ordered, price))

        po_created: list[AiReorderCreated] = []
        for vendor_id, group_lines in groups.items():
            po_lines = [
                {
                    "inventory_item_id": l.inventory_item_id,
                    "ordered_qty": ordered,
                    "unit_price": round(price, 2),
                    "notes": f"ai-recipe-reorder: {l.name or 'ingredient'} "
                             f"({payload.recipe_name or 'auto'})",
                }
                for l, ordered, price in group_lines
            ]
            created = await _create_purchase_order(
                client, identity, outlet_id, vendor_id, po_lines,
            )
            if created:
                po_id = uuid.UUID(str(created.get("id")))
                po_number = str(created.get("po_number") or po_id)
                po_created.append(AiReorderCreated(
                    id=po_id, number=po_number, lines=len(po_lines),
                ))
                for p in po_lines:
                    # lines[] carries exactly the AiReorderCreatedLine shape
                    # (the per-PO breakdown lives in po_created).
                    created_lines.append(AiReorderCreatedLine(
                        inventory_item_id=p["inventory_item_id"],
                        ordered_qty=p["ordered_qty"],
                        unit_price=p["unit_price"],
                        notes=p.get("notes"),
                    ))

        # ── low lines -> one purchase request ─────────────────────────────
        pr_created: list[AiReorderCreated] = []
        if low:
            pr_lines = [
                {
                    "inventory_item_id": l.inventory_item_id,
                    # PRLineIn requires qty > 0 — a zero/unknown suggestion
                    # would fail schema validation on the purchase side, so
                    # fall back to a minimal positive line.
                    "qty": max(_order_qty_for(
                        l, vendor_rows.get(l.inventory_item_id)), 1.0),
                    "notes": f"ai-recipe-reorder: low stock "
                             f"({payload.recipe_name or 'auto'})",
                }
                for l in low if l.inventory_item_id
            ]
            created = await _create_purchase_request(
                client, identity, outlet_id, pr_lines,
            )
            if created:
                pr_created.append(AiReorderCreated(
                    id=uuid.UUID(str(created.get("id"))),
                    number=str(created.get("pr_number") or created.get("id")),
                    lines=len(pr_lines),
                ))

    created_any = bool(po_created or pr_created)
    # Contract fields: po_id/po_number/lines cover the single-PO case; when
    # the gaps span several vendors, po_id points at the first PO and the
    # full breakdown is in po_created.
    primary = po_created[0] if po_created else None
    reason: str | None = None
    if not created_any:
        if idempotent:
            reason = ("No PO created — every line was already covered by an "
                      "open PO or PR, or no active vendor carries it "
                      "(see 'idempotent').")
        else:
            reason = ("No PO created — nothing was out of stock or the "
                      "purchase service was unreachable.")
    return AiReorderResponse(
        created=created_any,
        po_id=primary.id if primary else None,
        po_number=primary.number if primary else None,
        lines=created_lines,
        reason=reason,
        po_created=po_created,
        pr_created=pr_created,
        idempotent=idempotent,
        note=(
            f"Created {len(po_created)} draft PO(s) and {len(pr_created)} "
            f"purchase request(s); {len(idempotent)} line(s) skipped."
        ),
    )


# ─── Public alias (so api.py and docs can import one name) ───────────────────


# Public names api.py imports.
ai_recipe_search = ai_recipe_search_endpoint
ai_recipe_reconcile = ai_recipe_reconcile_endpoint
ai_recipe_reorder = ai_recipe_reorder_endpoint
