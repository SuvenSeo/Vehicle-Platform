import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, MapPin, Calendar,
  Share2, Fuel, Gauge, Settings2, Info,
  Car as CarIcon, ArrowRight, Zap, Sparkles, ShieldCheck, Clock, Database
} from 'lucide-react';
import { getListing, getSellerTrustProfile, getSimilarListings, formatPrice } from '@/services/api';
import type { CarListing, SellerTrustProfile } from '@/types/car';
import { Button } from '@/components/ui/button';
import { PlatformPageHero } from '@/components/PlatformPageHero';
import { PageCanvas } from '@/components/PageCanvas';
import { VehicleThumbnail } from '@/components/VehicleThumbnail';
import { pickVehicleImageUrl } from '@/lib/listingImage';
import { toast } from 'sonner';
import { FairPriceIndicator } from '@/components/FairPriceIndicator';
import { LeaseCalculator } from '@/components/LeaseCalculator';
import { TaxBreakdown } from '@/components/TaxBreakdown';

function formatToken(value: string | null | undefined): string {
   if (!value) return 'Unknown';
   return value
      .replace(/[_-]/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
}

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [listing, setListing] = useState<CarListing | null>(null);
  const [similar, setSimilar] = useState<CarListing[]>([]);
   const [sellerProfile, setSellerProfile] = useState<SellerTrustProfile | null>(null);
  const [loading, setLoading] = useState(true);

   const handleBack = () => {
      if (window.history.length > 1) {
         navigate(-1);
         return;
      }
      navigate('/');
   };

   const handleShare = async () => {
      const shareUrl = window.location.href;
      try {
         if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(shareUrl);
            toast.success('Listing link copied');
         } else {
            toast.error('Copy unavailable', {
               description: 'Use the browser address bar to copy this listing link.',
            });
         }
      } catch {
         toast.error('Copy unavailable', {
            description: 'Clipboard access is blocked in this browser session.',
         });
      }
   };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
      setSellerProfile(null);

    Promise.all([
      getListing(id).catch(() => null),
      getSimilarListings(id).catch(() => []),
         getSellerTrustProfile(id).catch(() => null),
      ]).then(([detail, sim, profile]) => {
      setListing(detail);
      setSimilar(sim);
         setSellerProfile(profile);
      setLoading(false);
      if (detail) document.title = `${detail.title} — AutoLens LK`;
    });
  }, [id]);

  if (loading) {
    return (
      <PageCanvas className="min-h-screen">
        <div className="layout-shell space-y-8 py-16 animate-pulse">
          <div className="skeleton-shimmer h-4 w-28 rounded" />
          <div className="skeleton-shimmer h-12 w-2/3 rounded" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <div className="skeleton-shimmer h-[320px] rounded-[12px]" />
            <div className="skeleton-shimmer h-[320px] rounded-[12px]" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton-shimmer h-28 rounded-[10px]" />
            ))}
          </div>
        </div>
      </PageCanvas>
    );
  }

  if (!listing) {
    return (
      <PageCanvas className="min-h-screen text-white">
        <div className="layout-shell flex min-h-[70vh] items-center justify-center py-16">
          <div className="console-empty !max-w-[560px]">
            <CarIcon className="mx-auto mb-4 h-10 w-10 text-zinc-600" />
            <p className="tech-label mb-2 text-zinc-600">Listing unavailable</p>
            <h1 className="headline-display mb-3 text-2xl sm:text-3xl">This market record could not be loaded.</h1>
            <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-zinc-400">
              The source may have removed it, or the listing id is no longer available in the live index.
            </p>
            <Button
              type="button"
              onClick={() => navigate('/')}
              className="action-primary h-11"
            >
              Return to inventory
            </Button>
          </div>
        </div>
      </PageCanvas>
    );
  }

   const listingUrl = listing.url || listing.detail_url || listing.external_url || '#';
   const heroImageUrl = pickVehicleImageUrl(
      [listing.thumbnail_url, ...(Array.isArray(listing.images) ? listing.images : [])],
      [listing.url, listing.detail_url, listing.external_url],
   );

   const specs = [
      { label: "Year", value: listing.year ? String(listing.year) : "Unknown", icon: Calendar },
      {
         label: "Mileage",
         value: Number.isFinite(Number(listing.mileage_km)) && Number(listing.mileage_km) >= 0 ? `${Number(listing.mileage_km).toLocaleString()} KM` : "Unknown",
         icon: Gauge,
      },
      { label: "Transmission", value: formatToken(listing.transmission), icon: Settings2 },
      { label: "Fuel", value: formatToken(listing.fuel_type), icon: Fuel },
      { label: "Condition", value: formatToken(listing.condition), icon: Sparkles },
      { label: "Body", value: formatToken(listing.body_type), icon: CarIcon },
   ];
   const listingPrice = Number(listing.price_lkr || 0);
   const hasKnownPrice = Number.isFinite(listingPrice) && listingPrice >= 100_000 && listingPrice <= 500_000_000;

  const dealColor = (listing.deal_score || 0) >= 15 ? '#d89b35' : (listing.deal_score || 0) >= 5 ? '#e9b652' : (listing.deal_score || 0) >= -5 ? '#f59e0b' : '#ef4444';
  const dealLabel = (listing.deal_score || 0) >= 15 ? 'Great Deal' : (listing.deal_score || 0) >= 5 ? 'Good Deal' : (listing.deal_score || 0) >= -5 ? 'Fair Price' : 'High Price';
   const sellerName = sellerProfile?.seller_name || listing.seller_name || `${listing.source} seller`;
   const sellerType = sellerProfile?.seller_type || (listing.is_dealer ? 'dealer' : 'unknown');
   const sellerHeadline = sellerType === 'dealer' ? 'Dealer Profile' : sellerType === 'private' ? 'Private Seller' : 'Source Seller';
   const trustBadges = (sellerProfile?.verified_badges || []).slice(0, 2);
   const ratingValue = sellerProfile?.rating;
   const reviewCount = sellerProfile?.review_count;
   const ratingStars = ratingValue ? Math.round(Math.max(1, Math.min(5, ratingValue))) : 0;
   const trustMetaParts = [
      sellerProfile?.member_since ? `Member since ${sellerProfile.member_since}` : null,
      sellerProfile?.listing_count != null ? `${sellerProfile.listing_count} listings` : null,
   ].filter((item): item is string => Boolean(item));
   const trustMeta = trustMetaParts.length
      ? trustMetaParts.join(' · ')
      : 'Source does not publish extended seller history for this listing.';
   const phonePreview = (sellerProfile?.phone_numbers || []).slice(0, 2);
   const whatsappPreview = (sellerProfile?.whatsapp_numbers || []).slice(0, 1);

   const listingTrackedDays = (() => {
      const firstSeen = new Date(listing.first_seen_at || '').getTime();
      if (!Number.isFinite(firstSeen)) return null;
      return Math.max(1, Math.round((Date.now() - firstSeen) / 86_400_000));
   })();

   const peerTrackedAges = similar
      .map((item) => {
         const firstSeen = new Date(item.first_seen_at || '').getTime();
         if (!Number.isFinite(firstSeen)) return null;
         return Math.max(1, Math.round((Date.now() - firstSeen) / 86_400_000));
      })
      .filter((value): value is number => Number.isFinite(value));

   const averagePeerTrackedDays = peerTrackedAges.length
      ? Math.round(peerTrackedAges.reduce((sum, value) => sum + value, 0) / peerTrackedAges.length)
      : null;

   const trackedLabel = listingTrackedDays
      ? `${listingTrackedDays} day${listingTrackedDays === 1 ? '' : 's'}`
      : 'not enough first-seen data yet';

   const peerTrackedLabel = averagePeerTrackedDays
      ? `${averagePeerTrackedDays} day${averagePeerTrackedDays === 1 ? '' : 's'}`
      : 'insufficient peer history';

   const dealDelta = listing.deal_score
      ? `${Math.abs(listing.deal_score)}% ${listing.deal_score > 0 ? 'below' : 'above'} median`
      : 'at market median';
   // Below median is a positive (good-deal) signal; above median is a risk signal.
   const dealIsPositive = (listing.deal_score || 0) >= 5;
   const dealIsNegative = (listing.deal_score || 0) <= -6;
   const dealTone = dealIsPositive
      ? 'text-emerald-400'
      : dealIsNegative
        ? 'text-rose-400'
        : 'text-amber-400';

  return (
    <PageCanvas className="min-h-screen text-white selection:bg-primary/30">

      <PlatformPageHero
        eyebrow="Inspection Report"
        title={`${listing.make} ${listing.model}${listing.year ? ` · ${listing.year}` : ''}`}
        description={listing.title}
        icon={CarIcon}
        metrics={[
          { label: 'Asking Price', value: hasKnownPrice ? formatPrice(listingPrice) : 'Unlisted' },
          { label: 'Deal Signal', value: dealLabel },
          { label: 'Tracked For', value: trackedLabel },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {listingUrl !== '#' ? (
              <Button asChild className="action-primary h-10 px-4">
                <a href={listingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  View on {listing.source} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            ) : (
              <Button disabled className="action-soft h-10 px-4 cursor-not-allowed opacity-60">
                Source link unavailable
              </Button>
            )}
            <button
              type="button"
              onClick={handleShare}
              className="action-soft h-10 px-3"
              aria-label="Copy listing link"
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
          </div>
        }
      />

      <div className="layout-shell py-10 sm:py-12">

        {/* Back navigation */}
        <button
          type="button"
          onClick={handleBack}
          className="group mb-8 inline-flex items-center gap-2 tech-label text-zinc-500 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> Back to Market
        </button>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] lg:items-start">

          {/* ====================== MAIN COLUMN ====================== */}
          <div className="space-y-6">

            {/* MEDIA + IDENTITY */}
            <section className="asset-surface overflow-hidden rounded-[12px]" aria-label="Vehicle media">
              <div className="relative aspect-[16/10] min-h-[220px] bg-zinc-900/60">
                {heroImageUrl ? (
                  <VehicleThumbnail
                    src={heroImageUrl}
                    listingId={listing.id}
                    alt={`${listing.make} ${listing.model}`}
                    className="h-full w-full object-cover"
                    placeholderClassName="flex h-full w-full items-center justify-center bg-zinc-900/60"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <CarIcon className="h-14 w-14 text-zinc-700" />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3">
                  <span className="rounded-md border border-white/10 bg-black/45 px-2.5 py-1 tech-label text-zinc-200">
                    {listing.make} {listing.model} · {listing.year || 'N/A'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/45 px-2.5 py-1 tech-label text-cyan-400">
                    <Database className="h-3 w-3" /> {listing.source}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-5 py-3.5">
                <span className="inline-flex items-center gap-1.5 text-sm text-zinc-300">
                  <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                  {listing.district || 'District Unknown'}, Sri Lanka
                </span>
                <span className="inline-flex items-center gap-1.5 tech-label text-zinc-500">
                  <Clock className="h-3.5 w-3.5" /> Tracked {trackedLabel}
                </span>
              </div>
            </section>

            {/* SPECS BENTO */}
            <section aria-label="Vehicle specifications">
              <h2 className="field-label mb-3 text-zinc-500">Specifications</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {specs.map((s) => (
                  <div key={s.label} className="data-card motion-card p-5">
                    <s.icon className="mb-3 h-4.5 w-4.5 text-zinc-500" />
                    <p className="tech-label mb-1 text-zinc-500">{s.label}</p>
                    <p className="num text-base font-bold text-white">{s.value || 'Unknown'}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* DESCRIPTION */}
            <section className="data-card rounded-[12px] p-6" aria-label="Listing description">
              <h2 className="field-label mb-3 text-zinc-500">Source Description</h2>
              <p className="whitespace-pre-wrap text-[15px] leading-[1.8] text-zinc-300/90">
                {listing.description || 'The seller has not provided a detailed description. Market intelligence reports indicate this vehicle is priced within the range of comparable models.'}
              </p>
            </section>

            {/* FINANCIAL TOOLS */}
            <section aria-label="Finance and tax tools">
              <h2 className="field-label mb-3 text-zinc-500">Ownership Planning</h2>
              {hasKnownPrice ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <LeaseCalculator price={listingPrice} />
                  <TaxBreakdown price={listingPrice} engineCapacity={typeof listing.engine_cc === 'number' ? listing.engine_cc : undefined} />
                </div>
              ) : (
                <div className="console-empty text-sm text-zinc-400">
                  <Info className="mx-auto mb-3 h-6 w-6 text-zinc-600" />
                  Lease and tax estimates are hidden until this source publishes a usable asking price.
                </div>
              )}
            </section>

          </div>

          {/* ====================== SIDEBAR ====================== */}
          <aside className="space-y-6 lg:sticky lg:top-24">

            {/* PRICE + DEAL */}
            <section className="data-card rounded-[12px] p-6" aria-label="Price and deal signal">
              <p className="field-label text-zinc-500">Asking Price</p>
              <p className="headline-display num mt-1.5 text-3xl sm:text-4xl">
                {hasKnownPrice ? formatPrice(listingPrice) : 'Price unavailable'}
              </p>

              <div className="mt-5 flex items-center gap-3">
                <FairPriceIndicator score={listing.deal_score || 0} condition={listing.condition} size="lg" className="num" />
                <span className={`num text-xs font-bold ${dealTone}`}>{dealDelta}</span>
              </div>

              {/* Median position bar — semantic gradient: low (good) -> median -> high (risk) */}
              <div className="mt-5 space-y-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full w-full origin-left bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500"
                    style={{ transform: `scaleX(${Math.max(0.12, Math.min(0.95, (50 + (listing.deal_score || 0)) / 100))})` }}
                  />
                </div>
                <div className="tech-label flex justify-between text-zinc-600">
                  <span>Overpriced</span>
                  <span>Median</span>
                  <span>Below</span>
                </div>
              </div>

              <div className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-xs text-zinc-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Market median for this model is{' '}
                  <span className="num font-semibold text-white">
                    {formatPrice(listing.market_median_lkr || (hasKnownPrice ? listingPrice : null))}
                  </span>
                </span>
              </div>
            </section>

            {/* SELLER TRUST */}
            <section className="data-card rounded-[12px] p-6" aria-label="Seller trust profile">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-zinc-500" />
                <h2 className="field-label text-zinc-500">Seller Trust Profile</h2>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="headline-display text-lg">{sellerHeadline}</p>
                  <p className="mt-0.5 truncate text-sm text-zinc-300">{sellerName}</p>
                </div>
                <span className="shrink-0 rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 tech-label text-amber-400">
                  {trustBadges[0] || 'Source Profile'}
                </span>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-zinc-500">{trustMeta}</p>

              <div className="mt-4 border-t border-border pt-4">
                {ratingValue ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex gap-1 text-amber-400">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg key={star} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={star <= ratingStars ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={star > ratingStars ? 'text-zinc-700' : ''} aria-hidden="true">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                      ))}
                    </div>
                    <span className="num text-sm font-bold text-zinc-300">
                      {ratingValue.toFixed(1)} / 5
                      {reviewCount != null && (
                        <span className="font-normal text-zinc-600"> ({reviewCount})</span>
                      )}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-zinc-500">No public rating available from this source.</p>
                )}

                {(phonePreview.length > 0 || whatsappPreview.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {phonePreview.map((phone) => (
                      <span key={phone} className="num text-caption rounded-md border border-border bg-black/20 px-2.5 py-1 font-semibold text-zinc-300">
                        {phone}
                      </span>
                    ))}
                    {whatsappPreview.map((phone) => (
                      <span key={`wa-${phone}`} className="num text-caption rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-400">
                        WhatsApp {phone}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <p className="mt-4 inline-flex items-center gap-1.5 tech-label text-cyan-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Live source data · {sellerProfile?.source || listing.source}
              </p>
            </section>

            {/* MARKET PEERS */}
            <section aria-label="Similar market listings">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="field-label text-zinc-500">Market Peers</h2>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-600" />
              </div>

              {similar.length > 0 ? (
                <ul className="space-y-2.5">
                  {similar.map((s) => (
                    <li key={s.id}>
                      <Link
                        to={`/listing/${s.id}`}
                        className="asset-surface motion-card group block rounded-[10px] px-4 py-3.5 transition-colors hover:border-amber-400/25"
                      >
                        <p className="tech-label text-zinc-500">
                          {s.make} {s.model} · {s.year}
                        </p>
                        <div className="mt-1 flex items-baseline justify-between gap-3">
                          <span className="num text-base font-bold text-white transition-colors group-hover:text-amber-400">
                            {formatPrice(s.price_lkr)}
                          </span>
                          {typeof s.deal_score === 'number' && s.deal_score > 0 && (
                            <span className="num text-caption font-bold text-emerald-400">{s.deal_score}% below</span>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="console-empty">
                  <CarIcon className="mx-auto mb-3 h-7 w-7 text-zinc-700" />
                  <p className="tech-label text-zinc-600">No active peers found</p>
                </div>
              )}
            </section>

            {/* INSIGHT */}
            <section className="data-card rounded-[12px] p-6" aria-label="AutoLens insight">
              <Zap className="mb-3 h-5 w-5 text-amber-400" />
              <h2 className="mb-2 text-sm font-bold text-white">AutoLens Insight</h2>
              <p className="text-xs leading-relaxed text-zinc-400">
                This listing has been tracked for <span className="font-bold text-white">{trackedLabel}</span>.
                Comparable {listing.make} {listing.model} listings in this view show an average observed age of{' '}
                <span className="font-bold text-white">{peerTrackedLabel}</span>.
              </p>
            </section>

          </aside>

        </div>
      </div>
      </PageCanvas>
  );
}
