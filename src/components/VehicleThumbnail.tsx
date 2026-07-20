import { memo, useEffect, useMemo, useState } from "react";
import { Car } from "lucide-react";
import { getListingThumbnailProxyUrl } from "@/services/api";

interface VehicleThumbnailProps {
  src?: string | null;
  listingId?: number;
  alt: string;
  className?: string;
  placeholderClassName?: string;
}

function createFallbackThumbnailDataUri(label: string): string {
  const safeLabel = String(label || "Vehicle").trim().slice(0, 28) || "Vehicle";
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="960" height="540" fill="url(#g)"/>
  <g opacity="0.9" fill="none" stroke="#e9b652" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">
    <path d="M220 330h70l65-95h250l75 95h50"/>
    <circle cx="320" cy="355" r="42"/>
    <circle cx="640" cy="355" r="42"/>
  </g>
  <text x="480" y="475" fill="#9ca3af" font-family="Inter,Arial,sans-serif" font-size="30" text-anchor="middle">${safeLabel}</text>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const VehicleThumbnail = memo(function VehicleThumbnail({
  src,
  listingId,
  alt,
  className,
  placeholderClassName,
}: VehicleThumbnailProps) {
  const fallbackSrc = useMemo(() => createFallbackThumbnailDataUri(alt), [alt]);
  const proxyUrl = useMemo(() => {
    if (!src || !Number.isFinite(listingId)) return null;
    return getListingThumbnailProxyUrl(Number(listingId));
  }, [src, listingId]);

  const [imageSrc, setImageSrc] = useState<string>(src || proxyUrl || fallbackSrc);
  const [triedProxy, setTriedProxy] = useState(!src || !proxyUrl);

  useEffect(() => {
    setImageSrc(src || proxyUrl || fallbackSrc);
    setTriedProxy(!src || !proxyUrl);
  }, [src, proxyUrl, fallbackSrc]);

  const handleError = () => {
    if (!triedProxy && proxyUrl && imageSrc !== proxyUrl) {
      setImageSrc(proxyUrl);
      setTriedProxy(true);
      return;
    }
    setImageSrc(fallbackSrc);
  };

  return (
    <>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={alt}
          width={480}
          height={270}
          className={className}
          loading="lazy"
          decoding="async"
          onError={handleError}
        />
      ) : (
        <div className={placeholderClassName || "w-full h-full flex items-center justify-center bg-secondary/40"}>
          <Car className="w-8 h-8 text-foreground" />
        </div>
      )}
    </>
  );
});

VehicleThumbnail.displayName = "VehicleThumbnail";
