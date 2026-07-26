import urllib.request
import json

def test():
    print("Testing /inventory/public/categories...")
    try:
        req = urllib.request.Request("http://localhost:8001/api/v1/inventory/public/categories")
        with urllib.request.urlopen(req) as response:
            status = response.getcode()
            body = response.read().decode('utf-8')
            print(f"Status: {status}")
            data = json.loads(body)
            print(f"Categories count: {len(data.get('items', []))}")
            print(f"Categories: {data}")
    except Exception as e:
        print(f"Categories failed: {e}")

    print("\nTesting /inventory/public/products...")
    try:
        req = urllib.request.Request("http://localhost:8001/api/v1/inventory/public/products")
        with urllib.request.urlopen(req) as response:
            status = response.getcode()
            body = response.read().decode('utf-8')
            print(f"Status: {status}")
            data = json.loads(body)
            print(f"Products count: {len(data.get('items', []))}")
            print(f"Products: {data}")
    except Exception as e:
        print(f"Products failed: {e}")

if __name__ == "__main__":
    test()
