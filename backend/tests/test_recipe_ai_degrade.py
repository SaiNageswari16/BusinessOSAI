"""End-to-end graceful-degrade checks for the AI recipe endpoints, driven
directly with a fake identity and no network / no database.

These prove the "never 500" contract:
  * search with zero LLM keys + unreachable inventory -> 200, catalog floor
  * reconcile by catalog code + unreachable inventory -> every line missing
  * reorder with unreachable purchase service -> nothing created, reasons set

Run directly:  python tests/test_recipe_ai_degrade.py
"""
from __future__ import annotations

import asyncio
import sys
import uuid

sys.path.insert(0, ".")

from src.services.menu import recipe_ai
from src.services.menu.schemas import (
    AiRecipeSearchRequest,
    AiReconcileRequest,
    AiReorderLineIn,
    AiReorderRequest,
)  # noqa: F401 (re-exported for readability of the assertions below)


class FakeIdentity:
    """Just enough of shared/identity.Identity to drive recipe_ai without a
    real JWT — recipe_ai only reads tenant/user/permissions/outlet fields and
    calls identity.require()."""

    def __init__(self, tenant: uuid.UUID) -> None:
        self.tenant_id = tenant
        self.user_id = uuid.UUID("11111111-1111-1111-1111-111111111111")
        self.email = "x@x"
        self.permissions = {"*"}
        self.roles = set()
        self.is_tenant_owner = True
        self.allowed_outlet_ids = set()
        self.active_outlet_id = uuid.UUID("11111111-2222-3333-4444-555555555555")

    def require(self, _p: str) -> None:  # always allowed
        return None


def main() -> int:
    tenant = uuid.UUID("44444444-4444-4444-4444-444444444444")
    ident = FakeIdentity(tenant)
    rid = uuid.UUID("55555555-5555-5555-5555-555555555555")
    oid = uuid.UUID("66666666-6666-6666-6666-666666666666")

    async def run() -> None:
        # ── 1. search: no LLM keys + no inventory service -> 200 catalog ──
        sp = AiRecipeSearchRequest(query="biryani", portions=2, limit=5)
        sresp = await recipe_ai.ai_recipe_search_endpoint(sp, ident, None)
        print("SEARCH results:", len(sresp.results), "| provider_used:",
              sresp.provider_used, "| error:", sresp.error)
        assert sresp.provider_used in ("gemini", "claude", "openai", "none")
        assert sresp.results, "search must never return an empty catalog"
        assert all(r.source in ("catalog", "llm", "zomato", "swiggy")
                   for r in sresp.results)

        # ── 2. reconcile: catalog code + no inventory -> all missing ──
        rp = AiReconcileRequest(recipe_id="CAT-BUTTER-CHICKEN", portions=2)
        rr = await recipe_ai.ai_recipe_reconcile_endpoint(rp, ident, None)
        print("RECONCILE:", rr.name, "| lines:", len(rr.lines),
              "| low:", rr.low_count, "missing:", rr.missing_count,
              "| cost_known:", rr.cost_known)
        assert len(rr.lines) == 5, "Butter Chicken has 5 catalog lines"
        # With no inventory service reachable, no ingredient resolves to an
        # item id, so every line must be 'missing'.
        assert rr.missing_count == 5, (
            f"expected 5 missing lines with inventory down, got "
            f"{rr.missing_count} (low={rr.low_count})"
        )

        # ── 3. reorder: unreachable purchase service -> nothing created ──
        lp = AiReorderRequest(
            lines=[
                AiReorderLineIn(inventory_item_id=rid, status="missing",
                                name="chicken", suggested_po_qty=3.0),
                AiReorderLineIn(inventory_item_id=oid, status="low",
                                name="tomato", suggested_po_qty=1.0),
            ],
            outlet_id=uuid.UUID("11111111-2222-3333-4444-555555555555"),
            recipe_name="Butter Chicken",
        )
        orr = await recipe_ai.ai_recipe_reorder_endpoint(lp, ident, None)
        print("REORDER created:", orr.created, "| po:", len(orr.po_created),
              "pr:", len(orr.pr_created), "| skipped:", len(orr.idempotent))
        print("REORDER note:", orr.note, "| reason:", orr.reason,
              "| po_id:", orr.po_id, "| po_number:", orr.po_number,
              "| lines:", len(orr.lines))
        # The 'low' line becomes a PR when the purchase service is reachable
        # (created=True here in a live env) and a documented skip when it is
        # not (created=False in a bare test run). Either way the call is a
        # clean 200: when nothing is created, a reason explains why.
        if orr.created:
            assert orr.pr_created, "a created PR must be reported in pr_created"
        else:
            assert orr.reason, "created=false must always carry a reason"

        # ── 4. reorder contract input: recipe_name_or_id + portions, no
        # lines — the server derives the missing/low lines itself. With the
        # registry empty (no inventory/purchase services) it degrades to
        # created=false + a reason, never a 500.
        crp = AiReorderRequest(recipe_name_or_id="CAT-BUTTER-CHICKEN",
                               portions=2,
                               outlet_id=uuid.UUID("11111111-2222-3333-4444-555555555555"))
        corr = await recipe_ai.ai_recipe_reorder_endpoint(crp, ident, None)
        print("REORDER(contract) created:", corr.created,
              "| reason:", corr.reason)
        # Derived path: if inventory is down, every line is 'missing' and a
        # live purchase service may still create a PO from the vendor rows —
        # so created may be True in a fully-up env. The hard contract is:
        # never a 500, and always a reason when created is False.
        if corr.created is False:
            assert corr.reason, "created=false must explain itself"

        # ── 5. reconcile contract input: recipe_name_or_id, no recipe_id ──
        crp2 = AiReconcileRequest(recipe_name_or_id="CAT-BUTTER-CHICKEN",
                                  portions=2)
        rr2 = await recipe_ai.ai_recipe_reconcile_endpoint(crp2, ident, None)
        print("RECONCILE(contract):", rr2.name, "| total block:", rr2.total)
        assert rr2.total["missing"] == 5
        assert rr2.total["lines"] == 5
        assert rr2.lines[0].vendor_id is None  # no purchase service -> no vendor

    asyncio.run(run())
    print("ALL DEGRADE PATHS OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
