"""API Gateway — standalone ASGI app.

Run:  python -m uvicorn src.services.gateway.main:app --port 8000
"""
from __future__ import annotations

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

from src.services.gateway.app import create_gateway

app = create_gateway()

if __name__ == "__main__":
    import os
    import uvicorn

    port = int(os.environ.get("GATEWAY_PORT", "8000"))
    uvicorn.run(
        "src.services.gateway.main:app",
        host="127.0.0.1",
        port=port,
        reload=False,
        log_level="info",
    )
