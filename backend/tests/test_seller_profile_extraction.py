import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints.listings import _extract_seller_profile_from_html


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
