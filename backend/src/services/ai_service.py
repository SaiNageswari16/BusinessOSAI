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


# ─── Structured-JSON multimodal generation (used by the recipe search) ──────
#
# The recipe-search feature needs the LLM to return a *structured recipe*
# (JSON matching a caller-provided schema), optionally grounded in an image of
# the dish, with Gemini/Claude failover. ``answer_question`` above stays as the
# copilot's free-text path; this is a second, JSON-output entry point that
# reuses the same provider cascade + ``_TIMEOUT``.


def _provider_order() -> list[str]:
    """The configured precedence order, with every provider appended after the
    configured ones so a single outage is never a total outage."""
    settings = get_settings()
    order = [
        name.strip().lower()
        for name in str(settings.ai_provider or "gemini").split(",")
        if name.strip()
    ]
    for name in ("gemini", "openai", "anthropic"):
        if name not in order:
            order.append(name)
    return order


async def _gemini_structured(
    system: str, user: str, image_b64: str | None, image_mime: str | None,
    schema: dict,
) -> str | None:
    settings = get_settings()
    if not settings.gemini_api_key:
        return None
    parts = [{"text": user}]
    if image_b64:
        parts.append({"inline_data": {"mime_type": image_mime or "image/jpeg", "data": image_b64}})
    gen_config: dict = {"temperature": 0.2, "maxOutputTokens": settings.ai_max_tokens}
    if schema:
        gen_config["responseMimeType"] = "application/json"
        if "responseSchema" in schema:
            gen_config["responseSchema"] = schema["responseSchema"]
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"{settings.ai_model_gemini}:generateContent",
                params={"key": settings.gemini_api_key},
                json={
                    "systemInstruction": {"parts": [{"text": system}]},
                    "contents": [{"parts": parts}],
                    "generationConfig": gen_config,
                },
            )
            response.raise_for_status()
            payload = response.json()
        return payload["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as exc:  # noqa: BLE001
        logger.warning("Gemini structured call failed: %s", exc)
        return None


async def _anthropic_structured(
    system: str, user: str, image_b64: str | None, image_mime: str | None,
    schema: dict,
) -> str | None:
    settings = get_settings()
    if not settings.anthropic_api_key:
        return None
    content: list[dict] = []
    if image_b64:
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": image_mime or "image/jpeg", "data": image_b64},
        })
    content.append({"type": "text", "text": user})
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
                    "max_tokens": settings.ai_max_tokens,
                    "system": system,
                    "messages": [{"role": "user", "content": content}],
                },
            )
            response.raise_for_status()
            payload = response.json()
        return "".join(block.get("text", "") for block in payload.get("content", [])) or None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Anthropic structured call failed: %s", exc)
        return None


async def _openai_structured(
    system: str, user: str, image_b64: str | None, image_mime: str | None,
    schema: dict,
) -> str | None:
    settings = get_settings()
    if not settings.openai_api_key:
        return None
    user_content: list[dict] = [{"type": "text", "text": user}]
    if image_b64:
        user_content.append({
            "type": "image_url",
            "image_url": {"url": f"data:{image_mime or 'image/jpeg'};base64,{image_b64}"},
        })
    body: dict = {
        "model": settings.ai_model_openai,
        "max_tokens": settings.ai_max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ],
    }
    if schema and "json_schema" in schema:
        body["response_format"] = {"type": "json_object"}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json=body,
            )
            response.raise_for_status()
            payload = response.json()
        return payload["choices"][0]["message"]["content"]
    except Exception as exc:  # noqa: BLE001
        logger.warning("OpenAI structured call failed: %s", exc)
        return None


def _structured_extra_user(user: str, schema: dict | None) -> str:
    """Fold the JSON-output instruction into the user prompt for providers
    that can't take a response schema (Anthropic, OpenAI). The Gemini path
    gets structured output natively, so for others the schema rides in the
    prompt text so the model knows the exact shape to produce."""
    if schema:
        hint = _recipe_json_schema_hint()
        return f"{user}\n\nOutput this exact shape (valid JSON, no prose):\n{hint}"
    return f"{user}\n\nReturn ONLY valid JSON — no prose, no markdown fences."


def _recipe_json_schema_hint() -> dict:
    """The documented JSON shape LLM recipe callers must ask for."""
    return {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "description": {"type": ["string", "null"]},
            "item_type": {"type": "string", "enum": ["veg", "non_veg", "beverage"]},
            "base_price": {"type": ["number", "null"]},
            "yield_qty": {"type": "number"},
            "ingredients": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "qty_per_portion": {"type": "number"},
                        "unit": {"type": "string"},
                        "wastage_pct": {"type": "number"},
                    },
                    "required": ["name", "qty_per_portion"],
                },
            },
        },
        "required": ["name", "ingredients"],
    }


async def generate_structured(
    system: str,
    user: str,
    image_b64: str | None = None,
    image_mime: str | None = None,
    schema: dict | None = None,
    provider_pref: str | None = None,
) -> tuple[str | None, str | None]:
    """Return ``(raw_json_text, provider_name)`` — the first provider to yield
    a non-empty result, in the configured precedence order. This is the
    "if one fails the other catches up" failover: a transient error on one
    provider is *not* retried here; the caller (recipe module) owns retry,
    and passes a *repaired* prompt back through this function on the next
    provider if JSON validation fails. Both None means every configured
    provider was unreachable/unkeyed.

    ``provider_pref``: 'gemini' | 'openai' | 'anthropic' forces that single
    provider (used when the client explicitly picks one); None runs the
    configured cascade."""
    handlers = {
        "gemini": _gemini_structured,
        "openai": _openai_structured,
        "anthropic": _anthropic_structured,
    }
    if provider_pref:
        order = [provider_pref]
    else:
        order = _provider_order()
    import asyncio as _asyncio

    last_error: str | None = None
    for name in order:
        handler = handlers.get(name)
        if handler is None:
            continue
        # Fold the JSON-output instruction into the user prompt for
        # non-Gemini providers (they have no native structured-output mode
        # in this raw-HTTP setup); Gemini gets it via responseMimeType.
        if name == "gemini":
            arg_user = user
        else:
            arg_user = _structured_extra_user(user, schema)
        # One retry with backoff per provider, so a transient 5xx/429 on a
        # provider that DOES have a key is not a total outage.
        text: str | None = None
        for attempt in range(2):
            text = await handler(system, arg_user, image_b64, image_mime, schema or {})
            if text and text.strip():
                break
            if attempt == 0:
                await _asyncio.sleep(0.4)
        if text and text.strip():
            return text.strip(), name
        last_error = f"{name}: no response (unkeyed or provider failed)"
    if last_error:
        logger.warning("generate_structured: all providers failed. last=%s", last_error)
    return None, None


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
