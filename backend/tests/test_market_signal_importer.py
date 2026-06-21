import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.market_signals import MARKET_SIGNAL_SOURCES, build_market_signal_records
from db.models import ImportPriceSnapshot, MarketSignal


def test_market_signal_models_exist_for_non_listing_sources():
    assert MarketSignal.__tablename__ == "market_signals"
    assert ImportPriceSnapshot.__tablename__ == "import_price_snapshots"
    assert hasattr(MarketSignal, "signal_type")
    assert hasattr(ImportPriceSnapshot, "source_market")


def test_market_signal_importer_declares_official_and_import_sources():
    keys = {source.key for source in MARKET_SIGNAL_SOURCES}

    assert {"dmt_registrations", "dmt_transfers", "customs_tenders", "import_parity"} <= keys


def test_build_market_signal_records_keeps_sources_out_of_listing_scrapers():
    records = build_market_signal_records(
        [
            {
                "source": "dmt",
                "signal_type": "registrations",
                "metric": "document_available",
                "value_numeric": 1,
                "unit": "boolean",
                "category": "official",
                "source_url": "https://dmt.gov.lk/index.php?option=com_content&view=article&id=45",
                "raw_meta": {"title": "Vehicle registrations"},
            }
        ]
    )

    assert records == [
        {
            "source": "dmt",
            "signal_type": "registrations",
            "metric": "document_available",
            "value_numeric": 1,
            "unit": "boolean",
            "category": "official",
            "source_url": "https://dmt.gov.lk/index.php?option=com_content&view=article&id=45",
            "raw_meta": {"title": "Vehicle registrations"},
        }
    ]
