"""Lightweight thumbnail CDN cache utility.

Instead of downloading images, this module derives a *stable* CDN proxy URL
from each listing's original thumbnail URL using a SHA-256 hash.  The hash
is deterministic, so the same source URL always maps to the same cached path.

When ``CDN_BASE_URL`` is set (e.g. ``https://cdn.example.com``), URLs are
fully qualified.  Without it they fall back to a relative path
``/cdn/thumbnails/<prefix>/<hash>`` that a reverse-proxy rule can rewrite.

Typical usage in a sync pipeline::

    from app.utils.thumbnail_cache import backfill_thumbnail_cache
    updated = backfill_thumbnail_cache(db, batch_limit=100)
"""

import hashlib
import os
from typing import Optional

from sqlalchemy.orm import Session

from db.models import CarListing

CDN_BASE_URL: str = os.getenv("CDN_BASE_URL", "").rstrip("/")
_DEFAULT_BATCH_LIMIT: int = int(os.getenv("THUMBNAIL_BATCH_LIMIT", "100"))


def get_cdn_proxy_url(original_url: str) -> Optional[str]:
    """Return a stable CDN proxy URL derived from *original_url*.

    The output is deterministic: the same input always yields the same URL.
    Returns ``None`` when *original_url* is empty or blank.
    """
    if not original_url or not original_url.strip():
        return None
    url_hash = hashlib.sha256(original_url.strip().encode("utf-8")).hexdigest()
    prefix = url_hash[:2]
    base = CDN_BASE_URL.rstrip("/") if CDN_BASE_URL else ""
    return f"{base}/cdn/thumbnails/{prefix}/{url_hash}"


def backfill_thumbnail_cache(db: Session, batch_limit: int = _DEFAULT_BATCH_LIMIT) -> int:
    """Populate ``thumbnail_url_cached`` for listings that are missing it.

    Selects up to *batch_limit* ``CarListing`` rows that have a
    ``thumbnail_url`` but a ``NULL`` ``thumbnail_url_cached``, computes the
    stable CDN proxy URL for each, and commits the batch.

    Returns the number of rows updated.
    """
    rows = (
        db.query(CarListing)
        .filter(
            CarListing.thumbnail_url.isnot(None),
            CarListing.thumbnail_url_cached.is_(None),
        )
        .limit(batch_limit)
        .all()
    )

    updated = 0
    for listing in rows:
        cached_url = get_cdn_proxy_url(listing.thumbnail_url)
        if cached_url:
            listing.thumbnail_url_cached = cached_url
            updated += 1

    if updated:
        db.commit()

    return updated
