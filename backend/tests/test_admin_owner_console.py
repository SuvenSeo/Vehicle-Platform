"""Admin owner-console route surface (static check — no full app import)."""

from __future__ import annotations

from pathlib import Path


def test_admin_py_declares_owner_console_routes():
    source = Path(__file__).resolve().parents[1] / "app/api/v1/endpoints/admin.py"
    text = source.read_text(encoding="utf-8")
    for needle in (
        '@router.get("/analytics"',
        '@router.get("/feedback"',
        '@router.patch("/feedback/{feedback_id}"',
        '@router.get("/dealers"',
        '@router.post("/dealers/{dealer_id}/verify"',
        '@router.get("/pipeline"',
        '@router.post("/pipeline/trigger"',
        '@router.get("/permits"',
        '@router.post("/permits"',
        '@router.delete("/cache"',
        '@router.get("/system"',
    ):
        assert needle in text, f"missing {needle}"
