import asyncio
import httpx

async def test_table_status():
    async with httpx.AsyncClient() as client:
        # Login
        login_res = await client.post(
            "http://127.0.0.1:8000/api/v1/auth/login",
            json={"email": "venaticfungus@gmail.com", "password": "121245@Forgot"}
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Update status using table code "T1"
        res1 = await client.put(
            "http://127.0.0.1:8000/api/v1/organization/tables/T1/status",
            json={"status": "occupied"},
            headers=headers
        )
        print("Status update with code 'T1':", res1.status_code, res1.json().get("status") if res1.status_code == 200 else res1.text)

        # 2. Reset back to "free"
        res2 = await client.put(
            "http://127.0.0.1:8000/api/v1/organization/tables/T1/status",
            json={"status": "available"},
            headers=headers
        )
        print("Status update back to 'available':", res2.status_code, res2.json().get("status") if res2.status_code == 200 else res2.text)

asyncio.run(test_table_status())
