"""Predefined recipe catalog.

A chef starting a new dish should not have to re-type a bill of materials
that the kitchen already knows. This module holds the library of standard
recipes — Chicken Dum Biryani, Butter Chicken, Dal Makhani — with each
ingredient line pointing at an inventory item **by code**, not by UUID.

Why codes rather than UUIDs: inventory item UUIDs are allocated per tenant as
rows are created, so hardcoding a UUID here would bind the seed to one
particular database. Codes are stable, human-meaningful, and let the seed
resolve the UUID at runtime against the live inventory service. If an
ingredient does not exist yet in inventory the line is skipped rather than
failing the whole recipe — the chef sees a partial breakdown and can add the
missing ingredient by hand.

Quantities are expressed per portion (one plate / one glass), in the
inventory item's own unit of measure. ``wastage_pct`` is the expected
trim/shrinkage loss, so the *required* quantity a kitchen must pull is
``qty * (1 + wastage_pct / 100)``.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class CatalogLine:
    """One ingredient of a predefined recipe."""

    inventory_code: str
    """Inventory item code, e.g. ``INV-CHKN``. Resolved to a UUID at seed time."""

    qty: float
    """Quantity per portion, in the inventory item's unit of measure."""

    unit: str
    """Human-readable unit label, e.g. ``g``, ``ml``, ``piece``."""

    wastage_pct: float = 0.0
    """Expected trim/shrinkage loss percentage. Drives the required-pull qty."""

    is_optional: bool = False
    """Optional lines are shown in the breakdown but do not block a recipe."""

    note: str = ""
    """Short prep note shown next to the ingredient."""

    name: str = ""
    """Human-readable ingredient name, used for search matching when the
    inventory item's name cannot be resolved. Falls back to the inventory
    item's own name (fetched live) if this is empty."""


@dataclass(frozen=True)
class CatalogRecipe:
    """A predefined recipe template."""

    name: str
    code: str
    """Catalog code. Prefixed ``CAT-`` so the search endpoint can identify
    catalog rows and distinguish them from ordinary menu items."""

    description: str
    item_type: str
    """``veg`` / ``non_veg`` / ``beverage`` — matches the menu item's type."""

    base_price: float
    """Suggested selling price per portion, in rupees."""

    yield_qty: float = 1
    """How many portions one batch of this recipe yields."""

    instructions: str = ""
    """Method summary shown to the chef."""

    tags: tuple[str, ...] = field(default=())
    """Free-text search tags (cuisine, technique, occasion)."""

    lines: tuple[CatalogLine, ...] = field(default=())

    def search_blob(self) -> str:
        """All the text a keyword search should match against."""
        return " ".join(
            [
                self.name,
                self.description,
                self.instructions,
                " ".join(self.tags),
                " ".join(l.note for l in self.lines),
            ]
        ).lower()


# ─── The catalog ─────────────────────────────────────────────────────────────
#
# Quantities are per portion and reflect a real kitchen's proportions:
# a 450 g plate of chicken biryani carries ~180 g of boneless chicken and
# ~120 g of dry rice (which swells, hence rice is always the largest line).

CATALOG: tuple[CatalogRecipe, ...] = (
    CatalogRecipe(
        name="Hyderabadi Dum Biryani (Chicken)",
        code="CAT-BIRYANI-CHICK",
        description=(
            "Layered basmati and marinated chicken slow-cooked under a sealed "
            "dum lid, finished with fried onion and saffron milk."
        ),
        item_type="non_veg",
        base_price=380,
        yield_qty=1,
        instructions=(
            "Marinate chicken 4h with yoghurt, ginger-garlic and garam masala. "
            "Layer soaked basmati and chicken, seal, dum-cook 45 min on low. "
            "Rest 10 min before serving."
        ),
        tags=("biryani", "hyderabadi", "dum", "rice", "non-veg", "main course"),
        lines=(
            CatalogLine("INV-CHKN", 180, "g", wastage_pct=12, name="chicken",
                        note="Marinated chicken, trimmed of excess fat"),
            CatalogLine("INV-RICE", 120, "g", wastage_pct=3, name="basmati rice",
                        note="Basmati, soaked 30 min"),
            CatalogLine("INV-CRM", 40, "ml", wastage_pct=2, name="cream",
                        note="Saffron milk poured over the top"),
            CatalogLine("INV-TOM", 60, "g", wastage_pct=20, name="tomato",
                        note="Tomato for the masala layer"),
            CatalogLine("INV-SPC", 8, "g", wastage_pct=1, name="garam masala",
                        note="Garam masala, whole spices"),
            CatalogLine("INV-BTR", 15, "g", wastage_pct=0, name="butter",
                        note="Butter for the rice layer"),
        ),
    ),
    CatalogRecipe(
        name="Butter Chicken",
        code="CAT-BUTTER-CHICKEN",
        description=(
            "Tandoor-charred chicken simmered in a rich tomato and butter "
            "gravy, finished with a swirl of cream."
        ),
        item_type="non_veg",
        base_price=420,
        yield_qty=1,
        instructions=(
            "Char chicken to 70% done, finish in a tomato-butter gravy, "
            "reduce to the desired consistency, finish with cream."
        ),
        tags=("curry", "butter", "gravy", "chicken", "non-veg", "main course"),
        lines=(
            CatalogLine("INV-CHKN", 200, "g", wastage_pct=10, name="chicken",
                        note="Boneless thigh, cut into 3 cm dice"),
            CatalogLine("INV-CRM", 60, "ml", wastage_pct=2, name="cream",
                        note="Cream for the final swirl"),
            CatalogLine("INV-TOM", 120, "g", wastage_pct=25, name="tomato",
                        note="Tomato, puréed for the gravy"),
            CatalogLine("INV-BTR", 30, "g", wastage_pct=0, name="butter",
                        note="Butter for the gravy"),
            CatalogLine("INV-SPC", 6, "g", wastage_pct=1, name="garam masala",
                        note="Garam masala"),
        ),
    ),
    CatalogRecipe(
        name="Paneer Tikka",
        code="CAT-PANEER-TIKKA",
        description=(
            "Marinated cottage cheese and peppers charred in the tandoor, "
            "served with mint chutney and onion."
        ),
        item_type="veg",
        base_price=320,
        yield_qty=1,
        instructions=(
            "Marinate paneer cubes 2h in yoghurt and spices. Skewer with "
            "peppers, grill 12 min until charred."
        ),
        tags=("tandoor", "paneer", "skewer", "starter", "veg"),
        lines=(
            CatalogLine("INV-PANEER", 150, "g", wastage_pct=5, name="paneer",
                        note="Paneer cubes, drained"),
            CatalogLine("INV-CRM", 30, "ml", wastage_pct=2, name="cream",
                        note="Yoghurt-marinade base"),
            CatalogLine("INV-TOM", 40, "g", wastage_pct=20, name="tomato",
                        note="Pepper and onion for the skewer"),
            CatalogLine("INV-SPC", 5, "g", wastage_pct=1, name="garam masala",
                        note="Garam masala, chaat masala"),
        ),
    ),
    CatalogRecipe(
        name="Dal Makhani",
        code="CAT-DAL-MAKHANI",
        description=(
            "Black lentils simmered overnight on charcoal with butter and "
            "cream until thick and smoky."
        ),
        item_type="veg",
        base_price=260,
        yield_qty=1,
        instructions=(
            "Soak urad dal overnight, simmer 6h on charcoal, add butter and "
            "cream, finish with cream swirl."
        ),
        tags=("dal", "lentils", "curry", "main course", "veg"),
        lines=(
            CatalogLine("INV-CRM", 40, "ml", wastage_pct=2, name="cream",
                        note="Cream for the finish"),
            CatalogLine("INV-BTR", 25, "g", wastage_pct=0, name="butter",
                        note="Butter, added in stages"),
            CatalogLine("INV-TOM", 80, "g", wastage_pct=25, name="tomato",
                        note="Tomato, cooked down into the dal"),
            CatalogLine("INV-SPC", 5, "g", wastage_pct=1, name="garam masala",
                        note="Garam masala"),
        ),
    ),
    CatalogRecipe(
        name="Garlic Naan",
        code="CAT-GARLIC-NAAN",
        description=(
            "Tandoor-baked leavened flatbread brushed with garlic butter and "
            "fresh coriander."
        ),
        item_type="veg",
        base_price=90,
        yield_qty=1,
        instructions=(
            "Roll the dough thin, bake in the tandoor at 400°C for 90 s, "
            "brush with garlic butter straight off the tandoor."
        ),
        tags=("bread", "naan", "tandoor", "side", "veg"),
        lines=(
            CatalogLine("INV-BTR", 12, "g", wastage_pct=0, name="butter",
                        note="Garlic butter for brushing"),
            CatalogLine("INV-CRM", 5, "ml", wastage_pct=2, name="cream",
                        note="Milk and yoghurt in the dough"),
        ),
    ),
    CatalogRecipe(
        name="Butter Naan",
        code="CAT-BUTTER-NAAN",
        description="Tandoor-baked naan brushed with butter.",
        item_type="veg",
        base_price=80,
        yield_qty=1,
        instructions="Bake in the tandoor, brush with butter, serve hot.",
        tags=("bread", "naan", "tandoor", "side", "veg"),
        lines=(
            CatalogLine("INV-BTR", 15, "g", wastage_pct=0, name="butter",
                        note="Butter for brushing"),
            CatalogLine("INV-CRM", 5, "ml", wastage_pct=2, name="cream",
                        note="Milk and yoghurt in the dough"),
        ),
    ),
    CatalogRecipe(
        name="Gulab Jamun with Rabri",
        code="CAT-GULAB-JAMUN",
        description=(
            "Warm milk-solids dumplings soaked in cardamom syrup, served "
            "with thick rabri."
        ),
        item_type="veg",
        base_price=180,
        yield_qty=1,
        instructions="Fry the dumplings, soak in warm cardamom sugar syrup, serve with rabri.",
        tags=("dessert", "sweet", "indian", "veg"),
        lines=(
            CatalogLine("INV-CRM", 50, "ml", wastage_pct=2, name="cream",
                        note="Rabri for serving"),
            CatalogLine("INV-SPC", 2, "g", wastage_pct=0, name="cardamom",
                        note="Cardamom for the syrup"),
        ),
    ),
    CatalogRecipe(
        name="Cold Coffee with Ice Cream",
        code="CAT-COLD-COFFEE",
        description=(
            "Blended cold coffee topped with a scoop of vanilla ice cream "
            "and a chocolate drizzle."
        ),
        item_type="veg",
        base_price=180,
        yield_qty=1,
        instructions="Blend coffee, milk and ice. Top with ice cream.",
        tags=("beverage", "cold", "coffee", "dessert", "veg"),
        lines=(
            CatalogLine("INV-CRM", 60, "ml", wastage_pct=2, name="cream",
                        note="Milk for the blend"),
            CatalogLine("INV-BTR", 5, "g", wastage_pct=0, name="butter",
                        note="Sugar for the blend"),
        ),
    ),
    CatalogRecipe(
        name="Fresh Lime Soda",
        code="CAT-LIME-SODA",
        description="Chilled lime soda with a pinch of salt and mint.",
        item_type="veg",
        base_price=90,
        yield_qty=1,
        instructions="Muddle lime, add soda, top with mint.",
        tags=("beverage", "cold", "lime", "veg"),
        lines=(
            CatalogLine("INV-CRM", 30, "ml", wastage_pct=2, name="cream",
                        note="Sweetener for the syrup"),
        ),
    ),
)


def catalog_by_code() -> dict[str, CatalogRecipe]:
    """Catalog recipes indexed by their ``CAT-`` code."""
    return {r.code: r for r in CATALOG}
