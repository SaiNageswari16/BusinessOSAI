"""Quick smoke test for the 3 AI recipe endpoints (menu service over HTTP).

Run:  python scripts/_smoke_ai_recipe.py
Mints a self-contained token (no auth service needed), then POSTs:
  /ai/recipe-search, /ai/recipe-reconcile, /ai/recipe-reorder
and prints the HTTP code + key fields. Expects degrade-to-catalog when the
LLM keys are empty (200, not 500)."""
from __future__ import annotations

import json
import os
import sys
import uuid
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.utils.security import create_access_token  # noqa: E402
from src.config.settings import get_settings  # noqa: E402

# A 401 here would mean the token was signed with a different key than
# the running menu service — sign it with the live .env key (86 chars)
# so it matches what the service verifies with.
_s = get_settings()
print('signing key prefix:', _s.secret_key[:6], '(len', len(_s.secret_key), ')')

BASE = os.environ.get("MENU_URL", "http://127.0.0.1:8102/api/v1/menu")

TENANT = uuid.uuid4()
USER = uuid.uuid4()
OUTLET = uuid.uuid4()
TOKEN = create_access_token(
    USER, TENANT,
    claims={
        "sub": str(USER),
        "email": "smoke@r.test",
        "full_name": "Smoke",
        "tenant_id": str(TENANT),
        "permissions": [
            "view:recipes", "view:inventory",
            "manage:purchase", "view:purchase", "view:menu",
            "*",
        ],
        "roles": ["owner"],
        "is_tenant_owner": True,
        "tenant_slug": "smoke",
        "active_outlet_id": str(OUTLET),
        "allowed_outlet_ids": [str(OUTLET)],
    },
)


def call(path: str, body: dict) -> tuple[int, dict]:
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TOKEN}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def main() -> int:
    s, body = call("/ai/recipe-search",
                   {"query": "biryani", "portions": 2, "limit": 3})
    err = str(body.get("error") or "")
    print(f"SEARCH      {s}  results={len(body.get('results', []))} "
          f"provider={body.get('provider_used')} "
          f"error={err[:80]!r}")
    assert s == 200, f"search must be 200 (degrade, not 500), got {s}: " \
                     f"{json.dumps(body)[:300]}"

    s2, b2 = call("/ai/recipe-reconcile",
                  {"recipe_name_or_id": "CAT-BUTTER-CHICKEN", "portions": 2})
    assert s2 == 200, f"reconcile must be 200, got {s2}: " \
                      f"{json.dumps(b2)[:300]}"
    line0 = b2.get("lines", [{}])[0]
    print(f"RECONCILE   {s2}  total={b2.get('total')} "
          f"line0_name={line0.get('name')!r} "
          f"line0_status={line0.get('status')!r}")

    s3, b3 = call("/ai/recipe-reorder",
                  {"recipe_name_or_id": "CAT-BUTTER-CHICKEN", "portions": 2})
    assert s3 == 200, f"reorder must be 200 (never 500), got {s3}: " \
                      f"{json.dumps(b3)[:300]}"
    reason = str(b3.get("reason") or "")
    print(f"REORDER     {s3}  created={b3.get('created')} "
          f"po_id={b3.get('po_id')} po_number={b3.get('po_number')} "
          f"lines={len(b3.get('lines', []))} reason={reason[:80]!r}")

    print("\nALL THREE ENDPOINTS OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
