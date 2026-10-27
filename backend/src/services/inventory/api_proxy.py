"""Inventory -> Purchase procurement proxy.

The retail frontend calls the procurement surface under
``/api/v1/inventory/procurement/*`` (suppliers, purchase requests/orders,
goods-received notes, vendor bills/payments, ...). That data actually lives in
the purchase service. One of the split rules is that a service never
duplicates another's tables, so this router is a thin forwarder over the mesh:
it rewrites the frontend's resource names onto the purchase service's canonical
routes and passes the call through, returning a clean 404 JSON when the
purchase service has no equivalent. No data is stored here.

Mounted in ``inventory/main.py`` alongside the inventory router, so the paths
serve at ``/api/v1/inventory/procurement/...``.
"""
from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import Response

from src.services.shared.identity import CurrentIdentity
from src.services.shared.registry import base_url, get_descriptor

logger = logging.getLogger("inventory.api_proxy")

router = APIRouter(prefix="/procurement", tags=["inventory-procurement"])

# Frontend resource name -> purchase-service resource name. The renames record
# what the split did to the procurement vocabulary ("suppliers" became
# "vendors", "goods-received-notes" became "grns"). Any procurement path whose
# first segment is NOT in this map has no purchase equivalent and gets a clean
# 404 rather than a mesh error.
_RESOURCE_MAP = {
    "suppliers": "vendors",
    "purchase-requests": "purchase-requests",
    "purchase-orders": "purchase-orders",
    "goods-received-notes": "grns",
    "vendor-bills": "vendor-bills",
    "vendor-payments": "vendor-payments",
    "credit-notes": "credit-notes",
    "debit-notes": "debit-notes",
    "purchase-returns": "purchase-returns",
}

# The methods the frontend actually issues on these resources. The extra
# PATCH/PUT are kept so an update call is forwarded rather than 405.
_METHODS = ("GET", "POST", "PATCH", "PUT", "DELETE")

_NOT_FOUND_BODY = '{"error":{"code":"NOT_FOUND"}}'


def _identity_headers(identity) -> dict:
    """X-Identity-* headers the gateway would set for a trusted hop.

    The purchase service trusts these the same way it trusts its own gateway:
    they carry the tenant the request acts for, the user, and the permissions.
    Mirrors ``gateway/app.py::_forwarded_headers`` and the cross-service reads
    in ``menu/recipe_ai.py``.
    """
    return {
        "X-Identity-User-Id": str(identity.user_id),
        "X-Identity-Tenant-Id": str(identity.tenant_id),
        "X-Identity-Email": identity.email,
        "X-Identity-Permissions": ",".join(sorted(identity.permissions)),
        "X-Identity-Is-Owner": "true" if identity.is_tenant_owner else "false",
        "X-Identity-Active-Outlet": (
            str(identity.active_outlet_id) if identity.active_outlet_id else ""
        ),
        "X-Identity-Allowed-Outlets": ",".join(
            str(o) for o in sorted(identity.allowed_outlet_ids, key=str)
        ),
    }


def _not_found() -> Response:
    """The clean 404 the split requires when a procurement path has no owner.

    A structured 404 keeps the UI from misreading a missing mesh route as a
    crash of the inventory backend.
    """
    return Response(content=_NOT_FOUND_BODY, status_code=404,
                    media_type="application/json")


async def _forward(request: Request, identity, purchase_path: str) -> Response:
    """Forward this request to the purchase service over the mesh.

    ``purchase_path`` is the segment after ``/api/v1/purchase``. The body and
    query string pass through untouched; only the host and path prefix change.
    """
    descriptor = get_descriptor("purchase")
    if descriptor is None:
        return _not_found()

    url = f"{base_url(descriptor)}/api/v1/purchase/{purchase_path}"
    if request.url.query:
        url = f"{url}?{request.url.query}"

    headers = _identity_headers(identity)
    if "content-type" in request.headers:
        headers["content-type"] = request.headers["content-type"]

    body = await request.body() or None
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            upstream = await client.request(
                request.method, url, content=body, headers=headers
            )
    except Exception as exc:
        # Purchase (or its registry entry) is unreachable. That reads as "no
        # such resource on the mesh", not a 500 — a 500 would make the UI think
        # the inventory backend itself crashed.
        logger.warning("procurement forward to purchase failed: %s", exc)
        return _not_found()

    # Purchase saying the route does not exist (404/405) is the "no equivalent
    # for this path" case — normalise it to the same clean 404 JSON.
    if upstream.status_code in (404, 405):
        return _not_found()

    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        media_type=upstream.headers.get("content-type", "application/json"),
    )


def _register(resource: str, purchase_resource: str) -> None:
    """GET/POST/PATCH/PUT/DELETE handlers for a resource and its tail.

    The tail covers item ids and sub-actions (``.../grns/{id}/qc``,
    ``.../vendors/merge-duplicates``, ``.../vendor-bills/{id}/cancel``) so a
    single endpoint pair forwards the whole resource surface.
    """

    async def collection(request: Request, identity: CurrentIdentity) -> Response:
        return await _forward(request, identity, purchase_resource)

    async def item(tail: str, request: Request,
                   identity: CurrentIdentity) -> Response:
        return await _forward(request, identity, f"{purchase_resource}/{tail}")

    for method in _METHODS:
        router.add_api_route(f"/{resource}", collection, methods=[method])
        router.add_api_route(f"/{resource}/{{tail:path}}", item,
                             methods=[method])


for _res, _purchase in _RESOURCE_MAP.items():
    _register(_res, _purchase)


# Catch-all: any other procurement path (supplier-contacts, supplier-performance,
# supplier-categories, blacklisted-suppliers, purchase-quotations, ocr/*,
# verify-gstin, analytics/*, ...) has no purchase equivalent. Return the clean
# 404 instead of a mesh 405/500. Registered last so the specific resource
# routes above win first.
@router.api_route("/{tail:path}", methods=list(_METHODS),
                  include_in_schema=False)
async def _unmapped(tail: str, request: Request,
                    identity: CurrentIdentity) -> Response:
    return _not_found()
