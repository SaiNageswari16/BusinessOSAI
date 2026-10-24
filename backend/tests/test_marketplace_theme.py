import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from src.models import Tenant, User, TenantStatus, UserStatus
from src.models.marketplace import MarketplaceThemeSettings
from src.utils.security import create_access_token, hash_password


async def create_test_tenant_and_user(db, name_prefix: str = "Test Org"):
    suffix = uuid.uuid4().hex[:6]
    tenant = Tenant(
        slug=f"org-{suffix}",
        name=f"{name_prefix} {suffix}",
        plan="enterprise",
        status=TenantStatus.ACTIVE,
    )
    db.add(tenant)
    await db.flush()

    user = User(
        tenant_id=tenant.id,
        email=f"admin_{suffix}@testorg.com",
        password_hash=hash_password("SecretPass123!"),
        full_name=f"Admin {suffix}",
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
        permissions=["all", "manage:marketplace", "view:marketplace"],
    )
    return tenant, user, token


@pytest.mark.asyncio
async def test_get_default_theme_when_no_settings_saved(async_client: AsyncClient, db):
    """When an organization has not configured a theme, default settings must be returned."""
    tenant, user, token = await create_test_tenant_and_user(db, "Fresh Store")
    headers = {"Authorization": f"Bearer {token}"}

    response = await async_client.get("/api/v1/marketplace/theme", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["theme_id"] == "speed_mart"
    assert data["store_name"] == "ExpressMart"
    assert data["primary_color"] == "#7C3AED"
    assert data["accent_color"] == "#F59E0B"
    assert data["bg_tone"] == "#FDF4FF"
    assert data["updated_at"] is None


@pytest.mark.asyncio
async def test_save_and_retrieve_theme_for_organization(async_client: AsyncClient, db):
    """An organization can save custom theme settings and retrieve them accurately."""
    tenant, user, token = await create_test_tenant_and_user(db, "Nursery Haven")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "theme_id": "nursery_botanics",
        "store_name": "Botanical Haven",
        "tagline": "Rare Exotic Houseplants & Living Terrariums",
        "sector": "Nursery & Botanics",
        "announcement_text": "🌿 Free shipping on orders over ₹999",
        "support_phone": "+91 98765 43210",
        "support_email": "orders@botanicalhaven.in",
        "primary_color": "#15803D",
        "accent_color": "#D97706",
        "bg_tone": "#F0FDF4",
    }

    put_resp = await async_client.put("/api/v1/marketplace/theme", json=payload, headers=headers)
    assert put_resp.status_code == 200, put_resp.text
    put_data = put_resp.json()
    assert put_data["message"] == "Storefront theme settings updated successfully"
    saved_theme = put_data["theme"]

    assert saved_theme["theme_id"] == "nursery_botanics"
    assert saved_theme["store_name"] == "Botanical Haven"
    assert saved_theme["tagline"] == "Rare Exotic Houseplants & Living Terrariums"
    assert saved_theme["primary_color"] == "#15803D"
    assert saved_theme["accent_color"] == "#D97706"
    assert saved_theme["bg_tone"] == "#F0FDF4"
    assert saved_theme["updated_at"] is not None

    # Retrieve again via GET
    get_resp = await async_client.get("/api/v1/marketplace/theme", headers=headers)
    assert get_resp.status_code == 200
    get_data = get_resp.json()
    assert get_data["theme_id"] == "nursery_botanics"
    assert get_data["store_name"] == "Botanical Haven"
    assert get_data["bg_tone"] == "#F0FDF4"
    assert get_data["primary_color"] == "#15803D"


@pytest.mark.asyncio
async def test_theme_settings_isolated_between_organizations(async_client: AsyncClient, db):
    """One organization's theme changes must NEVER affect or leak to another organization."""
    # Org A: Fashion Boutique
    tenant_a, user_a, token_a = await create_test_tenant_and_user(db, "Fashion Studio")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Org B: Tech Mega Mart
    tenant_b, user_b, token_b = await create_test_tenant_and_user(db, "Mega Tech")
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Org A sets theme to fashion_boutique
    await async_client.put(
        "/api/v1/marketplace/theme",
        json={
            "theme_id": "fashion_boutique",
            "store_name": "Haute Couture Studio",
            "tagline": "Exclusive Luxury Apparel",
            "primary_color": "#BE185D",
            "accent_color": "#4338CA",
            "bg_tone": "#FFF1F2",
        },
        headers=headers_a,
    )

    # Org B sets theme to mega_market
    await async_client.put(
        "/api/v1/marketplace/theme",
        json={
            "theme_id": "mega_market",
            "store_name": "Silicon Hypermarket",
            "tagline": "Next-Gen Electronics & Computing",
            "primary_color": "#1D4ED8",
            "accent_color": "#059669",
            "bg_tone": "#EFF6FF",
        },
        headers=headers_b,
    )

    # Verify Org A's theme is completely isolated
    res_a = await async_client.get("/api/v1/marketplace/theme", headers=headers_a)
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert data_a["theme_id"] == "fashion_boutique"
    assert data_a["store_name"] == "Haute Couture Studio"
    assert data_a["primary_color"] == "#BE185D"
    assert data_a["bg_tone"] == "#FFF1F2"

    # Verify Org B's theme is completely isolated
    res_b = await async_client.get("/api/v1/marketplace/theme", headers=headers_b)
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["theme_id"] == "mega_market"
    assert data_b["store_name"] == "Silicon Hypermarket"
    assert data_b["primary_color"] == "#1D4ED8"
    assert data_b["bg_tone"] == "#EFF6FF"

    # Org B updates again, Org A must still remain intact
    await async_client.put(
        "/api/v1/marketplace/theme",
        json={"store_name": "Silicon Hypermarket V2", "bg_tone": "#F8FAFC"},
        headers=headers_b,
    )

    res_a_check = await async_client.get("/api/v1/marketplace/theme", headers=headers_a)
    assert res_a_check.json()["store_name"] == "Haute Couture Studio"
    assert res_a_check.json()["bg_tone"] == "#FFF1F2"


@pytest.mark.asyncio
async def test_unauthenticated_request_rejected(async_client: AsyncClient):
    """Requests without authentication or with forged tokens must be rejected with 401."""
    # No auth header
    res_get = await async_client.get("/api/v1/marketplace/theme")
    assert res_get.status_code == 401

    res_put = await async_client.put("/api/v1/marketplace/theme", json={"theme_id": "speed_mart"})
    assert res_put.status_code == 401

    # Invalid Bearer token
    bad_headers = {"Authorization": "Bearer invalid.token.payload"}
    res_bad = await async_client.get("/api/v1/marketplace/theme", headers=bad_headers)
    assert res_bad.status_code == 401


@pytest.mark.asyncio
async def test_cannot_override_other_tenant_via_payload(async_client: AsyncClient, db):
    """Passing another organization's ID in payload must NOT affect that organization."""
    tenant_a, user_a, token_a = await create_test_tenant_and_user(db, "Target Org")
    tenant_b, user_b, token_b = await create_test_tenant_and_user(db, "Attacker Org")

    # Set Org A to initial theme
    await async_client.put(
        "/api/v1/marketplace/theme",
        json={"theme_id": "nursery_botanics", "store_name": "Target Store", "bg_tone": "#F0FDF4"},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    # User B attempts to overwrite Org A by injecting tenant_id or organization_id
    await async_client.put(
        "/api/v1/marketplace/theme",
        json={
            "tenant_id": str(tenant_a.id),
            "organization_id": str(tenant_a.id),
            "store_name": "Malicious Spoof",
            "bg_tone": "#000000",
        },
        headers={"Authorization": f"Bearer {token_b}"},
    )

    # Verify Target Org A was not touched
    check_a = await async_client.get("/api/v1/marketplace/theme", headers={"Authorization": f"Bearer {token_a}"})
    assert check_a.json()["store_name"] == "Target Store"
    assert check_a.json()["bg_tone"] == "#F0FDF4"


@pytest.mark.asyncio
async def test_partial_update_preserves_existing_fields(async_client: AsyncClient, db):
    """Updating only bg_tone or primary_color preserves previously set store_name and theme_id."""
    tenant, user, token = await create_test_tenant_and_user(db, "Partial Org")
    headers = {"Authorization": f"Bearer {token}"}

    # Initial save
    await async_client.put(
        "/api/v1/marketplace/theme",
        json={
            "theme_id": "speed_mart",
            "store_name": "Quick Drop",
            "tagline": "Fast Delivery",
            "primary_color": "#111827",
            "accent_color": "#E11D48",
            "bg_tone": "#FFF1F2",
        },
        headers=headers,
    )

    # Partial update: only bg_tone and accent_color
    update_res = await async_client.put(
        "/api/v1/marketplace/theme",
        json={"bg_tone": "#F0FDF4", "accent_color": "#16A34A"},
        headers=headers,
    )
    assert update_res.status_code == 200
    theme = update_res.json()["theme"]
    assert theme["bg_tone"] == "#F0FDF4"
    assert theme["accent_color"] == "#16A34A"
    # Preserved fields
    assert theme["theme_id"] == "speed_mart"
    assert theme["store_name"] == "Quick Drop"
    assert theme["tagline"] == "Fast Delivery"
    assert theme["primary_color"] == "#111827"


@pytest.mark.asyncio
async def test_public_store_theme_resolution_by_slug(async_client: AsyncClient, db):
    """Public clients without auth can retrieve a store's theme by passing its store slug."""
    tenant, user, token = await create_test_tenant_and_user(db, "Public Floral")
    # Save theme settings
    await async_client.put(
        "/api/v1/marketplace/theme",
        json={
            "theme_id": "nursery_botanics",
            "store_name": "Public Floral Botanics",
            "tagline": "Rare Exotic Houseplants",
            "primary_color": "#15803D",
            "accent_color": "#D97706",
            "bg_tone": "#FAF8F5",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    # Public request with NO Authorization header
    resp = await async_client.get(f"/api/v1/marketplace/theme?store={tenant.slug}")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["theme_id"] == "nursery_botanics"
    assert data["store_name"] == "Public Floral Botanics"
    assert data["primary_color"] == "#15803D"
    assert data["bg_tone"] == "#FAF8F5"


@pytest.mark.asyncio
async def test_public_store_theme_resolution_by_tenant_uuid(async_client: AsyncClient, db):
    """Public clients without auth can retrieve a store's theme using the tenant UUID."""
    tenant, user, token = await create_test_tenant_and_user(db, "UUID Store")
    await async_client.put(
        "/api/v1/marketplace/theme",
        json={
            "theme_id": "pharma_medical",
            "store_name": "UUID Pharma",
            "primary_color": "#0284C7",
            "bg_tone": "#F0F9FF",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    # Public request using tenant.id
    resp = await async_client.get(f"/api/v1/marketplace/theme?store={tenant.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["theme_id"] == "pharma_medical"
    assert data["store_name"] == "UUID Pharma"
    assert data["primary_color"] == "#0284C7"
    assert data["bg_tone"] == "#F0F9FF"


@pytest.mark.asyncio
async def test_public_store_theme_unknown_slug_returns_404(async_client: AsyncClient, db):
    """An unknown store slug must return 404 and NEVER fall back to another tenant."""
    # Ensure at least one tenant exists
    await create_test_tenant_and_user(db, "Existing Tenant")

    resp = await async_client.get("/api/v1/marketplace/theme?store=non-existent-store-slug-999")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_public_store_theme_leakage_prevention(async_client: AsyncClient, db):
    """Switching between store slugs returns only the requested store's theme with no leakage."""
    tenant_a, _, token_a = await create_test_tenant_and_user(db, "Store Alpha")
    tenant_b, _, token_b = await create_test_tenant_and_user(db, "Store Beta")

    await async_client.put(
        "/api/v1/marketplace/theme",
        json={"theme_id": "fashion_boutique", "store_name": "Alpha Boutique", "bg_tone": "#FFF1F2"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    await async_client.put(
        "/api/v1/marketplace/theme",
        json={"theme_id": "speed_mart", "store_name": "Beta Quick", "bg_tone": "#FDF4FF"},
        headers={"Authorization": f"Bearer {token_b}"},
    )

    # Public query for Alpha
    resp_a = await async_client.get(f"/api/v1/marketplace/theme?store={tenant_a.slug}")
    assert resp_a.status_code == 200
    assert resp_a.json()["theme_id"] == "fashion_boutique"
    assert resp_a.json()["store_name"] == "Alpha Boutique"
    assert resp_a.json()["bg_tone"] == "#FFF1F2"

    # Public query for Beta
    resp_b = await async_client.get(f"/api/v1/marketplace/theme?store={tenant_b.slug}")
    assert resp_b.status_code == 200
    assert resp_b.json()["theme_id"] == "speed_mart"
    assert resp_b.json()["store_name"] == "Beta Quick"
    assert resp_b.json()["bg_tone"] == "#FDF4FF"


@pytest.mark.asyncio
async def test_public_store_endpoint_exposes_only_public_fields(async_client: AsyncClient, db):
    """Public theme response must not leak private data (tokens, passwords, tenant secrets)."""
    tenant, user, token = await create_test_tenant_and_user(db, "Security Audit Org")
    resp = await async_client.get(f"/api/v1/marketplace/theme?store={tenant.slug}")
    assert resp.status_code == 200
    data = resp.json()

    allowed_fields = {
        "theme_id", "store_name", "tagline", "sector",
        "announcement_text", "support_phone", "support_email",
        "primary_color", "accent_color", "bg_tone", "updated_at",
        "store_slug", "is_published"
    }
    returned_fields = set(data.keys())
    assert returned_fields.issubset(allowed_fields)
    assert "password_hash" not in data
    assert "token" not in data
    assert "subscription_expires_at" not in data


@pytest.mark.asyncio
async def test_update_store_slug_and_publishing_status(async_client: AsyncClient, db):
    """A merchant can update their public store slug and publish/unpublish toggle."""
    tenant, user, token = await create_test_tenant_and_user(db, "Green Flora")
    headers = {"Authorization": f"Bearer {token}"}
    suffix = uuid.uuid4().hex[:6]
    custom_slug = f"greenflora-{suffix}"

    payload = {
        "theme_id": "nursery_botanics",
        "store_name": "Green Flora Organics",
        "store_slug": custom_slug,
        "is_published": True,
    }
    put_resp = await async_client.put("/api/v1/marketplace/theme", json=payload, headers=headers)
    assert put_resp.status_code == 200, put_resp.text
    put_data = put_resp.json()["theme"]
    assert put_data["store_slug"] == custom_slug
    assert put_data["is_published"] is True

    # Public shopper can resolve via new slug
    pub_resp = await async_client.get(f"/api/v1/marketplace/theme?store={custom_slug}")
    assert pub_resp.status_code == 200
    pub_data = pub_resp.json()
    assert pub_data["store_name"] == "Green Flora Organics"
    assert pub_data["store_slug"] == custom_slug


@pytest.mark.asyncio
async def test_unpublished_store_returns_404_to_public_shoppers(async_client: AsyncClient, db):
    """When a merchant unpublishes their store, public shoppers receive 404 Not Found."""
    tenant, user, token = await create_test_tenant_and_user(db, "Private Store")
    headers = {"Authorization": f"Bearer {token}"}

    # Set is_published to False
    put_resp = await async_client.put(
        "/api/v1/marketplace/theme",
        json={"is_published": False},
        headers=headers
    )
    assert put_resp.status_code == 200

    # Public theme lookup must return 404
    pub_theme_resp = await async_client.get(f"/api/v1/marketplace/theme?store={tenant.slug}")
    assert pub_theme_resp.status_code == 404
    assert "unpublished" in pub_theme_resp.text.lower()

    # Public products lookup must also return 404
    pub_prod_resp = await async_client.get(f"/api/v1/inventory/public/products?store={tenant.slug}")
    assert pub_prod_resp.status_code == 404


@pytest.mark.asyncio
async def test_store_slug_validation_and_uniqueness(async_client: AsyncClient, db):
    """Store slug updates must reject invalid formats, reserved names, and duplicates."""
    tenant1, user1, token1 = await create_test_tenant_and_user(db, "Store One")
    tenant2, user2, token2 = await create_test_tenant_and_user(db, "Store Two")
    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}

    # 1. Invalid slug format (spaces or symbols)
    inv_resp = await async_client.put(
        "/api/v1/marketplace/theme",
        json={"store_slug": "Invalid Slug!"},
        headers=headers1
    )
    assert inv_resp.status_code == 400

    # 2. Reserved system word
    res_resp = await async_client.put(
        "/api/v1/marketplace/theme",
        json={"store_slug": "admin"},
        headers=headers1
    )
    assert res_resp.status_code == 400

    # 3. Duplicate slug
    dup_resp = await async_client.put(
        "/api/v1/marketplace/theme",
        json={"store_slug": tenant1.slug},
        headers=headers2
    )
    assert dup_resp.status_code == 409


