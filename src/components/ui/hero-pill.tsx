import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function HeroPill({
  children,
  icon,
  className,
}: {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "hero-pill inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-foreground/90 backdrop-blur-md",
        className,
      )}
    >
      {icon && (
        <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/10 text-primary">{icon}</span>
      )}
      {children}
    </span>
  );
}
