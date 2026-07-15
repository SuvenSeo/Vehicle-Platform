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
