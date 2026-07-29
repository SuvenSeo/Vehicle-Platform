from datetime import datetime
from app.utils.time import utc_now
import json
import os
from typing import Any, Dict, List, Literal, Optional
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from db.models import CarListing, MarketSignal, PriceAggregate, ScrapeRun
from db.session import get_db
from app.services.assistant_context import build_assistant_context
from app.services.chat_web_tools import CHAT_WEB_TOOL_DEFINITIONS, fetch_url_text, search_web
from app.services.rate_limit import RateLimiter
from app.utils.plan_limits import is_free_browse_plan
from app.utils.request_access import resolve_request_access
from fastapi import Header

router = APIRouter()

_chat_rate_limiter = RateLimiter(
    max_requests=20,
    window_seconds=60,
    message="Too many chat messages. Please wait a moment before trying again.",
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant").strip() or "llama-3.1-8b-instant"
GROQ_API_URL = os.getenv("GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions").strip()
MAX_CHAT_WEB_TOOL_CALLS = 2

KNOWN_DISTRICTS = [
    "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya", "Galle", "Matara", "Hambantota",
    "Jaffna", "Kilinochchi", "Mannar", "Vavuniya", "Batticaloa", "Ampara", "Trincomalee", "Kurunegala",
    "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla", "Monaragala", "Ratnapura", "Kegalle",
]

PLATFORM_CAPABILITIES = {
    "inventory": [
        "Live listings search with make/model/year/district/source filters",
        "Deal-score ranking and best-pick surfacing",
        "Listing detail and similar listing context",
    ],
    "analytics": [
        "District market concentration and average pricing",
        "Monthly trend insights from aggregates",
        "Estimator and comparative pricing guidance",
        "Official and import-cost market signals from DMT, Customs, and import reference sources",
    ],
    "operations": [
        "Pipeline status and scrape run visibility",
        "Source freshness visibility and run outcomes",
        "Live context refreshes on every chat request",
    ],
    "assistant": {
        "base_mode": "Rules + live database context",
        "llm_mode": "Optional server-side model when configured",
        "api_key_required": False,
    },
}


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=3000)


class ChatRequest(BaseModel):
    # No api_key field: the LLM key is server-side only and client-supplied
    # keys/models are never honoured (unknown payload fields are ignored).
    message: str = Field(..., min_length=1, max_length=2000)
    history: List[ChatMessage] = Field(default_factory=list, max_length=12)
    model: Optional[str] = Field(default=None, max_length=100)
    page_context: Optional[Dict[str, Any]] = None

    @field_validator("page_context")
    @classmethod
    def cap_page_context(cls, value: Optional[Dict[str, Any]]):
        if value is None:
            return value
        try:
            encoded = json.dumps(value, ensure_ascii=False, default=str)
        except (TypeError, ValueError) as exc:
            raise ValueError("page_context must be JSON serializable") from exc
        if len(encoded) > 6000:
            raise ValueError("page_context is too large")
        return value


def _compact(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = (
        str(value)
        .strip()
        .lower()
        .replace("-", "")
        .replace("_", "")
        .replace(" ", "")
        .replace(".", "")
    )
    return cleaned or None


def _compact_expr(column):
    return func.lower(
        func.replace(
            func.replace(
                func.replace(
                    func.replace(func.coalesce(column, ""), "-", ""),
                    "_",
                    "",
                ),
                " ",
                "",
            ),
            ".",
            "",
        )
    )


def _canonical_source(value: Optional[str]) -> Optional[str]:
    token = _compact(value)
    if not token:
        return None
    if token.startswith("ikman"):
        return "ikman"
    if token.startswith("riyasewana"):
        return "riyasewana"
    if token in {"autolanka", "autolankacom", "autolankalk", "autolankasite"}:
        return "autolanka"
    if token.startswith("autodirect"):
        return "autodirect"
    if token.startswith("patpat"):
        return "patpat"
    if token.startswith("autostream"):
        return "autostream"
    if token.startswith("carshop"):
        return "carshop"
    if token in {"saleme", "salemelk"}:
        return "saleme"
    if token in {"riyahub", "riyahublk"}:
        return "riyahub"
    if token in {"dimo", "carsatdimo", "dimoautomobiles"}:
        return "dimo"
    return token


def _fmt_price(value) -> str:
    if value is None:
        return "N/A"
    amount = float(value)
    if amount >= 1_000_000:
        return f"Rs. {amount / 1_000_000:.2f}M"
    return f"Rs. {amount:,.0f}"


def _find_token(message: str, choices: List[Optional[str]]) -> Optional[str]:
    msg = f" {message.lower()} "
    best = None
    for choice in choices:
        c = (choice or "").strip().lower()
        if not c:
            continue
        if f" {c} " in msg and (best is None or len(c) > len(best)):
            best = c
    return best.title() if best else None


def _district_from_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    lower = str(url).lower()
    for district in sorted(KNOWN_DISTRICTS, key=len, reverse=True):
        slug = district.lower().replace(" ", "-")
        if f"-for-sale-{slug}" in lower:
            return district
    return None


def _extract_year(message: str) -> Optional[int]:
    years = re.findall(r"\b(19\d{2}|20\d{2})\b", message)
    if not years:
        return None
    y = int(years[-1])
    return y if 1980 <= y <= utc_now().year + 1 else None


def _extract_price_cap(message: str) -> Optional[float]:
    msg = message.lower().replace(",", "")
    m = re.search(r"(under|below|less than|max|upto|up to)\s*rs?\.?\s*(\d+(?:\.\d+)?)\s*(m|mn|million|k|l|lakhs?)?", msg)
    if not m:
        return None
    amount = float(m.group(2))
    unit = (m.group(3) or "").strip()
    if unit in {"m", "mn", "million"}:
        return amount * 1_000_000
    if unit in {"l", "lakh", "lakhs"}:
        return amount * 100_000
    if unit == "k":
        return amount * 1_000
    if amount < 10_000:
        return amount * 1_000_000
    return amount


def _intent(message: str) -> str:
    msg = message.lower()
    if any(k in msg for k in ["find", "show", "search", "looking for", "recommend", "suggest"]):
        return "find"
    if any(k in msg for k in ["deal", "underpriced", "best buy", "best deal"]):
        return "deal"
    if any(k in msg for k in ["trend", "up", "down", "month", "history"]):
        return "trend"
    if any(k in msg for k in ["average", "avg", "price", "worth", "valuation", "how much"]):
        return "pricing"
    if any(k in msg for k in ["source", "pipeline", "sync", "fresh", "updated", "status"]):
        return "operations"
    return "overview"


def _env_flag(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _is_dev_environment() -> bool:
    value = (
        os.getenv("APP_ENV")
        or os.getenv("ENVIRONMENT")
        or os.getenv("SENTRY_ENVIRONMENT")
        or os.getenv("ENV")
        or "development"
    )
    return value.strip().lower() in {"dev", "development", "local", "test"}


def _chat_web_tools_enabled() -> bool:
    configured = os.getenv("CHAT_WEB_TOOLS")
    if configured is not None:
        return _env_flag(configured)
    if os.getenv("PYTEST_CURRENT_TEST"):
        return False
    return _is_dev_environment()


def _build_groq_prompt(
    message: str,
    context: Dict[str, Any],
    history: List[ChatMessage],
    *,
    hide_deal_scores: bool = False,
) -> List[Dict[str, Any]]:
    system_prompt = (
        "You are Motormila Copilot, the Sri Lankan vehicle marketplace assistant. "
        "Use ONLY the provided context and available tool results; do not invent listings, metrics, or operational states. "
        "If data is missing, clearly say it is unavailable. "
        "Adapt your answer to the user's current page context when provided. "
        "When user asks for actions that require server-side operations, explain exact steps/commands but do not pretend actions were executed. "
        "Respond in concise plain text with useful bullets."
    )
    if hide_deal_scores:
        system_prompt += (
            " This user is on the Free plan: never mention deal scores, fair-price scores, "
            "or ranking by deal quality. Suggest upgrading to Pro if they ask about scores."
        )
    system_prompt += (
        " Treat Motormila database context as the source of truth for platform listings and metrics. "
        "When web tool results are present, you may cite them for external context and should mention source titles or URLs."
    )

    history_text = "\n".join([f"{item.role.title()}: {item.content}" for item in history[-8:]]).strip()

    return [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": (
                (f"Conversation history:\n{history_text}\n\n" if history_text else "")
                + f"User question: {message}\n\n"
                + f"Platform context:\n{json.dumps(context, ensure_ascii=False, indent=2)}\n\n"
                + "Answer directly and reference relevant numbers from context."
            ),
        },
    ]


def _post_groq_chat(
    messages: List[Dict[str, Any]],
    *,
    api_key: str,
    model: str,
    tools: Optional[List[Dict[str, Any]]] = None,
    tool_choice: Optional[str] = None,
) -> Dict[str, Any]:
    body: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 700,
    }
    if tools:
        body["tools"] = tools
        body["tool_choice"] = tool_choice or "auto"

    with httpx.Client(timeout=20.0) as client:
        response = client.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )
    response.raise_for_status()
    data = response.json()
    message = data["choices"][0]["message"]
    return message if isinstance(message, dict) else {"content": str(message)}


def _call_groq(messages: List[Dict[str, Any]], *, api_key: str, model: str) -> str:
    message = _post_groq_chat(messages, api_key=api_key, model=model)
    return str(message.get("content") or "").strip()


def _dedupe_sources(rows: List[Dict[str, str]]) -> List[Dict[str, str]]:
    sources: List[Dict[str, str]] = []
    seen: set[str] = set()
    for row in rows:
        url = str(row.get("url") or "").strip()
        title = str(row.get("title") or url).strip()
        if not url or url in seen:
            continue
        seen.add(url)
        sources.append({"title": title[:180], "url": url})
        if len(sources) >= 5:
            break
    return sources


def _tool_call_id(tool_call: Dict[str, Any], index: int) -> str:
    return str(tool_call.get("id") or f"tool-call-{index}")


def _tool_call_name(tool_call: Dict[str, Any]) -> str:
    fn = tool_call.get("function") if isinstance(tool_call.get("function"), dict) else {}
    return str(fn.get("name") or tool_call.get("name") or "").strip()


def _tool_call_args(tool_call: Dict[str, Any]) -> Dict[str, Any]:
    fn = tool_call.get("function") if isinstance(tool_call.get("function"), dict) else {}
    raw_args = fn.get("arguments") or tool_call.get("arguments") or "{}"
    if isinstance(raw_args, dict):
        return raw_args
    try:
        parsed = json.loads(str(raw_args or "{}"))
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _execute_chat_web_tool(tool_call: Dict[str, Any]) -> tuple[str, List[Dict[str, str]]]:
    name = _tool_call_name(tool_call)
    args = _tool_call_args(tool_call)

    if name == "search_web":
        results = search_web(str(args.get("query") or ""))
        return json.dumps({"results": results}, ensure_ascii=False), _dedupe_sources(results)

    if name == "fetch_url_text":
        url = str(args.get("url") or "").strip()
        text = fetch_url_text(url)
        sources = _dedupe_sources([{"title": url, "url": url}]) if text else []
        return json.dumps({"url": url, "text": text}, ensure_ascii=False), sources

    return json.dumps({"error": f"Unsupported tool: {name}"}, ensure_ascii=False), []


def _call_groq_with_web_tools(
    messages: List[Dict[str, Any]],
    *,
    api_key: str,
    model: str,
) -> tuple[str, List[Dict[str, str]]]:
    first_message = _post_groq_chat(
        messages,
        api_key=api_key,
        model=model,
        tools=CHAT_WEB_TOOL_DEFINITIONS,
        tool_choice="auto",
    )
    tool_calls = first_message.get("tool_calls")
    if not isinstance(tool_calls, list) or not tool_calls:
        return str(first_message.get("content") or "").strip(), []

    capped_tool_calls = [call for call in tool_calls[:MAX_CHAT_WEB_TOOL_CALLS] if isinstance(call, dict)]
    if not capped_tool_calls:
        return str(first_message.get("content") or "").strip(), []

    assistant_tool_message = {
        "role": "assistant",
        "content": first_message.get("content"),
        "tool_calls": capped_tool_calls,
    }
    followup_messages: List[Dict[str, Any]] = [*messages, assistant_tool_message]
    sources: List[Dict[str, str]] = []

    for index, tool_call in enumerate(capped_tool_calls):
        content, tool_sources = _execute_chat_web_tool(tool_call)
        sources.extend(tool_sources)
        followup_messages.append(
            {
                "role": "tool",
                "tool_call_id": _tool_call_id(tool_call, index),
                "name": _tool_call_name(tool_call),
                "content": content,
            }
        )

    final_message = _post_groq_chat(followup_messages, api_key=api_key, model=model)
    return str(final_message.get("content") or "").strip(), _dedupe_sources(sources)


def _serialize_listing(row: CarListing) -> Dict[str, Any]:
    title = f"{row.make or ''} {row.model or ''} {f'({row.year})' if row.year else ''}".strip()
    district = row.district
    if not district or str(district).strip().lower() == "sri lanka":
        district = _district_from_url(row.url)

    return {
        "id": row.id,
        "title": title or (row.title or "Listing"),
        "price_lkr": float(row.price_lkr) if row.price_lkr is not None else None,
        "district": district,
        "deal_score": float(row.deal_score) if row.deal_score is not None else None,
        "source": row.source,
        "detail_url": f"/listing/{row.id}",
        "external_url": row.url,
    }


def _build_fallback_response(
    *,
    intent: str,
    scope_label: str,
    scope_total: int,
    avg_price,
    min_price,
    max_price,
    listing_cards: List[Dict[str, Any]],
    source_stats: List[Dict[str, Any]],
    run_status: List[Dict[str, Any]],
    market_signals: List[Dict[str, Any]],
    configured_for_groq: bool,
) -> str:
    tip = ""

    if intent == "find":
        if not listing_cards:
            return (
                f"I couldn't find active matches for {scope_label} with the current filters.\n"
                "Try widening make/model/year or budget constraints."
                + tip
            )
        lines = [f"Strong matches for {scope_label}:"]
        for item in listing_cards[:5]:
            score = item.get("deal_score")
            score_text = f" | deal score {score:.1f}" if isinstance(score, (int, float)) else ""
            lines.append(
                f"- {item['title']} | {_fmt_price(item.get('price_lkr'))} | {item.get('district') or 'Unknown district'}{score_text}"
            )
        return "\n".join(lines) + tip

    if intent == "deal":
        if not listing_cards:
            return (
                f"No high-confidence deals were found for {scope_label} right now.\n"
                "Try removing strict filters and ask again."
                + tip
            )
        lines = [f"Top deal opportunities for {scope_label}:"]
        for item in listing_cards[:5]:
            score = item.get("deal_score")
            lines.append(
                f"- {item['title']} | {_fmt_price(item.get('price_lkr'))} | score {float(score or 0):.1f} | {item.get('district') or 'Unknown district'}"
            )
        return "\n".join(lines) + tip

    if intent == "trend":
        return (
            f"Trend snapshot for {scope_label}:\n"
            f"- Active listings in scope: {scope_total}\n"
            f"- Average price: {_fmt_price(avg_price)}\n"
            f"- Price range: {_fmt_price(min_price)} to {_fmt_price(max_price)}\n"
            "Use the dashboard trend graph for month-by-month movement by model."
            + tip
        )

    if intent == "operations":
        source_text = ", ".join([f"{row['source']} ({row['count']})" for row in source_stats[:5]]) or "No source distribution available"
        run_text = ", ".join([f"{row['source']}: {row['status']}" for row in run_status[:4]]) or "No recent scrape status available"
        signal_text = ", ".join(
            [
                f"{row['source']} {row['signal_type']}={row.get('value_numeric')}"
                for row in market_signals[:4]
            ]
        ) or "No official/import signals available yet"
        return (
            "Platform operations snapshot:\n"
            f"- Active listings: {scope_total}\n"
            f"- Source distribution: {source_text}\n"
            f"- Latest scrape runs: {run_text}\n"
            f"- Market signals: {signal_text}\n"
            "I stay current by querying live listings and latest scrape runs on each request. "
            "I can guide runbooks, troubleshooting steps, and query strategies from this live data."
            + tip
        )

    if intent == "pricing":
        return (
            f"Price snapshot for {scope_label}:\n"
            f"- Active listings: {scope_total}\n"
            f"- Average price: {_fmt_price(avg_price)}\n"
            f"- Range: {_fmt_price(min_price)} to {_fmt_price(max_price)}\n"
            "Ask for 'best deals' to get high-scoring listing picks."
            + tip
        )

    return (
        f"Motormila live snapshot ({utc_now().strftime('%Y-%m-%d %H:%M UTC')}):\n"
        f"- Active listings: {scope_total}\n"
        f"- Market average: {_fmt_price(avg_price)}\n"
        f"- Price range: {_fmt_price(min_price)} to {_fmt_price(max_price)}\n"
        "Ask me about deals, trends, models, districts, sources, or scraper status."
        + tip
    )


@router.post("", response_model=dict)
def chat_assistant(
    payload: ChatRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    _chat_rate_limiter(request)
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    plan, role = resolve_request_access(request, authorization, db)
    hide_deal_scores = is_free_browse_plan(plan, role=role)

    bundle = build_assistant_context(
        db=db,
        message=message,
        page_context=payload.page_context,
        hide_deal_scores=hide_deal_scores,
    )
    context = bundle["context"]
    listing_cards = bundle["listing_cards"]

    configured_key = GROQ_API_KEY
    configured_model = GROQ_MODEL
    has_groq = bool(configured_key)
    web_tools_enabled = has_groq and _chat_web_tools_enabled()

    ai_response: Optional[str] = None
    web_sources: List[Dict[str, str]] = []
    if has_groq:
        clean_history = payload.history[-12:]
        if clean_history and clean_history[-1].role == "user" and clean_history[-1].content.strip() == message:
            clean_history = clean_history[:-1]
        try:
            groq_messages = _build_groq_prompt(
                message,
                context,
                clean_history,
                hide_deal_scores=hide_deal_scores,
            )
            if web_tools_enabled:
                ai_response, web_sources = _call_groq_with_web_tools(
                    groq_messages,
                    api_key=configured_key,
                    model=configured_model,
                )
            else:
                ai_response = _call_groq(
                    groq_messages,
                    api_key=configured_key,
                    model=configured_model,
                )
            if not ai_response:
                ai_response = None
                web_sources = []
        except Exception:
            ai_response = None
            web_sources = []

    response_text = ai_response or _build_fallback_response(
        intent=bundle["intent"],
        scope_label=bundle["scope_label"],
        scope_total=bundle["scope_total"],
        avg_price=bundle["avg_price"],
        min_price=bundle["min_price"],
        max_price=bundle["max_price"],
        listing_cards=listing_cards,
        source_stats=bundle["source_stats"],
        run_status=bundle["run_status"],
        market_signals=bundle["market_signals"],
        configured_for_groq=has_groq,
    )

    return {
        "response": response_text,
        "listings": listing_cards,
        "applied_filters": bundle["applied_filters"],
        "context_cards": bundle["context_cards"],
        "market_signals": bundle["market_signals"],
        "sources_used": bundle["sources_used"],
        "sources": web_sources,
        "context": {
            "generated_at": context.get("generated_at"),
            "intent": context.get("intent"),
            "scope": context.get("scope"),
            "current_page": context.get("current_page"),
        },
        "ai_powered": ai_response is not None,
        "provider": "groq" if ai_response is not None else "rules",
        "model": configured_model if ai_response is not None else None,
    }
