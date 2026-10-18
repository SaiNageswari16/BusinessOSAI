"""Staff service entry point.

Run directly:
    python -m src.services.staff.main
or via run_services.py, which imports `app` from this module.

The models import MUST come before build_service: that is what registers the
tables on this service's own metadata, which is what create_all reads during
the app's lifespan. Without it the database is created empty.
"""
from __future__ import annotations

from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service
from src.services.staff import models  # noqa: F401 - registers tables first
from src.services.staff.api import router as staff_router

TAGS = [
    {"name": "staff", "description": "Employees, rosters, attendance, tips, feedback"},
]

app, db = build_service("staff", [staff_router], tags=TAGS)


if __name__ == "__main__":
    import uvicorn

    descriptor = get_descriptor("staff")
    uvicorn.run(app, host="0.0.0.0", port=descriptor.port, log_level="info")
