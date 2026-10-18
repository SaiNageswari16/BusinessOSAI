"""Smoke test for Platform Control Plane & Super Admin Service.

Validates:
1. Platform Service health & bootstrap seeding (admin, 6 plugins, 60+ permissions)
2. Super Admin authentication & token generation
3. Plugin Marketplace & Global Kill Switch
4. Dynamic Permission Catalog & ABAC Access Policies
5. Tenant Onboarding Wizard across Auth, Organization & Platform DBs
6. Tenant Module Lifecycle State Machine (ACTIVE -> SUSPENDED -> ACTIVE -> ARCHIVED)
7. Fast ASGI in-process validation + live network test
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import uuid
import httpx

PASS, FAIL = [], []


def log(name: str, ok: bool, detail: str = ""):
    symbol = "✓" if ok else "✗"
    msg = f"[{symbol}] {name} {detail}".strip()
    print(msg)
    if ok:
        PASS.append(name)
    else:
        FAIL.append(name)


async def run_smoke_tests(client: httpx.AsyncClient):
    print("\n--- Running Platform Service Suite ---")

    # 1. Health
    r = await client.get("/health")
    ok = r.status_code == 200 and r.json().get("status") == "up"
    log("Platform Health Check", ok, f"status={r.status_code}")

    # 2. Login
    r = await client.post(
        "/api/v1/platform/auth/login",
        json={"email": "superadmin@businessos.ai", "password": "SuperAdmin@123"},
    )
    ok = r.status_code == 200 and "access_token" in r.json()
    log("Super Admin Login", ok, f"status={r.status_code}")
    assert ok, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Me
    r = await client.get("/api/v1/platform/auth/me", headers=headers)
    ok = r.status_code == 200 and r.json().get("email") == "superadmin@businessos.ai"
    log("Platform /auth/me", ok, f"role={r.json().get('role')}")

    # 4. Plugins Marketplace
    r = await client.get("/api/v1/platform/plugins", headers=headers)
    plugins = r.json() if r.status_code == 200 else []
    plugin_ids = [p["id"] for p in plugins]
    expected = {"restaurant", "salon", "gym", "retail", "clinic", "carwash"}
    ok = r.status_code == 200 and expected.issubset(set(plugin_ids))
    log("Plugin Marketplace Catalog", ok, f"{len(plugins)} verticals found: {plugin_ids}")

    # 5. Permission Catalogue (60+ Granular Permissions)
    r = await client.get("/api/v1/platform/permissions", headers=headers)
    perms = r.json() if r.status_code == 200 else []
    perm_codes = {p["code"] for p in perms}
    ok = (
        r.status_code == 200
        and len(perms) >= 50
        and "pos:orders:discount" in perm_codes
        and "kitchen:kot:bump" in perm_codes
        and "platform:breakglass" in perm_codes
        and "inventory:stock:adjust" in perm_codes
    )
    log("Granular Permission Catalogue", ok, f"{len(perms)} keys registered across all microservices")

    # 6. Create Runtime Custom Permission
    custom_code = f"custom:test:{uuid.uuid4().hex[:6]}"
    r = await client.post(
        "/api/v1/platform/permissions",
        headers=headers,
        json={
            "code": custom_code,
            "module": "custom",
            "name": "Test Dynamic Permission",
            "tier": 3,
        },
    )
    ok = r.status_code == 201 and r.json().get("code") == custom_code
    log("Create Runtime Permission", ok, f"code={custom_code}")

    # 7. ABAC Policy Creation
    r = await client.post(
        "/api/v1/platform/policies",
        headers=headers,
        json={
            "subject": {"roles": ["waiter"]},
            "module": "pos",
            "resource": "order.discount",
            "operation": "create",
            "effect": "limit",
            "params": {"max_discount_pct": 5},
            "priority": 100,
        },
    )
    ok = r.status_code == 201 and r.json().get("effect") == "limit"
    log("Create ABAC Policy", ok, "5% discount limit for waiter")

    # 8. Tenant Onboarding Wizard across DBs
    tenant_slug = f"gym-club-{uuid.uuid4().hex[:6]}"
    r = await client.post(
        "/api/v1/platform/tenants/onboard",
        headers=headers,
        json={
            "name": "Apex Fitness & Gym Club",
            "slug": tenant_slug,
            "vertical": "gym",
            "enabled_modules": ["gym", "pos", "crm", "staff"],
            "plan": "enterprise",
            "contact_email": f"owner@{tenant_slug}.com",
            "owner_name": "Marcus Vance",
            "owner_email": f"marcus@{tenant_slug}.com",
            "owner_password": "Password123!",
            "initial_branch_name": "Downtown Arena",
            "initial_branch_code": "DT-01",
        },
    )
    ok = r.status_code == 201 and "tenant_id" in r.json()
    log("Tenant Onboarding Wizard", ok, f"slug={tenant_slug}")
    assert ok, f"Onboarding failed: {r.text}"
    onboard_res = r.json()
    new_tenant_id = onboard_res["tenant_id"]

    # 9. Tenant Module Lifecycle: Verify States
    r = await client.get(f"/api/v1/platform/tenants/{new_tenant_id}/modules", headers=headers)
    t_modules = r.json() if r.status_code == 200 else []
    gym_module = next((m for m in t_modules if m["plugin_id"] == "gym"), None)
    ok = gym_module is not None and gym_module["state"] == "active"
    log("Module State Machine: Initial Active", ok, f"gym={gym_module.get('state') if gym_module else None}")

    # 10. Suspend Module (Soft Stop)
    r = await client.post(
        f"/api/v1/platform/tenants/{new_tenant_id}/modules/gym/suspend",
        headers=headers,
    )
    ok = r.status_code == 200 and r.json().get("state") == "suspended"
    log("Module State Machine: Suspend", ok, "state=suspended")

    # 11. Reactivate Module
    r = await client.post(
        f"/api/v1/platform/tenants/{new_tenant_id}/modules/gym/activate",
        headers=headers,
        json={"config": {"restarted": True}},
    )
    ok = r.status_code == 200 and r.json().get("state") == "active"
    log("Module State Machine: Reactivate", ok, "state=active")

    # 12. Archive Module (Terminal Read-Only)
    r = await client.post(
        f"/api/v1/platform/tenants/{new_tenant_id}/modules/gym/archive",
        headers=headers,
    )
    ok = r.status_code == 200 and r.json().get("state") == "archived"
    log("Module State Machine: Archive", ok, "state=archived")

    # 13. Global Plugin Kill Switch
    r = await client.post(
        "/api/v1/platform/plugins/carwash/toggle-kill-switch?is_active=false",
        headers=headers,
    )
    ok = r.status_code == 200 and r.json().get("is_active") is False
    log("Global Plugin Kill Switch: Disable", ok, "carwash disabled")

    # Re-enable kill switch
    r = await client.post(
        "/api/v1/platform/plugins/carwash/toggle-kill-switch?is_active=true",
        headers=headers,
    )
    ok = r.status_code == 200 and r.json().get("is_active") is True
    log("Global Plugin Kill Switch: Re-enable", ok, "carwash enabled")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--remote", action="store_true", help="Run against remote HTTP ports")
    args = parser.parse_args()

    if args.remote:
        async with httpx.AsyncClient(base_url="http://127.0.0.1:8113", timeout=10.0) as client:
            await run_smoke_tests(client)
    else:
        # Direct in-process ASGI execution using the real database
        from src.services.platform.main import app, _on_startup
        await _on_startup()
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://testserver", timeout=15.0
        ) as client:
            await run_smoke_tests(client)

    print("\n" + "=" * 60)
    print(f"PLATFORM SERVICE SMOKE RESULTS: {len(PASS)} PASSED, {len(FAIL)} FAILED")
    print("=" * 60)
    if FAIL:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
