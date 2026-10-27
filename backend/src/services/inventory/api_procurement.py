"""Procurement proxy — serves the ERP procurement UI from the purchase service.

The frontend's procurement screens call ``/api/v1/inventory/procurement/*``.
Those features belong to the purchase service (vendors, PRs, POs, GRNs, bills),
so this router proxies the mapped paths to
``{purchase}/api/v1/purchase/<...>`` and returns a clean 501 for purchase
features that have not been ported yet.

Forwarding rules:
  * the incoming request's ``X-Identity-*`` headers are copied verbatim — the
    gateway has already stripped client-sent identity headers, so what arrives
    on this hop is the gateway's trusted forwarding, which purchase trusts the
    same way (``shared.identity._forwarded_identity``).
  * the query string and JSON body pass through untouched.
  * the upstream status code and body are returned as-is (no reshaping).

Paths with no purchase equivalent are answered here with
``501 {"error": {"code": "NOT_IMPLEMENTED", ...}, "service": "purchase"}``
— an honest "not ported yet" rather than a fake 200 with empty data.
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from src.services.shared.registry import base_url, get_descriptor

router = APIRouter(prefix="/procurement", tags=["inventory-procurement"])

_FORWARD_TIMEOUT = 15.0

# ─── Upstream helpers ────────────────────────────────────────────────────────


def _identity_headers(request: Request) -> dict[str, str]:
    """The incoming request's X-Identity-* headers, verbatim.

    The gateway authenticates once at the edge, strips any client-sent
    identity headers, and re-sets them from the decoded JWT before proxying.
    What reaches this service is therefore already the trusted set, and it is
    exactly what purchase expects on the mesh.
    """
    return {k: v for k, v in request.headers.items()
            if k.lower().startswith("x-identity-")}


def _not_implemented(path: str) -> JSONResponse:
    return JSONResponse(
        status_code=501,
        content={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": f"purchase feature not yet ported: {path}",
            },
            "service": "purchase",
        },
    )


def _unavailable() -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "error": {
                "code": "SERVICE_UNAVAILABLE",
                "message": "purchase service is not registered in the mesh",
            },
            "service": "purchase",
        },
    )


async def _forward(request: Request, upstream_path: str,
                   *, query: str = "", body: bytes | None = None) -> Response:
    """GET/POST the purchase service and return its status + body untouched."""
    descriptor = get_descriptor("purchase")
    if descriptor is None:
        return _unavailable()
    url = f"{base_url(descriptor)}/api/v1/purchase{upstream_path}"
    if query:
        url = f"{url}?{query}"
    headers = _identity_headers(request)
    if body is not None:
        headers["content-type"] = request.headers.get("content-type", "application/json")
    try:
        async with httpx.AsyncClient(timeout=_FORWARD_TIMEOUT) as client:
            if request.method in ("GET", "DELETE"):
                res = await client.get(url, headers=headers)
            else:
                res = await client.post(url, content=body, headers=headers)
    except httpx.HTTPError as exc:
        return JSONResponse(
            status_code=502,
            content={
                "error": {
                    "code": "UPSTREAM_ERROR",
                    "message": f"purchase service call failed: {exc}",
                },
                "service": "purchase",
            },
        )
    media_type = res.headers.get("content-type", "application/json")
    return Response(content=res.content, status_code=res.status_code,
                    media_type=media_type)


async def _forward_body(request: Request, upstream_path: str) -> Response:
    """Forward a JSON request with its raw body (POST/PATCH)."""
    body = await request.body()
    return await _forward(request, upstream_path,
                          query=request.url.query, body=body)


# ─── Vendors (frontend "suppliers") ──────────────────────────────────────────


@router.get("/suppliers")
async def list_suppliers(request: Request) -> Response:
    return await _forward(request, "/vendors", query=request.url.query)


@router.post("/suppliers")
async def create_supplier(request: Request) -> Response:
    return await _forward_body(request, "/vendors")


@router.patch("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, request: Request) -> Response:
    return await _forward_body(request, f"/vendors/{supplier_id}")


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str) -> Response:
    return _not_implemented("/suppliers/{id}")


@router.post("/suppliers/merge-duplicates")
async def merge_duplicate_suppliers() -> Response:
    return _not_implemented("/suppliers/merge-duplicates")


# ─── Not ported to purchase ─────────────────────────────────────────────────


@router.get("/supplier-contacts")
async def list_supplier_contacts() -> Response:
    return _not_implemented("/supplier-contacts")


@router.post("/supplier-contacts")
async def create_supplier_contact() -> Response:
    return _not_implemented("/supplier-contacts")


@router.get("/supplier-contracts")
async def list_supplier_contracts() -> Response:
    return _not_implemented("/supplier-contracts")


@router.post("/supplier-contracts")
async def create_supplier_contract() -> Response:
    return _not_implemented("/supplier-contracts")


@router.get("/supplier-performance")
async def list_supplier_performance() -> Response:
    return _not_implemented("/supplier-performance")


@router.post("/supplier-performance")
async def create_supplier_performance() -> Response:
    return _not_implemented("/supplier-performance")


@router.get("/supplier-categories")
async def list_supplier_categories() -> Response:
    return _not_implemented("/supplier-categories")


@router.post("/supplier-categories")
async def create_supplier_category() -> Response:
    return _not_implemented("/supplier-categories")


@router.get("/blacklisted-suppliers")
async def list_blacklisted_suppliers() -> Response:
    return _not_implemented("/blacklisted-suppliers")


@router.post("/blacklisted-suppliers")
async def blacklist_supplier() -> Response:
    return _not_implemented("/blacklisted-suppliers")


@router.get("/purchase-quotations")
async def list_purchase_quotations() -> Response:
    return _not_implemented("/purchase-quotations")


@router.post("/purchase-quotations")
async def create_purchase_quotation() -> Response:
    return _not_implemented("/purchase-quotations")


@router.get("/purchase-returns")
async def list_purchase_returns() -> Response:
    return _not_implemented("/purchase-returns")


@router.post("/purchase-returns")
async def create_purchase_return() -> Response:
    return _not_implemented("/purchase-returns")


@router.get("/credit-notes")
async def list_credit_notes() -> Response:
    return _not_implemented("/credit-notes")


@router.post("/credit-notes")
async def create_credit_note() -> Response:
    return _not_implemented("/credit-notes")


@router.get("/debit-notes")
async def list_debit_notes() -> Response:
    return _not_implemented("/debit-notes")


@router.post("/debit-notes")
async def create_debit_note() -> Response:
    return _not_implemented("/debit-notes")


@router.post("/verify-gstin")
async def verify_gstin() -> Response:
    return _not_implemented("/verify-gstin")


@router.post("/ocr/extract-pr-document")
async def ocr_extract_pr() -> Response:
    return _not_implemented("/ocr/extract-pr-document")


@router.post("/ocr/extract-po-document")
async def ocr_extract_po() -> Response:
    return _not_implemented("/ocr/extract-po-document")


@router.post("/ocr/extract-invoice-document")
async def ocr_extract_invoice() -> Response:
    return _not_implemented("/ocr/extract-invoice-document")


@router.post("/ocr/extract-grn-document")
async def ocr_extract_grn() -> Response:
    return _not_implemented("/ocr/extract-grn-document")


@router.post("/extract-quotation-ocr")
async def extract_quotation_ocr() -> Response:
    return _not_implemented("/extract-quotation-ocr")


@router.get("/analytics/spend-analysis")
async def analytics_spend() -> Response:
    return _not_implemented("/analytics/spend-analysis")


@router.get("/analytics/procurement-forecast")
async def analytics_forecast() -> Response:
    return _not_implemented("/analytics/procurement-forecast")


@router.get("/analytics/lead-time")
async def analytics_lead_time() -> Response:
    return _not_implemented("/analytics/lead-time")


@router.get("/analytics/cost-analysis")
async def analytics_cost() -> Response:
    return _not_implemented("/analytics/cost-analysis")


@router.get("/analytics/approvals")
async def analytics_approvals() -> Response:
    return _not_implemented("/analytics/approvals")


@router.post("/analytics/approvals/{approval_id}/action")
async def analytics_approval_action(approval_id: str) -> Response:
    return _not_implemented("/analytics/approvals")


# ─── Purchase requests / orders / GRNs / bills / payments ───────────────────


@router.get("/purchase-requests")
async def list_purchase_requests(request: Request) -> Response:
    return await _forward(request, "/purchase-requests",
                          query=request.url.query)


@router.post("/purchase-requests")
async def create_purchase_request(request: Request) -> Response:
    return await _forward_body(request, "/purchase-requests")


@router.get("/purchase-orders")
async def list_purchase_orders(request: Request) -> Response:
    return await _forward(request, "/purchase-orders",
                          query=request.url.query)


@router.post("/purchase-orders")
async def create_purchase_order(request: Request) -> Response:
    return await _forward_body(request, "/purchase-orders")


@router.patch("/purchase-orders/{po_id}")
async def update_purchase_order(po_id: str) -> Response:
    return _not_implemented("/purchase-orders/{id}")


@router.get("/goods-received-notes")
async def list_grns(request: Request) -> Response:
    return await _forward(request, "/grns", query=request.url.query)


@router.post("/goods-received-notes")
async def create_grn(request: Request) -> Response:
    return await _forward_body(request, "/grns")


@router.patch("/goods-received-notes/{grn_id}")
async def update_grn(grn_id: str) -> Response:
    return _not_implemented("/goods-received-notes/{id}")


@router.delete("/goods-received-notes/{grn_id}")
async def delete_grn(grn_id: str) -> Response:
    return _not_implemented("/goods-received-notes/{id}")


@router.get("/vendor-bills")
async def list_vendor_bills(request: Request) -> Response:
    return await _forward(request, "/vendor-bills",
                          query=request.url.query)


@router.post("/vendor-bills")
async def create_vendor_bill(request: Request) -> Response:
    return await _forward_body(request, "/vendor-bills")


@router.post("/vendor-bills/{bill_id}/cancel")
async def cancel_vendor_bill(bill_id: str, request: Request) -> Response:
    return await _forward_body(request, f"/vendor-bills/{bill_id}/cancel")


@router.get("/vendor-payments")
async def list_vendor_payments() -> Response:
    return _not_implemented("/vendor-payments")


@router.post("/vendor-payments")
async def create_vendor_payment(request: Request) -> Response:
    """POST a payment against a bill: the body carries the bill id.

    Purchase records payments on the bill itself
    (``/vendor-bills/{bill_id}/payments``), so this route rewrites the
    frontend's flat ``/vendor-payments`` body to that nested path.
    """
    import json as _json

    raw = await request.body()
    try:
        payload = _json.loads(raw) if raw else {}
    except ValueError:
        payload = {}
    bill_id = payload.get("bill_id") or payload.get("vendor_bill_id")
    if not bill_id:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "BAD_REQUEST",
                    "message": "bill_id is required to record a vendor payment",
                },
                "service": "purchase",
            },
        )
    # The bill id travels in the path upstream; drop it from the body so the
    # payload matches purchase's VendorPaymentCreate exactly.
    payload.pop("bill_id", None)
    payload.pop("vendor_bill_id", None)
    return await _forward(request, f"/vendor-bills/{bill_id}/payments",
                          body=_json.dumps(payload).encode("utf-8"))
