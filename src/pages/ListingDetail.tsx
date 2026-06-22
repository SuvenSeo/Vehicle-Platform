import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, MapPin, Calendar,
  Share2, Fuel, Gauge, Settings2, Info,
  Car as CarIcon, ArrowRight, Zap, Sparkles, ShieldCheck, Clock, Database
} from 'lucide-react';
import { getListing, getSellerTrustProfile, getSimilarListings, formatPrice } from '@/services/api';
import type { CarListing, SellerTrustProfile } from '@/types/car';
import { VehicleThumbnail } from '@/components/VehicleThumbnail';
import { pickVehicleImageUrl } from '@/lib/listingImage';
import { toast } from 'sonner';
import { FairPriceIndicator } from '@/components/FairPriceIndicator';
import { LeaseCalculator } from '@/components/LeaseCalculator';
import { TaxBreakdown } from '@/components/TaxBreakdown';

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
  const [loading, setLoading] = useState(true);

  const handleBack = () => { window.history.length > 1 ? navigate(-1) : navigate('/'); };
  const handleShare = async () => {
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(window.location.href); toast.success('Link copied'); }
      else toast.error('Copy unavailable');
    } catch { toast.error('Clipboard blocked'); }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true); setSellerProfile(null);
    Promise.all([getListing(id).catch(() => null), getSimilarListings(id).catch(() => []), getSellerTrustProfile(id).catch(() => null)])
      .then(([detail, sim, profile]) => {
        setListing(detail); setSimilar(sim); setSellerProfile(profile); setLoading(false);
        if (detail) document.title = `${detail.title} — AutoLens LK`;
      });
  }, [id]);

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
          <CarIcon className="mx-auto mb-4 h-8 w-8 text-zinc-600" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">Unavailable</p>
          <h1 className="mt-2 font-display text-xl font-semibold text-foreground">Listing not found</h1>
          <p className="mt-2 max-w-sm text-[12px] text-zinc-500">The source may have removed it or the ID is no longer in the live index.</p>
          <button type="button" onClick={() => navigate('/')} className="mt-5 rounded-lg bg-[var(--gold)] px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-black hover:bg-[var(--gold-bright)]">Return to inventory</button>
        </div>
      </div>
    );
  }

  // ── Derived data ───────────────────────────────────────────
  const listingUrl = listing.url || listing.detail_url || listing.external_url || '#';
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
  const dealScore = listing.deal_score || 0;
  const dealTone = dealScore >= 5 ? 'text-emerald-400' : dealScore <= -6 ? 'text-rose-400' : 'text-amber-400';
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
    <div className="min-h-screen">
      {/* Header */}
      <section className="border-b border-white/[0.04]">
        <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 sm:py-10">
          <button type="button" onClick={handleBack} className="group mb-5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500 transition-colors hover:text-zinc-200">
            <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" /> Back
          </button>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">Inspection · {listing.source}</p>
          <h1 className="mt-2 font-display text-[1.75rem] font-semibold tracking-tight text-foreground sm:text-[2.25rem]">
            {listing.make} {listing.model}{listing.year ? ` · ${listing.year}` : ''}
          </h1>
          {listing.title && listing.title !== `${listing.make} ${listing.model}` && (
            <p className="mt-1.5 max-w-xl text-sm text-zinc-500">{listing.title}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {listingUrl !== '#' && (
              <a href={listingUrl} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--gold)] px-4 text-[10px] font-bold uppercase tracking-[0.08em] text-black no-underline hover:bg-[var(--gold-bright)]">
                View on {listing.source} <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button type="button" onClick={handleShare} className="flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.06] px-3 text-[10px] font-semibold text-zinc-400 hover:text-zinc-200">
              <Share2 className="h-3 w-3" /> Share
            </button>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-[1.75fr_1fr] lg:items-start">

          {/* ── MAIN ──────────────────────────────────────────── */}
          <div className="space-y-5">
            {/* Image */}
            <div className="overflow-hidden rounded-xl border border-white/[0.05] bg-[hsl(220,8%,6%)]">
              <div className="relative aspect-[16/10] min-h-[220px] bg-black/30">
                {heroImage ? (
                  <VehicleThumbnail src={heroImage} listingId={listing.id} alt={`${listing.make} ${listing.model}`} className="h-full w-full object-cover" placeholderClassName="flex h-full w-full items-center justify-center bg-black/30" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><CarIcon className="h-12 w-12 text-zinc-700" /></div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <span className="rounded-md bg-black/50 px-2 py-1 text-[10px] font-semibold text-zinc-200 backdrop-blur-sm">{listing.make} {listing.model} · {listing.year || 'N/A'}</span>
                  <span className="flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[10px] font-semibold text-cyan-400 backdrop-blur-sm"><Database className="h-3 w-3" /> {listing.source}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 border-t border-white/[0.04] px-4 py-3">
                <span className="flex items-center gap-1.5 text-[12px] text-zinc-400"><MapPin className="h-3 w-3 text-zinc-600" /> {listing.district || 'Unknown'}, Sri Lanka</span>
                <span className="flex items-center gap-1.5 text-[10px] text-zinc-500"><Clock className="h-3 w-3" /> Tracked {trackedLabel}</span>
              </div>
            </div>

            {/* Specs */}
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Specifications</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {specs.map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/[0.04] bg-[hsl(220,8%,5.5%)] p-4">
                    <s.icon className="mb-2 h-3.5 w-3.5 text-zinc-600" />
                    <p className="text-[10px] text-zinc-500">{s.label}</p>
                    <p className="mt-1 text-[13px] font-bold text-foreground num">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="rounded-xl border border-white/[0.04] bg-[hsl(220,8%,5.5%)] p-5">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Description</p>
              <p className="whitespace-pre-wrap text-[13px] leading-[1.8] text-zinc-400">
                {listing.description || 'No description provided. Market intelligence indicates this vehicle is priced within the range of comparable models.'}
              </p>
            </div>

            {/* Finance */}
            {hasPrice && (
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Ownership planning</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <LeaseCalculator price={listingPrice} />
                  <TaxBreakdown price={listingPrice} engineCapacity={typeof listing.engine_cc === 'number' ? listing.engine_cc : undefined} />
                </div>
              </div>
            )}
          </div>

          {/* ── SIDEBAR ───────────────────────────────────────── */}
          <aside className="space-y-4 lg:sticky lg:top-20">
            {/* Price */}
            <div className="rounded-xl border border-white/[0.05] bg-[hsl(220,8%,6%)] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Asking price</p>
              <p className="num mt-2 text-3xl font-bold tracking-tight text-foreground">{hasPrice ? formatPrice(listingPrice) : 'Unlisted'}</p>
              <div className="mt-4 flex items-center gap-3">
                <FairPriceIndicator score={dealScore} condition={listing.condition} size="lg" className="num" />
                <span className={`num text-[11px] font-bold ${dealTone}`}>{dealDelta}</span>
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800/60">
                  <div className="h-full w-full origin-left bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500" style={{ transform: `scaleX(${Math.max(0.12, Math.min(0.95, (50 + dealScore) / 100))})` }} />
                </div>
                <div className="flex justify-between text-[9px] text-zinc-600"><span>Overpriced</span><span>Median</span><span>Below</span></div>
              </div>
              <div className="mt-4 flex items-start gap-2 border-t border-white/[0.04] pt-3 text-[11px] text-zinc-500">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                <span>Median: <span className="num font-semibold text-zinc-300">{formatPrice(listing.market_median_lkr || (hasPrice ? listingPrice : null))}</span></span>
              </div>
            </div>

            {/* Seller */}
            <div className="rounded-xl border border-white/[0.05] bg-[hsl(220,8%,6%)] p-5">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-zinc-500" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Seller</p>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-foreground">{sellerHeadline}</p>
                  <p className="mt-0.5 truncate text-[12px] text-zinc-400">{sellerName}</p>
                </div>
                <span className="shrink-0 rounded-md border border-amber-400/15 bg-amber-400/5 px-2 py-0.5 text-[10px] font-semibold text-amber-300/80">{trustBadges[0] || 'Source'}</span>
              </div>
              <p className="mt-2 text-[10px] text-zinc-500">{trustMeta}</p>
              {ratingValue ? (
                <div className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-3">
                  <div className="flex gap-0.5 text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <svg key={s} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={s <= ratingStars ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className={s > ratingStars ? 'text-zinc-700' : ''}>
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                  <span className="num text-[12px] font-bold text-zinc-300">{ratingValue.toFixed(1)}{reviewCount != null && <span className="text-zinc-600"> ({reviewCount})</span>}</span>
                </div>
              ) : <p className="mt-3 border-t border-white/[0.04] pt-3 text-[11px] text-zinc-500">No public rating.</p>}
              {(phonePreview.length > 0 || whatsappPreview.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {phonePreview.map((p) => <span key={p} className="num rounded-md border border-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-zinc-300">{p}</span>)}
                  {whatsappPreview.map((p) => <span key={`wa-${p}`} className="num rounded-md border border-emerald-500/15 bg-emerald-500/5 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">WA {p}</span>)}
                </div>
              )}
            </div>

            {/* Peers */}
            <div className="rounded-xl border border-white/[0.05] bg-[hsl(220,8%,6%)] p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Market peers</p>
                <ArrowRight className="h-3 w-3 text-zinc-600" />
              </div>
              {similar.length > 0 ? (
                <div className="space-y-1.5">
                  {similar.map((s) => (
                    <Link key={s.id} to={`/listing/${s.id}`} className="group flex items-center justify-between rounded-lg border border-white/[0.04] bg-[hsl(220,8%,5%)] px-3 py-2.5 no-underline transition-colors hover:border-white/[0.08]">
                      <div className="min-w-0">
                        <p className="text-[10px] text-zinc-500">{s.make} {s.model} · {s.year}</p>
                        <p className="num mt-0.5 text-[13px] font-bold text-foreground group-hover:text-amber-400">{formatPrice(s.price_lkr)}</p>
                      </div>
                      {typeof s.deal_score === 'number' && s.deal_score > 0 && <span className="num text-[10px] font-bold text-emerald-400">{s.deal_score}%</span>}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center"><CarIcon className="mx-auto mb-2 h-5 w-5 text-zinc-600" /><p className="text-[10px] text-zinc-600">No active peers</p></div>
              )}
            </div>

            {/* Insight */}
            <div className="rounded-xl border border-white/[0.05] bg-[hsl(220,8%,6%)] p-5">
              <Zap className="mb-2 h-4 w-4 text-amber-400/60" />
              <p className="text-[12px] font-semibold text-foreground">AutoLens Insight</p>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                Tracked for <span className="font-semibold text-zinc-300">{trackedLabel}</span>.
                {avgPeerDays && ` Peers avg ${avgPeerDays}d.`}
                {similar.length > 0 && ` ${similar.length} comparable listings active.`}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
