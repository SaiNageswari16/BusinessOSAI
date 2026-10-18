"""Import each service's models and report why any of them fail.

``bootstrap_schema.py`` silently records a service as having "no models yet"
when its models module raises anything other than ModuleNotFoundError — it
logs at ERROR, but the report line makes a broken service and an unimplemented
one look identical. This surfaces the actual traceback so the two are
distinguishable.

Usage:  python scripts/check_models.py [service ...]
"""
from __future__ import annotations

import importlib
import os
import sys
import traceback

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)


def main(argv: list[str]) -> int:
    from src.services.shared.registry import all_services

    names = argv or [s.name for s in all_services()]
    failed = []

    for name in names:
        try:
            module = importlib.import_module(f"src.services.{name}.models")
        except ModuleNotFoundError as exc:
            if exc.name and exc.name.startswith("src.services."):
                print(f"{name:14s} no models module (expected)")
                continue
            print(f"{name:14s} ModuleNotFoundError: {exc}")
            traceback.print_exc()
            failed.append(name)
            continue
        except Exception as exc:  # noqa: BLE001
            print(f"{name:14s} {type(exc).__name__}: {exc}")
            traceback.print_exc()
            failed.append(name)
            continue

        from src.services.shared.service_db import service_base
        n = len(service_base(name).metadata.tables)
        print(f"{name:14s} OK — {n} tables")

    if failed:
        print(f"\n{len(failed)} service(s) failed to import: {failed}")
        return 1

    # Each service's tables must live in that service's registry alone. If two
    # services share a registry, create_all() writes both schemas into both
    # databases — the failure mode this whole module exists to prevent.
    owners: dict[str, list[str]] = {}
    for name in names:
        for table in service_base(name).metadata.tables:
            owners.setdefault(table, []).append(name)
    shared = {t: d for t, d in owners.items() if len(d) > 1}
    if shared:
        print(f"\nFAIL — tables shared by more than one service: {shared}")
        return 1
    print(f"\nAll requested models modules imported cleanly. "
          f"{len(owners)} table(s), each owned by exactly one service.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
