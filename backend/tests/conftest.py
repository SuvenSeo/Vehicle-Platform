import warnings

import pytest


@pytest.fixture(scope="session", autouse=True)
def _filter_known_test_warnings() -> None:
    warnings.filterwarnings(
        "ignore",
        message="Using `httpx` with `starlette.testclient` is deprecated.*",
        category=DeprecationWarning,
    )
    warnings.filterwarnings(
        "ignore",
        message="datetime.datetime.utcnow\\(\\) is deprecated.*",
        category=DeprecationWarning,
    )
    warnings.filterwarnings(
        "ignore",
        message="Support for class-based `config` is deprecated.*",
        category=DeprecationWarning,
    )


@pytest.fixture(autouse=True)
def _open_app_access_for_unit_tests(monkeypatch: pytest.MonkeyPatch) -> None:
    """Product APIs stay open in unit tests unless a test opts into the gate.

    Production defaults APP_ACCESS_ENFORCED=true; tests that need the gate
    should setenv("APP_ACCESS_ENFORCED", "true") themselves.
    """
    monkeypatch.setenv("APP_ACCESS_ENFORCED", "false")

