import asyncio
import httpx
import json
import re

async def test_gemini_gst():
    api_key = "AIzaSyCj5bSjiSzfkFha2ZSXuUvWn201G9SekJM"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    prompt = """You are a real-time Indian GST & Business Intelligence engine.
Find the real registered taxpayer and business entity details for Indian GSTIN: 36AAFCI6694G1Z6

Return ONLY a JSON object (no markdown, no code fencing) with the exact keys:
{
  "valid": true,
  "gstin": "36AAFCI6694G1Z6",
  "pan": "AAFCI6694G",
  "legal_name": "Exact Legal Name of Company / Business",
  "trade_name": "Exact Trade Name",
  "taxpayer_type": "Regular / Composition / etc",
  "status": "Active / Inactive",
  "state": "State Name",
  "city": "City Name",
  "pincode": "Pincode",
  "address": "Full registered address",
  "principal_address": "Full registered address"
}"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "tools": [{"googleSearch": {}}]
    }
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(url, json=payload)
        print("Status:", res.status_code)
        data = res.json()
        try:
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            print("Raw text:", raw_text)
            clean_json = re.search(r"\{.*\}", raw_text, re.DOTALL)
            if clean_json:
                parsed = json.loads(clean_json.group(0))
                print("\nPARSED GST RESULT:\n", json.dumps(parsed, indent=2))
        except Exception as e:
            print("Error parsing:", e, data)

if __name__ == "__main__":
    asyncio.run(test_gemini_gst())
