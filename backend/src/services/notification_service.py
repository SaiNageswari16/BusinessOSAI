"""Notification helpers — template rendering and the variable registry.

Templates use `{{double_brace}}` placeholders. Rendering is deliberately simple
and dependency-free: it only substitutes, never evaluates. An unknown
placeholder is left visible rather than silently blanked, so a typo shows up in
the preview instead of in a customer's WhatsApp.
"""
import re
from datetime import datetime, timezone

# Variables the system fills in automatically, by event
SUPPORTED_VARIABLES: set[str] = {
    # Customer
    "customer_name",
    "customer_phone",
    "customer_email",
    # Order
    "order_number",
    "order_type",
    "order_total",
    "table_number",
    "covers",
    "waiter_name",
    # Bill
    "bill_number",
    "bill_total",
    "paid_amount",
    "due_amount",
    "payment_method",
    # Reservation
    "reservation_id",
    "reservation_time",
    "reservation_date",
    # Loyalty
    "points_balance",
    "points_earned",
    "points_redeemed",
    "tier",
    # Wallet / gift card
    "wallet_balance",
    "gift_card_number",
    "gift_card_balance",
    # Outlet
    "outlet_name",
    "outlet_phone",
    "outlet_address",
    # Feedback
    "rating",
    "feedback_link",
    # Generic
    "date",
    "time",
    "link",
    "message",
}

_PLACEHOLDER = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")


def render_template(template: str | None, variables: dict | None) -> str | None:
    """Substitute `{{name}}` placeholders with values from `variables`."""
    if not template:
        return template

    values = variables or {}

    def _substitute(match: re.Match) -> str:
        key = match.group(1)
        if key in values:
            value = values[key]
            # Money and numbers render without trailing .00 noise
            if isinstance(value, float) and value.is_integer():
                return str(int(value))
            return str(value)
        # Leave unknown placeholders visible so they are obvious in a preview
        return match.group(0)

    return _PLACEHOLDER.sub(_substitute, template)


def extract_variables(template: str | None) -> list[str]:
    """Every placeholder used in a template, de-duplicated and sorted."""
    if not template:
        return []
    return sorted(set(_PLACEHOLDER.findall(template)))


def validate_variables(template: str | None, declared: list[str]) -> list[str]:
    """Placeholders used but not declared — the caller should reject these."""
    used = set(extract_variables(template))
    declared_set = {d.strip() for d in (declared or [])}
    return sorted(used - declared_set)


def default_variables() -> dict:
    """A baseline context so previews look realistic."""
    now = datetime.now(timezone.utc)
    return {
        "customer_name": "Rahul Sharma",
        "customer_phone": "+919876543210",
        "order_number": "ORD-000123",
        "bill_number": "INV-000456",
        "bill_total": "1,250.00",
        "table_number": "T12",
        "covers": "4",
        "waiter_name": "Amit",
        "outlet_name": "LazyMonkeyai Kitchen",
        "date": now.strftime("%d %b %Y"),
        "time": now.strftime("%I:%M %p"),
    }


# ─── Event catalogue ─────────────────────────────────────────────
# The events a restaurant typically notifies on. Used by the template editor
# to offer a dropdown and by the docs to explain what triggers each one.

EVENTS: dict[str, str] = {
    "bill_generated": "A bill was generated and sent to the guest",
    "payment_received": "Payment was captured",
    "payment_failed": "A payment attempt failed",
    "order_confirmed": "An order (dine-in or delivery) was confirmed",
    "order_ready": "Food is ready for pickup or delivery",
    "kot_cancelled": "A kitchen ticket item was cancelled",
    "reservation_confirmed": "A table booking was confirmed",
    "reservation_reminder": "Reminder ahead of a booking",
    "birthday_wish": "Birthday greeting with an offer",
    "anniversary_wish": "Anniversary greeting with an offer",
    "loyalty_earned": "Points were credited",
    "loyalty_redeemed": "Points were redeemed",
    "wallet_topup": "Stored credit was added",
    "gift_card_issued": "A gift card was issued to a buyer",
    "feedback_request": "Rating request after a visit",
    "low_stock_alert": "An ingredient fell to its reorder level",
    "day_close_summary": "End-of-day summary to the manager",
}


def event_description(event: str) -> str:
    return EVENTS.get(event, "Custom event")
