"""Upgrade marketplace thumbnail URLs to a card-sized crop.

Scrapers store whichever image variant the marketplace grid markup exposes,
and that is often a tiny crop (ikman's search API hands out a 142x107
``cropped.jpg``). The public catalog renders cards at roughly 450 CSS px wide
inside a 16:10 frame — about 900 device px at 2x DPR — so a 142x107 source is
upscaled 6-7x and reads as blurred next to the source listing page.

ikman's CDN (``i.ikman-st.com``) serves any crop size from the same path, so
the stored URL can be rewritten in place, no bytes proxied by us and no
re-scrape needed. Applying the rewrite on read also fixes the ~200k rows that
already hold the 142x107 variant.
"""

from __future__ import annotations

import re
from typing import Optional
from urllib.parse import urlparse

# A 4:3 crop at this size covers a card without upscaling. The source images
# are 4:3+, so the browser's ``object-cover`` does the 16:10 crop.
TARGET_WIDTH = 1080
TARGET_HEIGHT = 810

# i.ikman-st.com/<slug>/<image-id>/<width>/<height>/cropped.jpg
_CROP_PATH_RE = re.compile(
    r"/(?P<width>\d{1,5})/(?P<height>\d{1,5})/cropped\.(?P<ext>jpe?g|webp|png)$",
    re.IGNORECASE,
)


def _is_ikman_cdn_host(host: str) -> bool:
    normalized = str(host or "").strip().lower().rstrip(".")
    return normalized == "ikman-st.com" or normalized.endswith(".ikman-st.com")


def upgrade_thumbnail_url(value: Optional[str]) -> Optional[str]:
    """Return a larger crop for known thumbnail CDNs; otherwise *value* as-is.

    Idempotent: a URL already at (or above) the target size is returned
    unchanged, and an already-upgraded URL round-trips without growing.
    """

    raw = str(value or "").strip()
    if not raw:
        return value

    match = _CROP_PATH_RE.search(raw)
    if not match:
        return value

    prefix = raw[: match.start()]
    if not _is_ikman_cdn_host(urlparse(prefix).hostname or ""):
        return value

    try:
        width = int(match.group("width"))
        height = int(match.group("height"))
    except (TypeError, ValueError):  # pragma: no cover - regex guarantees digits
        return value

    if width >= TARGET_WIDTH and height >= TARGET_HEIGHT:
        return value

    return f"{prefix}/{TARGET_WIDTH}/{TARGET_HEIGHT}/cropped.jpg"
