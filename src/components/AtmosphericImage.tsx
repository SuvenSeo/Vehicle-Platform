import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type AtmosphericImageProps = {
  src: string;
  /** Optional mobile / narrow src (served via srcSet). */
  srcSm?: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  /** LCP / above-the-fold hero: high priority, eager. Default lazy. */
  priority?: boolean;
  sizes?: string;
};

/**
 * Full-bleed atmosphere photo with responsive srcSet + decode hints.
 */
export function AtmosphericImage({
  src,
  srcSm,
  alt = "",
  className,
  style,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 1600px",
}: AtmosphericImageProps) {
  const srcSet = srcSm ? `${srcSm} 960w, ${src} 1920w` : undefined;

  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      className={cn(className)}
      style={style}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      {...{ fetchpriority: priority ? "high" : "low" }}
      draggable={false}
    />
  );
}
