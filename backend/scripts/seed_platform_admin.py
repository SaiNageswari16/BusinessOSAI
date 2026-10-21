"""Create the Platform Super Admin account.

The platform admin is the only account that can manage tenants, toggle module
plugins, edit permissions and policies, and run break-glass. It lives in a
separate realm from tenant users, and it is created ONCE, out of band, by this
script — deliberately never by the service at startup. That is the whole point:
an account whose password is committed to the repository is the single highest
impact defect a platform can ship with, and the platform admin is the account
that can reach every tenant.

Password resolution, in order:
  1. ``--password``
  2. ``PLATFORM_ADMIN_PASSWORD`` (env or ``.env``)
  3. interactive prompt, when stdin is a TTY
  4. error

There is no default and no fallback. Use ``--generate`` to mint a random
password that is printed exactly once; it is not written anywhere, so keep the
terminal output.

Usage:
    python scripts/seed_platform_admin.py                     # create (from .env)
    python scripts/seed_platform_admin.py --generate          # create, print once
    python scripts/seed_platform_admin.py --reset             # rotate password only
    python scripts/seed_platform_admin.py --force             # overwrite existing
    python scripts/seed_platform_admin.py --list
    python scripts/seed_platform_admin.py --deactivate
    python scripts/seed_platform_admin.py --remove --confirm

``create`` is idempotent: it reports an existing account and exits 0. Only
``--force`` overwrites one.
"""
from __future__ import annotations

import argparse
import asyncio
import getpass
import os
import secrets
import string
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from src.config import get_settings  # noqa: E402
from src.services.platform.models import (  # noqa: E402
    PlatformAdmin,
    PlatformAdminRole,
)
from sqlalchemy import select  # noqa: E402

ADMIN_EMAIL_DEFAULT = "platform.admin@restaurantos.local"

MIN_PASSWORD_LENGTH = 12
MAX_PASSWORD_LENGTH = 128
_GENERATE_LENGTH = 24

ROLES = [r.value for r in PlatformAdminRole]


def _banner(text: str) -> None:
    print(f"\n{'=' * 66}\n  {text}\n{'=' * 66}")


def _die(message: str, code: int = 1) -> None:
    print(f"\nERROR: {message}", file=sys.stderr)
    sys.exit(code)


def _ok(message: str) -> None:
    print(f"  [ok] {message}")


def _info(message: str) -> None:
    print(f"  [info] {message}")


# ─── Password policy ─────────────────────────────────────────────────────────

def _password_ok(password: str) -> tuple[bool, str]:
    """Reject the passwords that actually end up in credential dumps."""
    if len(password) < MIN_PASSWORD_LENGTH:
        return False, f"too short ({len(password)}, need at least {MIN_PASSWORD_LENGTH})"
    if len(password) > MAX_PASSWORD_LENGTH:
        return False, f"too long ({len(password)}, max {MAX_PASSWORD_LENGTH})"
    if not any(c.islower() for c in password):
        return False, "missing a lowercase letter"
    if not any(c.isupper() for c in password):
        return False, "missing an uppercase letter"
    if not any(c.isdigit() for c in password):
        return False, "missing a digit"
    if not any(not c.isalnum() for c in password):
        return False, "missing a symbol"
    return True, ""


def _generate_password(length: int = _GENERATE_LENGTH) -> str:
    """A random password that satisfies the policy.

    Loops until one does rather than hand-assembling classes, because a
    hand-built password tends to have the letter or symbol in a predictable
    slot — which defeats the point of generating it at all.
    """
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()-_=+[]{}"
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(length))
        if _password_ok(candidate)[0]:
            return candidate


def _resolve_password(
    explicit: str | None, generate: bool
) -> tuple[str | None, str]:
    """Pick the password from the precedence chain above.

    Returns ``(password, provenance)``. ``password`` is None when nothing
    supplied one and there is no TTY to prompt on — the caller prints the
    instructions and stops.
    """
    if generate:
        return _generate_password(), "generated (--generate)"

    if explicit:
        return explicit, "from --password"

    settings = get_settings()
    env_value = getattr(settings, "platform_admin_password", None)
    if env_value:
        return env_value, "from PLATFORM_ADMIN_PASSWORD"

    if sys.stdin.isatty():
        while True:
            first = getpass.getpass("Enter platform admin password: ")
            if not _password_ok(first)[0]:
                _info(f"{_password_ok(first)[1]} — try again")
                continue
            second = getpass.getpass("Repeat it: ")
            if first != second:
                _info("Passwords did not match — try again")
                continue
            return first, "from interactive prompt"

    return None, ""


def _resolve_email(cli_value: str | None) -> str:
    if cli_value:
        return cli_value.strip().lower()
    settings = get_settings()
    env_email = getattr(settings, "platform_admin_email", None)
    default_email = (env_email or ADMIN_EMAIL_DEFAULT).lower()

    if sys.stdin.isatty():
        while True:
            try:
                entered = input(f"Enter platform admin email [{default_email}]: ").strip()
                if not entered:
                    return default_email
                if "@" not in entered or "." not in entered.split("@")[-1]:
                    _info("Please enter a valid email address (e.g. admin@domain.com)")
                    continue
                return entered.lower()
            except (EOFError, KeyboardInterrupt):
                return default_email

    return default_email


def _resolve_full_name(cli_value: str | None) -> str:
    if cli_value:
        return cli_value
    if sys.stdin.isatty():
        try:
            entered = input("Enter admin display name [Platform Administrator]: ").strip()
            if entered:
                return entered
        except (EOFError, KeyboardInterrupt):
            pass
    return "Platform Administrator"



# ─── Database ────────────────────────────────────────────────────────────────

async def _connect():
    """A session factory bound to the platform service's own database."""
    from src.services.shared.registry import get_descriptor
    from src.services.shared.service_db import ServiceDatabase
    from src.services.shared.service_factory import resolve_dsn

    descriptor = get_descriptor("platform")
    if descriptor is None:
        _die("Service 'platform' is not in the registry")
    return ServiceDatabase("platform", resolve_dsn(descriptor))


async def _ensure_schema(db) -> None:
    """Create the platform database and its tables if they are missing.

    A missing table here means the script ran before bootstrap, so rather than
    failing with an unhelpful OperationalError it creates what is needed and
    moves on. ``bootstrap_all`` is idempotent, so a fully bootstrapped
    database is unaffected.
    """
    from src.services.shared.schema_bootstrap import bootstrap_all
    from src.config import get_settings

    s = get_settings()
    results = await bootstrap_all(
        user=s.postgres_user,
        password=s.postgres_password,
        host=s.postgres_host,
        port=s.postgres_port,
        only=["platform"],
    )
    if any("error" in r for r in results):
        errors = [f"{r['service']}: {r['error']}" for r in results if "error" in r]
        _die(f"could not prepare the platform schema: {'; '.join(errors)}")
    for r in results:
        if r.get("db_created"):
            _info(f"created database {r['database']}")
        elif r.get("tables"):
            _info(f"database {r['database']} ready ({len(r['tables'])} tables)")


async def _find(db, email: str) -> int | None:
    """Return the admin's id, or None if there is no account at that email.

    Only the scalar id crosses the session boundary, so nothing can lazy-load
    an expired attribute after the session closes.
    """
    async with db.session_factory() as session:
        result = await session.execute(
            select(PlatformAdmin).where(PlatformAdmin.email == email.lower())
        )
        admin = result.scalar_one_or_none()
        return admin.id if admin is not None else None


# ─── Actions ─────────────────────────────────────────────────────────────────

async def _create_or_update(
    db, email: str, password: str, full_name: str, role: str, force: bool
) -> int:
    existing_id = await _find(db, email)
    if existing_id is not None and not force:
        _info(f"{email} already exists (id={existing_id})")
        _info("Use --force to overwrite it, or --reset to rotate only the password.")
        return 0

    from src.utils.security import hash_password

    # Everything happens inside one session: the object read here is attached
    # to it, so the commit below is what actually persists the change.
    async with db.session_factory() as session:
        result = await session.execute(
            select(PlatformAdmin).where(PlatformAdmin.email == email.lower())
        )
        admin = result.scalar_one_or_none()

        if admin is not None:
            admin.hashed_password = hash_password(password)
            if full_name:
                admin.full_name = full_name
            admin.role = role
            admin.is_active = True
            label = "updated"
        else:
            admin = PlatformAdmin(
                email=email.lower(),
                hashed_password=hash_password(password),
                full_name=full_name or "Platform Administrator",
                role=role,
                is_active=True,
                mfa_enabled=False,
            )
            session.add(admin)
            label = "created"

        await session.commit()
        _ok(f"platform admin {label}: {email}")
        _info(f"role={role}")
        _info("MFA is not enabled on this account — set mfa_enabled before real use.")
    return 0


async def _reset_password(db, email: str, password: str) -> int:
    from src.utils.security import hash_password

    if await _find(db, email) is None:
        _die(f"no platform admin at {email} — run without --reset to create one")

    async with db.session_factory() as session:
        result = await session.execute(
            select(PlatformAdmin).where(PlatformAdmin.email == email.lower())
        )
        admin = result.scalar_one()
        admin.hashed_password = hash_password(password)
        # Any pre-existing platform token for this admin stays valid for its
        # remaining lifetime. There is no session store to revoke against, so
        # the honest remedy is a short token TTL, which is already in place.
        await session.commit()
        session.expire_all()
    _ok(f"password rotated for {email}")
    return 0


async def _list_admins(db) -> int:
    async with db.session_factory() as session:
        result = await session.execute(
            select(PlatformAdmin).order_by(PlatformAdmin.created_at)
        )
        admins = list(result.scalars().all())
        # Detach the scalar values before the session closes so nothing
        # lazily loads afterwards.
        rows = [
            (a.email, a.role, a.is_active,
             a.last_login_at.isoformat() if a.last_login_at else "-")
            for a in admins
        ]

    if not rows:
        _info("no platform admins exist yet")
        return 0

    print(f"\n{'email':44s} {'role':14s} {'active':6s}  last_login")
    print("-" * 92)
    for email, role, is_active, last in rows:
        print(f"{email:44s} {role:14s} {str(is_active):6s}  {last}")
    print()
    # Password hashes are deliberately never printed — not here, not anywhere
    # else in this file.
    return 0


async def _set_active(db, email: str, active: bool) -> int:
    async with db.session_factory() as session:
        result = await session.execute(
            select(PlatformAdmin).where(PlatformAdmin.email == email.lower())
        )
        admin = result.scalar_one_or_none()
        if admin is None:
            await session.rollback()
            _die(f"no platform admin at {email}")
        admin.is_active = active
        await session.commit()
    _ok(f"{email} {'activated' if active else 'deactivated'}")
    return 0


async def _remove(db, email: str, confirm: bool) -> int:
    from sqlalchemy import delete

    if await _find(db, email) is None:
        _die(f"no platform admin at {email}")

    if not confirm:
        _die(
            "refusing to delete without --confirm\n"
            f"  this removes the platform admin {email} permanently.\n"
            "  Re-run with --remove --confirm."
        )

    remaining = await _count_admins(db)
    if remaining <= 1:
        _die(
            f"{email} is the last platform admin. Delete an admin with another "
            "active admin still in place, or deactivate it instead (--deactivate)."
        )

    async with db.session_factory() as session:
        await session.execute(
            delete(PlatformAdmin).where(PlatformAdmin.email == email.lower())
        )
        await session.commit()
    _ok(f"deleted platform admin {email}")
    return 0


async def _count_admins(db) -> int:
    from sqlalchemy import func

    async with db.session_factory() as session:
        result = await session.execute(select(func.count()).select_from(PlatformAdmin))
        return int(result.scalar() or 0)


# ─── Entrypoint ──────────────────────────────────────────────────────────────

def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create and manage the Platform Super Admin account.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split("Usage:")[1] if "Usage:" in (__doc__ or "") else None,
    )
    parser.add_argument("--email", help="Admin email (default: PLATFORM_ADMIN_EMAIL)")
    parser.add_argument("--password", help="Password, bypassing .env and the prompt")
    parser.add_argument("--generate", action="store_true",
                        help="Generate a random password and print it once")
    parser.add_argument("--full-name", help="Display name")
    parser.add_argument("--role", choices=ROLES, default="super_admin",
                        help="Admin role (default: super_admin)")
    parser.add_argument("--reset", action="store_true",
                        help="Rotate the password of an existing admin only")
    parser.add_argument("--force", action="store_true",
                        help="Overwrite an existing admin instead of skipping it")
    parser.add_argument("--list", action="store_true", help="List platform admins")
    parser.add_argument("--deactivate", action="store_true", help="Deactivate the admin")
    parser.add_argument("--activate", action="store_true", help="Re-activate the admin")
    parser.add_argument("--remove", action="store_true", help="Delete the admin")
    parser.add_argument("--confirm", action="store_true",
                        help="Actually delete with --remove")
    return parser


async def _run(args: argparse.Namespace) -> int:
    db = await _connect()
    try:
        await _ensure_schema(db)

        if args.list:
            return await _list_admins(db)

        # Actions needing target email
        if args.deactivate:
            email = (args.email or ADMIN_EMAIL_DEFAULT).lower()
            return await _set_active(db, email, False)
        if args.activate:
            email = (args.email or ADMIN_EMAIL_DEFAULT).lower()
            return await _set_active(db, email, True)
        if args.remove:
            email = (args.email or ADMIN_EMAIL_DEFAULT).lower()
            return await _remove(db, email, args.confirm)

        # Create and Reset flows: prompt for email, display name, and password
        email = _resolve_email(args.email)
        full_name = _resolve_full_name(args.full_name)
        password, provenance = _resolve_password(args.password, args.generate)
        if not password:
            _die(
                "no password supplied and no TTY to prompt on.\n"
                "  Set PLATFORM_ADMIN_PASSWORD in .env,\n"
                "  pass --password, or run interactively."
            )
        good, why = _password_ok(password)
        if not good:
            _die(f"password rejected: {why}")

        _banner("Platform Super Admin")
        _info(f"email     : {email}")
        _info(f"role      : {args.role}")
        _info(f"password  : {provenance}")
        if args.generate:
            # This is the only place the value ever appears. The account is
            # written before this line prints, so an interrupted run still
            # leaves a usable row with an unrecoverable password — which is
            # why --generate is documented as a terminal-output-only secret.
            _info(f"GENERATED PASSWORD: {password}")
            _info("Save it now. It is not stored anywhere and cannot be recovered.")

        if args.reset:
            return await _reset_password(db, email, password)
        return await _create_or_update(db, email, password, full_name, args.role, args.force)
    finally:
        await db.dispose()


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()
    return asyncio.run(_run(args))


if __name__ == "__main__":
    raise SystemExit(main())
