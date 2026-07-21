from sqlalchemy import Column, Integer, BigInteger, String, Text, Boolean, Numeric, DateTime, ForeignKey, Index, JSON
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass

class CarListing(Base):
    __tablename__ = 'car_listings'

    id = Column(Integer, primary_key=True)
    # Legacy column: pointed at the removed raw_listings staging table. Kept in
    # the DB (drops need a real migration) but no longer written or read.
    raw_id = Column(BigInteger, nullable=True)
    source = Column(String(20), nullable=False)
    source_id = Column(String(100), nullable=False)
    scraped_at = Column(DateTime(timezone=True), nullable=False)
    first_seen_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    # Bumped only when price or live-status meaningfully changes — drives sitemap lastmod.
    content_updated_at = Column(DateTime(timezone=True), nullable=True)
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
    # cars | motorbikes | vans | ... — set by multi-category scrapers; null = legacy
    vehicle_category = Column(String(40), nullable=True)

    # Location
    raw_location = Column(Text)
    district = Column(String(50))
    city = Column(String(100))
    location_id = Column(BigInteger, ForeignKey('locations.id'))

    # Image & Thumbnails
    thumbnail_url = Column(Text)
    thumbnail_url_cached = Column(Text, nullable=True)
    # Perceptual hash (64-bit pHash, hex-encoded) of the thumbnail image, used
    # to spot the same physical vehicle re-listed with edited specs (year,
    # district, price) that heuristic make/model matching would miss.
    image_phash = Column(String(16), nullable=True)

    # Valuation
    deal_score = Column(Numeric(5, 1))
    market_median_lkr = Column(Numeric(15, 2))
    
    # Flags
    is_outlier = Column(Boolean, default=False)
    outlier_reason = Column(Text)
    is_duplicate = Column(Boolean, default=False)
    duplicate_of = Column(BigInteger, ForeignKey('car_listings.id'))
    # Soft-delete: flipped False by the post-scrape lifecycle pass when the
    # listing stops appearing at its source; flipped back True on re-sight.
    is_active = Column(Boolean, nullable=False, default=True, server_default='true')

    __table_args__ = (
        Index('idx_car_listings_source_source_id', 'source', 'source_id', unique=True),
        Index('idx_car_listings_make_model', 'make', 'model'),
        Index('idx_car_listings_make_model_district', 'make', 'model', 'district'),
        Index('idx_car_listings_district', 'district'),
        Index('idx_car_listings_price', 'price_lkr'),
        Index('idx_car_listings_active_price', 'is_outlier', 'price_lkr'),
        Index('idx_car_listings_scraped_at', 'scraped_at'),
        Index('idx_car_listings_first_seen_at', 'first_seen_at'),
        Index('idx_car_listings_last_seen_at', 'last_seen_at'),
        Index('idx_car_listings_content_updated_at', 'content_updated_at'),
        Index('idx_car_listings_deal_score', 'deal_score'),
        Index('idx_car_listings_source', 'source'),
        Index(
            'idx_car_listings_live_category_price',
            'is_active',
            'is_outlier',
            'vehicle_category',
            'price_lkr',
        ),
        Index(
            'idx_car_listings_category_first_seen',
            'vehicle_category',
            'first_seen_at',
        ),
    )


def live_listing_filter():
    """Single boolean expression for "count this listing in market views":
    not a statistical outlier AND still live at its source.

    Composes safely inside filter()/and_()/or_() because it is one expression.
    """
    from sqlalchemy import and_

    return and_(CarListing.is_outlier == False, CarListing.is_active == True)  # noqa: E712

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
    # Optional E.164 / local mobile for Twilio WhatsApp match notifications.
    notify_phone = Column(String(32), nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index('idx_market_alerts_user_token', 'user_token'),
        Index('idx_market_alerts_active', 'active'),
    )


class MarketAlertMatch(Base):
    """Persists the most recent alert-match pass result for each active alert.

    Rows are upserted (one row per alert_id) by ``run_alert_match_pass`` after
    every scrape cycle.  ``match_count`` reflects the current live-listing
    count and ``last_matched_at`` records when the pass ran.
    """

    __tablename__ = 'market_alert_matches'

    id = Column(Integer, primary_key=True)
    alert_id = Column(Integer, ForeignKey('market_alerts.id'), nullable=False, unique=True)
    match_count = Column(Integer, nullable=False, default=0)
    last_matched_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index('idx_market_alert_matches_alert_id', 'alert_id'),
    )


class ImportTaxConfig(Base):
    __tablename__ = 'import_tax_configs'

    id = Column(Integer, primary_key=True)
    effective_from = Column(DateTime(timezone=True), nullable=False)
    cid_rate = Column(Numeric(5, 4), nullable=False, default=0.20)
    cid_surcharge_rate = Column(Numeric(5, 4), nullable=False, default=0.50)
    sscl_rate = Column(Numeric(5, 4), nullable=False, default=0.025)
    vat_rate = Column(Numeric(5, 4), nullable=False, default=0.18)
    special_levy_2_5 = Column(Boolean, nullable=False, default=True)
    surcharge_50 = Column(Boolean, nullable=False, default=True)
    notes = Column(Text)


class VehiclePermit(Base):
    __tablename__ = 'vehicle_permits'

    id = Column(Integer, primary_key=True)
    permit_name = Column(String(100), nullable=False)
    permit_type = Column(String(50), nullable=False)
    market_price_lkr = Column(Numeric(15, 2), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class VehiclePriceHistory(Base):
    __tablename__ = 'vehicle_price_history'

    id = Column(Integer, primary_key=True)
    vehicle_id = Column(Integer, ForeignKey('car_listings.id', ondelete='CASCADE'), nullable=False)
    price_lkr = Column(Numeric(15, 2), nullable=False)
    scraped_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index('idx_vehicle_price_history_lookup', 'vehicle_id', 'scraped_at'),
    )


class DealerProfile(Base):
    """Lightweight claimed dealer yard / seller identity."""

    __tablename__ = "dealer_profiles"

    id = Column(Integer, primary_key=True)
    claim_token = Column(String(64), nullable=False, unique=True)
    display_name = Column(String(120), nullable=False)
    contact_phone = Column(String(32), nullable=True)
    contact_email = Column(String(255), nullable=True)
    seller_name_pattern = Column(String(120), nullable=True)
    claimed_url = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pending")  # pending | verified
    verified_at = Column(DateTime(timezone=True), nullable=True)
    plan = Column(String(20), nullable=False, default="dealer")  # free | dealer | enterprise
    subscription_status = Column(String(20), nullable=False, default="none")  # none|trialing|active|past_due|canceled
    billing_email = Column(String(255), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_dealer_profiles_claim_token", "claim_token"),
        Index("idx_dealer_profiles_status", "status"),
    )


class ImagePhashJob(Base):
    """Background queue for perceptual-hash computation on listing thumbnails."""

    __tablename__ = "image_phash_jobs"

    id = Column(Integer, primary_key=True)
    listing_id = Column(Integer, ForeignKey("car_listings.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending | processing | done | failed
    attempts = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_image_phash_jobs_status", "status", "id"),
        Index("idx_image_phash_jobs_listing", "listing_id"),
    )
