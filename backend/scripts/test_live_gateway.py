import json
import urllib.request

def main():
    login_data = json.dumps({"email": "venaticfungus@gmail.com", "password": "121245@Forgot"}).encode("utf-8")
    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/auth/login",
        data=login_data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    res = urllib.request.urlopen(req)
    body = json.loads(res.read().decode("utf-8"))
    token = body["access_token"]
    print("✓ Successfully authenticated against backend auth service! Token obtained.")

    # 1. Fetch live tables from Organization microservice (:8101 via :8000)
    req2 = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/organization/tables",
        headers={"Authorization": f"Bearer {token}"},
    )
    res2 = urllib.request.urlopen(req2)
    tables = json.loads(res2.read().decode("utf-8"))
    print(f"✓ Live tables returned from PostgreSQL: {len(tables)} tables")
    for t in tables[:4]:
        print(f"  - Table {t['code']}: {t['name']} [shape={t.get('shape')}, seats={t['seats']}, status={t['status']}, pos=({t['position_x']}, {t['position_y']})]")

    # 2. Fetch live sections from Organization microservice
    req3 = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/organization/sections",
        headers={"Authorization": f"Bearer {token}"},
    )
    res3 = urllib.request.urlopen(req3)
    sections = json.loads(res3.read().decode("utf-8"))
    print(f"✓ Live sections returned from PostgreSQL: {len(sections)} sections")
    for s in sections:
        print(f"  - Section: {s['name']} (type={s['section_type']}, cap={s['capacity']})")

    # 3. Fetch live menu items from Menu microservice (:8102 via :8000)
    req4 = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/menu/items",
        headers={"Authorization": f"Bearer {token}"},
    )
    res4 = urllib.request.urlopen(req4)
    menu_items = json.loads(res4.read().decode("utf-8"))
    print(f"✓ Live menu items returned from PostgreSQL: {len(menu_items)} items")

if __name__ == "__main__":
    main()
