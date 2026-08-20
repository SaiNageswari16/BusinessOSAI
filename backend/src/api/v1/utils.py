"""Shared utility endpoints."""
import logging

import httpx
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/utils", tags=["Utils"])


@router.get("/pincode/{pincode}")
async def lookup_pincode(pincode: str):
    """Look up Indian postal pincode details via India Post public API."""
    clean = (pincode or "").strip()
    if not clean.isdigit() or len(clean) != 6:
        raise HTTPException(status_code=400, detail="Pincode must be a 6-digit number")

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(f"https://api.postalpincode.in/pincode/{clean}")
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("Pincode lookup failed for %s: %s", clean, exc)
        raise HTTPException(status_code=502, detail="Pincode service unavailable") from exc

    if isinstance(data, list) and len(data) > 0:
        data = data[0]

    offices = data.get("PostOffice") or []
    if data.get("Status") != "Success" or not offices:
        raise HTTPException(status_code=404, detail="Pincode not found")

    primary = offices[0]
    district = primary.get("District") or primary.get("Block") or ""
    state = primary.get("State") or ""
    area = primary.get("Name") or ""

    return {
        "pincode": clean,
        "city": district,
        "district": district,
        "state": state,
        "country": "India",
        "area": area,
        "region": primary.get("Region") or "",
        "division": primary.get("Division") or "",
        "circle": primary.get("Circle") or "",
        "post_offices": [o.get("Name") for o in offices if o.get("Name")][:15],
    }
