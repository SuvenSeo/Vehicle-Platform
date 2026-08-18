import { ExternalLink, MapPin } from "lucide-react";
import { useAppPreferences } from "@/lib/appPreferences";
import type { EnrichmentEnvelope } from "@/services/api";

type GeoData = {
  lat?: number | null;
  lng?: number | null;
  formatted?: string | null;
  result_type?: string | null;
};

interface ListingGeoCardProps {
  geo?: EnrichmentEnvelope<GeoData> | null;
  isLoading?: boolean;
}

function osmUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}

export function ListingGeoCard({ geo, isLoading = false }: ListingGeoCardProps) {
  const { t } = useAppPreferences();
  const data = geo?.available ? geo.data : null;
  const lat = data?.lat != null ? Number(data.lat) : null;
  const lng = data?.lng != null ? Number(data.lng) : null;
  const hasPin = geo?.available === true && Number.isFinite(lat) && Number.isFinite(lng);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="h-4 w-32 animate-pulse rounded bg-surface" />
        <div className="mt-3 h-12 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }

  if (!hasPin) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-2 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {t("geo.title", "Ad location")}
          </h2>
        </div>
        <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">
          {t("geo.notAvailable", "Precise map pin not available.")}{" "}
          {geo?.limitation || t("geo.limitation", "Geocoded from the ad location text, not a GPS pin of the vehicle.")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-2 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {t("geo.title", "Ad location")}
        </h2>
      </div>
      <p className="text-[13px] font-semibold text-foreground">
        {data?.formatted || t("geo.unnamed", "Geocoded location")}
      </p>
      {data?.result_type ? (
        <p className="mt-1 text-[11px] font-medium capitalize text-muted-foreground">{data.result_type}</p>
      ) : null}
      <p className="mt-3 text-[11px] font-medium leading-relaxed text-muted-foreground">{geo.limitation}</p>
      <a
        href={osmUrl(lat as number, lng as number)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-primary no-underline hover:underline"
      >
        {t("geo.openMap", "Open in OpenStreetMap")}
        <ExternalLink className="h-3 w-3" aria-hidden />
      </a>
    </div>
  );
}
