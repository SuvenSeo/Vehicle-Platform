from statistics import median as _stats_median
from typing import Iterable, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session


def supports_percentile(db: Session) -> bool:
    dialect = db.bind.dialect.name if db.bind and db.bind.dialect else ""
    return dialect in {"postgresql", "postgres"}


def median_price_expr(db: Session, column):
    """SQL median expression via percentile_cont, or None on dialects without it (e.g. SQLite)."""
    if not supports_percentile(db):
        return None
    return func.percentile_cont(0.5).within_group(column).label("median_price")


def python_median(values: Iterable[Optional[float]], *, min_value: float = 0) -> Optional[float]:
    clean = [float(v) for v in values if v is not None and float(v) >= min_value]
    if not clean:
        return None
    return round(float(_stats_median(clean)), 2)


def median_price_for_query(db: Session, query, column, *, min_value: float = 0) -> Optional[float]:
    expr = median_price_expr(db, column)
    if expr is not None:
        value = query.with_entities(expr).scalar()
        return round(float(value), 2) if value is not None else None
    return python_median((row[0] for row in query.with_entities(column).all()), min_value=min_value)
