"""Single source of truth for all wall-clock time in the application.

BusinessOS customers operate in Indian business hours, but the backend can be
deployed anywhere (UTC servers, local dev machines). To make every timestamp
consistent — reference numbers, document dates, "today" checks, reminder
scheduling, PDF print headers — ALL time access goes through this module:

  - clock.now()      → current wall-clock in the configured APP_TIMEZONE
                       (default Asia/Kolkata), aware datetime
  - clock.today()    → current DATE in the configured APP_TIMEZONE
  - clock.utcnow()   → current instant in UTC, AWARE (drop-in for the old
                       naive datetime.utcnow(), which is deprecated in 3.12+)

Storage is unchanged: Postgres TIMESTAMPTZ columns store the same instant
regardless of the timezone tag, and the frontend always renders in the
viewer's system timezone. What this fixes is the *wall clock* used to
generate user-facing values (doc numbers, dates printed on documents,
"today" business-date logic), which previously followed whatever timezone
the server happened to run in.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo

from src.config.settings import get_settings


@lru_cache(maxsize=1)
def app_timezone() -> ZoneInfo:
    """The fixed application timezone (default IST). Cached — do not rebuild per call."""
    raw = (get_settings().app_timezone or "Asia/Kolkata").strip()
    try:
        return ZoneInfo(raw)
    except Exception:
        return ZoneInfo("Asia/Kolkata")


def now() -> datetime:
    """Current time in the application timezone (aware)."""
    return datetime.now(app_timezone())


def today() -> date:
    """Current date in the application timezone."""
    return datetime.now(app_timezone()).date()


def utcnow() -> datetime:
    """Current UTC instant (aware). Use for 'when did this happen' math;
    use now()/today() for user-facing wall-clock values."""
    return datetime.now(timezone.utc)


def utc_naive() -> datetime:
    """Current UTC instant WITHOUT tz info. For writing into legacy
    `TIMESTAMP WITHOUT TIME ZONE` columns that reject aware datetimes."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def tz(t: datetime) -> datetime:
    """Convert any naive/aware datetime into the application timezone (aware).
    Naive datetimes are assumed to already be in the app timezone."""
    if t.tzinfo is None:
        return t.replace(tzinfo=app_timezone())
    return t.astimezone(app_timezone())


def utc(t: datetime) -> datetime:
    """Normalize any naive/aware datetime to aware-UTC (assumes naive = UTC).
    Use before doing arithmetic between DB timestamps of unknown tz-ness."""
    if t.tzinfo is None:
        return t.replace(tzinfo=timezone.utc)
    return t.astimezone(timezone.utc)


class _Clock:
    """Namespace object so callers can write ``from src.utils.clock import clock``
    and use ``clock.now()`` / ``clock.today()`` / ``clock.utcnow()``."""
    _now = staticmethod(now)
    _today = staticmethod(today)
    _utcnow = staticmethod(utcnow)
    _utc_naive = staticmethod(utc_naive)
    _tz = staticmethod(tz)
    _utc = staticmethod(utc)
    _app_timezone = staticmethod(app_timezone)

    def now(self) -> datetime:
        return now()

    def today(self) -> date:
        return today()

    def utcnow(self) -> datetime:
        return utcnow()

    def utc_naive(self) -> datetime:
        return utc_naive()

    def tz(self, t: datetime) -> datetime:
        return tz(t)

    def utc(self, t: datetime) -> datetime:
        return utc(t)

    def app_timezone(self):
        return app_timezone()


clock = _Clock()


def utc(t: datetime) -> datetime:
    """Normalize any naive/aware datetime to aware-UTC (assumes naive = UTC).
    Use before doing arithmetic between DB timestamps of unknown tz-ness."""
    if t.tzinfo is None:
        return t.replace(tzinfo=timezone.utc)
    return t.astimezone(timezone.utc)
