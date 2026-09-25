"""Backfill missing vehicle_category values on CarListing records.

Uses title heuristics (Riyasewana category suffixes, Ikman keywords,
body_type mappings) to classify listings with NULL vehicle_category.
"""

from __future__ import annotations

import argparse
import re
import sqlite3
from pathlib import Path

# Mapping of Riyasewana title suffixes to vehicle categories
RIYASEWANA_TITLE_SUFFIXES: list[tuple[str, str]] = [
    (" Car", "cars"),
    (" SUV", "suvs"),
    (" Van", "vans"),
    (" Motorbike", "motorbikes"),
    (" motorcycle", "motorbikes"),
    (" Lorry", "lorries"),
    (" Pickup", "pickups"),
    (" Bus", "buses"),
    (" Tractor", "tractors"),
    (" Three Wheel", "three-wheelers"),
    (" Wheel", "three-wheelers"),
    (" Heavy-Duty", "heavy-duty"),
    (" Heavy Duty", "heavy-duty"),
    (" Cab", "crew-cabs"),
    (" Crew Cab", "crew-cabs"),
    (" Bicycle", "bicycles"),
    (" Boat", "boats"),
]

# Regex patterns for text detection
THREE_WHEELER_RE = re.compile(
    r"(?i)\b(three[\s-]?wheel(?:er)?s?|bajaj\s+re\b|tvs\s+king|piaggio\s+ape|tuktuk|tuk\s+tuk)\b"
)
MOTORBIKE_RE = re.compile(
    r"(?i)\b("
    r"motorbike|motorcycle|scooter|"
    r"ntorq|dio\b|pulsar|fzs?|gn125|platina|ct100|discover|ray\s*z|gixxer|hornet|fz-?s?|scooty|"
    r"activa|tvs\s+jupiter|hero\s+pleasure|yamaha\s+ray|honda\s+activa|honda\s+dio|"
    r"tvs\s+ntorq|tvs\s+weego|bajaj\s+pulsar|bajaj\s+ct|bajaj\s+platina|bajaj\s+discover|"
    r"yamaha\s+fz|suzuki\s+gixxer|ktm\s+duke"
    r")\b"
)
TRACTOR_RE = re.compile(
    r"(?i)\b(tractor|tafe|massey\s+ferguson|kubota|yanmar)\b"
)
HEAVY_DUTY_RE = re.compile(
    r"(?i)\b(heavy[\s-]?duty|excavator|backhoe|jcb\b|komatsu|caterpillar|bobcat|wheel\s+loader)\b"
)
BICYCLE_RE = re.compile(
    r"(?i)\b(bicycle|push[\s-]?cycle|lumala|mountain\s+bike)\b"
)
BOAT_RE = re.compile(
    r"(?i)\b(boat|jet[\s-]?ski|water\s*transport|outboard\s+motor|catamaran)\b"
)
BUS_RE = re.compile(
    r"(?i)\b(bus|buses|rosa|coaster)\b"
)
LORRY_RE = re.compile(
    r"(?i)\b(lorry|lorries|truck|trucks|canter|isuzu\s+elf|freezer\s+lorry|dimo\s+batta)\b"
)
VAN_RE = re.compile(
    r"(?i)\b(caravan|hiace|kdh|vanette|bongo\s+van)\b"
)


def classify_vehicle_category(
    source: str | None,
    title: str | None,
    make: str | None,
    model: str | None,
    body_type: str | None,
) -> str:
    """Classify a listing into a vehicle category token."""
    t = str(title or "").strip()
    m = str(make or "").strip().lower()
    mo = str(model or "").strip().lower()
    b = str(body_type or "").strip().lower()
    full_text = f"{t} {make or ''} {model or ''}".strip()

    # 1. Riyasewana titles explicitly end with the category name
    if source == "riyasewana":
        for sfx, cat in RIYASEWANA_TITLE_SUFFIXES:
            if t.endswith(sfx):
                return cat

    # 2. Direct body_type mappings
    if b in ("van", "vans"):
        return "vans"
    if b in ("bus", "buses"):
        return "buses"
    if b in ("lorry", "lorries", "truck", "trucks", "tipper"):
        return "lorries"
    if b in ("motorbike", "motorcycles", "scooter", "bike"):
        return "motorbikes"
    if b in ("pickup", "crew cab"):
        return "pickups"

    full_lower = full_text.lower()

    # 3. Three-wheelers (Bajaj RE, TVS King, Piaggio Ape, tuktuk)
    if THREE_WHEELER_RE.search(full_lower):
        return "three-wheelers"

    # Edge cases:
    # 1. Daihatsu Cast Activa is a passenger car model, avoid false positive on 'activa'
    is_cast_activa = (m == "daihatsu" and "cast" in mo)
    # 2. Nissan Pulsar is a car model (Nissan Pulsar hatchback/sedan), not a Bajaj Pulsar bike
    is_nissan_pulsar = (m == "nissan" and "pulsar" in full_lower)

    # 4. Motorbikes (including TVS XL mopeds often tagged 'heavy duty')
    if "xl super" in full_lower or "tvs xl" in full_lower:
        return "motorbikes"
    if not is_cast_activa and not is_nissan_pulsar and MOTORBIKE_RE.search(full_lower):
        return "motorbikes"
    if m in ("yamaha", "bajaj", "tvs", "hero", "ktm", "royal enfield", "kawasaki") and not is_cast_activa:
        return "motorbikes"
    if TRACTOR_RE.search(full_text):
        return "tractors"
    if HEAVY_DUTY_RE.search(full_text):
        return "heavy-duty"
    if BICYCLE_RE.search(full_text):
        return "bicycles"
    if BOAT_RE.search(full_text):
        return "boats"
    if BUS_RE.search(full_text) and not re.search(r"(?i)\bbusiness\b", full_text):
        return "buses"
    if LORRY_RE.search(full_text):
        return "lorries"
    if VAN_RE.search(full_text):
        return "vans"

    # 4. Default: passenger car
    return "cars"


def backfill_sqlite(db_path: Path | str, *, dry_run: bool = False, batch_size: int = 5000) -> dict[str, int]:
    """Backfill NULL vehicle_category entries in the given SQLite database."""
    conn = sqlite3.connect(str(db_path))
    c = conn.cursor()

    c.execute(
        "SELECT id, source, title, make, model, body_type "
        "FROM car_listings WHERE vehicle_category IS NULL"
    )
    rows = c.fetchall()
    total = len(rows)
    print(f"Found {total} listings with NULL vehicle_category in {db_path}")

    counts: dict[str, int] = {}
    updates: list[tuple[str, int]] = []

    for row_id, source, title, make, model, body_type in rows:
        cat = classify_vehicle_category(source, title, make, model, body_type)
        counts[cat] = counts.get(cat, 0) + 1
        updates.append((cat, row_id))

    print(f"Classification summary ({total} total):")
    for cat, count in sorted(counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {cat}: {count}")

    if dry_run:
        print("Dry run mode: changes NOT saved.")
        conn.close()
        return counts

    print(f"Applying updates in batches of {batch_size}...")
    for i in range(0, len(updates), batch_size):
        chunk = updates[i : i + batch_size]
        c.executemany("UPDATE car_listings SET vehicle_category = ? WHERE id = ?", chunk)
        conn.commit()
        print(f"  Updated {min(i + batch_size, len(updates))}/{len(updates)}")

    conn.close()
    print("Backfill complete and committed.")
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill NULL vehicle_category on car_listings")
    parser.add_argument(
        "--db-path",
        type=Path,
        default=None,
        help="Path to SQLite database file",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate classification without updating the database",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=5000,
        help="Batch size for database updates",
    )
    args = parser.parse_args()

    if args.db_path:
        db_path = args.db_path
    else:
        # Default priority: motormila.db or autolens.db
        candidates = [
            Path("backend/motormila.db"),
            Path("backend/autolens.db"),
            Path("motormila.db"),
            Path("autolens.db"),
        ]
        db_path = next((p for p in candidates if p.is_file()), None)
        if not db_path:
            raise SystemExit("No SQLite database found. Specify --db-path.")

    backfill_sqlite(db_path, dry_run=args.dry_run, batch_size=args.batch_size)


if __name__ == "__main__":
    main()
