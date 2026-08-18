"""Phase 0: provider adapter contract, cache, flags, and sync-run logging."""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.append(str(Path(__file__).resolve().parents[1]))


REQUIRED_ENVELOPE_KEYS = {
    "provider",
    "market_scope",
    "license_note",
    "fetched_at",
    "match_confidence",
    "source_url",
    "data",
    "available",
    "limitation",
}


class TestVehicleKey:
    def test_canonical_key_normalizes_make_model_year(self):
        from app.services.providers.identity import canonical_vehicle_key

        assert canonical_vehicle_key(2015, "TOYOTA", "  Axio ") == "2015|toyota|axio"

    def test_blank_make_or_year_returns_none(self):
        from app.services.providers.identity import canonical_vehicle_key

        assert canonical_vehicle_key(None, "Toyota", "Axio") is None
        assert canonical_vehicle_key(2015, "", "Axio") is None
        assert canonical_vehicle_key(2015, "Toyota", "") is None


class TestEnvelope:
    def test_ok_envelope_includes_attribution_fields(self):
        from app.services.providers.envelope import enrichment_ok

        payload = enrichment_ok(
            provider="nhtsa",
            market_scope="US federal (NHTSA)",
            license_note="Public US government data.",
            match_confidence=0.92,
            source_url="https://www.nhtsa.gov/recalls",
            data={"recalls": []},
            limitation="US recall data is not a verified history of this Sri Lankan vehicle.",
        )

        assert REQUIRED_ENVELOPE_KEYS <= set(payload)
        assert payload["available"] is True
        assert payload["provider"] == "nhtsa"
        assert payload["data"] == {"recalls": []}
        assert payload["match_confidence"] == pytest.approx(0.92)
        datetime.fromisoformat(payload["fetched_at"].replace("Z", "+00:00"))

    def test_unavailable_envelope_has_empty_data_and_reason(self):
        from app.services.providers.envelope import enrichment_unavailable

        payload = enrichment_unavailable(
            provider="nhtsa",
            market_scope="US federal (NHTSA)",
            reason="upstream_timeout",
            limitation="Safety research is temporarily unavailable.",
        )

        assert payload["available"] is False
        assert payload["data"] is None
        assert payload["unavailable_reason"] == "upstream_timeout"
        assert payload["match_confidence"] is None
        assert payload["limitation"]

    def test_low_confidence_is_suppressed_to_unavailable(self):
        from app.services.providers.envelope import enrichment_ok

        payload = enrichment_ok(
            provider="nhtsa",
            market_scope="US federal (NHTSA)",
            license_note="Public US government data.",
            match_confidence=0.2,
            source_url="https://www.nhtsa.gov/recalls",
            data={"rating": 5},
            limitation="US NHTSA safety rating—may vary by trim/market.",
        )

        assert payload["available"] is False
        assert payload["data"] is None
        assert payload["unavailable_reason"] == "low_match_confidence"


class TestTtlCache:
    def test_cache_returns_value_within_ttl(self):
        from app.services.providers.cache import TtlCache

        cache = TtlCache(ttl_seconds=60)
        cache.set("2015|toyota|axio", {"ok": True})
        assert cache.get("2015|toyota|axio") == {"ok": True}

    def test_cache_expires_after_ttl(self, monkeypatch):
        from app.services.providers import cache as cache_mod

        clock = {"now": 100.0}
        monkeypatch.setattr(cache_mod.time, "monotonic", lambda: clock["now"])
        store = cache_mod.TtlCache(ttl_seconds=5)
        store.set("k", "v")
        clock["now"] = 104.0
        assert store.get("k") == "v"
        clock["now"] = 106.0
        assert store.get("k") is None


class TestFlags:
    def test_safety_research_defaults_enabled(self, monkeypatch):
        monkeypatch.delenv("ENRICHMENT_NHTSA_SAFETY", raising=False)
        from app.services.providers.flags import is_enabled

        assert is_enabled("nhtsa_safety") is True

    def test_geoapify_and_revcardata_default_disabled(self, monkeypatch):
        monkeypatch.delenv("ENRICHMENT_GEOAPIFY", raising=False)
        monkeypatch.delenv("ENRICHMENT_REVCARDATA", raising=False)
        from app.services.providers.flags import is_enabled

        assert is_enabled("geoapify") is False
        assert is_enabled("revcardata") is False

    def test_flag_can_disable_provider(self, monkeypatch):
        monkeypatch.setenv("ENRICHMENT_NHTSA_SAFETY", "false")
        from app.services.providers.flags import is_enabled

        assert is_enabled("nhtsa_safety") is False


class TestSyncRuns:
    def test_start_and_finish_sync_run_persists_row(self):
        from db.models import Base, ProviderSyncRun
        from app.services.providers.sync import finish_sync_run, start_sync_run

        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        db = Session()
        try:
            run = start_sync_run(db, provider="problemsbyvin")
            assert run.id is not None
            assert run.status == "running"
            finish_sync_run(
                db,
                run,
                status="success",
                rows=6275,
                failures=0,
                checksum="abc123",
            )
            stored = db.query(ProviderSyncRun).one()
            assert stored.status == "success"
            assert stored.rows == 6275
            assert stored.checksum == "abc123"
            assert stored.ended_at is not None
        finally:
            db.close()

    def test_failed_sync_run_records_error(self):
        from db.models import Base, ProviderSyncRun
        from app.services.providers.sync import finish_sync_run, start_sync_run

        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        db = Session()
        try:
            run = start_sync_run(db, provider="openchargemap")
            finish_sync_run(db, run, status="failed", error_message="timeout")
            stored = db.query(ProviderSyncRun).one()
            assert stored.status == "failed"
            assert stored.error_message == "timeout"
        finally:
            db.close()


class TestSchemaPatch:
    def test_apply_schema_patches_creates_provider_sync_runs(self):
        from db.schema_patches import apply_schema_patches

        engine = create_engine("sqlite:///:memory:")
        apply_schema_patches(engine)
        tables = inspect(engine).get_table_names()
        assert "provider_sync_runs" in tables


class TestAdminHealth:
    def test_provider_health_lists_known_providers_without_secret_values(self):
        from db.models import Base
        from app.services.providers.health import provider_health

        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        db = Session()
        try:
            snapshot = provider_health(db)
            ids = {row["id"] for row in snapshot}
            assert {
                "nhtsa_safety",
                "problemsbyvin",
                "open_charge_map",
                "geoapify",
                "revcardata",
            } <= ids
            blob = str(snapshot)
            assert "sk-" not in blob
            assert "api_key" not in blob.lower() or all(
                "configured" in row for row in snapshot
            )
        finally:
            db.close()
