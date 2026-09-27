"""Canonical make normalization (backend half).

Scrape-side make values are noisy: the same brand arrives as "Bmw"/"BMW",
"Mg"/"MG", "Dfsk"/"DFSK", "Land rover"/"Land Rover", plus typo variants
("Mitshubishi", "Sukuzi", "Nisan", "Daihatzu", "Cheery") and outright junk
("Test", "TestPOS", "testused", "2018", "Other brand").

Those values reach the public make combobox and the valuation/trends model
pickers, where duplicates split one brand's listings across several rows and
junk makes pollute the filter.

Mirrored in the frontend at ``src/lib/makeNormalization.ts``; keep the two
tables in sync (the backend owns the live API + snapshot export, the frontend
owns the CDN snapshot path).
"""

from __future__ import annotations

import re
from typing import Optional

# Normalized (lowercase, alnum-only) key -> canonical display name.
MAKE_ALIASES: dict[str, str] = {
    # Case / spacing duplicates of the big brands.
    "toyota": "Toyota",
    "suzuki": "Suzuki",
    "nissan": "Nissan",
    "honda": "Honda",
    "bmw": "BMW",
    "mercedes": "Mercedes",
    "mercedesbenz": "Mercedes",
    "mg": "MG",
    "kia": "Kia",
    "dfsk": "DFSK",
    "hyundai": "Hyundai",
    "proton": "Proton",
    "landrover": "Land Rover",
    "rollsroyce": "Rolls-Royce",
    "harley": "Harley-Davidson",
    "harleydavidson": "Harley-Davidson",
    "ssang": "SsangYong",
    "ssangyong": "SsangYong",
    # Typo variants seen in live listings.
    "mitshubishi": "Mitsubishi",
    "suzuzi": "Suzuki",
    "sukuzi": "Suzuki",
    "nisan": "Nissan",
    "daihatzu": "Daihatsu",
    "cheery": "Chery",
    "mubota": "Kubota",
    "kubota": "Kubota",
    "suzukimaruti": "Maruti Suzuki",
    "marutisuzuki": "Maruti Suzuki",
    "saicmaxus": "Maxus",
    "maxus": "Maxus",
    # Scrape artifacts where a model name landed in the make column.
    "hondafit": "Honda",
    "hondacar": "Honda",
    "tatanexon": "Tata",
    "mg4": "MG",
    "gacaion": "GAC",
    "baicbeijing": "BAIC",
    "microgeely": "Micro",
    "heroelectric": "Hero",
    "jeepwrangler": "Jeep",
    "mercedesbenzc180": "Mercedes",
    "singerlima": "Singer",
    "hyndaitrajet": "Hyundai",
}

# Multi-word values that are a leaked model/garbage rather than a real marque.
# Kept separate from JUNK_MAKES so genuine two-word brands ("Ashok Leyland",
# "Royal Enfield", "John Deere") are never dropped by the same rule.
LEAKED_MODEL_MAKES = frozenset(
    {
        "vitzcar",
        "vezelzplay",
        "utone",
        "vivaelite",
        "scooty",
        "car",
        "cars",
        "auto",
        "vehicle",
    }
)

# Values that carry no brand information. These are hidden from make/model
# filters rather than offered to users as car brands.
JUNK_MAKES = frozenset(
    {
        "other",
        "otherbrand",
        "otherbrands",
        "others",
        "unknown",
        "unnamed",
        "na",
        "n/a",
        "none",
        "null",
        "nil",
        "test",
        "test1",
        "test2",
        "testpos",
        "testlisting",
        "testused",
        "testuser",
        "sample",
        "demo",
        "dummy",
        "lorem",
        "ipsum",
        "asdf",
    }
)

_YEAR_RE = re.compile(r"^(19|20)\d{2}$")
_NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")
_WS_RE = re.compile(r"\s+")


def compact_key(value: str) -> str:
    return _NON_ALNUM_RE.sub("", value.lower())


def is_junk_make(value: object) -> bool:
    """True when a make value carries no usable brand signal."""
    key = compact_key(str(value if value is not None else "").strip())
    if not key:
        return True
    if key in JUNK_MAKES or key in LEAKED_MODEL_MAKES:
        return True
    # A bare model year in the make column ("2018") is never a brand.
    return bool(_YEAR_RE.match(key))


def _title_case(value: str) -> str:
    parts = []
    for part in value.split(" "):
        # Preserve genuine acronyms (TVS, JAC, KTM, BYD) but normalize long
        # all-caps words that are just shouted brand names (ISUZU -> Isuzu).
        if len(part) <= 4 and part.isupper():
            parts.append(part)
        else:
            parts.append(part[:1].upper() + part[1:].lower())
    return " ".join(parts)


def canonicalize_make(value: object) -> Optional[str]:
    """Resolve a raw make value to its canonical display name.

    Returns ``None`` for junk so callers can drop the row. Unknown but
    plausible single-token makes are kept (normalized in case); silently hiding
    a real niche marque is worse than showing an uncommon one.
    """
    raw = str(value if value is not None else "").strip()
    if not raw:
        return None

    collapsed = _WS_RE.sub(" ", raw)
    key = compact_key(collapsed)
    if not key or key in JUNK_MAKES or _YEAR_RE.match(key):
        return None

    direct = MAKE_ALIASES.get(key)
    if direct:
        return direct

    # "Honda fit" / "Jeep Wrangler" / "BAIC Beijing": a real brand followed by
    # a model that leaked into the make column. The leading brand is the truth.
    first_token = collapsed.split(" ")[0]
    if first_token and first_token != collapsed:
        first_key = compact_key(first_token)
        if first_key and first_key not in JUNK_MAKES and not _YEAR_RE.match(first_key):
            head = MAKE_ALIASES.get(first_key)
            if head:
                return head

    # Known leaked model strings ("Vitz car", "VEZEL Z PLAY"). Anything else
    # multi-word is treated as a real marque — "Ashok Leyland" and "Royal
    # Enfield" must survive, so an unknown word is not proof of junk.
    if key in LEAKED_MODEL_MAKES:
        return None

    return _title_case(collapsed)


def canonicalize_model(value: object) -> str:
    """Trim a model name and drop pure junk; returns "" when unusable."""
    raw = _WS_RE.sub(" ", str(value if value is not None else "").strip())
    if not raw:
        return ""
    key = compact_key(raw)
    if not key or key in JUNK_MAKES or _YEAR_RE.match(key):
        return ""
    return raw


def has_usable_make_model(make: object, model: object) -> bool:
    return bool(canonicalize_make(make)) and bool(canonicalize_model(model))
