"""Shared free vs Pro plan ceilings (server-side).

Keep in sync with ``src/lib/planLimits.ts``.
"""

from __future__ import annotations

from typing import Optional

FREE_LISTINGS_MAX_SIZE = 12
FREE_LISTINGS_MAX_PAGE = 1
FREE_BEST_PICKS_LIMIT = 6
FREE_ALERTS_LIMIT = 1
FREE_PRICE_DROPS_LIMIT = 3
PRO_ALERTS_LIMIT = 20

PRO_PLANS = {"pro", "enterprise"}


def is_free_browse_plan(plan: Optional[str], *, role: Optional[str] = None) -> bool:
    """True when the caller should receive free-tier teaser limits."""
    if str(role or "").strip().lower() == "admin":
        return False
    if plan is None:
        # Anonymous / open-mode callers are not free-teased here; app gate handles auth.
        return False
    return str(plan).strip().lower() not in PRO_PLANS
