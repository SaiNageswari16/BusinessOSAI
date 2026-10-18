"""Menu service — standalone ASGI app.

Run:  python -m uvicorn src.services.menu.main:app --port 8102
"""
from __future__ import annotations

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

from src.services.menu import models  # noqa: F401  (registers on this service's base)
from src.services.menu.api import router
from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service

TAGS = [
    {"name": "items", "description": "Menu items and pricing"},
    {"name": "categories", "description": "Menu categories"},
    {"name": "modifiers", "description": "Modifier groups and modifiers"},
    {"name": "recipes", "description": "Bills of materials (consumed by inventory)"},
    {"name": "combos", "description": "Combo deals"},
    {"name": "pricing", "description": "Time-based and bulk pricing rules"},
]

app, db = build_service("menu", [router], tags=TAGS)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.services.menu.main:app",
        host="127.0.0.1",
        port=get_descriptor("menu").port,
        reload=False,
        log_level="info",
    )
