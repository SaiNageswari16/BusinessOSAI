"""Phone number helpers.

Restaurants collect phone numbers from paper slips, WhatsApp messages and
payment terminals, so they arrive as "+91 98765 43210", "098765-43210",
"0091 9876543210" and so on. Every stored phone is digits-only so lookups and
uniqueness checks are reliable.
"""
import re

# Digits, optionally with a leading + we strip
_NON_DIGITS = re.compile(r"\D")


def clean_phone(value: str | None) -> str:
    """Strip to digits only — '+91 98765 43210' → '919876543210'."""
    if not value:
        return ""
    return _NON_DIGITS.sub("", value)


def to_e164(value: str | None, country_code: str = "91") -> str:
    """Best-effort E.164 with a default country code for local numbers.

    '9876543210' → '+919876543210'; an already-international number is
    returned unchanged apart from the '+' prefix.
    """
    digits = clean_phone(value)
    if not digits:
        return ""

    # Already international: 00-prefix or a country code longer than the
    # national number length
    if digits.startswith("00"):
        return "+" + digits[2:]
    if len(digits) == 10:
        return f"+{country_code}{digits}"
    if not digits.startswith(country_code) and len(digits) > 10:
        return "+" + digits
    return f"+{digits}"


def last_10(value: str | None) -> str:
    """The national number — matches regardless of country code formatting."""
    digits = clean_phone(value)
    return digits[-10:] if len(digits) >= 10 else digits


def is_valid_indian_mobile(value: str | None) -> bool:
    """10 digits starting 6-9, optionally prefixed with 91."""
    digits = clean_phone(value)
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    elif len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    return len(digits) == 10 and digits[0] in "6789"


def mask_phone(value: str | None) -> str:
    """For receipts and logs — '98765 43210' → 'XXXXX 43210'."""
    digits = clean_phone(value)
    if len(digits) < 5:
        return digits
    return "X" * (len(digits) - 5) + digits[-5:]
