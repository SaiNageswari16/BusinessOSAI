import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from src.models import Tenant, User, TenantStatus, UserStatus, EntityStatus
from src.models.inventory import Product, ProductCategory, InventoryTransaction
from src.models.marketplace import (
    MarketplaceVendor, MarketplaceProduct, MarketplaceOrder,
    MarketplaceOrderItem, MarketplacePayout, MarketplacePromotion
)
from src.utils.security import create_access_token, hash_password


async def create_isolated_tenant_and_user(db, name_prefix: str = "Org"):
    suffix = uuid.uuid4().hex[:6]
    tenant = Tenant(
        slug=f"store-{suffix}",
        name=f"{name_prefix} {suffix}",
        plan="enterprise",
        status=TenantStatus.ACTIVE,
    )
    db.add(tenant)
    await db.flush()

    user = User(
        tenant_id=tenant.id,
        email=f"owner_{suffix}@organization.com",
        password_hash=hash_password("SuperSecret123!"),
        full_name=f"Owner {suffix}",
        status=UserStatus.ACTIVE,
        is_tenant_owner=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(tenant)
    await db.refresh(user)

    token = create_access_token(
        subject=str(user.id),
        tenant_id=str(tenant.id),
        permissions=["all", "manage:marketplace", "view:marketplace", "manage:inventory", "view:inventory"],
    )
    return tenant, user, token


async def create_isolated_product(db, tenant_id: uuid.UUID, name: str, sku: str, on_hand: int = 50, price: float = 199.0):
    cat = ProductCategory(
        tenant_id=tenant_id,
        name=f"Cat-{sku}",
        category_code=f"C-{uuid.uuid4().hex[:4].upper()}",
        status=EntityStatus.ACTIVE,
    )
    db.add(cat)
    await db.flush()

    prod = Product(
        tenant_id=tenant_id,
        category_id=cat.id,
        name=name,
        sku=sku,
        selling_price=price,
        online_price=price,
        purchase_price=price * 0.5,
        initial_stock=on_hand,
        on_hand_stock=on_hand,
        reserved_stock=0,
        rack_location=f"Aisle-4-{sku}",
        status=EntityStatus.ACTIVE,
    )
    db.add(prod)
    await db.commit()
    await db.refresh(prod)
    await db.refresh(cat)
    return prod, cat


@pytest.mark.asyncio
async def test_authenticated_products_tenant_isolation(async_client: AsyncClient, db):
    """Authenticated staff of Organization A can only view and manage Organization A products."""
    tenant_a, _, token_a = await create_isolated_tenant_and_user(db, "Alpha Store")
    tenant_b, _, token_b = await create_isolated_tenant_and_user(db, "Beta Store")

    prod_a, _ = await create_isolated_product(db, tenant_a.id, "Alpha Organic Apples", "SKU-ALPHA-01", 100, 150.0)
    prod_b, _ = await create_isolated_product(db, tenant_b.id, "Beta Hydroponic Basil", "SKU-BETA-01", 50, 80.0)

    # 1. Query as Org A
    headers_a = {"Authorization": f"Bearer {token_a}"}
    resp_a = await async_client.get("/api/v1/marketplace/products", headers=headers_a)
    assert resp_a.status_code == 200, resp_a.text
    items_a = resp_a.json()

    a_ids = [p["id"] for p in items_a]
    assert str(prod_a.id) in a_ids
    assert str(prod_b.id) not in a_ids

    # Verify sensitive margins and rack locations are visible to authenticated staff of own org
    item_own = next(p for p in items_a if p["id"] == str(prod_a.id))
    assert item_own["cost_price"] == 75.0
    assert item_own["rack_location"] == f"Aisle-4-SKU-ALPHA-01"

    # 2. Query as Org B
    headers_b = {"Authorization": f"Bearer {token_b}"}
    resp_b = await async_client.get("/api/v1/marketplace/products", headers=headers_b)
    assert resp_b.status_code == 200, resp_b.text
    items_b = resp_b.json()

    b_ids = [p["id"] for p in items_b]
    assert str(prod_b.id) in b_ids
    assert str(prod_a.id) not in b_ids


@pytest.mark.asyncio
async def test_public_storefront_isolation_by_store_slug(async_client: AsyncClient, db):
    """Public storefront requests scoped to a store slug only return that store's active products and categories."""
    tenant_a, _, _ = await create_isolated_tenant_and_user(db, "Green Grocer")
    tenant_b, _, _ = await create_isolated_tenant_and_user(db, "Tech Haven")

    prod_a, cat_a = await create_isolated_product(db, tenant_a.id, "Organic Avocados", "SKU-AVO-01", 30, 250.0)
    prod_b, cat_b = await create_isolated_product(db, tenant_b.id, "Mechanical Keyboard", "SKU-KEY-01", 15, 3500.0)

    # Public products for Store A
    resp_pub_a = await async_client.get(f"/api/v1/inventory/public/products?store={tenant_a.slug}")
    assert resp_pub_a.status_code == 200
    data_pub_a = resp_pub_a.json()
    p_ids_a = [p["id"] for p in data_pub_a["items"]]
    assert str(prod_a.id) in p_ids_a
    assert str(prod_b.id) not in p_ids_a

    # Public products for Store B
    resp_pub_b = await async_client.get(f"/api/v1/inventory/public/products?store={tenant_b.slug}")
    assert resp_pub_b.status_code == 200
    data_pub_b = resp_pub_b.json()
    p_ids_b = [p["id"] for p in data_pub_b["items"]]
    assert str(prod_b.id) in p_ids_b
    assert str(prod_a.id) not in p_ids_b

    # Public categories for Store A
    cat_resp_a = await async_client.get(f"/api/v1/inventory/public/categories?store={tenant_a.slug}")
    assert cat_resp_a.status_code == 200
    cat_items_a = cat_resp_a.json()["items"]
    c_ids_a = [c["id"] for c in cat_items_a]
    assert str(cat_a.id) in c_ids_a
    assert str(cat_b.id) not in c_ids_a


@pytest.mark.asyncio
async def test_unknown_store_slug_returns_404_no_fallback(async_client: AsyncClient, db):
    """Non-existent store slugs must return HTTP 404 without falling back to any existing tenant."""
    unknown_slug = f"non-existent-store-{uuid.uuid4().hex[:8]}"

    # 1. Public products
    resp_products = await async_client.get(f"/api/v1/inventory/public/products?store={unknown_slug}")
    assert resp_products.status_code == 404, resp_products.text
    assert f"Store '{unknown_slug}' not found" in resp_products.json()["detail"]

    # 2. Public categories
    resp_cats = await async_client.get(f"/api/v1/inventory/public/categories?store={unknown_slug}")
    assert resp_cats.status_code == 404
    assert f"Store '{unknown_slug}' not found" in resp_cats.json()["detail"]

    # 3. Marketplace products
    resp_mp = await async_client.get(f"/api/v1/marketplace/products?store={unknown_slug}")
    assert resp_mp.status_code == 404
    assert f"Store '{unknown_slug}' not found" in resp_mp.json()["detail"]


@pytest.mark.asyncio
async def test_product_id_guessing_protection(async_client: AsyncClient, db):
    """Attempting to access a product ID belonging to Store B from Store A returns HTTP 404."""
    tenant_a, _, _ = await create_isolated_tenant_and_user(db, "Store One")
    tenant_b, _, _ = await create_isolated_tenant_and_user(db, "Store Two")

    prod_b, _ = await create_isolated_product(db, tenant_b.id, "Secret Recipe Tea", "SKU-TEA-B", 20, 120.0)

    # Looking up Store B's product under Store A context must return 404
    resp_guess = await async_client.get(f"/api/v1/inventory/public/products/{prod_b.id}?store={tenant_a.slug}")
    assert resp_guess.status_code == 404

    # Looking up under Store B context succeeds
    resp_legit = await async_client.get(f"/api/v1/inventory/public/products/{prod_b.id}?store={tenant_b.slug}")
    assert resp_legit.status_code == 200
    assert resp_legit.json()["id"] == str(prod_b.id)


@pytest.mark.asyncio
async def test_cross_tenant_order_rejection(async_client: AsyncClient, db):
    """Placing an order containing a product from another organization must be rejected with HTTP 400."""
    tenant_a, _, _ = await create_isolated_tenant_and_user(db, "Store Alpha")
    tenant_b, _, _ = await create_isolated_tenant_and_user(db, "Store Beta")

    prod_a, _ = await create_isolated_product(db, tenant_a.id, "Alpha Bread", "SKU-BREAD", 50, 40.0)
    prod_b, _ = await create_isolated_product(db, tenant_b.id, "Beta Olive Oil", "SKU-OIL", 25, 600.0)
    prod_a_id = prod_a.id
    prod_b_id = prod_b.id

    # Order on Store A attempting to include Product B
    order_payload = {
        "customer_name": "Shopper Dave",
        "customer_email": "dave@shopper.com",
        "customer_phone": "+91 99887 76655",
        "shipping_address": "456 Market St, Floor 2",
        "store": tenant_a.slug,
        "items": [
            {"product_id": str(prod_a_id), "quantity": 1, "price": 40.0},
            {"product_id": str(prod_b_id), "quantity": 1, "price": 600.0},
        ],
        "total_amount": 640.0,
    }

    resp = await async_client.post("/api/v1/marketplace/orders", json=order_payload)
    assert resp.status_code == 400, resp.text
    detail = resp.json()["detail"]
    assert "Cross-tenant order rejected" in detail
    assert "Beta Olive Oil" in detail

    # Verify no stock was reserved or changed on either product
    await db.rollback()
    check_a = await db.scalar(select(Product).where(Product.id == prod_a_id).execution_options(populate_existing=True))
    check_b = await db.scalar(select(Product).where(Product.id == prod_b_id).execution_options(populate_existing=True))
    assert check_a.reserved_stock == 0
    assert check_b.reserved_stock == 0


@pytest.mark.asyncio
async def test_atomic_stock_reservation_and_concurrency(async_client: AsyncClient, db):
    """Order creation atomically reserves physical inventory and logs an ONLINE_RESERVATION transaction."""
    tenant, _, token = await create_isolated_tenant_and_user(db, "Fresh Dairy")
    tenant_slug = tenant.slug
    prod, _ = await create_isolated_product(db, tenant.id, "Fresh Cow Milk 1L", "SKU-MILK-01", 10, 65.0)
    prod_id = prod.id

    # Order 4 units
    order_payload = {
        "customer_name": "Priya Sharma",
        "customer_email": "priya@example.com",
        "store": tenant_slug,
        "items": [
            {"product_id": str(prod_id), "quantity": 4, "price": 65.0}
        ],
        "total_amount": 260.0,
    }

    order_resp = await async_client.post("/api/v1/marketplace/orders", json=order_payload)
    assert order_resp.status_code == 200, order_resp.text
    order_data = order_resp.json()
    order_id = order_data["id"]

    # Verify stock reservation in database
    await db.rollback()
    p_updated = await db.scalar(select(Product).where(Product.id == prod_id).execution_options(populate_existing=True))
    assert p_updated.on_hand_stock == 10
    assert p_updated.reserved_stock == 4  # 4 reserved, 6 available

    # Verify audit transaction
    tx = await db.scalar(
        select(InventoryTransaction).where(
            InventoryTransaction.product_id == prod_id,
            InventoryTransaction.transaction_type == "ONLINE_RESERVATION"
        )
    )
    assert tx is not None
    assert tx.quantity == 4
    assert tx.before_reserved == 0
    assert tx.after_reserved == 4
    assert tx.reference_id == order_id

    # Attempting to order 7 units (more than 6 available) must fail
    fail_payload = {
        "customer_name": "Greedy Buyer",
        "store": tenant_slug,
        "items": [
            {"product_id": str(prod_id), "quantity": 7, "price": 65.0}
        ],
        "total_amount": 455.0,
    }
    fail_resp = await async_client.post("/api/v1/marketplace/orders", json=fail_payload)
    assert fail_resp.status_code == 400
    assert "Insufficient available stock" in fail_resp.json()["detail"]


@pytest.mark.asyncio
async def test_order_dispatch_stock_deduction_and_idempotency(async_client: AsyncClient, db):
    """Dispatch releases reserved stock, decrements physical on_hand stock, and prevents double deduction."""
    tenant, _, token = await create_isolated_tenant_and_user(db, "Electronics Hub")
    headers = {"Authorization": f"Bearer {token}"}

    prod, _ = await create_isolated_product(db, tenant.id, "Wireless Earbuds", "SKU-BUDS-01", 20, 1999.0)
    prod_id = prod.id

    # 1. Place order for 3 units
    order_payload = {
        "customer_name": "Rahul Verma",
        "store": tenant.slug,
        "items": [{"product_id": str(prod_id), "quantity": 3, "price": 1999.0}],
        "total_amount": 5997.0,
    }
    order_resp = await async_client.post("/api/v1/marketplace/orders", json=order_payload)
    order_id = order_resp.json()["id"]

    await db.rollback()
    p_check = await db.scalar(select(Product).where(Product.id == prod_id).execution_options(populate_existing=True))
    assert p_check.on_hand_stock == 20
    assert p_check.reserved_stock == 3

    # 2. Dispatch order
    dispatch_resp = await async_client.put(
        f"/api/v1/marketplace/orders/{order_id}/dispatch",
        json={"courier": "BlueDart Express", "tracking_number": "TRK-BLUEDART-991"},
        headers=headers
    )
    assert dispatch_resp.status_code == 200, dispatch_resp.text

    # Verify physical stock deducted and reservation released
    await db.rollback()
    p_dispatched = await db.scalar(select(Product).where(Product.id == prod_id).execution_options(populate_existing=True))
    assert p_dispatched.on_hand_stock == 17  # 20 - 3 = 17 physical on hand
    assert p_dispatched.reserved_stock == 0  # Reservation cleared

    # Verify dispatch transaction logged
    disp_tx = await db.scalar(
        select(InventoryTransaction).where(
            InventoryTransaction.product_id == prod_id,
            InventoryTransaction.transaction_type == "ONLINE_DISPATCH"
        )
    )
    assert disp_tx is not None
    assert disp_tx.quantity == 3
    assert disp_tx.before_on_hand == 20
    assert disp_tx.after_on_hand == 17
    assert disp_tx.before_reserved == 3
    assert disp_tx.after_reserved == 0

    # 3. Call dispatch a second time: must NOT deduct stock again (idempotent guard)
    second_dispatch = await async_client.put(
        f"/api/v1/marketplace/orders/{order_id}/dispatch",
        json={"courier": "BlueDart Express"},
        headers=headers
    )
    assert second_dispatch.status_code == 200
    assert "already been dispatched" in second_dispatch.json()["message"]

    await db.rollback()
    p_still_17 = await db.scalar(select(Product).where(Product.id == prod_id).execution_options(populate_existing=True))
    assert p_still_17.on_hand_stock == 17  # Not 14!


@pytest.mark.asyncio
async def test_order_cancellation_releases_reservation(async_client: AsyncClient, db):
    """Pre-dispatch cancellation releases reserved stock back to available pool without altering on-hand."""
    tenant, _, token = await create_isolated_tenant_and_user(db, "Book Haven")
    headers = {"Authorization": f"Bearer {token}"}

    prod, _ = await create_isolated_product(db, tenant.id, "Hardcover Fiction", "SKU-BOOK-01", 15, 450.0)
    prod_id = prod.id

    # Place order for 5 books
    order_payload = {
        "customer_name": "Anita Roy",
        "store": tenant.slug,
        "items": [{"product_id": str(prod_id), "quantity": 5, "price": 450.0}],
        "total_amount": 2250.0,
    }
    order_resp = await async_client.post("/api/v1/marketplace/orders", json=order_payload)
    order_id = order_resp.json()["id"]

    # Cancel order
    cancel_resp = await async_client.put(f"/api/v1/marketplace/orders/{order_id}/cancel", headers=headers)
    assert cancel_resp.status_code == 200

    await db.rollback()
    p_cancelled = await db.scalar(select(Product).where(Product.id == prod_id).execution_options(populate_existing=True))
    assert p_cancelled.on_hand_stock == 15  # Unchanged
    assert p_cancelled.reserved_stock == 0  # Released back

    # Verify release transaction logged
    rel_tx = await db.scalar(
        select(InventoryTransaction).where(
            InventoryTransaction.product_id == prod_id,
            InventoryTransaction.transaction_type == "ONLINE_RESERVATION_RELEASE"
        )
    )
    assert rel_tx is not None
    assert rel_tx.quantity == 5


@pytest.mark.asyncio
async def test_cross_tenant_order_access_denial(async_client: AsyncClient, db):
    """Organization A staff cannot access or dispatch Organization B's orders."""
    tenant_a, _, token_a = await create_isolated_tenant_and_user(db, "Store A")
    tenant_b, _, token_b = await create_isolated_tenant_and_user(db, "Store B")

    prod_b, _ = await create_isolated_product(db, tenant_b.id, "Beta Item", "SKU-B-ITEM", 10, 100.0)

    # Order on Store B
    order_resp = await async_client.post(
        "/api/v1/marketplace/orders",
        json={
            "customer_name": "Store B Shopper",
            "store": tenant_b.slug,
            "items": [{"product_id": str(prod_b.id), "quantity": 1, "price": 100.0}],
            "total_amount": 100.0,
        }
    )
    order_b_id = order_resp.json()["id"]

    # Org A tries to fetch Order B by ID
    resp_fetch = await async_client.get(
        f"/api/v1/marketplace/orders/{order_b_id}",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert resp_fetch.status_code == 404

    # Org A tries to dispatch Order B
    resp_disp = await async_client.put(
        f"/api/v1/marketplace/orders/{order_b_id}/dispatch",
        json={"courier": "Fast Courier"},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert resp_disp.status_code == 404

    # Org B can fetch Order B successfully
    resp_b_legit = await async_client.get(
        f"/api/v1/marketplace/orders/{order_b_id}",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert resp_b_legit.status_code == 200
    assert resp_b_legit.json()["id"] == order_b_id
