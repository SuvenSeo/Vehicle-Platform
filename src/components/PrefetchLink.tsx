import { Link, type LinkProps } from "react-router-dom";
import { prefetchRoute } from "@/lib/routePrefetch";

function hrefFromTo(to: LinkProps["to"]): string {
  if (typeof to === "string") return to;
  if (typeof to === "number") return "";
  return `${to.pathname || "/"}${to.search || ""}${to.hash || ""}`;
}

/** Router link that warms the destination chunk on hover/focus. */
export function PrefetchLink({ onPointerEnter, onFocus, to, ...props }: LinkProps) {
  const href = hrefFromTo(to);
  return (
    <Link
      to={to}
      onPointerEnter={(event) => {
        prefetchRoute(href);
        onPointerEnter?.(event);
      }}
      onFocus={(event) => {
        prefetchRoute(href);
        onFocus?.(event);
      }}
      {...props}
    />
  );
}
