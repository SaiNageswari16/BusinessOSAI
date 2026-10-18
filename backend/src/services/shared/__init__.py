"""Shared kernel — code every service may import.

Rules for this package:
  * NO SQLAlchemy models. A service's schema is private to it.
  * NO imports from any sibling service (pos, inventory, ...). Services are
    peers; they never reach into each other's code.
  * Dependencies limited to FastAPI/Pydantic/stdlib.
"""
