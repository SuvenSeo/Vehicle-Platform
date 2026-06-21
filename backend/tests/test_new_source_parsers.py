import sys
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.scrapers.carshop import CarshopScraper
from app.scrapers.dimo import DimoScraper
from app.scrapers.riyahub import RiyahubScraper
from app.scrapers.saleme import SaleMeScraper


def _soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


def test_carshop_extracts_oracle_apex_item_links():
    soup = _soup(
        """
        <a href="/ords/carshop/r/carshop/item-details-new?p86_current_item_code=136187">
          Toyota Aqua 2016
        </a>
        <a href="http://127.0.0.1:8000/item-details-new?p86_current_item_code=1">Bad host</a>
        <a href="/ords/carshop/r/carshop/dealer-profile?p1_id=22">Dealer</a>
        """
    )

    assert CarshopScraper._extract_listing_links(soup) == [
        "https://www.carshop.lk/ords/carshop/r/carshop/item-details-new?p86_current_item_code=136187"
    ]


def test_saleme_extracts_vehicle_ad_links_and_skips_transport_noise():
    soup = _soup(
        """
        <a href="https://www.saleme.lk/ad/toyota-axio-2008-for-sell-boralesgamuwa-3">
          Toyota Axio 2008 for sell
        </a>
        <a href="https://www.saleme.lk/ad/comfortable-office-transport-for-rent-angoda-1">
          Comfortable Office Transport For Rent
        </a>
        """
    )

    assert SaleMeScraper._extract_listing_links(soup) == [
        "https://www.saleme.lk/ad/toyota-axio-2008-for-sell-boralesgamuwa-3"
    ]


def test_riyahub_extracts_deep_vehicle_links_not_category_pages():
    soup = _soup(
        """
        <a href="https://riyahub.lk/vehicle/cars">Cars</a>
        <a href="https://riyahub.lk/vehicle/cars/toyota-prius-2014-colombo">
          Toyota Prius 2014
        </a>
        <a href="/toyota-starlet-1998-sale-24101">
          Toyota Starlet 1998 Car Rs.3,700,000
        </a>
        """
    )

    assert RiyahubScraper._extract_listing_links(soup) == [
        "https://riyahub.lk/vehicle/cars/toyota-prius-2014-colombo",
        "https://riyahub.lk/toyota-starlet-1998-sale-24101",
    ]


def test_dimo_extracts_woocommerce_product_links():
    soup = _soup(
        """
        <a href="https://carsatdimo.lk/product/mercedes-benz-gls-400-4matic/">
          Mercedes Benz GLS 400 4MATIC
        </a>
        <a href="https://carsatdimo.lk/product-category/all-vehicles/">All vehicles</a>
        """
    )

    assert DimoScraper._extract_listing_links(soup) == [
        "https://carsatdimo.lk/product/mercedes-benz-gls-400-4matic/"
    ]


def test_multi_category_scrapers_respect_total_page_budget():
    assert len(RiyahubScraper(db=None)._build_page_urls(5)) == 5
    assert len(DimoScraper(db=None)._build_page_urls(5)) == 5


def test_carshop_builds_payload_from_current_detail_shape():
    html = """
    <html><body>
      <h2>Ad Contact Detail</h2>
      <div>Ad header1 Toyota RAV4 2007 Price Rs 7,950,000 Contact Seller Kalutara</div>
      <p>Description New YOM / YOR - 2007/ 2010 Registered Owner. Automatic Petrol SUV.</p>
    </body></html>
    """

    payload = CarshopScraper(db=None)._build_payload(
        "https://www.carshop.lk/ords/carshop/r/carshop/item-details-new?p86_current_item_code=136187",
        html,
    )

    assert payload is not None
    assert payload["source"] == "carshop"
    assert payload["make"] == "Toyota"
    assert payload["model"] == "Rav4"
    assert payload["year"] == 2007
    assert payload["price_lkr"] == 7_950_000
    assert payload["district"] == "Kalutara"


def test_saleme_builds_payload_from_vehicle_meta_title_not_noise_heading():
    html = """
    <html>
      <head><meta property="og:title" content=" Honda Fit - Shuttle 2014 in Kandy" /></head>
      <body>
        <h1>land for sale</h1>
        <h3>Honda Fit - Shuttle 2014</h3>
        <div class="price">Rs 8,950,000 Negotiable</div>
        <p>LOCATION Kandy Transmission Automatic Fuel Hybrid</p>
      </body>
    </html>
    """

    payload = SaleMeScraper(db=None)._build_payload(
        "https://www.saleme.lk/ad/honda-fit-shuttle-2014-for-sell-kandy-1",
        html,
    )

    assert payload is not None
    assert payload["source"] == "saleme"
    assert payload["make"] == "Honda"
    assert payload["model"] == "Fit"
    assert payload["year"] == 2014
    assert payload["price_lkr"] == 8_950_000
    assert payload["district"] == "Kandy"


def test_saleme_mercedes_benz_titles_keep_specific_model():
    html = """
    <html>
      <head><meta property="og:title" content="Mercedes-Benz c 180 2010 in Colombo 2" /></head>
      <body>
        <h1>Mercedes-Benz c 180 2010</h1>
        <div class="price">Rs 9,200,000</div>
        <p>Colombo Automatic Petrol</p>
      </body>
    </html>
    """

    payload = SaleMeScraper(db=None)._build_payload(
        "https://www.saleme.lk/ad/mercedes-benz-c-180-2010-for-sell-colombo-2-1",
        html,
    )

    assert payload is not None
    assert payload["make"] == "Mercedes"
    assert payload["model"] == "C"
    assert payload["price_lkr"] == 9_200_000


def test_riyahub_keeps_negotiable_vehicle_in_unavailable_price_lane():
    html = """
    <html>
      <head><meta property="og:title" content="Suzuki Wagon R Fz Safty 2018 Car" /></head>
      <body>
        <div class="price">Price : Negotiable</div>
        <p>Make : Suzuki Model : Wagon R Fz Safty Model Year : 2018 Mileage : 84,500 Km Condition : Used Transmission : Automatic Fuel : Hybrid Kurunegala</p>
      </body>
    </html>
    """

    payload = RiyahubScraper(db=None)._build_payload(
        "https://riyahub.lk/suzuki-wagon-r-fz-safty-2018-sale-24146",
        html,
    )

    assert payload is not None
    assert payload["source"] == "riyahub"
    assert payload["make"] == "Suzuki"
    assert payload["model"] == "Wagon"
    assert payload["year"] == 2018
    assert payload["price_lkr"] is None
    assert payload["district"] == "Kurunegala"


def test_dimo_builds_priced_payload_from_product_page_shape():
    html = """
    <html>
      <head><meta property="og:title" content="Mercedes-Benz GLS 400 4MATIC" /></head>
      <body>
        <h1 class="product_title">Mercedes-Benz GLS 400 4MATIC</h1>
        <p class="price">Rs 45,900,000</p>
        <p>Colombo Automatic Petrol SUV</p>
      </body>
    </html>
    """

    payload = DimoScraper(db=None)._build_payload(
        "https://carsatdimo.lk/product/mercedes-benz-gls-400-4matic/",
        html,
    )

    assert payload is not None
    assert payload["source"] == "dimo"
    assert payload["make"] == "Mercedes"
    assert payload["model"] == "Gls"
    assert payload["price_lkr"] == 45_900_000
    assert payload["district"] == "Colombo"
