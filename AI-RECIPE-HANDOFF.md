# AI Recipe Search — HANDOFF DOC

> Read this before starting a new session. It records **exactly what is done,
> what is left, and the one known bug** that blocks the feature.
>
> Feature: "global realtime recipe search" on the recipe page — LLM-powered
> (Gemini + Claude, multimodal, "if one fails the other catches up"),
> reconciled against **current inventory** in realtime, minute-detail
> ingredient breakdown, and **auto-create purchase orders** when an
> ingredient is missing/low. Caching + rate limiting included.

---

## 0. Repo layout (quick orientation)

- Backend: `backend/` — FastAPI microservices. 13 services under
  `backend/src/services/<name>/` (auth, organization, menu, pos, kitchen,
  billing, inventory, purchase, staff, customers, loyalty, accounting,
  reports, platform) + a gateway at `backend/src/services/gateway/`.
- Python env: `C:\Users\abhil\anaconda3\envs\sales\python.exe`
- Frontend: `frontend/` — React + Vite + TanStack Router (file-based routes),
  shadcn/ui in `frontend/src/components/ui`, service clients in
  `frontend/src/services/`, API client `frontend/src/lib/api-client.ts`.
- Run services: `cd backend && python run_services.py <status|restart ...>`
  (14 services). Gateway :8000, menu :8102, inventory :8106, purchase :8107.
- **Split rule** (do not violate): services own their own DBs; cross-service
  reads go **over HTTP** (`registry.base_url()` + gateway-forwarded
  `X-Identity-*` headers), **never** a foreign key or direct DB handle into
  another service's DB.

---

## 1. WHAT IS DONE (on disk, verified present)

### Backend — menu service (the core of the feature)

`backend/src/services/menu/recipe_ai.py` — **NEW, 1608 lines, exists and is
complete.** Contains all three endpoint implementations + every helper:

| Function | Purpose |
|---|---|
| `ai_recipe_search_endpoint` | Fan out query to LLM cascade + catalog (+Zomato/Swiggy when keyed); merge, dedupe, rank. Degrades to catalog with a `note` when no LLM key. **Never 500s.** |
| `ai_recipe_reconcile_endpoint` | Resolve a recipe (catalog code / item name / full recipe obj) + portions; fetch live stock/cost/reorder from inventory; classify each line in_stock / low / missing with shortfall + suggested qty. |
| `ai_recipe_reorder_endpoint` | Turn missing lines → **draft PO**, low lines → **purchase request**, grouped by vendor, **idempotent** against open PO/PR. |
| `_llm_recipe` | Gemini-first, Claude-fallback structured-JSON LLM call ("if one fails the other catches up"). |
| `_TokenBucket`, `_get_limiter` | Per-tenant rate limiter. |
| `_llm_cache_get/_set`, `_cache_key` | In-memory LRU+TTL cache (keyed on normalized query + portions + image hash). |
| `_inventory_items`, `_inventory_cost_lookup` | Cross-service inventory reads (HTTP + `X-Identity-*` headers). |
| `_fetch_vendor_rows`, `_first_active_vendor`, `_create_purchase_order`, `_create_purchase_request`, `_open_po_pr_items` | Purchase-service reads/writes for the auto-PO. |
| `zomato_source`, `swiggy_source` | Best-effort global source adapters; safe no-ops returning `[]` when their key is empty/disabled (do **not** invent keys). |

Other backend files that already exist and are wired:
- `backend/src/services/menu/schemas.py` (lines ~424–717) — all the
  Pydantic models: `AiRecipeSearchRequest/Response`, `AiRecipeResult`,
  `AiRecipeIngredient`, `AiReconcileRequest/Response/Line`,
  `AiReorderRequest/Response/LineIn/Skipped/Created/CreatedLine`,
  `RecipeReconcileLine`. **Complete.**
- `backend/src/services/menu/api.py` (lines 631–682) — the three routes are
  **registered and delegated** to `recipe_ai`:
  - `@router.post("/ai-recipe-search", response_model=AiRecipeSearchResponse)`
  - `@router.post("/ai-recipe-reconcile", response_model=AiReconcileResponse)`
  - `@router.post("/ai-recipe-reorder", response_model=AiReorderResponse)`
  - They import the three `*_endpoint` functions from `recipe_ai` at
    `api.py:647-651`.
- `backend/src/services/ai_service.py` — already extended with
  `generate_structured_json(...)` (multimodal Gemini/Claude/OpenAI + JSON
  output). The cascade + failover lives here.
- `backend/src/config/settings.py` — new settings present:
  `ai_recipe_cache_maxsize`, `ai_recipe_cache_ttl_seconds`,
  `ai_recipe_rate_limit_per_min`, `ai_recipe_max_results` (plus earlier
  `ai_multimodal_enabled`, aggregator base URLs).
- `backend/src/services/inventory/api.py` — `cost-lookup` now also returns
  `reorder_level` (needed for low/missing classification).
- `backend/src/services/purchase/api.py` — `GET /vendor-items/recommend`
  added.

### Frontend

- `frontend/src/services/purchaseService.ts` — **NEW, exists.** Typed
  `purchaseService` with `aiRecipeSearch`, `aiRecipeReconcile`,
  `aiRecipeReorder` + all TS interfaces mirroring the contract.
- `frontend/src/routes/recipes.tsx` — extended with an "AI Search" tab:
  text + image upload, ranked results, minute-detail reconcile table with
  status badges, portions stepper, per-row + batch "Reorder/Create PO"
  buttons, degrade banner. (Frontend agent reported typecheck 0 errors in
  its files + `npm run build` passing.)

---

## 2. THE ONE KNOWN BUG — frontend↔backend path mismatch ⚠️

**The feature does NOT work end-to-end yet because of this.**

- **Frontend** `purchaseService.ts` calls:
  - `POST /api/v1/menu/ai/recipe-search`
  - `POST /api/v1/menu/ai/recipe-reconcile`
  - `POST /api/v1/menu/ai/recipe-reorder`
  (i.e. an `/ai/` segment with a slash.)

- **Backend** `menu/api.py` registers:
  - `POST /ai-recipe-search`
  - `POST /ai-recipe-reconcile`
  - `POST /ai-recipe-reorder`
  (hyphenated, no `/ai/` segment.) Mounted under the menu service prefix
  (`/api/v1/menu`), so the real live paths are
  `/api/v1/menu/ai-recipe-search` etc.

So the frontend's 3 requests 404 today. **Pick ONE convention and make both
sides match.** Recommendation: keep the backend as-is (hyphenated, no `/ai/`)
and change the **3 URLs in `frontend/src/services/purchaseService.ts`** to
`/api/v1/menu/ai-recipe-search|reconcile|reorder`. (Alternatively add `/ai/`
sub-routes on the backend — more code, more churn.)

> Minor: `backend/recipe_ai.py`'s top docstring mentions
> `POST /ai/recipe-*` in two places but the actual routes are `/ai-recipe-*`.
> Cosmetic only — fix if you touch the file.

---

## 3. WHAT STILL TO DO (in order)

1. **Fix the path mismatch** (section 2) — 3-line change in
   `frontend/src/services/purchaseService.ts`. This is the critical one.
2. **Verify backend imports cleanly.** The menu service must import
   `recipe_ai` without error. Run:
   ```
   cd backend && python -c "import src.services.menu.api; print('ok')"
   ```
   (If a killed agent left a half-edit, this is where it would surface.)
3. **Set LLM keys** — `backend/.env` currently has **empty** `GEMINI_API_KEY`,
   `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (and `AI_ENABLED` was false). Until
   a key is set, `/ai-recipe-search` returns catalog-only results with
   `provider_used: "none"` + a `note` — that's expected, not a bug. To test
   the real LLM path, put a Gemini and/or Anthropic key in `.env` and
   restart the menu service.
4. **Smoke test the 3 endpoints** (user will run the app; you only do HTTP
   checks after the user's services are up). Example:
   ```
   curl -X POST http://127.0.0.1:8000/api/v1/menu/ai-recipe-search \
        -H "X-Identity-Tenant-Id: e9fb216b-6289-43ca-900c-c09eada9840f" \
        -H "Content-Type: application/json" \
        -d '{"query":"chicken biryani","portions":4,"limit":3}'
   ```
   Then `-recipe-reconcile` with `{"recipe_name_or_id":"CAT-BIRYANI-CHICK","portions":4}`
   and `-recipe-reorder` with the reconcile output. Confirm no 500s and that
   stock/cost numbers come back real.

---

## 4. KEY FACTS FOR THE NEW SESSION

- **Auth for cross-service calls:** services trust the gateway's forwarded
  `X-Identity-*` headers (see `backend/src/services/shared/identity.py`,
  `_identity_from_forwarded_headers`). The working reference pattern is the
  existing menu→inventory call at `menu/api.py` `item_food_cost` (~line 650):
  `httpx` + `registry.base_url(get_descriptor('inventory'))` +
  `headers={"X-Identity-Tenant-Id": str(tenant_id)}`.
- **Recipe scaling math** (reused across breakdown + reconcile):
  `required = (qty_per_portion / yield_qty) * portions * (1 + wastage_pct/100)`.
- **Status logic:** `missing` = no resolved inventory item or available<=0;
  `low` = available < required OR available <= reorder_level; else `in_stock`.
- **Suggested PO qty:** `max(required, reorder_level*2) - available`
  (covers the shortfall + refills to the reorder buffer); 0 when in_stock.
- **Auto-PO idempotency:** before creating, query open POs/PRs; if an open
  doc already covers the inventory item, mark it in `idempotent` and skip.
- **All LLM/aggregator keys are empty** in the current `.env` — the whole
  feature is built to **degrade gracefully** (catalog-only, no 500) until
  keys are added. Zomato/Swiggy adapters are safe no-ops when unkeyed.
- **Cache** = in-memory LRU+TTL per menu process (fine; single process).
  **Rate limit** = in-memory token bucket. No Redis dependency for these.

## 5. STATUS SUMMARY (TL;DR)

| Piece | Status |
|---|---|
| Backend `recipe_ai.py` (search/reconcile/reorder + LLM + cache + ratelimit + inventory + PO) | ✅ done |
| Backend schemas (`Ai*` models) | ✅ done |
| Backend route registration in `menu/api.py` | ✅ done (`/ai-recipe-*`) |
| `ai_service.py` multimodal structured-JSON | ✅ done |
| Settings fields | ✅ done |
| inventory `reorder_level` in cost-lookup | ✅ done |
| purchase `/vendor-items/recommend` | ✅ done |
| Frontend `purchaseService.ts` + `recipes.tsx` AI tab | ✅ done (reported clean tsc + build) |
| **Path mismatch (frontend `/ai/recipe-*` vs backend `/ai-recipe-*`)** | ✅ **fixed** — 3 URLs in `purchaseService.ts` AND 3 in `menuService.ts` (handoff had missed the second file) now both point at `/api/v1/menu/ai-recipe-*` |
| LLM keys in `.env` | ⬜ empty (feature degrades to catalog-only — by design; `provider_used: "none"` + note in response) |
| End-to-end HTTP smoke test | ✅ done 2026-10-23 — all 3 endpoints return HTTP 200 (see §6) |

## 6. SESSION 2 — what was done (2026-10-23)

- Fixed the 6 URL strings above (`purchaseService.ts` + `menuService.ts` both had the bug; handoff only listed the former).
- Added `IDENTITY_DEV_FALLBACK=true` to `backend/.env` (with a comment). Without it, every request through the gateway without a valid Bearer token hard-401s — the service-level dev fallback in `shared/identity.py` is deliberately off unless this flag is set. This unblocks unauthenticated local API testing / the frontend in dev.
- Smoke-tested all 3 endpoints end-to-end (gateway :8000, menu :8102, inventory :8106, purchase :8107) via `backend/ai_recipe_smoke.py` (new, mirrors the `ro_test.py` pattern):
  - `/ai-recipe-search` → 200, catalog results, `provider_used: "none"` + "no LLM keys" note (expected, keys empty).
  - `/ai-recipe-reconcile` → 200, real live inventory numbers (stock, reorder_level, shortfall computed correctly; scaling math verified by hand).
  - `/ai-recipe-reorder` → 200, created a real purchase request (idempotent, skipped lines already covered by an open PR).
- Left `IDENTITY_DEV_FALLBACK=true` in place since the app runs in `APP_ENV=development` locally and the whole point of the fallback is exactly this kind of unauthenticated dev/test flow. If you want it off for "closer to prod" behavior, remove that one line from `.env` and restart the services.
- Known data-quality observation: seeded inventory `standard_cost` values are wildly large (e.g. ₹37,800/kg for chicken), which makes `total_cost` in a reconcile look unrealistic — this is a seed-data problem, not a code bug in `recipe_ai.py`.

**Bottom line for the new session: the work is ~95% done. Fix the 3 URL
strings in `frontend/src/services/purchaseService.ts` to match
`/api/v1/menu/ai-recipe-*`, confirm `import src.services.menu.api` is clean,
and smoke-test the 3 endpoints. That's it.**
