"""Feature flags for third-party enrichment. Secrets stay in the backend env."""

from __future__ import annotations

import os

# (env var, default enabled)
_PROVIDER_FLAGS: dict[str, tuple[str, bool]] = {
    "nhtsa_safety": ("ENRICHMENT_NHTSA_SAFETY", True),
    "problemsbyvin": ("ENRICHMENT_PROBLEMSBYVIN", True),
    "open_charge_map": ("ENRICHMENT_OPEN_CHARGE_MAP", True),
    "geoapify": ("ENRICHMENT_GEOAPIFY", False),
    "revcardata": ("ENRICHMENT_REVCARDATA", False),
    # Product brief only — do not build a Smartcar live-data path.
    "smartcar": ("ENRICHMENT_SMARTCAR", False),
}


def _truthy(raw: str | None, default: bool) -> bool:
    if raw is None or not str(raw).strip():
        return default
    token = str(raw).strip().lower()
    if token in {"1", "true", "yes", "on"}:
        return True
    if token in {"0", "false", "no", "off"}:
        return False
    return default


def is_enabled(provider_id: str) -> bool:
    spec = _PROVIDER_FLAGS.get(provider_id)
    if spec is None:
        return False
    env_name, default = spec
    return _truthy(os.getenv(env_name), default)


def catalog() -> list[dict[str, str | bool]]:
    return [
        {
            "id": provider_id,
            "env": env_name,
            "enabled": is_enabled(provider_id),
            "defaultEnabled": default,
        }
        for provider_id, (env_name, default) in _PROVIDER_FLAGS.items()
    ]
