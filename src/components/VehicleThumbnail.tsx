import { memo, useEffect, useMemo, useState } from "react";
import { Car } from "lucide-react";
import { getListingThumbnailProxyUrl } from "@/services/api";

interface VehicleThumbnailProps {
  src?: string | null;
  listingId?: number;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  /** First-screen images should load eagerly to protect LCP. */
  priority?: boolean;
  sizes?: string;
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createFallbackThumbnailDataUri(label: string): string {
  const safeLabel = escapeSvgText(String(label || "Vehicle").trim().slice(0, 28) || "Vehicle");
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="asphalt" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a1612"/>
      <stop offset="1" stop-color="#0c0a08"/>
    </linearGradient>
    <radialGradient id="lamp" cx="62%" cy="38%" r="55%">
      <stop offset="0" stop-color="#0A7AFF" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#0A7AFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="960" height="540" fill="url(#asphalt)"/>
  <rect width="960" height="540" fill="url(#lamp)"/>
  <g fill="none" stroke="#f4ece0" stroke-opacity="0.28" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
    <path d="M228 328h62l58-88h248l68 88h58"/>
    <circle cx="328" cy="352" r="36"/>
    <circle cx="632" cy="352" r="36"/>
  </g>
  <text x="480" y="468" fill="#f4ece0" fill-opacity="0.42" font-family="Georgia,serif" font-size="26" text-anchor="middle">${safeLabel}</text>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const VehicleThumbnail = memo(function VehicleThumbnail({
  src,
  listingId,
  alt,
  className,
  placeholderClassName,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 33vw",
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
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          sizes={sizes}
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
