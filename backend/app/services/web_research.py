"""Lightweight web research helper for chat context augmentation.

Queries DuckDuckGo Instant Answer API and returns a small list of
{title, url, snippet, source} dicts. Fails open — any exception returns [].
"""

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_DDG_API = "https://api.duckduckgo.com/"
_MAX_SNIPPET_LEN = 300
_REQUEST_TIMEOUT = 5.0

_VEHICLE_HINTS = {
    "car", "cars", "vehicle", "vehicles", "auto", "automotive",
    "review", "reviews", "price", "buy", "sell",
    "toyota", "honda", "nissan", "suzuki", "mitsubishi", "bmw",
    "mercedes", "hyundai", "kia", "mazda", "subaru", "ford",
    "volkswagen", "vw", "audi", "lexus", "isuzu", "perodua",
    "petrol", "diesel", "hybrid", "electric", "ev",
    "suv", "sedan", "hatchback", "pickup", "wagon",
}


def _is_vehicle_query(query: str) -> bool:
    tokens = set(query.lower().split())
    return bool(tokens & _VEHICLE_HINTS)


def _truncate(text: str, max_len: int = _MAX_SNIPPET_LEN) -> str:
    text = text.strip()
    if len(text) <= max_len:
        return text
    truncated = text[:max_len]
    last_space = truncated.rfind(" ")
    if last_space > max_len // 2:
        truncated = truncated[:last_space]
    return truncated + "…"


def research_vehicle_query(query: str, *, limit: int = 3) -> list[dict[str, Any]]:
    """Return up to *limit* web snippets for *query*.

    Tries DuckDuckGo Instant Answer API (no API key required).
    Always returns a list; returns [] on any network or parse failure.
    """
    if not query or len(query.strip()) < 4:
        return []

    q = query.strip()
    if _is_vehicle_query(q) and "sri lanka" not in q.lower():
        q = f"{q} Sri Lanka"

    results: list[dict[str, Any]] = []

    try:
        with httpx.Client(timeout=_REQUEST_TIMEOUT) as client:
            response = client.get(
                _DDG_API,
                params={
                    "q": q,
                    "format": "json",
                    "no_redirect": "1",
                    "no_html": "1",
                    "skip_disambig": "1",
                },
                headers={"User-Agent": "Motormila-Research/1.0 (vehicle market assistant)"},
            )
        response.raise_for_status()
        data: dict[str, Any] = response.json()

        abstract = (data.get("Abstract") or "").strip()
        abstract_url = (data.get("AbstractURL") or "").strip()
        abstract_source = (data.get("AbstractSource") or "Web").strip()
        if abstract and abstract_url:
            results.append({
                "title": abstract_source,
                "url": abstract_url,
                "snippet": _truncate(abstract),
                "source": "duckduckgo_abstract",
            })

        for topic in data.get("RelatedTopics") or []:
            if len(results) >= limit:
                break
            if not isinstance(topic, dict):
                continue
            text = (topic.get("Text") or "").strip()
            url = (topic.get("FirstURL") or "").strip()
            if not text or not url:
                continue
            title = text.split(".")[0][:80].strip() or "Related"
            results.append({
                "title": title,
                "url": url,
                "snippet": _truncate(text),
                "source": "duckduckgo_related",
            })

        for result in data.get("Results") or []:
            if len(results) >= limit:
                break
            if not isinstance(result, dict):
                continue
            text = (result.get("Text") or "").strip()
            url = (result.get("FirstURL") or "").strip()
            if not text or not url:
                continue
            title = text.split(".")[0][:80].strip() or "Result"
            results.append({
                "title": title,
                "url": url,
                "snippet": _truncate(text),
                "source": "duckduckgo_result",
            })

    except Exception as exc:
        logger.debug("web_research failed for %r: %s", query, exc)

    return results[:limit]
