"""Shared page-budget helpers for multi-category vehicle scrapers."""

from __future__ import annotations


def secondary_page_budget(
    max_pages: int,
    *,
    min_pages: int = 5,
    max_pages_cap: int = 25,
    divisor: int = 4,
) -> int:
    """Smaller page budget for non-primary vehicle categories.

    Never exceeds the caller-requested ``max_pages``.
    """
    page_limit = max(1, int(max_pages or 1))
    desired = max(int(min_pages), page_limit // max(1, int(divisor)))
    desired = min(int(max_pages_cap), desired)
    return max(1, min(page_limit, desired))


def page_budget_for_category(
    *,
    is_primary: bool,
    max_pages: int,
    min_pages: int = 5,
    max_pages_cap: int = 25,
    divisor: int = 4,
) -> int:
    page_limit = max(1, int(max_pages or 1))
    if is_primary:
        return page_limit
    return secondary_page_budget(
        page_limit,
        min_pages=min_pages,
        max_pages_cap=max_pages_cap,
        divisor=divisor,
    )
