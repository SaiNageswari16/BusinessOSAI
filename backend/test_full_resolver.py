import asyncio
import httpx
import re
import json

STATE_MAP = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra & Nagar Haveli", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
    "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman & Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh"
}

async def fetch_gst_details(gstin: str):
    clean = gstin.strip().upper()
    state_code = clean[:2]
    pan = clean[2:12]
    state_name = STATE_MAP.get(state_code, "India")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }

    result = {
        "valid": True,
        "gstin": clean,
        "pan": pan,
        "legal_name": "",
        "trade_name": "",
        "address": "",
        "principal_address": "",
        "city": "",
        "state": state_name,
        "state_code": state_code,
        "pincode": "",
        "status": "Active",
        "taxpayer_type": "Regular",
        "phone": "",
    }

    # Strategy 1: Search DDG for direct GST aggregator pages
    ddg_url = f"https://html.duckduckgo.com/html/?q={clean}"
    target_urls = []
    snippets = []
    
    async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
        try:
            r = await client.get(ddg_url, headers=headers)
            if r.status_code == 200:
                # Extract links
                links = re.findall(r'<a class="result__url"[^>]*href="([^"]+)"', r.text)
                target_urls.extend(links)
                raw_snips = re.findall(r'<a class="result__snippet[^>]*>(.*?)</a>', r.text, re.DOTALL)
                snippets = [re.sub(r'<[^>]+>', '', s).strip() for s in raw_snips[:5]]
        except Exception as e:
            print("DDG search err:", e)

    # Strategy 2: If we found direct aggregator links (e.g. gst.iadv.io or knowyourgst.com), fetch schema.org JSON-LD
    found_structured = False
    async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
        for u in target_urls:
            if any(domain in u.lower() for domain in ["iadv.io", "knowyourgst.com", "cleartax.in", "mastersindia"]):
                # Unquote duckduckgo redirect if present
                actual_url = u
                if "uddg=" in u:
                    import urllib.parse
                    actual_url = urllib.parse.unquote(u.split("uddg=")[1].split("&")[0])
                try:
                    page = await client.get(actual_url, headers=headers)
                    if page.status_code == 200:
                        # Check for JSON-LD schema
                        ld_matches = re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', page.text, re.DOTALL)
                        for ld in ld_matches:
                            try:
                                schema = json.loads(ld.strip())
                                if isinstance(schema, dict) and ("Organization" in str(schema.get("@type")) or "LocalBusiness" in str(schema.get("@type"))):
                                    result["legal_name"] = schema.get("name") or result["legal_name"]
                                    result["trade_name"] = schema.get("name") or result["trade_name"]
                                    addr = schema.get("address")
                                    if isinstance(addr, dict):
                                        result["address"] = addr.get("streetAddress") or result["address"]
                                        result["principal_address"] = addr.get("streetAddress") or result["principal_address"]
                                        result["pincode"] = addr.get("postalCode") or result["pincode"]
                                        result["city"] = addr.get("addressLocality") or result["city"]
                                        result["state"] = addr.get("addressRegion") or result["state"]
                                    cp = schema.get("contactPoint")
                                    if isinstance(cp, dict):
                                        result["phone"] = cp.get("telephone") or result["phone"]
                                    if result["legal_name"]:
                                        found_structured = True
                                        break
                            except Exception:
                                pass
                        if found_structured:
                            break
                except Exception as e:
                    pass

    # Strategy 3: If not found via direct schema, use Claude with snippets
    if not result["legal_name"] and snippets:
        prompt = f"""Extract registered Indian GST taxpayer details for GSTIN: {clean} from search snippets:
{chr(10).join(snippets)}

Return JSON with exact keys:
{{"legal_name": "...", "trade_name": "...", "address": "...", "city": "...", "state": "...", "pincode": "...", "phone": "..."}}"""
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(
                    "https://api.opusmax.pro/v1/messages",
                    headers={"x-api-key": "sk-ant-opm-vLmniWw922HpmfrrTbSTJ0Z2cVmbiYFN", "anthropic-version": "2023-06-01", "content-type": "application/json"},
                    json={"model": "claude-3-5-sonnet-20241022", "max_tokens": 500, "messages": [{"role": "user", "content": prompt}]}
                )
                for b in res.json().get("content", []):
                    if b.get("type") == "text":
                        m = re.search(r"\{.*\}", b.get("text", ""), re.DOTALL)
                        if m:
                            parsed = json.loads(m.group(0))
                            for k in ["legal_name", "trade_name", "address", "city", "state", "pincode", "phone"]:
                                if parsed.get(k) and parsed[k] != "N/A":
                                    result[k] = parsed[k]
        except Exception as e:
            print("Claude extraction error:", e)

    print("Final result:", json.dumps(result, indent=2))
    return result

if __name__ == "__main__":
    asyncio.run(fetch_gst_details("36AAFCI6694G1Z6"))
