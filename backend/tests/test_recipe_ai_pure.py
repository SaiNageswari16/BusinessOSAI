"""Unit tests for the pure (no I/O) functions in menu/recipe_ai.py:

* ``_catalog_score`` / ``_catalog_matches`` — lexical catalog ranking
* ``_parse_llm_recipe`` — LLM JSON -> AiRecipeResult, fence-stripping,
  malformed-JSON rejection
* ``_classify_reorder_lines`` — the reorder idempotency split
* ``_order_qty_for`` — PO/PR quantity precedence

Run directly:  python -m pytest tests/test_recipe_ai_pure.py -q
(no services or database needed — none of these touch the network)."""
from __future__ import annotations

import sys
import unittest
import uuid

sys.path.insert(0, ".")

from src.services.menu.recipe_ai import (
    _catalog_matches,
    _classify_reorder_lines,
    _order_qty_for,
    _parse_llm_recipe,
)
from src.services.menu.schemas import AiReorderLineIn

T = uuid.UUID("11111111-1111-1111-1111-111111111111")
U = uuid.UUID("22222222-2222-3333-4444-555555555555")
V = uuid.UUID("33333333-2222-3333-4444-555555555555")


class CatalogScoreTests(unittest.TestCase):
    def test_exact_dish_names_rank_above_partial(self):
        hits = _catalog_matches("butter chicken", 20)
        names = [r.name for r in hits]
        self.assertIn("Butter Chicken", names)
        # Butter Chicken's name carries both query terms, so it must be first.
        self.assertEqual(names[0], "Butter Chicken")

    def test_empty_query_returns_full_catalog(self):
        hits = _catalog_matches("", 20)
        self.assertGreater(len(hits), 3)
        for r in hits:
            self.assertEqual(r.source, "catalog")
            self.assertTrue(r.recipe_id.startswith("CAT-"))

    def test_catalog_result_ingredients_carry_codes(self):
        hits = _catalog_matches("naan", 20)
        self.assertTrue(hits)
        for r in hits:
            for ing in r.ingredients:
                self.assertTrue(ing.inventory_code)


class LlmParseTests(unittest.TestCase):
    def _recipe_json(self) -> str:
        return (
            '{"name": "Test Curd Rice", "description": "d", '
            '"item_type": "veg", "base_price": 120, "yield_qty": 2, '
            '"ingredients": [{"name": "rice", "qty_per_portion": 50, '
            '"unit": "g"}, {"name": "curd", "qty_per_portion": 10, '
            '"unit": "ml"}]}'
        )

    def test_parses_clean_json(self):
        r = _parse_llm_recipe(self._recipe_json())
        self.assertIsNotNone(r)
        self.assertEqual(r.name, "Test Curd Rice")
        self.assertEqual(r.yield_qty, 2.0)
        self.assertEqual(r.source, "llm")
        self.assertEqual(len(r.ingredients), 2)
        self.assertEqual(r.ingredients[0].name, "rice")

    def test_strips_markdown_fence(self):
        r = _parse_llm_recipe("```json\n" + self._recipe_json() + "\n```")
        self.assertIsNotNone(r)
        self.assertEqual(r.name, "Test Curd Rice")

    def test_malformed_json_returns_none(self):
        self.assertIsNone(_parse_llm_recipe("not json at all"))
        self.assertIsNone(_parse_llm_recipe('{"name": "x"}'))  # no ingredients

    def test_qty_alias_fills_per_portion(self):
        from src.services.menu.schemas import AiRecipeIngredient
        ing = AiRecipeIngredient(name="rice", qty=15.0)
        self.assertEqual(ing.qty_per_portion, 15.0)
        zero = AiRecipeIngredient(name="x")
        self.assertEqual(zero.qty_per_portion, 0.0)


class ClassifyReorderTests(unittest.TestCase):
    def _line(self, item, status):
        return AiReorderLineIn(inventory_item_id=item, status=status,  # type: ignore[arg-type]
                               name="chicken", suggested_po_qty=5.0)

    def test_splits_missing_low_and_open(self):
        open_items = {U}
        lines = [
            self._line(T, "missing"),
            self._line(U, "missing"),   # already open -> idempotent
            self._line(V, "low"),
        ]
        missing, low, idem = _classify_reorder_lines(lines, open_items)
        self.assertEqual([l.inventory_item_id for l in missing], [T])
        self.assertEqual([l.inventory_item_id for l in low], [V])
        self.assertEqual(len(idem), 1)
        self.assertEqual(idem[0].inventory_item_id, U)
        self.assertIn("Open PO or PR", idem[0].reason)

    def test_none_id_lines_are_skipped_not_500(self):
        lines = [AiReorderLineIn(inventory_item_id=None, name="ghost")]
        missing, low, idem = _classify_reorder_lines(lines, set())
        self.assertEqual(len(idem), 1)
        self.assertIsNone(idem[0].inventory_item_id)
        self.assertEqual(missing + low, [])


class OrderQtyTests(unittest.TestCase):
    def test_client_suggestion_wins(self):
        line = AiReorderLineIn(inventory_item_id=T, suggested_po_qty=7.0)
        self.assertEqual(_order_qty_for(line, None), 7.0)

    def test_zero_falls_back_to_vendor_suggested(self):
        line = AiReorderLineIn(inventory_item_id=T, suggested_po_qty=0.0)
        row = {"suggested_qty": 12.0}
        self.assertEqual(_order_qty_for(line, row), 12.0)

    def test_zero_without_vendor_row_is_at_least_one(self):
        line = AiReorderLineIn(inventory_item_id=T, suggested_po_qty=0.0)
        self.assertEqual(_order_qty_for(line, None), 1.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
