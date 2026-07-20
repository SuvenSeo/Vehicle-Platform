import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.source_aliases import canonical_source_key, source_alias_tokens


def test_canonical_source_key_normalizes_known_aliases():
    assert canonical_source_key("auto-lanka") == "autolanka"
    assert canonical_source_key("AutoLanka") == "autolanka"
    assert canonical_source_key("autolanka.com") == "autolanka"
    assert canonical_source_key("ikman") == "ikman"
    assert canonical_source_key("riyasewana") == "riyasewana"
    assert canonical_source_key("auto-stream") == "autostream"
    assert canonical_source_key("carshop.lk") == "carshop"
    assert canonical_source_key("sale-me") == "saleme"
    assert canonical_source_key("cars-at-dimo") == "dimo"
    assert canonical_source_key("riyahub.lk") == "riyahub"
    assert canonical_source_key("hitad.lk") == "hitad"
    assert canonical_source_key("cartivate-motors") == "cartivate"
    assert canonical_source_key("Department of Motor Traffic") == "dmt"
    assert canonical_source_key("Sri Lanka Customs") == "customs"


def test_source_alias_tokens_include_autolanka_variants():
    tokens = source_alias_tokens("auto-lanka")

    assert "autolanka" in tokens
    assert "autolankacom" in tokens
    assert "autolankalk" in tokens
    assert "autolankasite" in tokens


def test_source_alias_tokens_include_new_source_variants():
    assert source_alias_tokens("cars-at-dimo") == {"dimo", "carsatdimo", "dimoautomobiles"}
    assert source_alias_tokens("sale-me") == {"saleme", "salemelk"}
    assert source_alias_tokens("riyahub.lk") == {"riyahub", "riyahublk"}
    assert source_alias_tokens("carshop.lk") == {"carshop", "carshoplk"}
    assert source_alias_tokens("hitad.lk") == {"hitad", "hitadlk"}
    assert source_alias_tokens("cartivate-motors") == {
        "cartivate",
        "cartivatemotors",
        "cartivatemotorslk",
    }


def test_source_alias_tokens_falls_back_to_canonical_token_for_unknown_sources():
    tokens = source_alias_tokens("new-market")

    assert tokens == {"newmarket"}
