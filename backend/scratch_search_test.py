import asyncio
import httpx
import json
import re

async def test_search():
    gstin = "36AAFCI6694G1Z6"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    
    # Method 1: DuckDuckGo HTML or API search
    try:
        ddg_url = f"https://html.duckduckgo.com/html/?q={gstin}"
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            r = await client.get(ddg_url, headers=headers)
            print("DDG status:", r.status_code)
            # Find snippets
            snippets = re.findall(r'<a class="result__snippet[^>]*>(.*?)</a>', r.text, re.DOTALL)
            clean_snippets = [re.sub(r'<[^>]+>', '', s).strip() for s in snippets]
            print("DDG snippets:", clean_snippets[:3])
            titles = re.findall(r'<a class="result__url[^>]*>(.*?)</a>', r.text, re.DOTALL)
            print("DDG titles:", titles[:3])
    except Exception as e:
        print("DDG err:", e)

    # Method 2: Anthropic API
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
            "messages": [
                {"role": "user", "content": f"Given Indian GSTIN {gstin}, what is the registered company name and state?"}
            ]
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(url, json=anth_payload, headers=anth_headers)
            print("Anthropic status:", r.status_code)
            print("Anthropic response:", r.text[:300])
    except Exception as e:
        print("Anthropic err:", e)

if __name__ == "__main__":
    asyncio.run(test_search())
