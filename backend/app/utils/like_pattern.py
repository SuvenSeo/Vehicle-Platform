"""SQL LIKE/ILIKE pattern helpers.

User-controlled text interpolated into ``f"%{value}%"`` leaks the LIKE
wildcards ``%`` and ``_``: a search for ``100%`` would match everything.
Values are still fully parameterized (no injection), but the *matching
semantics* widen and leading-wildcard scans get slower. Escape the
metacharacters and pass ``escape=LIKE_ESCAPE_CHAR`` at the query site so
they match literally.
"""

from __future__ import annotations

LIKE_ESCAPE_CHAR = "\\"

_ESCAPE_TABLE = (
    (LIKE_ESCAPE_CHAR, LIKE_ESCAPE_CHAR + LIKE_ESCAPE_CHAR),
    ("%", LIKE_ESCAPE_CHAR + "%"),
    ("_", LIKE_ESCAPE_CHAR + "_"),
)


def escape_like(value: str) -> str:
    r"""Escape LIKE metacharacters; pair with ``escape=LIKE_ESCAPE_CHAR``."""
    text = str(value or "")
    for char, replacement in _ESCAPE_TABLE:
        text = text.replace(char, replacement)
    return text


def contains_pattern(value: str) -> str:
    """Return ``%escaped%`` for use as ``col.ilike(contains_pattern(v), escape=LIKE_ESCAPE_CHAR)``."""
    return f"%{escape_like(value)}%"
