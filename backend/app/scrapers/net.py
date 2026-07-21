from __future__ import annotations

import os
import random
import threading

DEFAULT_VIEWPORT = {"width": 1920, "height": 1080}
USER_AGENT_POOL = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
)
VIEWPORT_POOL = (
    {"width": 1920, "height": 1080},
    {"width": 1366, "height": 768},
    {"width": 1536, "height": 864},
    {"width": 1600, "height": 900},
)
_TRUTHY_VALUES = {"1", "true", "yes", "on"}
_PROXY_INDEX = 0
_PROXY_LOCK = threading.Lock()


def _env_truthy(name: str) -> bool:
    return str(os.getenv(name, "")).strip().lower() in _TRUTHY_VALUES


def _parse_proxy_pool() -> list[str]:
    raw = str(os.getenv("SCRAPE_PROXIES", "")).strip()
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


def get_proxy() -> str | None:
    single_proxy = str(os.getenv("SCRAPE_PROXY_URL", "")).strip()
    if single_proxy:
        return single_proxy

    proxy_pool = _parse_proxy_pool()
    if not proxy_pool:
        return None

    if len(proxy_pool) == 1:
        return proxy_pool[0]

    global _PROXY_INDEX
    with _PROXY_LOCK:
        proxy = proxy_pool[_PROXY_INDEX % len(proxy_pool)]
        _PROXY_INDEX += 1
    return proxy


def random_user_agent(default: str) -> str:
    if not _env_truthy("SCRAPE_ROTATE_UA"):
        return default
    return random.choice(USER_AGENT_POOL)


def random_viewport() -> dict:
    if not (_env_truthy("SCRAPE_ROTATE_UA") or _env_truthy("SCRAPE_ROTATE_VIEWPORT")):
        return dict(DEFAULT_VIEWPORT)
    return dict(random.choice(VIEWPORT_POOL))


def httpx_client_kwargs(default_headers: dict) -> dict:
    headers = dict(default_headers or {})
    default_ua = str(headers.get("User-Agent") or "")
    headers["User-Agent"] = random_user_agent(default_ua)

    kwargs: dict = {"headers": headers}
    proxy = get_proxy()
    if proxy:
        # httpx>=0.28 uses singular "proxy" argument for AsyncClient.
        kwargs["proxy"] = proxy
    return kwargs


def playwright_context_kwargs(default_ua: str) -> dict:
    return {
        "user_agent": random_user_agent(default_ua),
        "viewport": random_viewport(),
    }


def playwright_launch_proxy() -> dict | None:
    proxy = get_proxy()
    if not proxy:
        return None
    return {"server": proxy}


def stealth_init_script() -> str | None:
    if not _env_truthy("SCRAPE_STEALTH"):
        return None
    return """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
Object.defineProperty(navigator, 'platform', { get: () => navigator.platform || 'Win32' });
window.chrome = window.chrome || { runtime: {} };
"""
