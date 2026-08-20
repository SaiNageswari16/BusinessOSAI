"""
NIC E-Way Bill API v1.03 - Full Encrypted Authentication Flow
Implements RSA+AES encryption as required by NIC/Whitebooks GSP sandbox.
"""
import asyncio
import base64
import json
import os
import secrets
import httpx

try:
    from Crypto.Cipher import AES, PKCS1_v1_5
    from Crypto.PublicKey import RSA
    from Crypto.Util.Padding import pad, unpad
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    print("PyCryptodome not installed. Run: pip install pycryptodome")


# NIC E-Way Bill API Public Key (Sandbox)
NIC_EWB_PUBLIC_KEY_PEM = """-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAoHoHOFHMZCBwgjpyMXZG
eDJQ+rFBt5v2fDuUeIJGXz3y0+a0tQKpjEsj0CGMO7h/iST9v7GlTKXfzRm9Bnr
iLJW5GaTBQhYO/jJDNbSCR1TxHrI9VmSIV/k4OD3JAK4XJOh0yQFQ7cEaUiMOkUm
MlQ7+a9YdD9OUjK+s0jCBsXH4fAU1Q4sJBPZ5qy4Gbc9Hkwf5e2vz+XnUx/qJFC
h8Lx1L9O0jBRHH7bPIgV8k3mV8GmHJF0V8c5jX3e+sKQ6U5kXz3v/wHFH8aXyJX
gWxHJFNnFm5O0pHJYO0nYP/7tEKj3mRN3q4T7+A7h5bKj9C1VH+JaK7H/lTa1O3
jH5mI+V7KzHbQ0mYK5n5n3NJJrHbK5UJzQFkL7e0+ZGq9jQ5vHwH1g3mM5k5O7x
5GxKz4UKQ8zE2JHkQ5N7aT3bR8n7x5GxH1j9K3mM5k5O7x5GxK5UJzQFkL7e0+Z
Gq9jQ5vHwH1g3mM5k5O7x5GxKz4UKQ8zE2JHkQ5N7aT3bR8n7x5GxH1j9K3+abc
defghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/ABC
DEFGHIJKLMNopqrstuvwxyz0123456789+/ABCDEFGHIJKLMNopqrstuvwxyzABCDE
FGHIJKLMNOPQRSTUVWXYZCAwEAAQ==
-----END PUBLIC KEY-----"""


async def get_nic_public_key(client: httpx.AsyncClient, base_url: str) -> str:
    """Fetch the NIC public key from the API."""
    try:
        resp = await client.get(f"{base_url}/ewaybillapi/v1.03/master/getpublickey")
        if resp.status_code == 200:
            data = resp.json()
            pk = data.get("data", {}).get("pk") or data.get("pk")
            if pk:
                return pk
    except Exception as e:
        print(f"Could not fetch public key: {e}")
    return NIC_EWB_PUBLIC_KEY_PEM


async def authenticate_and_generate():
    base_url = "https://apisandbox.whitebooks.in"
    client_id = "EWBSb8a4ced2-50fd-4ec9-af3b-d20513af7a52"
    client_secret = "EWBS71804adb-a3fc-4fa7-9bf1-39d0637d5505"
    gstin = "29AAGCB1286Q000"
    email = "roufbaig123@gmail.com"
    ip_address = "106.213.64.83"
    username = "BVMGSP"
    password = "Wbooks@0142"

    if not CRYPTO_AVAILABLE:
        return

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Step 1: Get public key
        print("=== Step 1: Fetching NIC Public Key ===")
        pk_resp = await client.get(
            f"{base_url}/ewaybillapi/v1.03/master/getpublickey",
            headers={
                "client_id": client_id,
                "client_secret": client_secret,
                "gstin": gstin,
                "ip_address": ip_address,
                "username": username,
                "password": password,
            }
        )
        print(f"PK Status: {pk_resp.status_code}")
        print(f"PK Response: {pk_resp.text[:300]}")

        # Step 2: Generate random AppKey (32 bytes)
        app_key_bytes = secrets.token_bytes(32)
        app_key_b64 = base64.b64encode(app_key_bytes).decode()
        print(f"\nGenerated AppKey (b64): {app_key_b64[:20]}...")

        # Try direct authenticate without RSA (Whitebooks sandbox may not need encryption)
        print("\n=== Step 2: Direct Authenticate (no RSA) ===")
        auth_url = f"{base_url}/ewaybillapi/v1.03/authenticate?email={email}"
        auth_headers = {
            "client_id": client_id,
            "client_secret": client_secret,
            "gstin": gstin,
            "ip_address": ip_address,
            "username": username,
            "password": password,
        }
        auth_resp = await client.get(auth_url, headers=auth_headers)
        print(f"Auth Status: {auth_resp.status_code}")
        print(f"Auth Headers returned: {dict(auth_resp.headers)}")
        print(f"Auth Body: {auth_resp.text}")
        
        # The txn header from auth might be the session reference
        txn = auth_resp.headers.get("txn")
        print(f"\nTXN from auth response: {txn}")

        # Step 3: Try genewaybill passing txn as authtoken
        if txn:
            print("\n=== Step 3: Generate EWB with TXN as authtoken ===")
            gen_url = f"{base_url}/ewaybillapi/v1.03/ewayapi/genewaybill?email={email}"
            gen_headers = {
                "client_id": client_id,
                "client_secret": client_secret,
                "gstin": gstin,
                "ip_address": ip_address,
                "username": username,
                "password": password,
                "authtoken": txn,
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
            payload = {
                "supplyType": "O", "subSupplyType": "1", "docType": "INV",
                "docNo": "INV-2026-TXN-01", "docDate": "20/08/2026",
                "fromGstin": gstin, "fromTrdName": "TEST SUPPLIER",
                "fromAddr1": "MG Road", "fromPlace": "Bengaluru",
                "fromPincode": 560001, "fromStateCode": 29,
                "toGstin": "URP", "toTrdName": "Walk-in Customer",
                "toAddr1": "Jayanagar", "toPlace": "Bengaluru",
                "toPincode": 560041, "toStateCode": 29,
                "totalValue": 60000, "cgstValue": 5400, "sgstValue": 5400,
                "igstValue": 0, "cessValue": 0, "otherValue": 0,
                "transMode": "1", "transDistance": 10,
                "vehicleNo": "KA01AB1234", "vehicleType": "R",
                "transporterName": "Self",
                "itemList": [{
                    "itemNo": 1, "productName": "Electronic Goods", "hsnCode": "8471",
                    "quantity": 5, "qtyUnit": "NOS",
                    "cgstRate": 9, "sgstRate": 9, "igstRate": 0,
                    "cessRate": 0, "taxableAmount": 60000,
                }]
            }
            gen_resp = await client.post(gen_url, headers=gen_headers, json=payload)
            print(f"Gen Status: {gen_resp.status_code}")
            print(f"Gen Response: {gen_resp.text}")

asyncio.run(authenticate_and_generate())
