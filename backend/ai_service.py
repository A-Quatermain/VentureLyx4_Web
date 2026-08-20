"""Unified multi-model AI service layer (Claude + GPT) with routing and cross-provider fallback."""
import os
import logging
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
from core import db, new_id

logger = logging.getLogger("ai_service")

# Model tiers per provider. Names verified against available_models list.
MODELS = {
    "claude": {
        "heavy": "claude-sonnet-5",
        "standard": "claude-sonnet-4-6",
        "cheap": "claude-haiku-4-5-20251001",
        "provider": "anthropic",
    },
    "gpt": {
        "heavy": "gpt-5.6-terra",
        "standard": "gpt-5.6-luna",
        "cheap": "gpt-5.4-mini",
        "provider": "openai",
    },
}

# Per-task routing: (tier, primary_family)
TASK_ROUTING = {
    "seo_recommendations": ("standard", "claude"),
    "page_generation": ("standard", "claude"),
    "review_response": ("standard", "gpt"),
    "next_best_action": ("standard", "claude"),
    "metric_explanation": ("cheap", "claude"),
    "blueprint": ("heavy", "gpt"),
    "default": ("standard", "claude"),
}

FRIENDLY_NAMES = {
    "claude-sonnet-5": "Claude Sonnet 5",
    "claude-sonnet-4-6": "Claude Sonnet 4.6",
    "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
    "gpt-5.6-terra": "GPT 5.6 Terra",
    "gpt-5.6-luna": "GPT 5.6 Luna",
    "gpt-5.4-mini": "GPT 5.4 Mini",
}


def _api_key(provider: str) -> str:
    if provider == "anthropic":
        return os.environ.get("ANTHROPIC_API_KEY") or os.environ["EMERGENT_LLM_KEY"]
    return os.environ.get("OPENAI_API_KEY") or os.environ["EMERGENT_LLM_KEY"]


def _resolve(task: str, preference: str = "auto"):
    """Return ordered list of (family, provider, model) to try (primary then fallback)."""
    tier, primary = TASK_ROUTING.get(task, TASK_ROUTING["default"])
    if preference in ("claude", "gpt"):
        primary = preference
    fallback = "gpt" if primary == "claude" else "claude"
    order = []
    for fam in (primary, fallback):
        cfg = MODELS[fam]
        order.append((fam, cfg["provider"], cfg[tier]))
    return order


async def _log_usage(business_id, task, provider, model, chars, ok):
    try:
        await db.ai_usage.insert_one({
            "id": new_id(),
            "business_id": business_id,
            "task": task,
            "provider": provider,
            "model": model,
            "approx_tokens": int(chars / 4),
            "success": ok,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.warning(f"usage log failed: {e}")


async def generate_stream(task, system, prompt, business_id=None, preference="auto"):
    """Async generator yielding text chunks. Falls back to the other provider on early failure."""
    order = _resolve(task, preference)
    last_err = None
    for idx, (family, provider, model) in enumerate(order):
        acc = ""
        started = False
        try:
            chat = LlmChat(
                api_key=_api_key(provider),
                session_id=f"{task}-{new_id()}",
                system_message=system,
            ).with_model(provider, model)
            async for ev in chat.stream_message(UserMessage(text=prompt)):
                if isinstance(ev, TextDelta):
                    started = True
                    acc += ev.content
                    yield ev.content
                elif isinstance(ev, StreamDone):
                    break
            await _log_usage(business_id, task, provider, model, len(acc), True)
            return
        except Exception as e:
            last_err = e
            logger.error(f"AI provider {provider}/{model} failed: {e}")
            await _log_usage(business_id, task, provider, model, len(acc), False)
            if started or idx == len(order) - 1:
                yield f"\n\n[AI temporarily unavailable: {str(e)[:120]}]"
                return
            # else try next provider (fallback)
    if last_err:
        yield f"[AI error: {str(last_err)[:120]}]"


async def generate_text(task, system, prompt, business_id=None, preference="auto") -> dict:
    """Non-streaming: accumulate stream. Returns {text, model, provider}."""
    order = _resolve(task, preference)
    for idx, (family, provider, model) in enumerate(order):
        acc = ""
        try:
            chat = LlmChat(
                api_key=_api_key(provider),
                session_id=f"{task}-{new_id()}",
                system_message=system,
            ).with_model(provider, model)
            async for ev in chat.stream_message(UserMessage(text=prompt)):
                if isinstance(ev, TextDelta):
                    acc += ev.content
                elif isinstance(ev, StreamDone):
                    break
            await _log_usage(business_id, task, provider, model, len(acc), True)
            return {"text": acc.strip(), "model": model, "model_name": FRIENDLY_NAMES.get(model, model), "provider": provider}
        except Exception as e:
            logger.error(f"AI provider {provider}/{model} failed: {e}")
            await _log_usage(business_id, task, provider, model, len(acc), False)
            if idx == len(order) - 1:
                return {"text": "", "error": str(e)[:200], "model": model, "provider": provider}
    return {"text": "", "error": "no model available"}
