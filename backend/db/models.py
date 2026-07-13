from sqlalchemy import Column, Integer, BigInteger, String, Text, Boolean, Numeric, DateTime, ForeignKey, Index, JSON
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass

class RawListing(Base):
    __tablename__ = 'raw_listings'

    id = Column(Integer, primary_key=True)
    source = Column(String(20), nullable=False)
    source_id = Column(String(100), nullable=False)
    scraped_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    url = Column(Text, nullable=False)
    title = Column(Text)
    raw_price = Column(Text)
    raw_location = Column(Text)
    raw_meta = Column(JSON)  # Store fuel, mileage, etc as found on page
    description = Column(Text)
    is_processed = Column(Boolean, default=False)

    __table_args__ = (
        Index('idx_raw_listings_source_source_id', 'source', 'source_id', unique=True),
        Index('idx_raw_listings_is_processed', 'is_processed'),
    )

class CarListing(Base):
    __tablename__ = 'car_listings'

    id = Column(Integer, primary_key=True)
    raw_id = Column(BigInteger, nullable=True)  # Soft reference to raw_listings on cold DB (NeonDB); no FK constraint across databases
    source = Column(String(20), nullable=False)
    source_id = Column(String(100), nullable=False)
    scraped_at = Column(DateTime(timezone=True), nullable=False)
    first_seen_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    title = Column(Text)
    url = Column(Text)

    # Vehicle specific fields
    make = Column(String(50), nullable=False)
    model = Column(String(100), nullable=False)
    year = Column(Integer, nullable=True)
    price_lkr = Column(Numeric(15, 2))
    mileage = Column(Integer)  # in km
    fuel_type = Column(String(20))
    transmission = Column(String(20))
    engine_capacity = Column(Integer)  # in cc
    condition = Column(String(20))
    body_type = Column(String(30))

    # Location
    raw_location = Column(Text)
    district = Column(String(50))
    city = Column(String(100))
    location_id = Column(BigInteger, ForeignKey('locations.id'))

    # Image & Thumbnails
    thumbnail_url = Column(Text)

    # Valuation
    deal_score = Column(Numeric(5, 1))
    market_median_lkr = Column(Numeric(15, 2))
    
    # Flags
    is_outlier = Column(Boolean, default=False)
    outlier_reason = Column(Text)
    is_duplicate = Column(Boolean, default=False)
    duplicate_of = Column(BigInteger, ForeignKey('car_listings.id'))

    __table_args__ = (
        Index('idx_car_listings_source_source_id', 'source', 'source_id', unique=True),
        Index('idx_car_listings_make_model', 'make', 'model'),
        Index('idx_car_listings_make_model_district', 'make', 'model', 'district'),
        Index('idx_car_listings_district', 'district'),
        Index('idx_car_listings_price', 'price_lkr'),
        Index('idx_car_listings_active_price', 'is_outlier', 'price_lkr'),
        Index('idx_car_listings_scraped_at', 'scraped_at'),
        Index('idx_car_listings_first_seen_at', 'first_seen_at'),
        Index('idx_car_listings_deal_score', 'deal_score'),
        Index('idx_car_listings_source', 'source'),
    )

class PriceAggregate(Base):
    __tablename__ = 'price_aggregates'

    id = Column(Integer, primary_key=True)
    make = Column(String(50), nullable=False)
    model = Column(String(100), nullable=False)
    year = Column(Integer)
    district = Column(String(50)) # optional for local trends
    
    period_year = Column(Integer, nullable=False)
    period_month = Column(Integer, nullable=False)
    
    median_price_lkr = Column(Numeric(15, 2))
    avg_price_lkr = Column(Numeric(15, 2))
    p25_price_lkr = Column(Numeric(15, 2))
    p75_price_lkr = Column(Numeric(15, 2))
    listing_count = Column(Integer)
    
    computed_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('idx_price_aggregates_lookup', 'make', 'model', 'year', 'period_year', 'period_month'),
        Index('idx_price_aggregates_scope_period', 'make', 'model', 'district', 'period_year', 'period_month'),
    )

class MarketSignal(Base):
    __tablename__ = 'market_signals'

    id = Column(Integer, primary_key=True)
    source = Column(String(40), nullable=False)
    signal_type = Column(String(60), nullable=False)
    period_year = Column(Integer)
    period_month = Column(Integer)
    metric = Column(String(80), nullable=False)
    category = Column(String(80))
    value_numeric = Column(Numeric(18, 2))
    unit = Column(String(30))
    source_url = Column(Text, nullable=False)
    observed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    raw_meta = Column(JSON)

    __table_args__ = (
        Index('idx_market_signals_source_type', 'source', 'signal_type'),
        Index('idx_market_signals_period', 'period_year', 'period_month'),
        Index('idx_market_signals_metric_category', 'metric', 'category'),
    )

class ImportPriceSnapshot(Base):
    __tablename__ = 'import_price_snapshots'

    id = Column(Integer, primary_key=True)
    source = Column(String(40), nullable=False)
    source_id = Column(String(100), nullable=False)
    observed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    url = Column(Text, nullable=False)
    title = Column(Text)
    make = Column(String(50))
    model = Column(String(100))
    year = Column(Integer)
    price_lkr = Column(Numeric(15, 2))
    mileage = Column(Integer)
    fuel_type = Column(String(20))
    transmission = Column(String(20))
    body_type = Column(String(30))
    source_market = Column(String(50))
    raw_meta = Column(JSON)

    __table_args__ = (
        Index('idx_import_price_source_source_id', 'source', 'source_id', unique=True),
        Index('idx_import_price_make_model', 'make', 'model'),
        Index('idx_import_price_observed_at', 'observed_at'),
    )

class Location(Base):
    __tablename__ = 'locations'

    id = Column(Integer, primary_key=True)
    normalized_key = Column(Text, unique=True, nullable=False) # e.g. "colombo|nugegoda"
    district = Column(String(50))
    city = Column(String(100))
    lat = Column(Numeric(9, 6))
    lng = Column(Numeric(9, 6))
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

class ScrapeRun(Base):
    __tablename__ = 'scrape_runs'

    id = Column(Integer, primary_key=True)
    source = Column(String(20), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False)
    finished_at = Column(DateTime(timezone=True))
    status = Column(String(10)) # SUCCESS, FAILED
    listings_found = Column(Integer, default=0)
    listings_new = Column(Integer, default=0)
    error_message = Column(Text)

class UserFeedback(Base):
    __tablename__ = 'user_feedback'

    id = Column(Integer, primary_key=True)
    category = Column(String(30), nullable=False, default="general")
    route = Column(Text)
    message = Column(Text, nullable=False)
    email = Column(String(255))
    user_agent = Column(Text)
    status = Column(String(20), nullable=False, default="new")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index('idx_user_feedback_status_created', 'status', 'created_at'),
    )


class MarketStatsCache(Base):
    """Key-value materialized cache for heavy aggregate endpoints.

    Rows are upserted by ``cache_key``; ``payload`` holds the JSON blob;
    ``refreshed_at`` is used for TTL checks.  Valid keys: ``summary``,
    ``district_prices``.
    """

    __tablename__ = 'market_stats_cache'

    cache_key = Column(String(80), primary_key=True)
    payload = Column(JSON, nullable=False)
    refreshed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class MarketAlert(Base):
    __tablename__ = 'market_alerts'

    id = Column(Integer, primary_key=True)
    user_token = Column(String(36), nullable=False)
    make = Column(String(50), nullable=True)
    model = Column(String(100), nullable=True)
    max_price = Column(Numeric(15, 2), nullable=True)
    district = Column(String(50), nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index('idx_market_alerts_user_token', 'user_token'),
        Index('idx_market_alerts_active', 'active'),
    )
