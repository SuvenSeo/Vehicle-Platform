"""Perceptual-hash (pHash) image dedup.

Reverses the earlier "do not build" call on photo AI: full inspection-grade
photo AI is still out of scope, but a 64-bit perceptual hash of each
listing's thumbnail is cheap and lets the listing-history report catch the
same physical vehicle re-listed with an edited year, district, or price —
the cases spec-based heuristic matching misses entirely.

``compute_phash`` never raises: a fetch/decode failure just means that
listing has no hash yet and is skipped by hash-based matching, which
degrades gracefully to the existing heuristic.
"""

from __future__ import annotations

import io

import httpx
import imagehash
import structlog
from PIL import Image
from sqlalchemy.orm import Session

from db.models import CarListing

log = structlog.get_logger()

_FETCH_TIMEOUT_SECONDS = 5.0
_MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB guard against oversized/hostile responses
_DEFAULT_BATCH_LIMIT = 200

# Two 64-bit pHashes differing by this many bits or fewer are treated as the
# same photo. 10 is a widely used near-duplicate threshold (out of 64 bits).
PHASH_MATCH_THRESHOLD = 10


def compute_phash(url: str, timeout: float = _FETCH_TIMEOUT_SECONDS) -> str | None:
    """Fetch *url* and return its 64-bit pHash as a 16-char hex string, or None."""
    if not url or not url.strip():
        return None
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            if len(resp.content) > _MAX_IMAGE_BYTES:
                return None
            image = Image.open(io.BytesIO(resp.content))
            image.load()
        return str(imagehash.phash(image))
    except Exception as exc:
        log.debug("image_phash_compute_failed", url=url, error=str(exc))
        return None


def hamming_distance(hash_a: str | None, hash_b: str | None) -> int | None:
    """Bit distance between two hex-encoded pHashes, or None if either is missing/invalid."""
    if not hash_a or not hash_b:
        return None
    try:
        return imagehash.hex_to_hash(hash_a) - imagehash.hex_to_hash(hash_b)
    except (ValueError, TypeError):
        return None


def is_same_photo(hash_a: str | None, hash_b: str | None, threshold: int = PHASH_MATCH_THRESHOLD) -> bool:
    distance = hamming_distance(hash_a, hash_b)
    return distance is not None and distance <= threshold


def backfill_image_phash(db: Session, batch_limit: int = _DEFAULT_BATCH_LIMIT) -> int:
    """Compute and store ``image_phash`` for listings that have a thumbnail but no hash yet.

    Mirrors :func:`app.utils.thumbnail_cache.backfill_thumbnail_cache`'s batch
    shape. Best-effort: a per-listing fetch/decode failure is logged and
    skipped rather than aborting the batch.
    """
    rows = (
        db.query(CarListing)
        .filter(
            CarListing.thumbnail_url.isnot(None),
            CarListing.image_phash.is_(None),
        )
        .limit(batch_limit)
        .all()
    )

    updated = 0
    for listing in rows:
        phash = compute_phash(listing.thumbnail_url)
        if phash:
            listing.image_phash = phash
            updated += 1

    if updated:
        db.commit()

    return updated
