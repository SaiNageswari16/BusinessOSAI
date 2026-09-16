import asyncio
import httpx
import json
import re

async def test_lookup(gstin: str):
    clean = gstin.strip().upper()
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    
    # Direct DuckDuckGo HTML query
    ddg_url = f"https://html.duckduckgo.com/html/?q={clean}"
    snippets = []
    async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
        r = await client.get(ddg_url, headers=headers)
        raw_snips = re.findall(r'<a class="result__snippet[^>]*>(.*?)</a>', r.text, re.DOTALL)
        snippets = [re.sub(r'<[^>]+>', '', s).strip() for s in raw_snips[:5]]

    print("Snippets:", snippets)
    snip_text = "\n".join(snippets)

    prompt = f"""Extract registered Indian GST taxpayer details for GSTIN: {clean}
Search snippets:
{snip_text}

Return ONLY valid JSON (no thinking, no backticks, no markdown) matching this exact format:
{{
  "valid": true,
  "gstin": "{clean}",
  "pan": "{clean[2:12]}",
  "legal_name": "Official Legal Business Name",
  "trade_name": "Official Trade / Brand Name",
  "status": "Active",
  "taxpayer_type": "Regular",
  "state": "State Name",
  "city": "City Name",
  "pincode": "Pincode",
  "address": "Full registered address"
}}"""

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
        data = resp.json()
        print("Response raw:", json.dumps(data, indent=2))

if __name__ == "__main__":
    asyncio.run(test_lookup("36AAFCI6694G1Z6"))
