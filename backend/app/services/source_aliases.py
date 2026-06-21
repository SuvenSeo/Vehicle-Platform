from __future__ import annotations

from typing import Optional, Set


ALIAS_GROUPS: dict[str, set[str]] = {
    "ikman": {"ikman"},
    "riyasewana": {"riyasewana"},
    "autolanka": {
        "autolanka",
        "autolankacom",
        "autolankalk",
        "autolankasite",
    },
    "autodirect": {"autodirect"},
    "patpat": {"patpat"},
    "autostream": {"autostream"},
    "carshop": {"carshop", "carshoplk"},
    "saleme": {"saleme", "salemelk"},
    "riyahub": {"riyahub", "riyahublk"},
    "dimo": {"dimo", "carsatdimo", "dimoautomobiles"},
    "dmt": {"dmt", "departmentofmotortraffic"},
    "customs": {"customs", "srilankacustoms"},
    "import_parity": {"importparity", "landedcost", "cardreams", "providecars"},
}


def _compact_source_token(value: Optional[str]) -> str:
    return (
        str(value or "")
        .strip()
        .lower()
        .replace("-", "")
        .replace("_", "")
        .replace(".", "")
        .replace(" ", "")
    )


def canonical_source_key(value: Optional[str]) -> Optional[str]:
    token = _compact_source_token(value)
    if not token:
        return None

    if token.startswith("ikman"):
        return "ikman"
    if token.startswith("riyasewana"):
        return "riyasewana"
    if token in {"autolanka", "autolankacom", "autolankalk", "autolankasite"}:
        return "autolanka"
    if token.startswith("autodirect"):
        return "autodirect"
    if token.startswith("patpat"):
        return "patpat"
    if token.startswith("autostream"):
        return "autostream"
    if token.startswith("carshop"):
        return "carshop"
    if token in {"saleme", "salemelk"}:
        return "saleme"
    if token in {"riyahub", "riyahublk"}:
        return "riyahub"
    if token in {"dimo", "carsatdimo", "carsatdimolk", "dimoautomobiles"}:
        return "dimo"
    if token in {"dmt", "departmentofmotortraffic", "motortraffic"}:
        return "dmt"
    if token in {"customs", "srilankacustoms"}:
        return "customs"
    if token in {"importparity", "landedcost", "cardreams", "providecars"}:
        return "import_parity"
    return token


def source_alias_tokens(value: Optional[str]) -> Set[str]:
    canonical = canonical_source_key(value)
    if not canonical:
        return set()
    return set(ALIAS_GROUPS.get(canonical, {canonical}))
