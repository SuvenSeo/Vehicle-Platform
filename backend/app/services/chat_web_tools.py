"""Optional web research helpers for Motormila Copilot.

These tools are intentionally small and fail-open: chat should keep working
from database context even when public search or fetches are unavailable.
"""

from __future__ import annotations

import ipaddress
import socket
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import httpx
import structlog
from bs4 import BeautifulSoup

log = structlog.get_logger()

DUCKDUCKGO_HTML_URL = "https://html.duckduckgo.com/html/"
DUCKDUCKGO_API_URL = "https://api.duckduckgo.com/"
REQUEST_TIMEOUT_SECONDS = 5.0
MAX_SEARCH_RESULTS = 5
FETCH_TEXT_LIMIT = 2_000
FETCH_READ_LIMIT = 120_000
USER_AGENT = "MotormilaCopilot/1.0 (+https://motormila.vercel.app)"

ALLOWED_FETCH_DOMAINS = (
    "wikipedia.org",
    "nhtsa.gov",
    "cbsl.gov.lk",
)

CHAT_WEB_TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": (
                "Search the public web for current, external context. "
                "Use this only when Motormila database context is insufficient."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "A concise web search query.",
                    }
                },
                "required": ["query"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_url_text",
            "description": (
                "Fetch readable text from an allowlisted public source URL. "
                "Only wikipedia.org, nhtsa.gov, and cbsl.gov.lk URLs are supported."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "A full http(s) URL on an allowlisted public domain.",
                    }
                },
                "required": ["url"],
                "additionalProperties": False,
            },
        },
    },
]


def _clean_text(value: Any, *, limit: int = 500) -> str:
    text = " ".join(str(value or "").split())
    return text[:limit].strip()


def _is_http_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _clean_result_url(raw_url: str) -> str:
    url = str(raw_url or "").strip()
    if not url:
        return ""
    parsed = urlparse(url)
    if parsed.netloc.endswith("duckduckgo.com") and parsed.path.startswith("/l/"):
        uddg = parse_qs(parsed.query).get("uddg", [""])[0]
        if uddg:
            url = unquote(uddg)
    return url if _is_http_url(url) else ""


def _append_result(
    rows: list[dict[str, str]],
    *,
    title: str,
    url: str,
    snippet: str,
    seen: set[str],
) -> None:
    cleaned_url = _clean_result_url(url)
    cleaned_title = _clean_text(title, limit=180)
    if not cleaned_url or not cleaned_title or cleaned_url in seen:
        return
    seen.add(cleaned_url)
    rows.append(
        {
            "title": cleaned_title,
            "url": cleaned_url,
            "snippet": _clean_text(snippet, limit=500),
        }
    )


def _parse_duckduckgo_html(html: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html or "", "lxml")
    rows: list[dict[str, str]] = []
    seen: set[str] = set()

    for result in soup.select(".result"):
        link = result.select_one("a.result__a") or result.select_one("a[href]")
        if not link:
            continue
        snippet_el = result.select_one(".result__snippet")
        _append_result(
            rows,
            title=link.get_text(" ", strip=True),
            url=str(link.get("href") or ""),
            snippet=snippet_el.get_text(" ", strip=True) if snippet_el else "",
            seen=seen,
        )
        if len(rows) >= MAX_SEARCH_RESULTS:
            break
    return rows


def _iter_related_topics(items: list[Any]):
    for item in items:
        if not isinstance(item, dict):
            continue
        nested = item.get("Topics")
        if isinstance(nested, list):
            yield from _iter_related_topics(nested)
        else:
            yield item


def _parse_duckduckgo_api(payload: dict[str, Any]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    seen: set[str] = set()

    abstract = _clean_text(payload.get("AbstractText"), limit=500)
    abstract_url = str(payload.get("AbstractURL") or "")
    heading = str(payload.get("Heading") or "DuckDuckGo result")
    if abstract and abstract_url:
        _append_result(rows, title=heading, url=abstract_url, snippet=abstract, seen=seen)

    direct_results = payload.get("Results")
    if isinstance(direct_results, list):
        for item in direct_results:
            if not isinstance(item, dict):
                continue
            _append_result(
                rows,
                title=str(item.get("Text") or item.get("FirstURL") or "DuckDuckGo result"),
                url=str(item.get("FirstURL") or ""),
                snippet=str(item.get("Text") or ""),
                seen=seen,
            )
            if len(rows) >= MAX_SEARCH_RESULTS:
                return rows

    related = payload.get("RelatedTopics")
    if isinstance(related, list):
        for item in _iter_related_topics(related):
            text = str(item.get("Text") or "")
            title = text.split(" - ", 1)[0] if text else "DuckDuckGo result"
            _append_result(
                rows,
                title=title,
                url=str(item.get("FirstURL") or ""),
                snippet=text,
                seen=seen,
            )
            if len(rows) >= MAX_SEARCH_RESULTS:
                break
    return rows


def search_web(query: str, *, client: httpx.Client | None = None) -> list[dict[str, str]]:
    """Return up to five DuckDuckGo results as ``{title, url, snippet}`` rows."""
    cleaned = _clean_text(query, limit=300)
    if not cleaned:
        return []

    owns = client is None
    http = client or httpx.Client(timeout=REQUEST_TIMEOUT_SECONDS, follow_redirects=True)
    headers = {"User-Agent": USER_AGENT}
    try:
        try:
            response = http.get(DUCKDUCKGO_HTML_URL, params={"q": cleaned}, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
            response.raise_for_status()
            rows = _parse_duckduckgo_html(response.text)
            if rows:
                return rows[:MAX_SEARCH_RESULTS]
        except Exception as exc:
            log.warning("chat_web_search_html_failed", error=str(exc))

        response = http.get(
            DUCKDUCKGO_API_URL,
            params={"q": cleaned, "format": "json", "no_html": "1", "skip_disambig": "1"},
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            return []
        return _parse_duckduckgo_api(payload)[:MAX_SEARCH_RESULTS]
    except Exception as exc:
        log.warning("chat_web_search_failed", error=str(exc))
        return []
    finally:
        if owns:
            http.close()


def _is_allowlisted_hostname(hostname: str) -> bool:
    host = hostname.strip(".").lower()
    return any(host == domain or host.endswith(f".{domain}") for domain in ALLOWED_FETCH_DOMAINS)


def _hostname_has_only_public_addresses(hostname: str, port: int) -> bool:
    try:
        infos = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except OSError as exc:
        log.warning("chat_web_dns_failed", hostname=hostname, error=str(exc))
        return False

    addresses = {item[4][0] for item in infos if item and item[4]}
    if not addresses:
        return False
    for address in addresses:
        try:
            ip = ipaddress.ip_address(address)
        except ValueError:
            return False
        if not ip.is_global:
            return False
    return True


def fetch_url_text(url: str, *, client: httpx.Client | None = None) -> str:
    """Fetch up to 2k chars of readable text from a safe, allowlisted URL."""
    cleaned = str(url or "").strip()
    if not _is_http_url(cleaned):
        return ""

    parsed = urlparse(cleaned)
    hostname = (parsed.hostname or "").strip().lower()
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if not hostname or not _is_allowlisted_hostname(hostname):
        return ""
    if not _hostname_has_only_public_addresses(hostname, port):
        return ""

    owns = client is None
    http = client or httpx.Client(timeout=REQUEST_TIMEOUT_SECONDS, follow_redirects=False)
    try:
        response = http.get(cleaned, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        content_type = str(response.headers.get("content-type") or "").lower()
        raw_text = response.text[:FETCH_READ_LIMIT]
        if "html" in content_type or "<html" in raw_text[:500].lower():
            soup = BeautifulSoup(raw_text, "lxml")
            for tag in soup(["script", "style", "noscript"]):
                tag.extract()
            text = soup.get_text(" ", strip=True)
        else:
            text = raw_text
        return _clean_text(text, limit=FETCH_TEXT_LIMIT)
    except Exception as exc:
        log.warning("chat_web_fetch_failed", url=cleaned, error=str(exc))
        return ""
    finally:
        if owns:
            http.close()
