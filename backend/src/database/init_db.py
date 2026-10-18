"""Schema creation + idempotent seed.

No Alembic in this project. Schema changes are:
  1. Model changes, applied automatically by Base.metadata.create_all
  2. Inline `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in MIGRATION_STATEMENTS
     for columns added to existing tables after they first ship.
"""
import logging
import uuid
from datetime import date

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.database.base import Base
from src.database.session import engine
from src.models import (
    ApiKey,
    AuditLog,
    ChartOfAccount,
    CostCenter,
    Currency,
    FiscalYear,
    InventoryCategory,
    MenuCategory,
    NumberSeries,
    NotificationTemplate,
    Permission,
    Role,
    RolePermission,
    ServiceChargeConfig,
    StorageLocation,
    Tag,
    TaxCode,
    Tenant,
    UnitOfMeasure,
    User,
    UserRole,
)
from src.utils.security import (
    create_super_admin_role,
    hash_password,
    seed_permissions,
    seed_roles_for_tenant,
)

logger = logging.getLogger(__name__)
settings = get_settings()


# Columns added after a table first ships. Keep these idempotent.
MIGRATION_STATEMENTS: list[str] = [
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS token_number INTEGER;",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_charge NUMERIC(12,2) DEFAULT 0;",
    "ALTER TABLE bills ADD COLUMN IF NOT EXISTS customer_gstin VARCHAR(20);",
    "ALTER TABLE bills ADD COLUMN IF NOT EXISTS irn VARCHAR(100);",
    "ALTER TABLE bills ADD COLUMN IF NOT EXISTS irn_status VARCHAR(30);",
    "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS discrepancy_approved_by UUID;",
    "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS shift_type VARCHAR(20) DEFAULT 'MORNING';",
    "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS allow_negative_stock BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS short_name VARCHAR(50);",
    "ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS mrp NUMERIC(12,2);",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_visits INTEGER DEFAULT 0;",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spent NUMERIC(14,2) DEFAULT 0;",
    "ALTER TABLE kots ADD COLUMN IF NOT EXISTS course_number INTEGER;",
    "ALTER TABLE day_closes ADD COLUMN IF NOT EXISTS total_round_off NUMERIC(14,2) DEFAULT 0;",
]


async def _enum_labels(conn, type_name: str) -> set[str] | None:
    """Existing labels for a Postgres enum type, or None if the type is absent."""
    rows = await conn.execute(
        text(
            "SELECT e.enumlabel FROM pg_type t "
            "JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = :name"
        ),
        {"name": type_name},
    )
    found = {row[0] for row in rows}
    return found


async def sync_enum_labels(conn) -> list[str]:
    """Add any missing labels to enum types that already exist in the database.

    ``create_all`` only creates a type when it is absent, so a type that was
    created empty — or created before a member was added to the Python enum —
    silently rejects every insert. Comparing the metadata against the live type
    and issuing ``ADD VALUE IF NOT EXISTS`` keeps them in step. New types are
    left alone; ``create_all`` builds those with the full label set.
    """
    from sqlalchemy import Enum

    applied: list[str] = []
    seen: dict[str, list[str]] = {}
    for table in Base.metadata.tables.values():
        for column in table.columns:
            col_type = column.type
            if isinstance(col_type, Enum) and col_type.name:
                seen[col_type.name] = list(col_type.enums)

    for type_name, labels in seen.items():
        existing = await _enum_labels(conn, type_name)
        if existing is None:
            continue  # freshly created by create_all — already correct
        for label in labels:
            if label not in existing:
                stmt = f'ALTER TYPE "{type_name}" ADD VALUE IF NOT EXISTS \'{label}\''
                try:
                    await conn.execute(text(stmt))
                    applied.append(stmt)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Enum label skipped (%s): %s", stmt, exc)
    return applied


async def init_database() -> None:
    # 1. Create any missing tables from the model metadata
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 2. Bring pre-existing enum types up to date with the model definitions
    async with engine.begin() as conn:
        try:
            added = await sync_enum_labels(conn)
            if added:
                logger.info("Enum labels added: %d", len(added))
        except Exception as exc:  # noqa: BLE001
            logger.error("Enum sync failed: %s", exc)

    # 3. Apply inline column migrations for pre-existing tables
    async with engine.begin() as conn:
        for stmt in MIGRATION_STATEMENTS:
            try:
                await conn.execute(text(stmt))
            except Exception as exc:
                logger.warning("Migration skipped (%s): %s", stmt[:60], exc)

    # 3. Seed
    async with AsyncSession(engine, expire_on_commit=False) as db:
        try:
            await seed_permissions(db)
            await db.commit()
        except Exception as exc:
            await db.rollback()
            logger.error("Permission seed failed: %s", exc)
            raise

        if settings.seed_demo_data:
            try:
                await seed_demo_tenant(db)
                await db.commit()
            except Exception as exc:
                await db.rollback()
                logger.error("Demo seed failed: %s", exc)
                if settings.app_env == "production":
                    raise


async def seed_demo_tenant(db: AsyncSession) -> None:
    """Idempotent demo tenant: outlet, tables, stations, menu, recipes, stock."""
    # ── Tenant ──
    tenant = await db.scalar(select(Tenant).where(Tenant.slug == "demo"))
    if tenant is None:
        tenant = Tenant(
            name="Demo Restaurant Group",
            slug="demo",
            status="active",
            plan="trial",
            settings={"seeded": True},
        )
        db.add(tenant)
        await db.flush()

    # ── Owner user ──
    owner = await db.scalar(
        select(User).where(User.tenant_id == tenant.id, User.email == settings.demo_owner_email)
    )
    if owner is None:
        owner = User(
            tenant_id=tenant.id,
            email=settings.demo_owner_email,
            hashed_password=hash_password(settings.demo_owner_password),
            full_name="Demo Owner",
            phone="9999000001",
            is_tenant_owner=True,
            email_verified=True,
            status="active",
        )
        db.add(owner)
        await db.flush()

        role = await create_super_admin_role(db, tenant.id)
        db.add(UserRole(tenant_id=tenant.id, user_id=owner.id, role_id=role.id))
        await db.flush()

    # ── Standard roles ──
    await seed_roles_for_tenant(db, tenant.id)

    # ── Units of measure ──
    uoms = [
        ("Kilogram", "kg", "weight", 1000.0),
        ("Gram", "g", "weight", 1.0),
        ("Litre", "ltr", "volume", 1000.0),
        ("Millilitre", "ml", "volume", 1.0),
        ("Piece", "pcs", "count", 1.0),
        ("Dozen", "doz", "count", 12.0),
    ]
    uom_ids: dict[str, uuid.UUID] = {}
    for name, code, uom_type, factor in uoms:
        uom = await db.scalar(
            select(UnitOfMeasure).where(UnitOfMeasure.tenant_id == tenant.id, UnitOfMeasure.code == code)
        )
        if uom is None:
            uom = UnitOfMeasure(
                tenant_id=tenant.id, name=name, code=code,
                uom_type=uom_type, base_factor=factor,
            )
            db.add(uom)
            await db.flush()
        uom_ids[code] = uom.id

    # ── Outlet ──
    from src.models import Outlet, OutletType

    outlet = await db.scalar(
        select(Outlet).where(Outlet.tenant_id == tenant.id, Outlet.code == "MAIN")
    )
    if outlet is None:
        outlet = Outlet(
            tenant_id=tenant.id,
            name="Demo Restaurant — Main",
            code="MAIN",
            outlet_type=OutletType.DINE_IN,
            address_line1="12 MG Road",
            city="Bengaluru",
            state="Karnataka",
            state_code="29",
            pincode="560001",
            country="IN",
            phone="9886000000",
            email="main@demo.com",
            gstin="29ABCDE1234F1Z5",
            fssai_license="10021001000123",
            timezone="Asia/Kolkata",
            currency="INR",
            opening_time="10:00",
            closing_time="23:00",
        )
        db.add(outlet)
        await db.flush()

    # ── Tax codes ──
    tax_codes = [
        ("GST 0%", "GST0", None, 0, 0, 0, 0),
        ("GST 5%", "GST5", "9963", 2.5, 2.5, 0, 0),
        ("GST 12%", "GST12", "9963", 6, 6, 0, 0),
        ("GST 18%", "GST18", "2202", 9, 9, 0, 0),
    ]
    tax_code_ids: dict[str, uuid.UUID] = {}
    for name, code, hsn, cgst, sgst, igst, cess in tax_codes:
        tc = await db.scalar(
            select(TaxCode).where(TaxCode.tenant_id == tenant.id, TaxCode.code == code)
        )
        if tc is None:
            tc = TaxCode(
                tenant_id=tenant.id, outlet_id=outlet.id, name=name, code=code,
                hsn_code=hsn, tax_type="GST",
                cgst_pct=cgst, sgst_pct=sgst, igst_pct=igst, cess_pct=cess,
            )
            db.add(tc)
            await db.flush()
        tax_code_ids[code] = tc.id

    # ── Sections ──
    from src.models import Section, SectionType

    section_specs = [
        ("AC Hall", SectionType.AC_HALL, 40),
        ("Non-AC Hall", SectionType.NON_AC, 24),
        ("Terrace", SectionType.TERRACE, 16),
        ("Bar", SectionType.BAR, 12),
    ]
    section_ids: dict[str, uuid.UUID] = {}
    for idx, (name, stype, cap) in enumerate(section_specs):
        sec = await db.scalar(
            select(Section).where(
                Section.tenant_id == tenant.id, Section.outlet_id == outlet.id, Section.name == name
            )
        )
        if sec is None:
            sec = Section(
                tenant_id=tenant.id, outlet_id=outlet.id, name=name,
                section_type=stype, capacity=cap, sort_order=idx,
            )
            db.add(sec)
            await db.flush()
        section_ids[name] = sec.id

    # ── Tables ──
    from src.models import RestaurantTable

    table_counts = {"AC Hall": 10, "Non-AC Hall": 6, "Terrace": 4, "Bar": 6}
    for sec_name, count in table_counts.items():
        sec_id = section_ids[sec_name]
        prefix = sec_name.split()[0][:2].upper()
        for i in range(1, count + 1):
            code = f"{prefix}{i:02d}"
            exists = await db.scalar(
                select(RestaurantTable.id).where(
                    RestaurantTable.outlet_id == outlet.id, RestaurantTable.code == code
                )
            )
            if not exists:
                db.add(RestaurantTable(
                    tenant_id=tenant.id, outlet_id=outlet.id, section_id=sec_id,
                    name=f"{sec_name} {i}", code=code,
                    seats=4, min_covers=1, max_covers=6,
                ))
    await db.flush()

    # ── Kitchen stations ──
    from src.models import KitchenStation, StationType

    station_specs = [
        ("Tandoor", StationType.TANDOOR, 8, 12),
        ("Fry Station", StationType.FRY, 10, 8),
        ("Grill", StationType.GRILL, 6, 15),
        ("Curry / Gravy", StationType.CURRY, 10, 10),
        ("Salad & Chutney", StationType.SALAD, 8, 5),
        ("Dessert", StationType.DESSERT, 5, 7),
        ("Beverage", StationType.BEVERAGE, 12, 3),
        ("Counter", StationType.COUNTER, 15, 2),
    ]
    station_ids: dict[str, uuid.UUID] = {}
    for name, stype, capacity, prep in station_specs:
        st = await db.scalar(
            select(KitchenStation.id).where(
                KitchenStation.tenant_id == tenant.id,
                KitchenStation.outlet_id == outlet.id,
                KitchenStation.name == name,
            )
        )
        if st is None:
            station = KitchenStation(
                tenant_id=tenant.id, outlet_id=outlet.id, name=name,
                station_type=stype, capacity_concurrent=capacity, avg_prep_minutes=prep,
            )
            db.add(station)
            await db.flush()
            st = station.id
        station_ids[name] = st

    # ── Menu categories ──
    cat_specs = [
        ("Starters", "starters", "food", "Tandoor"),
        ("Main Course", "main-course", "food", "Curry / Gravy"),
        ("Breads", "breads", "food", "Tandoor"),
        ("Rice & Biryani", "rice-biryani", "food", "Curry / Gravy"),
        ("Beverages", "beverages", "beverage", "Beverage"),
        ("Desserts", "desserts", "dessert", "Dessert"),
    ]
    cat_ids: dict[str, uuid.UUID] = {}
    for idx, (name, slug, ctype, _station) in enumerate(cat_specs):
        cat = await db.scalar(
            select(MenuCategory.id).where(
                MenuCategory.tenant_id == tenant.id, MenuCategory.slug == slug
            )
        )
        if cat is None:
            category = MenuCategory(
                tenant_id=tenant.id, outlet_id=outlet.id, name=name, slug=slug,
                category_type=ctype, sort_order=idx,
            )
            db.add(category)
            await db.flush()
            cat = category.id
        cat_ids[name] = cat

    # ── Menu items ──
    from src.models import ItemType, MenuItem

    item_specs = [
        # (cat, name, code, type, price, cost, station, tax, prep)
        ("Starters", "Paneer Tikka", "ST01", "veg", 280, 110, "Tandoor", "GST5", 12),
        ("Starters", "Chicken 65", "ST02", "non_veg", 320, 140, "Fry Station", "GST5", 10),
        ("Starters", "Gobi Manchurian", "ST03", "veg", 240, 95, "Fry Station", "GST5", 9),
        ("Main Course", "Paneer Butter Masala", "MC01", "veg", 340, 145, "Curry / Gravy", "GST5", 14),
        ("Main Course", "Butter Chicken", "MC02", "non_veg", 420, 200, "Curry / Gravy", "GST5", 16),
        ("Main Course", "Dal Makhani", "MC03", "veg", 260, 90, "Curry / Gravy", "GST5", 12),
        ("Breads", "Butter Naan", "BR01", "veg", 60, 20, "Tandoor", "GST5", 5),
        ("Breads", "Tandoori Roti", "BR02", "veg", 40, 13, "Tandoor", "GST5", 4),
        ("Rice & Biryani", "Chicken Biryani", "RB01", "non_veg", 380, 175, "Curry / Gravy", "GST5", 18),
        ("Rice & Biryani", "Veg Pulao", "RB02", "veg", 260, 100, "Curry / Gravy", "GST5", 12),
        ("Beverages", "Masala Lemon Soda", "BV01", "veg", 120, 40, "Beverage", "GST12", 3),
        ("Beverages", "Fresh Lime Water", "BV02", "veg", 90, 30, "Beverage", "GST12", 3),
        ("Desserts", "Gulab Jamun", "DS01", "veg", 140, 45, "Dessert", "GST5", 4),
        ("Desserts", "Ice Cream Sundae", "DS02", "veg", 180, 60, "Dessert", "GST5", 5),
    ]
    item_ids: dict[str, uuid.UUID] = {}
    for cat, name, code, itype, price, cost, station, tax, prep in item_specs:
        item = await db.scalar(
            select(MenuItem.id).where(
                MenuItem.tenant_id == tenant.id, MenuItem.code == code
            )
        )
        if item is None:
            mi = MenuItem(
                tenant_id=tenant.id, outlet_id=outlet.id,
                category_id=cat_ids[cat], name=name, code=code,
                item_type=ItemType(itype), base_price=price, cost_price=cost,
                kitchen_station_id=station_ids[station],
                tax_code_id=tax_code_ids[tax], hsn_code="9963",
                prep_time_minutes=prep, track_inventory=True,
            )
            db.add(mi)
            await db.flush()
            item = mi.id
        item_ids[code] = item

    # ── Variants ──
    from src.models import MenuItemVariant

    variant_specs = [
        ("MC01", [("Half", 240, True), ("Full", 340, False)]),
        ("MC02", [("Half", 300, True), ("Full", 420, False)]),
        ("RB01", [("Regular", 380, True), ("Family", 720, False)]),
    ]
    for code, variants in variant_specs:
        for name, price, is_default in variants:
            exists = await db.scalar(
                select(MenuItemVariant.id).where(
                    MenuItemVariant.tenant_id == tenant.id,
                    MenuItemVariant.menu_item_id == item_ids[code],
                    MenuItemVariant.name == name,
                )
            )
            if not exists:
                db.add(MenuItemVariant(
                    tenant_id=tenant.id, menu_item_id=item_ids[code],
                    name=name, price=price, is_default=is_default,
                ))
    await db.flush()

    # ── Addon group on Paneer Tikka ──
    from src.models import MenuItemAddon, MenuItemAddonGroup

    grp = await db.scalar(
        select(MenuItemAddonGroup.id).where(
            MenuItemAddonGroup.tenant_id == tenant.id,
            MenuItemAddonGroup.menu_item_id == item_ids["ST01"],
        )
    )
    if grp is None:
        group = MenuItemAddonGroup(
            tenant_id=tenant.id, menu_item_id=item_ids["ST01"],
            name="Add Cheese", min_selections=0, max_selections=2,
        )
        db.add(group)
        await db.flush()
        grp = group.id
        for addon_name, price in [("Extra Cheese", 60), ("Cheese Stuffing", 80)]:
            db.add(MenuItemAddon(
                tenant_id=tenant.id, addon_group_id=grp,
                name=addon_name, price=price, is_veg=True,
            ))
        await db.flush()

    # ── Inventory categories, items and opening stock ──
    from src.models import (
        InventoryItem,
        InventoryItemType,
        InventoryStock,
        StorageLocation,
        StorageLocationType,
    )

    loc = await db.scalar(
        select(StorageLocation.id).where(
            StorageLocation.tenant_id == tenant.id,
            StorageLocation.outlet_id == outlet.id,
            StorageLocation.name == "Main Kitchen Store",
        )
    )
    if loc is None:
        location = StorageLocation(
            tenant_id=tenant.id, outlet_id=outlet.id,
            name="Main Kitchen Store", location_type=StorageLocationType.KITCHEN_STORE,
        )
        db.add(location)
        await db.flush()
        loc = location.id

    ing_specs = [
        ("Paneer", "ING-PANEER", "kg", 40, 320),
        ("Chicken", "ING-CHICK", "kg", 60, 260),
        ("Butter", "ING-BUTR", "kg", 15, 520),
        ("Tomato", "ING-TOMT", "kg", 30, 40),
        ("Cream", "ING-CREAM", "ltr", 20, 180),
        ("Onion", "ING-ONIN", "kg", 45, 35),
    ]
    ing_ids: dict[str, uuid.UUID] = {}
    for name, code, uom_code, qty, cost in ing_specs:
        ing = await db.scalar(
            select(InventoryItem.id).where(
                InventoryItem.tenant_id == tenant.id, InventoryItem.code == code
            )
        )
        if ing is None:
            item = InventoryItem(
                tenant_id=tenant.id, outlet_id=outlet.id, name=name, code=code,
                item_type=InventoryItemType.INGREDIENT, uom_id=uom_ids[uom_code],
                default_location_id=loc, track_stock=True,
                reorder_level=qty * 0.2, reorder_qty=qty * 0.5,
                standard_cost=cost,
            )
            db.add(item)
            await db.flush()
            ing = item.id
        ing_ids[code] = ing

        stock = await db.scalar(
            select(InventoryStock.id).where(
                InventoryStock.tenant_id == tenant.id,
                InventoryStock.outlet_id == outlet.id,
                InventoryStock.inventory_item_id == ing,
                InventoryStock.location_id == loc,
            )
        )
        if stock is None:
            db.add(InventoryStock(
                tenant_id=tenant.id, outlet_id=outlet.id,
                inventory_item_id=ing, location_id=loc,
                qty_on_hand=qty, qty_available=qty,
                avg_cost=cost, last_cost=cost,
            ))
    await db.flush()

    # ── Recipes so stock deduction is demonstrable ──
    from src.models import Recipe, RecipeLine

    recipe_specs = [
        ("MC01", "Paneer Butter Masala — Full", [
            ("ING-PANEER", 0.25, 3), ("ING-BUTR", 0.05, 5),
            ("ING-TOMT", 0.15, 10), ("ING-CREAM", 0.05, 5),
        ]),
        ("MC02", "Butter Chicken — Full", [
            ("ING-CHICK", 0.35, 5), ("ING-BUTR", 0.06, 5),
            ("ING-TOMT", 0.15, 10), ("ING-CREAM", 0.06, 5),
        ]),
    ]
    for item_code, recipe_name, lines in recipe_specs:
        exists = await db.scalar(
            select(Recipe.id).where(
                Recipe.tenant_id == tenant.id,
                Recipe.menu_item_id == item_ids[item_code],
            )
        )
        if exists is None:
            recipe = Recipe(
                tenant_id=tenant.id, menu_item_id=item_ids[item_code],
                name=recipe_name, yield_qty=1, yield_uom_id=uom_ids["pcs"],
                instructions="Standard prep. Verify tempering before plating.",
            )
            db.add(recipe)
            await db.flush()
            for ing_code, qty, wastage in lines:
                db.add(RecipeLine(
                    tenant_id=tenant.id, recipe_id=recipe.id,
                    ingredient_id=ing_ids[ing_code], qty=qty,
                    uom_id=uom_ids["kg"], wastage_pct=wastage,
                ))
    await db.flush()

    # ── Service charge + currency ──
    sc = await db.scalar(
        select(ServiceChargeConfig.id).where(ServiceChargeConfig.tenant_id == tenant.id)
    )
    if sc is None:
        db.add(ServiceChargeConfig(
            tenant_id=tenant.id, outlet_id=outlet.id,
            name="Service Charge", pct=5.0,
            applies_to="subtotal_after_discount", is_active=True,
        ))

    base_currency = await db.scalar(
        select(Currency.id).where(Currency.tenant_id == tenant.id, Currency.code == "INR")
    )
    if base_currency is None:
        db.add(Currency(
            tenant_id=tenant.id, code="INR", name="Indian Rupee",
            symbol="₹", exchange_rate=1.0, is_base=True,
        ))

    # ── Fiscal year ──
    fy = await db.scalar(select(FiscalYear.id).where(FiscalYear.tenant_id == tenant.id))
    if fy is None:
        db.add(FiscalYear(
            tenant_id=tenant.id, name="FY 2026-27",
            start_date=date(2026, 4, 1), end_date=date(2027, 3, 31),
            status="open", is_current=True,
        ))

    # ── Number series ──
    from src.services.number_series import ensure_series_for_outlet
    await ensure_series_for_outlet(db, tenant.id, outlet.id)

    # ── Notification templates ──
    templates = [
        ("Order Placed", "order_placed", "whatsapp",
         "Hi {{customer_name}}, your order {{order_number}} has been received. We'll keep you posted!"),
        ("Order Ready", "order_ready", "whatsapp",
         "Good news {{customer_name}} — order {{order_number}} is ready. Token: {{token_number}}."),
        ("Bill Generated", "bill_generated", "whatsapp",
         "Thank you for dining with us, {{customer_name}}! Bill {{bill_number}} — total {{grand_total}}."),
        ("Reservation Confirmed", "reservation_confirmed", "whatsapp",
         "Hi {{customer_name}}, your table for {{covers}} on {{reserved_from}} is confirmed."),
        ("Feedback Request", "feedback_request", "whatsapp",
         "How was your meal, {{customer_name}}? Rate us: {{feedback_link}}"),
        ("Birthday Wish", "birthday_wish", "whatsapp",
         "Happy Birthday {{customer_name}}! Here's {{discount_code}} for a treat on us."),
    ]
    for name, event, channel, body in templates:
        exists = await db.scalar(
            select(NotificationTemplate.id).where(
                NotificationTemplate.tenant_id == tenant.id,
                NotificationTemplate.event == event,
            )
        )
        if not exists:
            db.add(NotificationTemplate(
                tenant_id=tenant.id, outlet_id=outlet.id,
                name=name, event=event, channel=channel, body=body,
            ))

    await db.flush()
    logger.info("Demo tenant seed complete (tenant=%s outlet=%s)", tenant.id, outlet.id)
