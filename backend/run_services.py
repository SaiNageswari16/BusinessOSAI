"""Service runner — start/stop/status every microservice.

Usage:
    python run_services.py start [name ...]     # start all, or the named ones
    python run_services.py stop  [name ...]
    python run_services.py restart [name ...]
    python run_services.py status
    python run_services.py migrate              # create every service's schema

Logs go to <repo>/.services/<name>.log; PIDs to <repo>/.services/<name>.pid.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from src.services.shared.registry import all_services, get_descriptor  # noqa: E402

RUN_DIR = ROOT / ".services"
LOG_DIR = RUN_DIR / "logs"
GATEWAY_PORT = int(os.environ.get("GATEWAY_PORT", "8000"))


def _python() -> str:
    """Interpreter the services run under.

    Set PYTHON_BIN to override. Otherwise use the `sales` conda env when it
    exists, since that's where the pinned requirements are installed. Falls
    back to the current interpreter so the runner still works in a venv or CI.
    """
    override = os.environ.get("PYTHON_BIN")
    if override:
        return override
    conda_env = os.environ.get("CONDA_PREFIX") or os.environ.get("CONDA_DEFAULT_ENV")
    if conda_env:
        # Already running inside a conda env — keep it.
        return sys.executable
    for candidate in sorted(Path(os.environ.get("CONDA_ROOT", r"C:\Users\abhil\anaconda3"))
                            .joinpath("envs").glob("*/python.exe"), reverse=True):
        return str(candidate)
    return sys.executable


PYTHON_BIN = _python()


def _pid_file(name: str) -> Path:
    return RUN_DIR / f"{name}.pid"


def _pid_alive(pid: int) -> bool:
    """Is ``pid`` a running process?

    ``os.kill(pid, 0)`` is the POSIX idiom and is not trustworthy here. On
    Windows CPython implements it with OpenProcess + TerminateProcess, so it
    raises ``SystemError`` (WinError 87) for PIDs that are *alive* but that
    this process cannot open — the normal case, since the services were
    spawned by an earlier runner that has since exited. It also reports a
    reaped child as alive, so a stale PID file can look live.

    ``tasklist`` is ground truth on Windows, so that is what this uses there.
    """
    if os.name != "nt":
        try:
            os.kill(pid, 0)
            return True
        except (OSError, SystemError):
            return False
    try:
        out = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}", "/NH", "/FO", "CSV"],
            capture_output=True, text=True, timeout=10,
        ).stdout
    except Exception:  # noqa: BLE001
        # Can't tell. Report alive: a wrong "dead" deletes a running service's
        # PID file, and then `stop` can only find it by port.
        return True
    return f'"{pid}"' in out


def _read_pid(name: str) -> int | None:
    """The PID recorded for this service, or None if it is gone.

    A stale file — the process died without cleaning up — reads as None, and
    the file is removed so the next start doesn't think it is still running.
    """
    f = _pid_file(name)
    if not f.exists():
        return None
    try:
        pid = int(f.read_text().strip())
    except ValueError:
        f.unlink(missing_ok=True)
        return None
    if not _pid_alive(pid):
        f.unlink(missing_ok=True)
        return None
    return pid


def _target(name: str) -> tuple[str, int]:
    if name == "gateway":
        return "src.services.gateway.main:app", GATEWAY_PORT
    d = get_descriptor(name)
    if d is None:
        raise SystemExit(f"Unknown service '{name}'. Known: {[s.name for s in all_services()]}")
    return f"src.services.{name}.main:app", d.port


def _implemented(name: str) -> bool:
    """Does this service actually have code to run?

    The registry is a manifest: it declares every service in the target
    architecture, but only the implemented ones have a ``main.py``. Starting an
    unimplemented one would just crash with ModuleNotFoundError, so skip it.
    """
    if name == "gateway":
        return (ROOT / "src/services/gateway/main.py").exists()
    return (ROOT / f"src/services/{name}/main.py").exists()


def start(names: list[str]) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    # Create each service's own database and tables before launching it.
    #
    # Each service also does this itself on startup (see
    # ``ensure_service_schema`` in service_app.py), but doing it here too means
    # a fresh clone gets a working database from one command, and a schema
    # error is reported once instead of once per service log.
    wanted = [n for n in names if _implemented(n)]
    if wanted and os.environ.get("SKIP_MIGRATE", "").lower() not in ("1", "true"):
        asyncio.run(_migrate(wanted))

    skipped = []
    for name in names:
        if not _implemented(name):
            skipped.append(name)
            continue
        if _read_pid(name) is not None:
            print(f"  {name:14s} already running (pid {_read_pid(name)})")
            continue
        target, port = _target(name)
        log = open(LOG_DIR / f"{name}.log", "w", encoding="utf-8")
        flags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        if os.name == "nt":
            flags |= getattr(subprocess, "DETACHED_PROCESS", 0x00000008)
        proc = subprocess.Popen(
            [PYTHON_BIN, "-m", "uvicorn", target,
             "--port", str(port), "--host", "127.0.0.1"],
            cwd=ROOT, stdout=log, stderr=subprocess.STDOUT,
            creationflags=flags,
        )
        _pid_file(name).write_text(str(proc.pid))
        print(f"  {name:14s} started pid={proc.pid} port={port}")
    if skipped:
        print(f"\n  skipped (no implementation yet): {', '.join(skipped)}")


def _port_of(name: str) -> int:
    return _target(name)[1]


def _pids_on_port(port: int) -> list[int]:
    """Every PID listening on this port. Windows keeps orphaned listeners when
    a parent is killed by PID only, so this is the reliable stop path."""
    try:
        out = subprocess.run(
            ["netstat", "-ano"], capture_output=True, text=True, timeout=10
        ).stdout
    except Exception:
        return []
    pids: list[int] = []
    for line in out.splitlines():
        if f":{port}" in line and "LISTENING" in line:
            try:
                pids.append(int(line.split()[-1]))
            except (ValueError, IndexError):
                continue
    return pids


def _kill(pid: int) -> None:
    if os.name == "nt":
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True)
    else:
        import signal
        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            pass


def stop(names: list[str]) -> None:
    for name in names:
        port = _port_of(name)
        pids = set(_pids_on_port(port))
        pid = _read_pid(name)
        if pid is not None:
            pids.add(pid)
        if not pids:
            print(f"  {name:14s} not running")
            continue
        for p in pids:
            _kill(p)
        _pid_file(name).unlink(missing_ok=True)
        # Give the OS a moment to release the socket before anything rebinds.
        deadline = time.time() + 8
        while time.time() < deadline and _pids_on_port(port):
            time.sleep(0.3)
        print(f"  {name:14s} stopped (port {port} freed)")


def status() -> None:
    import urllib.error
    import urllib.request

    names = ["gateway"] + [s.name for s in all_services()]
    print(f"{'service':16s} {'port':6s} {'pid':8s} {'state':10s} db      bus")
    print("-" * 62)
    for name in names:
        _, port = _target(name)
        pid = _read_pid(name)
        state, db, bus = "down", "-", "-"
        if pid is None:
            # The PID file can go missing while the process lives on (a stale
            # file is pruned on read). Fall back to whoever owns the port so a
            # healthy service isn't reported as down.
            on_port = _pids_on_port(port)
            pid = on_port[0] if on_port else None
        if pid is not None:
            try:
                # Generous: the gateway's /health fans out to every service in
                # the registry, most of which are unimplemented and cost a
                # connect timeout each. A short timeout here reports a live
                # gateway as "starting", which reads as broken when it is not.
                with urllib.request.urlopen(
                    f"http://127.0.0.1:{port}/health", timeout=25
                ) as r:
                    import json
                    body = json.loads(r.read())
                    state = body.get("status", "up")
                    db = body.get("database", "-")
                    bus = body.get("event_bus", "-")
            except Exception:
                state = "starting"
        print(f"{name:16s} {port:<6d} {str(pid or '-'):8s} {state:10s} {db:6s}  {bus}")


def migrate(names: list[str] | None = None) -> None:
    """Create each service's own schema in its own database."""
    asyncio.run(_migrate(names))


async def _migrate(names: list[str] | None) -> None:
    from src.config import get_settings
    from src.services.shared.schema_bootstrap import _report, bootstrap_all

    s = get_settings()
    results = await bootstrap_all(
        user=s.postgres_user,
        password=s.postgres_password,
        host=s.postgres_host,
        port=s.postgres_port,
        only=names or None,
    )
    _report(results)
    if any("error" in r for r in results):
        raise SystemExit(1)


def main() -> None:
    ap = argparse.ArgumentParser(description="RestaurantOS service runner")
    ap.add_argument("action", choices=["start", "stop", "restart", "status", "migrate"])
    ap.add_argument("names", nargs="*", help="service names; default = all")
    ap.add_argument("--watch", action="store_true", help="Keep runner alive to supervise processes")
    args = ap.parse_args()

    if args.action == "migrate":
        migrate(args.names or None)
        return

    all_names = ["gateway"] + [s.name for s in all_services()]
    names = args.names or all_names
    unknown = [n for n in names if n != "gateway" and get_descriptor(n) is None]
    if unknown:
        raise SystemExit(f"Unknown service(s): {unknown}. Known: {all_names}")

    if args.action == "status":
        status()
        return
    if args.action in ("start", "restart"):
        if args.action == "restart":
            stop(names)
            time.sleep(1)
        start(names)
        print("\nWaiting for services to come up...")
        time.sleep(4)
        status()
        if args.watch:
            print("\nFleet running in watch mode. Press Ctrl+C to stop.")
            try:
                while True:
                    time.sleep(2)
            except KeyboardInterrupt:
                stop(names)
        return
    if args.action == "stop":
        stop(names)
        return


if __name__ == "__main__":
    main()
