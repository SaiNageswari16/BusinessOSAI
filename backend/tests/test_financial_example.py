import uuid
import pytest


async def register_tenant(client, tenant_name: str, admin_email: str, admin_password: str, company_name: str):
    payload = {
        "tenant_name": tenant_name,
        "tenant_slug": tenant_name.lower().replace(" ", "-"),
        "admin_name": "Admin User",
        "admin_email": admin_email,
        "admin_password": admin_password,
        "company_name": company_name,
    }
    r = await client.post("/api/v1/auth/register-tenant", json=payload)
    assert r.status_code == 201
    return r.json()


@pytest.mark.asyncio
async def test_create_and_list_fiscal_year(async_client, db):
    client = async_client
    tenant_slug = f"test-tenant-{uuid.uuid4().hex[:6]}"
    admin_email = f"admin+{uuid.uuid4().hex[:6]}@example.com"
    admin_password = "TestPass123!"
    company_name = "TestCo"

    # Register tenant and get tokens
    token_resp = await register_tenant(client, tenant_slug, admin_email, admin_password, company_name)
    access_token = token_resp["access_token"]

    headers = {"Authorization": f"Bearer {access_token}"}

    # discover the created company from DB
    result = await db.execute("SELECT id FROM companies WHERE tenant_id = (SELECT id FROM tenants WHERE slug = :slug)", {"slug": tenant_slug})
    row = result.first()
    assert row is not None
    company_id = row[0]

    # Create a fiscal year
    fy_payload = {
        "company_id": str(company_id),
        "name": "FY2026",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "status": "open",
    }

    r = await client.post("/api/v1/erp/fiscal-years", json=fy_payload, headers=headers)
    assert r.status_code == 201
    fy = r.json()
    assert fy["name"] == "FY2026"

    # List fiscal years and ensure the created one appears
    r = await client.get(f"/api/v1/erp/fiscal-years?company_id={company_id}", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 1
    assert any(item["name"] == "FY2026" for item in data["items"]) 
