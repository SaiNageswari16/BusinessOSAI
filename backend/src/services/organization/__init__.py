"""Organization service — tenants, outlets, sections, tables, UoM, cost centres.

Owns its own database (``restaurantos_organization``). Other services keep
only the ``outlet_id`` / ``section_id`` / ``table_id`` UUIDs they need; they
never join to these tables.
"""
