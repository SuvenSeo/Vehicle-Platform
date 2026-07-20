import { cn } from "@/lib/utils";

type AmbientBackgroundProps = {
  variant?: "default" | "hero" | "subtle";
  className?: string;
};

export function AmbientBackground({ variant = "default", className }: AmbientBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "ambient-layer pointer-events-none absolute inset-0 overflow-hidden",
        variant === "hero" && "ambient-layer--hero",
        variant === "subtle" && "ambient-layer--subtle",
        className,
      )}
    >
      <div className="ambient-orb ambient-orb--gold" />
      <div className="ambient-orb ambient-orb--cyan" />
      <div className="ambient-noise" />
    </div>
  );
}
