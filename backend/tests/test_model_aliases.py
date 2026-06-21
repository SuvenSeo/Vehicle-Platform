import sys
from datetime import datetime
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints.listings import (  # noqa: E402
    _comparable_sort_key,
    _model_alias_tokens,
    _model_match_rank,
)


class _Row:
    def __init__(self, model: str, deal_score: float, first_seen_at: datetime):
        self.model = model
        self.deal_score = deal_score
        self.first_seen_at = first_seen_at


def test_model_alias_tokens_include_vitz_yaris_group():
    assert _model_alias_tokens("Vitz") == {"vitz", "yaris"}
    assert _model_alias_tokens("Yaris") == {"vitz", "yaris"}
    assert _model_alias_tokens("Toyota Vitz") == {"vitz", "yaris"}


def test_model_alias_tokens_fall_back_to_single_token():
    assert _model_alias_tokens("Axio") == {"axio"}


def test_model_match_rank_prioritizes_exact_then_alias():
    assert _model_match_rank("Vitz", "Vitz") == 2
    assert _model_match_rank("Yaris", "Vitz") == 1
    assert _model_match_rank("Corolla", "Vitz") == 0


def test_comparable_sort_key_prefers_exact_model_over_alias_even_with_lower_deal_score():
    requested_model = "Vitz"
    exact = _Row("Vitz", deal_score=6.0, first_seen_at=datetime(2026, 4, 18, 8, 0, 0))
    alias = _Row("Yaris", deal_score=15.0, first_seen_at=datetime(2026, 4, 18, 9, 0, 0))

    assert _comparable_sort_key(exact, requested_model) > _comparable_sort_key(alias, requested_model)