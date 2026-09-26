"""
Universal Real-Time Indian GST & Taxpayer Intelligence Service.
Fetches real registered business legal name, trade name, address, city, state, pincode, and status for any Indian GSTIN.

Strategy:
1. Official GSTN Portal Resolver  (services.gst.gov.in taxpayer search)
2. Whitebooks GSP API Integration (if configured)
3. KnowYourGST / Structured Schema Scraper
4. Intelligent structural fallback with PAN-decoded entity info
"""

import json
import logging
import re
from typing import Any, Dict, Optional
import httpx
from src.services.whitebooks_service import whitebooks_service

logger = logging.getLogger(__name__)

STATE_CODE_MAP = {
    "01": {"state": "Jammu & Kashmir", "city": "Srinagar", "pin": "190001"},
    "02": {"state": "Himachal Pradesh", "city": "Shimla", "pin": "171001"},
    "03": {"state": "Punjab", "city": "Chandigarh", "pin": "160017"},
    "04": {"state": "Chandigarh", "city": "Chandigarh", "pin": "160017"},
    "05": {"state": "Uttarakhand", "city": "Dehradun", "pin": "248001"},
    "06": {"state": "Haryana", "city": "Gurugram", "pin": "122001"},
    "07": {"state": "Delhi", "city": "New Delhi", "pin": "110001"},
    "08": {"state": "Rajasthan", "city": "Jaipur", "pin": "302001"},
    "09": {"state": "Uttar Pradesh", "city": "Lucknow", "pin": "226001"},
    "10": {"state": "Bihar", "city": "Patna", "pin": "800001"},
    "11": {"state": "Sikkim", "city": "Gangtok", "pin": "737101"},
    "12": {"state": "Arunachal Pradesh", "city": "Itanagar", "pin": "791111"},
    "13": {"state": "Nagaland", "city": "Kohima", "pin": "797001"},
    "14": {"state": "Manipur", "city": "Imphal", "pin": "795001"},
    "15": {"state": "Mizoram", "city": "Aizawl", "pin": "796001"},
    "16": {"state": "Tripura", "city": "Agartala", "pin": "799001"},
    "17": {"state": "Meghalaya", "city": "Shillong", "pin": "793001"},
    "18": {"state": "Assam", "city": "Guwahati", "pin": "781001"},
    "19": {"state": "West Bengal", "city": "Kolkata", "pin": "700001"},
    "20": {"state": "Jharkhand", "city": "Ranchi", "pin": "834001"},
    "21": {"state": "Odisha", "city": "Bhubaneswar", "pin": "751001"},
    "22": {"state": "Chhattisgarh", "city": "Raipur", "pin": "492001"},
    "23": {"state": "Madhya Pradesh", "city": "Bhopal", "pin": "462001"},
    "24": {"state": "Gujarat", "city": "Ahmedabad", "pin": "380001"},
    "26": {"state": "Dadra & Nagar Haveli and Daman & Diu", "city": "Daman", "pin": "396210"},
    "27": {"state": "Maharashtra", "city": "Mumbai", "pin": "400001"},
    "29": {"state": "Karnataka", "city": "Bengaluru", "pin": "560001"},
    "30": {"state": "Goa", "city": "Panaji", "pin": "403001"},
    "31": {"state": "Lakshadweep", "city": "Kavaratti", "pin": "682555"},
    "32": {"state": "Kerala", "city": "Kochi", "pin": "682001"},
    "33": {"state": "Tamil Nadu", "city": "Chennai", "pin": "600001"},
    "34": {"state": "Puducherry", "city": "Puducherry", "pin": "605001"},
    "35": {"state": "Andaman and Nicobar Islands", "city": "Port Blair", "pin": "744101"},
    "36": {"state": "Telangana", "city": "Hyderabad", "pin": "500001"},
    "37": {"state": "Andhra Pradesh", "city": "Visakhapatnam", "pin": "530001"},
    "38": {"state": "Ladakh", "city": "Leh", "pin": "194101"},
}

PAN_ENTITY_TYPES = {
    "C": "Company / Corporation",
    "P": "Individual / Proprietorship",
    "H": "Hindu Undivided Family (HUF)",
    "F": "Partnership / LLP",
    "A": "Association of Persons (AOP)",
    "T": "Trust",
    "B": "Body of Individuals (BOI)",
    "L": "Local Authority",
    "J": "Artificial Juridical Person",
    "G": "Government Agency",
}


class GstLookupService:
    """Universal Indian GSTIN verification and auto-fill engine."""

    BROWSER_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "en-US,en;q=0.9",
    }

    async def lookup_gstin(
        self,
        gstin: str,
        tenant_settings: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        clean = (gstin or "").strip().upper().replace(" ", "")
        if len(clean) != 15 or not re.match(r"^[0-9]{2}[A-Z0-9]{13}$", clean):
            return {
                "valid": False,
                "message": "Invalid GSTIN format. GSTIN must be exactly 15 alphanumeric characters.",
            }

        state_code = clean[:2]
        pan = clean[2:12]
        pan_type_code = pan[3] if len(pan) >= 4 else "P"
        pan_entity_type = PAN_ENTITY_TYPES.get(pan_type_code, "Business Enterprise")
        state_info = STATE_CODE_MAP.get(state_code, {"state": "India", "city": "Metro", "pin": "500001"})

        base_res: Dict[str, Any] = {
            "valid": True,
            "is_simulated": False,
            "gstin": clean,
            "pan": pan,
            "legal_name": "",
            "trade_name": "",
            "status": "Active",
            "taxpayer_type": "Regular",
            "entity_type": pan_entity_type,
            "state": state_info["state"],
            "state_code": state_code,
            "city": state_info["city"],
            "pincode": state_info["pin"],
            "address": "",
            "principal_address": "",
            "phone": "",
            "message": f"Valid GSTIN registered in {state_info['state']} (State Code: {state_code}).",
        }

        # ─── 1. Primary Engine: Whitebooks Official Public Search API ───
        try:
            wb_pub_resolved = await self._lookup_via_whitebooks_public(clean)
            if wb_pub_resolved and (wb_pub_resolved.get("legal_name") or wb_pub_resolved.get("trade_name")):
                base_res.update(wb_pub_resolved)
                logger.info("GST lookup succeeded via Whitebooks Public API for %s: %s (Legal: %s)", clean, base_res.get("trade_name"), base_res.get("legal_name"))
                return base_res
        except Exception as exc:
            logger.warning("Whitebooks public search lookup error for %s: %s", clean, exc)

        # ─── 2. Secondary Engine: Official GSTN Portal Taxpayer Search ───
        try:
            gstn_resolved = await self._lookup_via_gstn_portal(clean)
            if gstn_resolved and gstn_resolved.get("legal_name"):
                base_res.update(gstn_resolved)
                logger.info("GST lookup succeeded via GSTN Portal for %s: %s", clean, base_res.get("trade_name"))
                return base_res
        except Exception as exc:
            logger.debug("GSTN portal lookup note: %s", exc)

        # ─── 3. Tertiary Engine: Whitebooks Authenticated GSP API Integration ───
        try:
            wb_resolved = await self._lookup_via_whitebooks(clean, tenant_settings)
            if wb_resolved and wb_resolved.get("legal_name"):
                base_res.update(wb_resolved)
                logger.info("GST lookup succeeded via Whitebooks GSP for %s: %s", clean, base_res.get("trade_name"))
                return base_res
        except Exception as exc:
            logger.debug("Whitebooks direct lookup attempt note: %s", exc)

        # ─── 4. Quaternary Engine: KnowYourGST & Open Data Scraper ───
        try:
            kyg_resolved = await self._lookup_via_knowyourgst(clean, state_info)
            if kyg_resolved and kyg_resolved.get("legal_name"):
                base_res.update(kyg_resolved)
                logger.info("GST lookup succeeded via KnowYourGST for %s: %s", clean, base_res.get("trade_name"))
                return base_res
        except Exception as exc:
            logger.debug("KnowYourGST lookup note: %s", exc)

        # ─── 4. Quaternary Engine: Public gstincheck / gstzen APIs ───
        try:
            direct_resolved = await self._lookup_via_public_apis(clean)
            if direct_resolved and direct_resolved.get("legal_name"):
                base_res.update(direct_resolved)
                logger.info("GST lookup succeeded via Public API for %s: %s", clean, base_res.get("trade_name"))
                return base_res
        except Exception as exc:
            logger.debug("Public API lookup note: %s", exc)

        # ─── 5. Graceful Structural Fallback with PAN-decoded info ───
        if not base_res["legal_name"]:
            entity_label = f"{pan_entity_type} ({pan})"
            base_res["legal_name"] = entity_label
            base_res["trade_name"] = entity_label
            base_res["is_simulated"] = True

        if not base_res["address"]:
            base_res["address"] = f"{base_res['city']}, {base_res['state']} - {base_res['pincode']}"
            base_res["principal_address"] = base_res["address"]

        return base_res

    async def _lookup_via_whitebooks_public(self, gstin: str) -> Optional[Dict[str, Any]]:
        """
        Query the official Whitebooks Public Search API for real-time GSTN taxpayer details.
        Endpoint: https://api.whitebooks.in/public/search?email=roufbaig123@gmail.com&gstin={gstin}
        """
        url = "https://api.whitebooks.in/public/search"
        params = {
            "email": "roufbaig123@gmail.com",
            "gstin": gstin,
        }
        headers = {
            "client_id": "GSTP695cdccb-2a46-4ee3-a3ee-271996c0de49",
            "client_secret": "GSTP63905dce-a403-407e-bb4a-cf48eaa09189",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "application/json",
        }

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, params=params, headers=headers)
            if resp.status_code == 200:
                body = resp.json()
                data = body.get("data") or {}
                if data and (data.get("lgnm") or data.get("tradeNam") or data.get("legal_name") or data.get("trade_name")):
                    return self._parse_whitebooks_public_data(data, gstin)
        return None

    def _parse_whitebooks_public_data(self, d: Dict[str, Any], gstin: str) -> Dict[str, Any]:
        """Convert standard Whitebooks Public Search response to complete GST taxpayer model."""
        legal_name = (d.get("lgnm") or d.get("legal_name") or d.get("legalName") or "").strip()
        trade_name = (d.get("tradeNam") or d.get("trade_name") or d.get("tradeName") or legal_name).strip()
        constitution = (d.get("ctb") or d.get("constitution") or "").strip()

        # Parse address details from pradr.addr
        pradr = d.get("pradr") or {}
        addr_obj = pradr.get("addr", pradr) if isinstance(pradr, dict) else {}

        flno = str(addr_obj.get("flno") or "").strip()
        bno = str(addr_obj.get("bno") or "").strip()
        bnm = str(addr_obj.get("bnm") or "").strip()
        st = str(addr_obj.get("st") or "").strip()
        locality = str(addr_obj.get("locality") or "").strip()
        loc = str(addr_obj.get("loc") or "").strip()
        dst = str(addr_obj.get("dst") or "").strip()
        city = dst or loc or locality or ""
        pin = str(addr_obj.get("pncd") or "").strip()
        stcd_raw = str(addr_obj.get("stcd") or "").strip()

        state_cd = str(d.get("stjCd") or gstin[:2]).zfill(2)
        if len(state_cd) > 2:
            m = re.search(r"\b(0[1-9]|[1-3][0-9])\b", state_cd)
            state_cd = m.group(1).zfill(2) if m else gstin[:2]

        state_name = stcd_raw or STATE_CODE_MAP.get(state_cd, {}).get("state", "India")

        # Build clean address
        parts = []
        for p in [flno, bno, bnm, st, locality, loc, dst]:
            if p and p not in parts:
                parts.append(p)
        full_addr = ", ".join(parts)
        if pin:
            full_addr = f"{full_addr}, {state_name} - {pin}".strip(", -")
        elif state_name:
            full_addr = f"{full_addr}, {state_name}".strip(", -")

        status_raw = str(d.get("sts") or d.get("status") or "ACTIVE").upper()
        status_str = "Active" if "ACT" in status_raw else ("Cancelled" if "CAN" in status_raw else status_raw.capitalize())

        pan_char = gstin[3] if len(gstin) >= 4 else "P"
        entity_type = constitution or PAN_ENTITY_TYPES.get(pan_char, "Business Enterprise")

        return {
            "valid": True,
            "legal_name": legal_name or trade_name,
            "trade_name": trade_name or legal_name,
            "constitution_of_business": constitution,
            "entity_type": entity_type,
            "address": full_addr,
            "principal_address": full_addr,
            "city": city or STATE_CODE_MAP.get(state_cd, {}).get("city", ""),
            "state": state_name,
            "state_code": state_cd,
            "pincode": pin or STATE_CODE_MAP.get(state_cd, {}).get("pin", ""),
            "status": status_str,
            "taxpayer_type": d.get("dty") or "Regular",
            "registration_date": d.get("rgdt"),
            "einvoice_status": d.get("einvoiceStatus"),
            "nature_of_business": d.get("nba") or (pradr.get("ntr") if isinstance(pradr, dict) else None),
            "jurisdiction": f"{d.get('stj', '')} / {d.get('ctj', '')}".strip(" /"),
            "is_simulated": False,
        }

    async def _lookup_via_gstn_portal(self, gstin: str) -> Optional[Dict[str, Any]]:
        """
        Query the official GSTN taxpayer search endpoint.
        This is the same API used by the GST portal's taxpayer search — it returns
        legal name, trade name, address, status, and taxpayer type publicly.
        """
        urls = [
            f"https://services.gst.gov.in/services/api/search/taxpayerDetails?gstin={gstin}",
            f"https://www.gst.gov.in/services/api/search/taxpayerDetails?gstin={gstin}",
        ]

        headers = {
            **self.BROWSER_HEADERS,
            "Referer": "https://services.gst.gov.in/services/searchtp",
            "Origin": "https://services.gst.gov.in",
            "x-requested-with": "XMLHttpRequest",
        }

        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            for url in urls:
                try:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        taxpayer = data.get("data") or data
                        legal_name = (
                            taxpayer.get("lgnm")
                            or taxpayer.get("legal_name")
                            or taxpayer.get("legalName")
                            or ""
                        ).strip()
                        if legal_name and len(legal_name) > 2:
                            return self._parse_gstn_taxpayer(taxpayer, gstin)
                except Exception as e:
                    logger.debug("GSTN portal URL %s failed: %s", url, e)

        return None

    def _parse_gstn_taxpayer(self, d: Dict[str, Any], gstin: str) -> Dict[str, Any]:
        """Parse GSTN portal taxpayer response — standard format from services.gst.gov.in."""
        legal_name = (d.get("lgnm") or d.get("legal_name") or d.get("legalName") or "").strip()
        trade_name = (d.get("tradeNam") or d.get("trade_name") or d.get("tradeName") or legal_name).strip()

        # Parse principal address — GSTN format uses nested pradr.addr
        pradr = d.get("pradr") or {}
        addr_obj = pradr.get("addr", pradr) if isinstance(pradr, dict) else {}
        bno = str(addr_obj.get("bno") or "").strip()
        bnm = str(addr_obj.get("bnm") or "").strip()
        flno = str(addr_obj.get("flno") or "").strip()
        st = str(addr_obj.get("st") or "").strip()
        loc = str(addr_obj.get("loc") or addr_obj.get("dst") or "").strip()
        city = loc or str(addr_obj.get("city") or "").strip()
        pin = str(addr_obj.get("pncd") or d.get("pincode") or "").strip()
        state_cd = str(d.get("stj") or d.get("stcd") or gstin[:2]).zfill(2)
        if len(state_cd) > 2:
            # stj might be "State-Karnataka" style
            m = re.search(r"\b(0[1-9]|[1-3][0-9])\b", state_cd)
            state_cd = m.group(1).zfill(2) if m else gstin[:2]
        state_name = STATE_CODE_MAP.get(state_cd, {}).get("state", "India")

        addr_parts = [p for p in [flno, bno, bnm, st, loc] if p]
        full_addr = ", ".join(addr_parts)
        if not full_addr:
            full_addr = f"{city}, {state_name} - {pin}".strip(", -")

        status_raw = str(d.get("sts") or d.get("status") or "ACT").upper()
        status_str = "Active" if "ACT" in status_raw else "Inactive / Cancelled"

        return {
            "legal_name": legal_name,
            "trade_name": trade_name or legal_name,
            "address": full_addr,
            "principal_address": full_addr,
            "city": city or STATE_CODE_MAP.get(state_cd, {}).get("city", ""),
            "state": state_name,
            "state_code": state_cd,
            "pincode": pin or STATE_CODE_MAP.get(state_cd, {}).get("pin", ""),
            "status": status_str,
            "taxpayer_type": d.get("dty") or d.get("txpType") or "Regular",
            "registration_date": d.get("rgdt") or d.get("registration_date"),
            "is_simulated": False,
        }

    async def _lookup_via_whitebooks(
        self,
        gstin: str,
        tenant_settings: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Call Whitebooks GSP / GetGSTINDetails with active credentials."""
        try:
            ewb_client = whitebooks_service.get_ewb_client(tenant_settings)
            einv_client = whitebooks_service.get_einv_client(tenant_settings)

            auth_ok, _, token = await ewb_client.authenticate()
            headers = {
                "client_id": ewb_client.client_id,
                "client_secret": ewb_client.client_secret,
                "user_name": ewb_client.username,
                "password": ewb_client.password,
                "gstin": ewb_client.gstin or gstin,
                "email": ewb_client.registered_email,
                "ip_address": ewb_client.ip_address,
                "authtoken": token or "",
            }

            urls = [
                f"{ewb_client.base_url}/ewaybillapis/v1.03/customerapis/GetGSTINDetails?gstin={gstin}",
                f"{einv_client.base_url}/einvoiceapis/v1.03/customerapis/GetGSTINDetails?gstin={gstin}",
                f"{ewb_client.base_url}/ewaybillapis/v1.03/commonapis/GetGSTINDetails?gstin={gstin}",
            ]

            async with httpx.AsyncClient(timeout=8.0) as client:
                for url in urls:
                    try:
                        resp = await client.get(url, headers=headers)
                        if resp.status_code == 200:
                            data = resp.json()
                            if data.get("status_cd") == "1" or data.get("tradeName") or data.get("legalName"):
                                return self._parse_whitebooks_taxpayer(data, gstin)
                    except Exception:
                        pass
        except Exception as e:
            logger.debug("Whitebooks taxpayer extraction error: %s", e)
        return None

    def _parse_whitebooks_taxpayer(self, data: Dict[str, Any], gstin: str) -> Dict[str, Any]:
        """Convert standard Whitebooks taxpayer response to internal model."""
        trade_name = (data.get("tradeName") or data.get("trade_name") or data.get("legalName") or "").strip()
        legal_name = (data.get("legalName") or data.get("legal_name") or trade_name).strip()

        bno = str(data.get("bno") or "").strip()
        bnm = str(data.get("bnm") or "").strip()
        st = str(data.get("st") or "").strip()
        loc = str(data.get("loc") or "").strip()
        city = loc or str(data.get("city") or "").strip()
        pincode = str(data.get("pncd") or data.get("pincode") or "").strip()
        state_code = str(data.get("stcd") or gstin[:2]).zfill(2)
        state_name = STATE_CODE_MAP.get(state_code, {}).get("state", "India")

        full_addr_parts = [p for p in [bno, bnm, st, loc] if p]
        full_addr = ", ".join(full_addr_parts)
        if not full_addr:
            full_addr = f"{city}, {state_name} - {pincode}".strip(", -")

        status_str = "Active"
        raw_status = str(data.get("status") or data.get("blkStatus") or "").upper()
        if "INACT" in raw_status or "CAN" in raw_status:
            status_str = "Inactive / Cancelled"

        return {
            "legal_name": legal_name,
            "trade_name": trade_name or legal_name,
            "address": full_addr,
            "principal_address": full_addr,
            "city": city or STATE_CODE_MAP.get(state_code, {}).get("city", ""),
            "state": state_name,
            "state_code": state_code,
            "pincode": pincode or STATE_CODE_MAP.get(state_code, {}).get("pin", ""),
            "status": status_str,
            "taxpayer_type": data.get("txpType") or "Regular",
            "is_simulated": False,
        }

    async def _lookup_via_knowyourgst(self, gstin: str, state_info: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """
        Scrape taxpayer data from KnowYourGST and related services.
        These sites display structured JSON-LD organization data or embedded JSON from the GST API.
        """
        endpoints = [
            f"https://knowyourgst.com/gst-number-search/{gstin.lower()}/",
            f"https://knowyourgst.com/gst-number-search/{gstin.upper()}/",
            f"https://www.knowyourgst.com/taxpayers/?gstno={gstin}",
        ]

        async with httpx.AsyncClient(timeout=9.0, follow_redirects=True) as client:
            for url in endpoints:
                try:
                    resp = await client.get(url, headers=self.BROWSER_HEADERS)
                    if resp.status_code != 200:
                        continue
                    text = resp.text

                    # 1. Try JSON-LD schema
                    ld_scripts = re.findall(
                        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
                        text, re.DOTALL
                    )
                    for ld in ld_scripts:
                        try:
                            schema = json.loads(ld.strip())
                            if isinstance(schema, list):
                                schema = schema[0]
                            s_name = (schema.get("name") or "").strip()
                            if s_name and len(s_name) > 2 and not any(
                                x in s_name.lower() for x in ["knowyourgst", "cleartax", "gst portal", "gst number"]
                            ):
                                result: Dict[str, Any] = {
                                    "legal_name": s_name,
                                    "trade_name": s_name,
                                    "is_simulated": False,
                                }
                                addr_obj = schema.get("address") or {}
                                if isinstance(addr_obj, dict):
                                    if addr_obj.get("streetAddress"):
                                        result["address"] = addr_obj["streetAddress"]
                                        result["principal_address"] = addr_obj["streetAddress"]
                                    if addr_obj.get("postalCode"):
                                        result["pincode"] = str(addr_obj["postalCode"])
                                    if addr_obj.get("addressLocality"):
                                        result["city"] = addr_obj["addressLocality"]
                                    if addr_obj.get("addressRegion"):
                                        result["state"] = addr_obj["addressRegion"]
                                return result
                        except Exception:
                            pass

                    # 2. Try embedded JSON from page — many GST search sites embed raw API data
                    json_blocks = re.findall(r'window\.__data\s*=\s*({.*?});', text, re.DOTALL)
                    json_blocks += re.findall(r'"taxpayer"\s*:\s*({[^}]+})', text)
                    json_blocks += re.findall(r'"gstData"\s*:\s*({[^}]+})', text)
                    for block in json_blocks:
                        try:
                            d = json.loads(block)
                            ln = (d.get("lgnm") or d.get("legal_name") or d.get("legalName") or "").strip()
                            if ln and len(ln) > 2:
                                return self._parse_gstn_taxpayer(d, gstin)
                        except Exception:
                            pass

                    # 3. Parse text for company name directly in HTML tables
                    name_matches = re.findall(
                        r'(?:Legal Name|Taxpayer Name|Trade Name|Company Name)[^<:]*[:<][^>]*>?\s*([A-Z][A-Z0-9 &\.\-,\'\/]+)',
                        text, re.IGNORECASE
                    )
                    if name_matches:
                        candidate = name_matches[0].strip()
                        if len(candidate) > 3 and not any(
                            x in candidate.lower() for x in ["knowyourgst", "gst number", "search", "click"]
                        ):
                            return {
                                "legal_name": candidate,
                                "trade_name": candidate,
                                "is_simulated": False,
                            }

                except Exception as e:
                    logger.debug("KnowYourGST URL %s failed: %s", url, e)

        return None

    async def _lookup_via_public_apis(self, gstin: str) -> Optional[Dict[str, Any]]:
        """Query public / free-tier GSTIN verification JSON endpoints."""
        endpoints = [
            # gstincheck APIs (some endpoints occasionally work publicly)
            f"https://sheet.gstincheck.ml/check/{gstin}",
            f"https://api.gstincheck.ml/v1/{gstin}",
            # GST Zero / other public resolvers
            f"https://gstzero.in/api/gstin/{gstin}",
            f"https://api.gstzero.in/verify/{gstin}",
        ]

        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
            for ep in endpoints:
                try:
                    r = await client.get(ep, headers=self.BROWSER_HEADERS)
                    if r.status_code == 200:
                        data = r.json()
                        inner = data.get("data") or data
                        l_name = (
                            inner.get("lgnm")
                            or inner.get("legal_name")
                            or inner.get("legalName")
                            or inner.get("trade_name")
                        )
                        if l_name and "taxpayer" not in str(l_name).lower() and len(str(l_name)) > 2:
                            t_name = inner.get("tradeNam") or inner.get("trade_name") or l_name
                            pr_addr = inner.get("pradr") or {}
                            addr_obj = pr_addr.get("addr") if isinstance(pr_addr, dict) else {}
                            if not isinstance(addr_obj, dict):
                                addr_obj = {}

                            bno = addr_obj.get("bno") or ""
                            bnm = addr_obj.get("bnm") or ""
                            st = addr_obj.get("st") or ""
                            loc = addr_obj.get("loc") or addr_obj.get("dst") or ""
                            pin = str(addr_obj.get("pncd") or inner.get("pincode") or "")

                            addr_parts = [p for p in [bno, bnm, st, loc] if p]
                            full_addr = ", ".join(addr_parts)

                            return {
                                "legal_name": str(l_name).strip(),
                                "trade_name": str(t_name).strip(),
                                "address": full_addr or inner.get("address") or "",
                                "principal_address": full_addr or inner.get("address") or "",
                                "city": loc or inner.get("city") or "",
                                "pincode": pin or "",
                                "status": inner.get("sts") or "Active",
                                "taxpayer_type": inner.get("dty") or "Regular",
                                "is_simulated": False,
                            }
                except Exception:
                    pass
        return None


gst_lookup_service = GstLookupService()
