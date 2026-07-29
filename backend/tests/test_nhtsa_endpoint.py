"""Tests for the /listings/nhtsa-models endpoint.

The NHTSA vPIC API is mocked so no live network calls are made.
"""

from __future__ import annotations

import sys
import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Fake NHTSA payload helpers
# ---------------------------------------------------------------------------

def _vpic_payload(models: list[dict]) -> dict:
    """Build a minimal NHTSA vPIC JSON envelope."""
    return {
        "Count": len(models),
        "Message": "Results returned successfully",
        "SearchCriteria": "Make:Toyota",
        "Results": models,
    }


def _make_mock_client(payload: dict | None = None, raise_exc: Exception | None = None):
    """Return a mock httpx.Client whose .get() returns the given payload."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    if raise_exc:
        mock_response.raise_for_status.side_effect = raise_exc
    else:
        mock_response.json.return_value = payload or {}

    mock_client = MagicMock()
    mock_client.get.return_value = mock_response
    mock_client.close = MagicMock()
    return mock_client


# ---------------------------------------------------------------------------
# Unit tests for the service layer (fetch_models_for_make)
# ---------------------------------------------------------------------------

class TestFetchModelsForMake:
    def test_returns_parsed_models(self):
        from app.services.nhtsa_specs import fetch_models_for_make, _cache

        payload = _vpic_payload([
            {"Make_ID": 448, "Make_Name": "Toyota", "Model_ID": 1861, "Model_Name": "Corolla"},
            {"Make_ID": 448, "Make_Name": "Toyota", "Model_ID": 2071, "Model_Name": "Camry"},
        ])
        _cache.clear()

        with patch("app.services.nhtsa_specs.httpx.Client", return_value=_make_mock_client(payload)):
            result = fetch_models_for_make("Toyota")

        assert len(result) == 2
        assert result[0]["model"] == "Corolla"
        assert result[0]["make"] == "Toyota"
        assert result[0]["source"] == "nhtsa_vpic"
        assert result[1]["model"] == "Camry"

    def test_returns_empty_on_network_error(self):
        import httpx
        from app.services.nhtsa_specs import fetch_models_for_make, _cache

        _cache.clear()
        mock_client = _make_mock_client(raise_exc=httpx.ConnectError("refused"))

        with patch("app.services.nhtsa_specs.httpx.Client", return_value=mock_client):
            result = fetch_models_for_make("Nonexistent")

        assert result == []

    def test_returns_empty_for_blank_make(self):
        from app.services.nhtsa_specs import fetch_models_for_make

        assert fetch_models_for_make("") == []
        assert fetch_models_for_make("   ") == []

    def test_caches_results(self):
        from app.services.nhtsa_specs import fetch_models_for_make, _cache

        payload = _vpic_payload([
            {"Make_ID": 448, "Make_Name": "Toyota", "Model_ID": 1861, "Model_Name": "Corolla"},
        ])
        _cache.clear()

        mock_client = _make_mock_client(payload)
        with patch("app.services.nhtsa_specs.httpx.Client", return_value=mock_client):
            first = fetch_models_for_make("Toyota")

        # Second call should hit cache — httpx.Client should NOT be called again.
        with patch("app.services.nhtsa_specs.httpx.Client") as mock_cls:
            second = fetch_models_for_make("Toyota")
            mock_cls.assert_not_called()

        assert first == second

    def test_skips_items_without_model_name(self):
        from app.services.nhtsa_specs import fetch_models_for_make, _cache

        payload = _vpic_payload([
            {"Make_ID": 448, "Make_Name": "Toyota", "Model_ID": 1861, "Model_Name": "Corolla"},
            {"Make_ID": 448, "Make_Name": "Toyota", "Model_ID": None, "Model_Name": ""},
            {"Make_ID": 448, "Make_Name": "Toyota", "Model_ID": None, "Model_Name": None},
        ])
        _cache.clear()

        with patch("app.services.nhtsa_specs.httpx.Client", return_value=_make_mock_client(payload)):
            result = fetch_models_for_make("Toyota")

        assert len(result) == 1
        assert result[0]["model"] == "Corolla"


# ---------------------------------------------------------------------------
# Unit tests for lookup_specs_hint
# ---------------------------------------------------------------------------

class TestLookupSpecsHint:
    def test_filters_by_model_substring(self):
        from app.services.nhtsa_specs import lookup_specs_hint, _cache

        payload = _vpic_payload([
            {"Make_ID": 448, "Make_Name": "Toyota", "Model_ID": 1861, "Model_Name": "Corolla"},
            {"Make_ID": 448, "Make_Name": "Toyota", "Model_ID": 2071, "Model_Name": "Camry"},
            {"Make_ID": 448, "Make_Name": "Toyota", "Model_ID": 9999, "Model_Name": "Corolla Cross"},
        ])
        _cache.clear()

        with patch("app.services.nhtsa_specs.httpx.Client", return_value=_make_mock_client(payload)):
            result = lookup_specs_hint("Toyota", "Corolla")

        model_names = [r["model"] for r in result]
        assert "Corolla" in model_names
        assert "Corolla Cross" in model_names
        assert "Camry" not in model_names

    def test_returns_full_list_when_model_blank(self):
        from app.services.nhtsa_specs import lookup_specs_hint, _cache

        payload = _vpic_payload([
            {"Make_ID": 448, "Make_Name": "Toyota", "Model_ID": 1861, "Model_Name": "Corolla"},
            {"Make_ID": 448, "Make_Name": "Toyota", "Model_ID": 2071, "Model_Name": "Camry"},
        ])
        _cache.clear()

        with patch("app.services.nhtsa_specs.httpx.Client", return_value=_make_mock_client(payload)):
            result = lookup_specs_hint("Toyota", "")

        assert len(result) == 2

    def test_falls_back_to_full_list_when_no_match(self):
        from app.services.nhtsa_specs import lookup_specs_hint, _cache

        payload = _vpic_payload([
            {"Make_ID": 448, "Make_Name": "Toyota", "Model_ID": 1861, "Model_Name": "Corolla"},
        ])
        _cache.clear()

        with patch("app.services.nhtsa_specs.httpx.Client", return_value=_make_mock_client(payload)):
            result = lookup_specs_hint("Toyota", "ZZZ-NoMatch")

        assert len(result) == 1


# ---------------------------------------------------------------------------
# Integration tests via FastAPI TestClient
# ---------------------------------------------------------------------------

class TestNhtsaEndpoint:
    def _client(self):
        from app.main import app
        return TestClient(app)

    def test_endpoint_returns_models(self):
        payload = _vpic_payload([
            {"Make_ID": 448, "Make_Name": "Toyota", "Model_ID": 1861, "Model_Name": "Corolla"},
            {"Make_ID": 448, "Make_Name": "Toyota", "Model_ID": 2071, "Model_Name": "Camry"},
        ])

        from app.services import nhtsa_specs
        nhtsa_specs._cache.clear()

        with patch("app.services.nhtsa_specs.httpx.Client", return_value=_make_mock_client(payload)):
            response = self._client().get("/api/v1/listings/nhtsa-models?make=Toyota")

        assert response.status_code == 200
        body = response.json()
        assert body["make"] == "Toyota"
        assert body["count"] == 2
        assert len(body["models"]) == 2
        assert body["models"][0]["model"] == "Corolla"

    def test_endpoint_returns_empty_on_nhtsa_failure(self):
        import httpx

        from app.services import nhtsa_specs
        nhtsa_specs._cache.clear()

        mock_client = _make_mock_client(raise_exc=httpx.ConnectError("refused"))

        with patch("app.services.nhtsa_specs.httpx.Client", return_value=mock_client):
            response = self._client().get("/api/v1/listings/nhtsa-models?make=Bogus")

        assert response.status_code == 200
        body = response.json()
        assert body["count"] == 0
        assert body["models"] == []

    def test_endpoint_requires_make_param(self):
        response = self._client().get("/api/v1/listings/nhtsa-models")
        assert response.status_code == 422

    def test_endpoint_rejects_empty_make(self):
        response = self._client().get("/api/v1/listings/nhtsa-models?make=")
        assert response.status_code == 422
