import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, MapPin, Calendar,
  Share2, Fuel, Gauge, Settings2, Info, MessageCircle,
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
import { CashToOwnStrip } from '@/components/CashToOwnStrip';
import { inferFinanceClass } from '@/lib/cashToOwn';

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

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };
  const buildShareText = () => {
    if (!listing) return document.title;
    const name = [listing.year, listing.make, listing.model].filter(Boolean).join(' ');
    const price = Number(listing.price_lkr || 0);
    const priceText = Number.isFinite(price) && price >= 100_000 ? ` — ${formatPrice(price)}` : '';
    return `${name}${priceText} on AutoLens LK`;
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
    setLoading(true); setSellerProfile(null);
    Promise.all([getListing(id).catch(() => null), getSimilarListings(id).catch(() => []), getSellerTrustProfile(id).catch(() => null)])
      .then(([detail, sim, profile]) => {
        setListing(detail); setSimilar(sim); setSellerProfile(profile); setLoading(false);
        if (detail) document.title = `${detail.title} — AutoLens LK`;
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
          <button type="button" onClick={() => navigate('/')} className="mt-5 rounded-lg bg-[var(--gold)] px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white hover:bg-[var(--gold-bright)]">Return to inventory</button>
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
  const dealTone = dealScore >= 5 ? 'text-emerald-400' : dealScore <= -6 ? 'text-rose-400' : 'text-primary';
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
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 sm:py-10">
          <button type="button" onClick={handleBack} className="group mb-5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" /> Back
          </button>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]/70">Inspection · {listing.source}</p>
          <h1 className="mt-2 font-display text-[2rem] font-bold tracking-[-0.035em] leading-[1.02] text-foreground sm:text-[2.75rem] lg:text-[3rem]">
            {listing.make} {listing.model}{listing.year ? ` · ${listing.year}` : ''}
          </h1>
          {listing.title && listing.title !== `${listing.make} ${listing.model}` && (
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{listing.title}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {listingUrl !== '#' && (
              <a href={listingUrl} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--gold)] px-4 text-[10px] font-bold uppercase tracking-[0.08em] text-white no-underline hover:bg-[var(--gold-bright)]">
                View on {listing.source} <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button type="button" onClick={handleWhatsAppShare} className="flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-emerald-600 transition-colors hover:bg-emerald-500/15 dark:text-emerald-400">
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </button>
            <button type="button" onClick={handleShare} className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[10px] font-semibold text-muted-foreground hover:text-foreground">
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
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="relative aspect-[16/10] min-h-[220px] bg-black/30">
                {heroImage ? (
                  <VehicleThumbnail src={heroImage} listingId={listing.id} alt={`${listing.make} ${listing.model}`} className="h-full w-full object-cover" placeholderClassName="flex h-full w-full items-center justify-center bg-black/30" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><CarIcon className="h-12 w-12 text-foreground" /></div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <span className="rounded-md bg-black/50 px-2 py-1 text-[10px] font-semibold text-foreground backdrop-blur-sm">{listing.make} {listing.model} · {listing.year || 'N/A'}</span>
                  <span className="flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[10px] font-semibold text-cyan-400 backdrop-blur-sm"><Database className="h-3 w-3" /> {listing.source}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 border-t border-border px-4 py-3">
                <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><MapPin className="h-3 w-3 text-muted-foreground" /> {listing.district || 'Unknown'}, Sri Lanka</span>
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Clock className="h-3 w-3" /> Tracked {trackedLabel}</span>
              </div>
            </div>

            {/* Specs */}
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Specifications</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {specs.map((s) => (
                  <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
                    <s.icon className="mb-2 h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    <p className="mt-1 text-[13px] font-bold text-foreground num">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Description</p>
              <p className="whitespace-pre-wrap text-[13px] leading-[1.8] text-muted-foreground">
                {listing.description || 'No description provided. Market intelligence indicates this vehicle is priced within the range of comparable models.'}
              </p>
            </div>

            {/* Finance */}
            {hasPrice && (
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Ownership planning</p>
                <div className="mb-3">
                  <CashToOwnStrip
                    priceLkr={listingPrice}
                    financeClass={inferFinanceClass({
                      condition: listing.condition,
                      fuelType: listing.fuel_type,
                      year: listing.year,
                    })}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <LeaseCalculator
                    price={listingPrice}
                    financeClass={inferFinanceClass({
                      condition: listing.condition,
                      fuelType: listing.fuel_type,
                      year: listing.year,
                    })}
                  />
                  <TaxBreakdown price={listingPrice} engineCapacity={typeof listing.engine_cc === 'number' ? listing.engine_cc : undefined} />
                </div>
              </div>
            )}
          </div>

          {/* ── SIDEBAR ───────────────────────────────────────── */}
          <aside className="space-y-4 lg:sticky lg:top-20">
            {/* Price */}
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Asking price</p>
              <p className="num mt-2 text-3xl font-bold tracking-tight text-foreground">{hasPrice ? formatPrice(listingPrice) : 'Unlisted'}</p>
              <div className="mt-4 flex items-center gap-3">
                <FairPriceIndicator score={dealScore} condition={listing.condition} size="lg" className="num" />
                <span className={`num text-[11px] font-bold ${dealTone}`}>{dealDelta}</span>
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary/60">
                  <div className="h-full w-full origin-left bg-gradient-to-r from-rose-500 via-primary to-emerald-500" style={{ transform: `scaleX(${Math.max(0.12, Math.min(0.95, (50 + dealScore) / 100))})` }} />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground"><span>Overpriced</span><span>Median</span><span>Below</span></div>
              </div>
              <div className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                <span>Median: <span className="num font-semibold text-foreground">{formatPrice(listing.market_median_lkr || (hasPrice ? listingPrice : null))}</span></span>
              </div>
            </div>

            {/* Seller */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Seller</p>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-foreground">{sellerHeadline}</p>
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{sellerName}</p>
                </div>
                <span className="shrink-0 rounded-md border border-primary/15 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary/80">{trustBadges[0] || 'Source'}</span>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">{trustMeta}</p>
              {ratingValue ? (
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <div className="flex gap-0.5 text-primary">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <svg key={s} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={s <= ratingStars ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className={s > ratingStars ? 'text-foreground' : ''}>
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                  <span className="num text-[12px] font-bold text-foreground">{ratingValue.toFixed(1)}{reviewCount != null && <span className="text-muted-foreground"> ({reviewCount})</span>}</span>
                </div>
              ) : <p className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">No public rating.</p>}
              {(phonePreview.length > 0 || whatsappPreview.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {phonePreview.map((p) => <span key={p} className="num rounded-md border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground">{p}</span>)}
                  {whatsappPreview.map((p) => <span key={`wa-${p}`} className="num rounded-md border border-emerald-500/15 bg-emerald-500/5 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">WA {p}</span>)}
                </div>
              )}
            </div>

            {/* Peers */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Market peers</p>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </div>
              {similar.length > 0 ? (
                <div className="space-y-1.5">
                  {similar.map((s) => (
                    <Link key={s.id} to={`/listing/${s.id}`} className="group flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5 no-underline transition-colors hover:border-border">
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground">{s.make} {s.model} · {s.year}</p>
                        <p className="num mt-0.5 text-[13px] font-bold text-foreground group-hover:text-primary">{formatPrice(s.price_lkr)}</p>
                      </div>
                      {typeof s.deal_score === 'number' && s.deal_score > 0 && <span className="num text-[10px] font-bold text-emerald-400">{s.deal_score}%</span>}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center"><CarIcon className="mx-auto mb-2 h-5 w-5 text-muted-foreground" /><p className="text-[10px] text-muted-foreground">No active peers</p></div>
              )}
            </div>

            {/* Insight */}
            <div className="rounded-xl border border-border bg-card p-5">
              <Zap className="mb-2 h-4 w-4 text-primary/60" />
              <p className="text-[12px] font-semibold text-foreground">AutoLens Insight</p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Tracked for <span className="font-semibold text-foreground">{trackedLabel}</span>.
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
