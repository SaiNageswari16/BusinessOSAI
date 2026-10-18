"""AI provider cascade — Gemini, OpenAI, Anthropic, then a local fallback.

Every caller gets a string back. If no provider is configured or they all fail,
the fallback summarises the computed context instead, so the copilot keeps
working offline rather than erroring.
"""
import logging
from typing import Any

import httpx

from src.config.settings import get_settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the operations copilot for a restaurant management system.
You answer questions about sales, menu performance, stock and staffing using
only the figures provided in the context block.

Rules:
- Never invent numbers. If the context does not contain something, say so.
- Keep answers short and concrete — a manager reads this between services.
- Format money as ₹1,23,456 and dates as 13 Oct 2026.
- When you name a top or worst performer, say the figure that qualifies it.
"""

_TIMEOUT = httpx.Timeout(30.0, connect=5.0)


def _build_prompt(message: str, context: dict, history: list[dict]) -> str:
    lines = ["Context for this outlet:", ""]
    for key, value in context.items():
        label = key.replace("_", " ").capitalize()
        lines.append(f"- {label}: {value}")
    lines.append("")

    if history:
        lines.append("Earlier in this conversation:")
        for turn in history[-6:]:
            role = turn.get("role", "user")
            lines.append(f"- {role}: {turn.get('content', '')}")
        lines.append("")

    lines.append(f"Question: {message}")
    return "\n".join(lines)


async def _gemini(prompt: str) -> str | None:
    settings = get_settings()
    if not settings.gemini_api_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"{settings.ai_model_gemini}:generateContent",
                params={"key": settings.gemini_api_key},
                json={
                    "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.3, "maxOutputTokens": 600},
                },
            )
            response.raise_for_status()
            payload = response.json()
        return payload["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as exc:  # noqa: BLE001 — a provider outage must not break chat
        logger.warning("Gemini call failed: %s", exc)
        return None


async def _openai(prompt: str) -> str | None:
    settings = get_settings()
    if not settings.openai_api_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json={
                    "model": settings.ai_model_openai,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 600,
                },
            )
            response.raise_for_status()
            payload = response.json()
        return payload["choices"][0]["message"]["content"]
    except Exception as exc:  # noqa: BLE001
        logger.warning("OpenAI call failed: %s", exc)
        return None


async def _anthropic(prompt: str) -> str | None:
    settings = get_settings()
    if not settings.anthropic_api_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": settings.ai_model_anthropic,
                    "max_tokens": 600,
                    "system": SYSTEM_PROMPT,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            response.raise_for_status()
            payload = response.json()
        return "".join(
            block.get("text", "") for block in payload.get("content", [])
        ) or None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Anthropic call failed: %s", exc)
        return None


def _fallback(message: str, context: dict) -> str:
    """A deterministic answer from the computed figures — no provider needed."""
    sales = context.get("total_sales", 0)
    bills = context.get("bill_count", 0)
    covers = context.get("total_covers", 0)
    avg = context.get("avg_ticket", 0)
    active = context.get("active_orders", 0)
    period = context.get("period", "the period")

    lowered = message.lower()

    if any(word in lowered for word in ("sales", "revenue", "earning", "turnover")):
        return (
            f"Over {period} this outlet did ₹{sales:,.0f} across {bills} bills "
            f"and {covers} covers, averaging ₹{avg:,.0f} per bill."
        )
    if any(word in lowered for word in ("kitchen", "prep", "order", "running")):
        return (
            f"There are {active} orders in progress right now. Over {period} "
            f"the outlet served {covers} covers on {bills} bills."
        )
    if any(word in lowered for word in ("average", "ticket", "per bill")):
        return f"The average bill is ₹{avg:,.0f} over {period} ({bills} bills)."

    return (
        f"Here is what I have for {period}: ₹{sales:,.0f} in sales, {bills} bills, "
        f"{covers} covers, an average ticket of ₹{avg:,.0f}, and {active} orders "
        f"currently in the kitchen. Ask me about sales, orders, or averages and "
        f"I can go deeper."
    )


async def answer_question(
    message: str,
    context: dict[str, Any],
    history: list[dict] | None = None,
) -> tuple[str, str | None]:
    """Return (reply, provider_name). provider_name is None for the fallback."""
    prompt = _build_prompt(message, context, history or [])
    settings = get_settings()

    # The configured order decides who is tried first
    providers = {
        "gemini": _gemini,
        "openai": _openai,
        "anthropic": _anthropic,
    }
    order = [
        name.strip().lower()
        for name in str(settings.ai_provider or "gemini").split(",")
        if name.strip()
    ]
    # Always try the rest afterwards so one outage is not a total outage
    for name in ("gemini", "openai", "anthropic"):
        if name not in order:
            order.append(name)

    for name in order:
        handler = providers.get(name)
        if handler is None:
            continue
        reply = await handler(prompt)
        if reply and reply.strip():
            return reply.strip(), name

    return _fallback(message, context), None
