import asyncio
import httpx
import re

async def test_full_address(gstin: str):
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
        # Search for address specifically
        url = f"https://html.duckduckgo.com/html/?q={gstin}+address+Hyderabad"
        r = await client.get(url, headers=headers)
        raw_snips = re.findall(r'<a class="result__snippet[^>]*>(.*?)</a>', r.text, re.DOTALL)
        snippets = [re.sub(r'<[^>]+>', '', s).strip() for s in raw_snips[:5]]
        print("Address query snippets:", snippets)

if __name__ == "__main__":
    asyncio.run(test_full_address("36AAFCI6694G1Z6"))
