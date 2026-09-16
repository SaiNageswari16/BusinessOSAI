import asyncio
import httpx
import json
import re

async def lookup_live_gstin(gstin: str):
    clean = gstin.strip().upper()
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    
    # Step 1: Search DuckDuckGo for live taxpayer snippets
    snippets = []
    try:
        ddg_url = f"https://html.duckduckgo.com/html/?q={clean}+GST+details"
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
            r = await client.get(ddg_url, headers=headers)
            if r.status_code == 200:
                raw_snips = re.findall(r'<a class="result__snippet[^>]*>(.*?)</a>', r.text, re.DOTALL)
                snippets = [re.sub(r'<[^>]+>', '', s).strip() for s in raw_snips[:5]]
    except Exception as e:
        print("DDG fetch error:", e)

    print("Found snippets:", snippets)

    # Step 2: Use LLM (Claude) to extract structured entity details with 100% precision
    snip_text = "\n".join(snippets)
    prompt = f"""You are an Indian GST Taxpayer Entity resolver.
Analyze the following GSTIN and search context:
GSTIN: {clean}
Search Context:
{snip_text}

Extract the exact registered business details. Return ONLY a valid JSON object with:
{{
  "valid": true,
  "gstin": "{clean}",
  "pan": "{clean[2:12]}",
  "legal_name": "Official Legal Name (e.g. Iotronics Private Limited)",
  "trade_name": "Official Trade / Brand Name",
  "status": "Active",
  "taxpayer_type": "Regular",
  "state": "State Name",
  "city": "City Name",
  "pincode": "Pincode if found or main city pincode",
  "address": "Full registered address or Street, City, State - PIN",
  "principal_address": "Full registered address"
}}"""

    try:
        url = "https://api.opusmax.pro/v1/messages"
        anth_headers = {
            "x-api-key": "sk-ant-opm-vLmniWw922HpmfrrTbSTJ0Z2cVmbiYFN",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        anth_payload = {
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 1000,
            "messages": [{"role": "user", "content": prompt}]
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=anth_payload, headers=anth_headers)
            res_json = resp.json()
            for block in res_json.get("content", []):
                if block.get("type") == "text":
                    text = block.get("text", "")
                    match = re.search(r"\{.*\}", text, re.DOTALL)
                    if match:
                        data = json.loads(match.group(0))
                        print("\n=== RESOLVED GSTIN RESULT ===")
                        print(json.dumps(data, indent=2))
                        return data
    except Exception as e:
        print("LLM resolver error:", e)

if __name__ == "__main__":
    asyncio.run(lookup_live_gstin("36AAFCI6694G1Z6"))
