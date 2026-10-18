"""Menu service — categories, items, variants, addons, modifiers, combos, pricing.

Owns ``restaurantos_menu``. Recipes reference inventory items by UUID only;
inventory deducts stock from the recipe lines it reads through this service.
"""
