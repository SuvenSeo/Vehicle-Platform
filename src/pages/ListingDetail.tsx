import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, MapPin, Calendar,
  Share2, Fuel, Gauge, Settings2, MessageCircle,
  Car as CarIcon, ArrowRight, Zap, Sparkles, ShieldCheck, Clock, Database, AlertTriangle
} from 'lucide-react';
import { getListing, getListingPriceHistory, getSellerTrustProfile, getSimilarListings, formatPrice } from '@/services/api';
import type { CarListing, PriceHistoryInfo, SellerTrustProfile } from '@/types/car';
import { VehicleThumbnail } from '@/components/VehicleThumbnail';
import { pickVehicleImageUrl } from '@/lib/listingImage';
import { safeExternalUrl } from '@/lib/safeExternalUrl';
import { toast } from 'sonner';
import { FairPriceIndicator } from '@/components/FairPriceIndicator';
import { DealLadder } from '@/components/DealLadder';
import { LeaseCalculator } from '@/components/LeaseCalculator';
import { TaxBreakdown } from '@/components/TaxBreakdown';
import { CashToOwnStrip } from '@/components/CashToOwnStrip';
import { HybridCliffBadge } from '@/components/HybridCliffBadge';
import { MileageTrustChip } from '@/components/MileageTrustChip';
import { SellSpeedChip } from '@/components/SellSpeedChip';
import { AdvertHealthChip } from '@/components/AdvertHealthChip';
import { ListingHistoryReport } from '@/components/ListingHistoryReport';
import { ListingPriceTimeline } from '@/components/ListingPriceTimeline';
import { inferFinanceClass } from '@/lib/cashToOwn';
import type { ImportFuelType } from '@/lib/importTaxModel';
import { motion } from 'framer-motion';
import { revealContainer, revealItem, springSnappy } from '@/lib/motion';

function formatToken(value: string | null | undefined): string {
  if (!value) return 'Unknown';
  return value.replace(/[_-]/g, ' ').split(' ').filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [listing, setListing] = useState<CarListing | null>(null);
  const [similar, setSimilar] = useState<CarListing[]>([]);
  const [sellerProfile, setSellerProfile] = useState<SellerTrustProfile | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };
  const buildShareText = () => {
    if (!listing) return document.title;
    const name = [listing.year, listing.make, listing.model].filter(Boolean).join(' ');
    const price = Number(listing.price_lkr || 0);
    const priceText = Number.isFinite(price) && price >= 100_000 ? ` — ${formatPrice(price)}` : '';
    return `${name}${priceText} on Motormila`;
  };

  const handleShare = async () => {
    const text = buildShareText();
    if (navigator.share) {
      try {
        await navigator.share({ title: text, text, url: window.location.href });
        return;
      } catch {
        // User dismissed the sheet or share failed — fall through to clipboard.
      }
    }
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(window.location.href); toast.success('Link copied'); }
      else toast.error('Copy unavailable');
    } catch { toast.error('Clipboard blocked'); }
  };

  const handleWhatsAppShare = () => {
    const text = `${buildShareText()}\n${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (!id) return;
    window.scrollTo(0, 0); // peer links navigate mid-scroll; open each listing at the top
    setLoading(true); setSellerProfile(null); setPriceHistory(null);
    Promise.all([
      getListing(id).catch(() => null),
      getSimilarListings(id).catch(() => []),
      getSellerTrustProfile(id).catch(() => null),
      getListingPriceHistory(id).catch(() => null),
    ])
      .then(([detail, sim, profile, history]) => {
        setListing(detail); setSimilar(sim); setSellerProfile(profile); setPriceHistory(history); setLoading(false);
        if (detail) document.title = `${detail.title} — Motormila`;
      });
  }, [id]);

  // Enrich the generic route JSON-LD (set by RouteMeta) with real vehicle data
  // once the listing loads — same script element, so there is only ever one.
  useEffect(() => {
    if (!listing) return;
    const script = document.getElementById('autolens-jsonld');
    if (!script) return;

    const price = Number(listing.price_lkr || 0);
    const image = pickVehicleImageUrl(
      [listing.thumbnail_url, ...(Array.isArray(listing.images) ? listing.images : [])],
      [listing.url, listing.detail_url, listing.external_url],
    );

    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Vehicle',
      name: [listing.year, listing.make, listing.model].filter(Boolean).join(' ') || listing.title,
      brand: listing.make ? { '@type': 'Brand', name: listing.make } : undefined,
      model: listing.model || undefined,
      vehicleModelDate: listing.year ? String(listing.year) : undefined,
      mileageFromOdometer:
        Number.isFinite(Number(listing.mileage_km)) && Number(listing.mileage_km) > 0
          ? { '@type': 'QuantitativeValue', value: Number(listing.mileage_km), unitCode: 'KMT' }
          : undefined,
      fuelType: listing.fuel_type || undefined,
      vehicleTransmission: listing.transmission || undefined,
      bodyType: listing.body_type || undefined,
      image: image || undefined,
      url: `https://vehicle-platform-one.vercel.app/listing/${listing.id}`,
      areaServed: listing.district
        ? { '@type': 'AdministrativeArea', name: `${listing.district}, Sri Lanka` }
        : undefined,
      offers:
        Number.isFinite(price) && price >= 100_000
          ? {
              '@type': 'Offer',
              price,
              priceCurrency: 'LKR',
              availability: 'https://schema.org/InStock',
              areaServed: listing.district || 'Sri Lanka',
            }
          : undefined,
    });
  }, [listing]);

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="mx-auto max-w-[1320px] animate-pulse space-y-6 px-5 py-16 sm:px-6">
          <div className="skeleton-shimmer h-4 w-28 rounded" />
          <div className="skeleton-shimmer h-10 w-2/3 rounded" />
          <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
            <div className="skeleton-shimmer h-[320px] rounded-xl" />
            <div className="skeleton-shimmer h-[320px] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────
  if (!listing) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-5">
        <div className="text-center">
          <CarIcon className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Unavailable</p>
          <h1 className="mt-2 font-display text-xl font-semibold text-foreground">Listing not found</h1>
          <p className="mt-2 max-w-sm text-[12px] text-muted-foreground">The source may have removed it or the ID is no longer in the live index.</p>
          <button type="button" onClick={() => navigate('/')} className="mt-5 rounded-full bg-primary px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-primary-foreground shadow-soft transition-all hover:bg-primary/95 hover:shadow-soft-lg active:scale-[0.97]">Return to inventory</button>
        </div>
      </div>
    );
  }

  // ── Derived data ───────────────────────────────────────────
  const listingUrl = safeExternalUrl(listing.url || listing.detail_url || listing.external_url);
  const heroImage = pickVehicleImageUrl([listing.thumbnail_url, ...(Array.isArray(listing.images) ? listing.images : [])], [listing.url, listing.detail_url, listing.external_url]);
  const specs = [
    { label: "Year", value: listing.year ? String(listing.year) : "Unknown", icon: Calendar },
    { label: "Mileage", value: Number.isFinite(Number(listing.mileage_km)) && Number(listing.mileage_km) >= 0 ? `${Number(listing.mileage_km).toLocaleString()} KM` : "Unknown", icon: Gauge },
    { label: "Transmission", value: formatToken(listing.transmission), icon: Settings2 },
    { label: "Fuel", value: formatToken(listing.fuel_type), icon: Fuel },
    { label: "Condition", value: formatToken(listing.condition), icon: Sparkles },
    { label: "Body", value: formatToken(listing.body_type), icon: CarIcon },
  ];
  const listingPrice = Number(listing.price_lkr || 0);
  const hasPrice = Number.isFinite(listingPrice) && listingPrice >= 100_000 && listingPrice <= 500_000_000;
  // Map the listing's fuel label onto the import-tax model's fuel classes.
  const fuelRaw = String(listing.fuel_type || '').toLowerCase();
  const importFuelType: ImportFuelType =
    fuelRaw.includes('hybrid') || fuelRaw.includes('phev') ? 'hybrid'
    : fuelRaw.includes('electric') || fuelRaw === 'ev' ? 'electric'
    : fuelRaw.includes('diesel') ? 'diesel'
    : 'petrol';

  // null = rating suppressed server-side (thin cohort / old vehicle / extreme price)
  const hasDealScore = listing.deal_score !== null && listing.deal_score !== undefined;
  const dealScore = listing.deal_score || 0;
  const dealTone = dealScore >= 5
    ? 'text-emerald-600 dark:text-emerald-400'
    : dealScore <= -6
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-primary-bright';
  const dealDelta = dealScore ? `${Math.abs(dealScore)}% ${dealScore > 0 ? 'below' : 'above'} median` : 'at median';
  const sellerName = sellerProfile?.seller_name || listing.seller_name || `${listing.source} seller`;
  const sellerType = sellerProfile?.seller_type || (listing.is_dealer ? 'dealer' : 'unknown');
  const sellerHeadline = sellerType === 'dealer' ? 'Dealer' : sellerType === 'private' ? 'Private Seller' : 'Source Seller';
  const trustBadges = (sellerProfile?.verified_badges || []).slice(0, 2);
  const ratingValue = sellerProfile?.rating;
  const reviewCount = sellerProfile?.review_count;
  const ratingStars = ratingValue ? Math.round(Math.max(1, Math.min(5, ratingValue))) : 0;
  const trustMeta = [sellerProfile?.member_since ? `Since ${sellerProfile.member_since}` : null, sellerProfile?.listing_count != null ? `${sellerProfile.listing_count} listings` : null].filter(Boolean).join(' · ') || 'No extended seller history available.';
  const phonePreview = (sellerProfile?.phone_numbers || []).slice(0, 2);
  const whatsappPreview = (sellerProfile?.whatsapp_numbers || []).slice(0, 1);
  const trackedDays = (() => { const ts = new Date(listing.first_seen_at || '').getTime(); return Number.isFinite(ts) ? Math.max(1, Math.round((Date.now() - ts) / 86_400_000)) : null; })();
  const trackedLabel = trackedDays ? `${trackedDays}d` : 'N/A';
  const peerAges = similar.map((s) => { const ts = new Date(s.first_seen_at || '').getTime(); return Number.isFinite(ts) ? Math.max(1, Math.round((Date.now() - ts) / 86_400_000)) : null; }).filter((v): v is number => v !== null);
  const avgPeerDays = peerAges.length ? Math.round(peerAges.reduce((a, b) => a + b, 0) / peerAges.length) : null;

  // ── Render ─────────────────────────────────────────────────
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={revealContainer}
      className="min-h-screen relative overflow-hidden bg-background"
    >
      {/* Decorative Blur Orbs — token-based, adapt to both themes */}
      <div aria-hidden className="pointer-events-none absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute bottom-[20%] right-[-10%] h-[600px] w-[600px] rounded-full bg-primary/5 blur-[150px]" />

      {/* Header — the editorial hero: eyebrow, towering title, ask + verdict */}
      <motion.section variants={revealItem} className="relative z-10 -mt-16 border-b border-border bg-card/30 pt-16 backdrop-blur-md">
        <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 sm:py-10">
          <button type="button" onClick={handleBack} className="group mb-5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft aria-hidden className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> Back
          </button>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="section-eyebrow text-[10px] tracking-[0.18em]">Inspection</span>
            <span aria-hidden className="text-muted-foreground/40 text-xs">•</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{listing.source}</span>
          </div>

          {listing.is_active === false && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-400/[0.06] p-3.5 max-w-2xl">
              <AlertTriangle aria-hidden className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Possibly sold or delisted</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground font-medium">
                  This ad has not been seen at {listing.source}
                  {listing.last_seen_at ? ` since ${new Date(listing.last_seen_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ' recently'}.
                  Pricing below is kept for market reference and may be historical.
                </p>
              </div>
            </div>
          )}

          <h1 className="display-1 max-w-4xl text-foreground">
            {listing.make} {listing.model}{listing.year ? ` · ${listing.year}` : ''}
          </h1>

          {/* Mobile: the sticky price sidebar stacks ~4 screens down — surface ask + verdict here */}
          <div className="mt-4 flex flex-wrap items-center gap-3 lg:hidden">
            <p className="num text-3xl font-extrabold tracking-tight text-foreground">
              {hasPrice ? formatPrice(listingPrice) : 'Unlisted'}
            </p>
            {hasDealScore && (
              <span className="flex items-center gap-2">
                <FairPriceIndicator score={dealScore} condition={listing.condition} size="sm" />
                <span className={`num text-[11px] font-bold ${dealTone}`}>{dealDelta}</span>
              </span>
            )}
          </div>

          {listing.title && listing.title !== `${listing.make} ${listing.model}` && (
            <p className="mt-3 max-w-2xl text-[14px] text-muted-foreground leading-relaxed font-medium">{listing.title}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            {listingUrl && (
              <a href={listingUrl} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[10px] font-bold uppercase tracking-[0.08em] text-primary-foreground no-underline shadow-soft transition-all hover:bg-primary/95 hover:shadow-soft-lg active:scale-[0.97]">
                View on {listing.source} <ExternalLink aria-hidden className="h-3 w-3" />
              </a>
            )}
            <button type="button" onClick={handleWhatsAppShare} className="flex h-9 items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 text-[10px] font-bold uppercase tracking-[0.06em] text-emerald-700 dark:text-emerald-400 transition-all hover:bg-emerald-500/15 active:scale-[0.97]">
              <MessageCircle aria-hidden className="h-3 w-3" /> Share on WhatsApp
            </button>
            <button type="button" onClick={handleShare} className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground transition-all hover:text-foreground hover:bg-surface active:scale-[0.97]">
              <Share2 aria-hidden className="h-3 w-3" /> Share
            </button>
          </div>
        </div>
      </motion.section>

      {/* Content */}
      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-12 relative z-10">
        <div className="grid gap-6 lg:grid-cols-[1.75fr_1fr] lg:items-start lg:gap-8">

          {/* ── MAIN ──────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Image — the car is the hero; overlays stay dark (they sit on the photo) */}
            <motion.div variants={revealItem} className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              <div className="relative aspect-[16/10] min-h-[220px] bg-black/40 overflow-hidden group">
                {heroImage ? (
                  <VehicleThumbnail src={heroImage} listingId={listing.id} alt={`${listing.make} ${listing.model}`} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]" placeholderClassName="flex h-full w-full items-center justify-center bg-black/40" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><CarIcon aria-hidden className="h-12 w-12 text-white/50" /></div>
                )}
                <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10">
                  <span className="rounded-md border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-md">{listing.make} {listing.model} · {listing.year || 'N/A'}</span>
                  <span className="flex items-center gap-1 rounded-md border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-primary-bright backdrop-blur-md"><Database aria-hidden className="h-3 w-3" /> {listing.source}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 border-t border-border px-4 py-3 bg-card">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><MapPin aria-hidden className="h-3.5 w-3.5 text-primary-bright" /> {listing.district || 'Unknown'}, Sri Lanka</span>
                <span aria-hidden className="text-muted-foreground/30 text-xs">•</span>
                <span className="num flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground"><Clock aria-hidden className="h-3.5 w-3.5 text-primary-bright" /> Tracked {trackedLabel}</span>
              </div>
            </motion.div>

            {/* Specs Bento Grid */}
            <motion.div variants={revealItem} className="space-y-3">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Specifications</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {specs.map((s) => (
                  <motion.div
                    key={s.label}
                    whileHover={{ scale: 1.02, y: -3 }}
                    transition={springSnappy}
                    className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30 relative overflow-hidden group shadow-soft"
                  >
                    <div aria-hidden className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <s.icon aria-hidden className="mb-2 h-4 w-4 text-primary" />
                    <p className="text-[10px] font-medium text-muted-foreground">{s.label}</p>
                    <p className="mt-1 text-[14px] font-bold text-foreground num leading-tight">{s.value}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {priceHistory && priceHistory.points.length > 0 && (
              <motion.div variants={revealItem}>
                <ListingPriceTimeline
                  history={priceHistory}
                  marketMedianLkr={listing.market_median_lkr}
                  listingTitle={`${listing.make} ${listing.model}`}
                />
              </motion.div>
            )}

            {listing.id != null && <ListingHistoryReport listingId={listing.id} />}

            {/* Description */}
            <motion.div variants={revealItem} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h2 className="mb-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Description</h2>
              <p className="whitespace-pre-wrap text-[13px] leading-[1.8] text-muted-foreground font-medium">
                {listing.description || 'No description provided. Market intelligence indicates this vehicle is priced within the range of comparable models.'}
              </p>
            </motion.div>

            {hasPrice && (() => {
              // brand_new already covers API-normalized "unregistered"/new imports
              const isUnregistered =
                listing.condition === 'brand_new' ||
                (typeof listing.year === 'number' && listing.year >= 2025);

              return (
                <motion.div variants={revealItem} className="space-y-4">
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Ownership planning</h2>

                  <CashToOwnStrip
                    priceLkr={listingPrice}
                    financeClass={inferFinanceClass({
                      condition: listing.condition,
                      fuelType: listing.fuel_type,
                      year: listing.year,
                    })}
                  />
                <div className="grid gap-4 md:grid-cols-2 items-start">
                  <LeaseCalculator
                    price={listingPrice}
                    financeClass={inferFinanceClass({
                      condition: listing.condition,
                      fuelType: listing.fuel_type,
                      year: listing.year,
                    })}
                  />
                  {isUnregistered ? (
                    <TaxBreakdown
                      price={listingPrice}
                      engineCapacity={typeof listing.engine_cc === 'number' ? listing.engine_cc : undefined}
                      initialFuelType={importFuelType}
                    />
                  ) : (
                    <div className="page-panel flex flex-col justify-between gap-3 rounded-xl p-6">
                      <div>
                        <h2 className="field-label text-foreground">Import duty and tax</h2>
                        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                          This vehicle is already registered in Sri Lanka, so import duty doesn't
                          apply to buying it. Curious what importing the same spec fresh would cost
                          under today's gazette?
                        </p>
                      </div>
                      <Link
                        to={`/calculator?tab=landed-cost&fuel=${importFuelType}${typeof listing.engine_cc === 'number' ? `&cc=${listing.engine_cc}` : ''}`}
                        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-primary-bright no-underline transition-all hover:bg-primary/15"
                      >
                        Model a fresh import <ArrowRight aria-hidden className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })()}
          </div>

          {/* ── SIDEBAR ───────────────────────────────────────── */}
          <aside className="space-y-5 lg:sticky lg:top-20">

            {/* Price — the money hero: the number towers, verdict reads in signal colour */}
            <motion.div
              variants={revealItem}
              className="rounded-2xl border border-border bg-card p-5 relative overflow-hidden shadow-soft-lg"
              style={{ backgroundImage: 'radial-gradient(circle at 100% 0%, hsl(var(--primary) / 0.06) 0%, transparent 60%)' }}
            >
              <div aria-hidden className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-transparent" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Asking price</h2>
              <p className="num mt-2 text-[2.5rem] font-extrabold leading-[1.05] tracking-tight text-foreground">{hasPrice ? formatPrice(listingPrice) : 'Unlisted'}</p>

              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <HybridCliffBadge fuelType={listing.fuel_type} engineCc={listing.engine_cc} />
                <MileageTrustChip mileageKm={listing.mileage_km} year={listing.year} />
                <SellSpeedChip listing={listing} />
                <AdvertHealthChip listing={listing} />
                {priceHistory && priceHistory.cut_count > 0 && (
                  <span
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                    title={`Tracked since first sighting: ${priceHistory.cut_count} downward price ${priceHistory.cut_count === 1 ? 'move' : 'moves'}${priceHistory.change_pct !== null ? `, ${priceHistory.change_pct}% overall` : ''}`}
                  >
                    <Clock aria-hidden className="h-3 w-3" />
                    Price cut {priceHistory.cut_count}×
                    {priceHistory.change_pct !== null && priceHistory.change_pct < 0 && (
                      <span className="num">({priceHistory.change_pct}%)</span>
                    )}
                  </span>
                )}
              </div>

              {hasDealScore ? (
                <div className="mt-5 flex items-center gap-3">
                  <FairPriceIndicator score={dealScore} condition={listing.condition} size="lg" className="num font-extrabold" />
                  <span className={`num text-[11px] font-bold ${dealTone}`}>{dealDelta}</span>
                </div>
              ) : (
                <p className="mt-5 text-[11px] font-semibold text-muted-foreground">
                  No price rating — not enough comparable listings for a confident call on this vehicle.
                </p>
              )}

              {hasPrice &&
                Number.isFinite(Number(listing.market_median_lkr)) &&
                Number(listing.market_median_lkr) > 0 && (
                  <div className="mt-2">
                    <DealLadder askingPrice={listingPrice} marketMedianLkr={Number(listing.market_median_lkr)} />
                  </div>
                )}
            </motion.div>

            {/* Seller */}
            <motion.div variants={revealItem} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="mb-3.5 flex items-center gap-2 border-b border-border pb-2.5">
                <ShieldCheck aria-hidden className="h-4 w-4 text-primary" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Seller information</h2>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-foreground leading-tight">{sellerHeadline}</p>
                  <p className="mt-1 truncate text-[12px] text-muted-foreground font-medium">{sellerName}</p>
                </div>
                <span className="shrink-0 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-primary-bright">{trustBadges[0] || 'Source'}</span>
              </div>

              <p className="mt-3 text-[11px] text-muted-foreground font-medium">{trustMeta}</p>

              {ratingValue ? (
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3.5">
                  <div aria-hidden className="flex gap-0.5 text-primary">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <svg key={s} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={s <= ratingStars ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" className={s > ratingStars ? 'text-muted-foreground/30' : ''}>
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                  <span className="num text-[12px] font-bold text-foreground">{ratingValue.toFixed(1)}{reviewCount != null && <span className="text-muted-foreground font-medium"> ({reviewCount})</span>}</span>
                </div>
              ) : <p className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground italic">No public seller rating synced.</p>}

              {(phonePreview.length > 0 || whatsappPreview.length > 0) && (
                <div className="mt-4 flex flex-wrap gap-1.5 pt-1">
                  {phonePreview.map((p) => (
                    <a key={p} href={`tel:${p.replace(/[^\d+]/g, "")}`}
                      className="num rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-bold text-foreground no-underline transition-colors hover:border-primary/30 hover:bg-card">
                      {p}
                    </a>
                  ))}
                  {whatsappPreview.map((p) => (
                    <a key={`wa-${p}`} href={`https://wa.me/${p.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                      className="num rounded-md border border-emerald-500/25 bg-emerald-500/5 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 no-underline transition-colors hover:bg-emerald-500/10">
                      WA {p}
                    </a>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Peers */}
            <motion.div variants={revealItem} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="mb-3.5 flex items-center justify-between border-b border-border pb-2.5">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Market peers</h2>
                <ArrowRight aria-hidden className="h-3.5 w-3.5 text-primary" />
              </div>

              {similar.length > 0 ? (
                <div className="space-y-2">
                  {similar.map((s) => (
                    <Link
                      key={s.id}
                      to={`/listing/${s.id}`}
                      className="group flex items-center justify-between rounded-lg border border-border bg-surface px-3.5 py-2.5 no-underline transition-all hover:bg-card hover:border-primary/30 hover:translate-y-[-1px]"
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">{s.make} {s.model} · {s.year}</p>
                        <p className="num mt-1 text-[13px] font-bold text-foreground group-hover:text-primary transition-colors">{formatPrice(s.price_lkr)}</p>
                      </div>
                      {typeof s.deal_score === 'number' && s.deal_score > 0 && (
                        <span className="num text-[10px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 bg-emerald-500/10 rounded px-1.5 py-0.5">{s.deal_score}%</span>
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center"><CarIcon aria-hidden className="mx-auto mb-2 h-5 w-5 text-muted-foreground/40" /><p className="text-[11px] text-muted-foreground">No active peers tracked.</p></div>
              )}
            </motion.div>

            {/* Insight */}
            <motion.div variants={revealItem} className="rounded-2xl border border-border bg-card p-5 shadow-soft relative overflow-hidden">
              <div aria-hidden className="absolute top-0 left-0 h-full w-[2px] bg-primary" />
              <div className="flex items-center gap-2 mb-2">
                <Zap aria-hidden className="h-4 w-4 text-primary" />
                <h2 className="text-[12px] font-bold text-foreground">Motormila Insight</h2>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
                Tracked for <span className="num font-bold text-foreground">{trackedLabel}</span>.
                {avgPeerDays && ` Peers average ${avgPeerDays}d.`}
                {similar.length > 0 && ` ${similar.length} comparable listings active.`}
              </p>
            </motion.div>
          </aside>
        </div>
      </div>
    </motion.div>
  );
}
