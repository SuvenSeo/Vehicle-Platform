import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import listings
from app.api.v1.endpoints.listings import _extract_seller_profile_from_html, _store_seller_profile_cache


def test_extract_seller_profile_from_source_html_uses_real_values():
    html = """
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "offers": {
            "@type": "Offer",
            "seller": {
              "@type": "Organization",
              "name": "Sell Fast | LSJ Computer Centre"
            }
          }
        }
        </script>
      </head>
      <body>
        <div>Verified Dealer</div>
        <div>Member since 2019</div>
        <div>142 listings sold</div>
        <div>18 Reviews</div>
        <div>4.2 / 5</div>
        <a href="tel:0768481559">Call</a>
        <a href="https://wa.me/94768481559">WhatsApp</a>
      </body>
    </html>
    """

    profile = _extract_seller_profile_from_html(
      source="ikman",
      detail_url="https://ikman.lk/en/ad/example",
      html=html,
    )

    assert profile["seller_name"] == "Sell Fast | LSJ Computer Centre"
    assert profile["seller_type"] == "dealer"
    assert profile["member_since"] == "2019"
    assert profile["listing_count"] == 142
    assert profile["review_count"] == 18
    assert profile["rating"] == 4.2
    assert profile["phone_numbers"]
    assert profile["whatsapp_numbers"]


def test_extract_seller_profile_does_not_invent_mock_metrics():
    html = """
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "offers": {
            "@type": "Offer",
            "seller": {
              "@type": "Person",
              "name": "J. Perera"
            }
          }
        }
        </script>
      </head>
      <body>
        <p>Direct owner listing</p>
      </body>
    </html>
    """

    profile = _extract_seller_profile_from_html(
      source="patpat",
      detail_url="https://patpat.lk/en/ad/example",
      html=html,
    )

    assert profile["seller_name"] == "J. Perera"
    assert profile["seller_type"] in {"private", "unknown"}
    assert profile["member_since"] is None
    assert profile["listing_count"] is None
    assert profile["review_count"] is None
    assert profile["rating"] is None


def test_seller_profile_cache_evicts_oldest_when_over_capacity():
    listings.SELLER_PROFILE_CACHE.clear()
    try:
        cap = listings.SELLER_PROFILE_CACHE_MAX_ENTRIES
        for i in range(cap):
            _store_seller_profile_cache(i, now=float(i), profile={"n": i})
        assert len(listings.SELLER_PROFILE_CACHE) == cap

        # One more entry, newer than everything already cached, should evict
        # the single oldest entry (id 0) rather than grow unbounded.
        _store_seller_profile_cache(cap, now=float(cap), profile={"n": cap})

        assert len(listings.SELLER_PROFILE_CACHE) == cap
        assert 0 not in listings.SELLER_PROFILE_CACHE
        assert cap in listings.SELLER_PROFILE_CACHE
    finally:
        listings.SELLER_PROFILE_CACHE.clear()


def test_seller_profile_cache_evicts_expired_entries_before_oldest():
    listings.SELLER_PROFILE_CACHE.clear()
    try:
        cap = listings.SELLER_PROFILE_CACHE_MAX_ENTRIES
        ttl = listings.SELLER_PROFILE_CACHE_TTL_SECONDS
        # id 0 is expired (cached far in the past); the rest are fresh.
        _store_seller_profile_cache(0, now=0.0, profile={"n": 0})
        for i in range(1, cap):
            _store_seller_profile_cache(i, now=float(ttl + i), profile={"n": i})

        _store_seller_profile_cache(cap, now=float(ttl + cap), profile={"n": cap})

        assert 0 not in listings.SELLER_PROFILE_CACHE, "expired entry should be evicted first"
        assert len(listings.SELLER_PROFILE_CACHE) <= cap
    finally:
        listings.SELLER_PROFILE_CACHE.clear()
