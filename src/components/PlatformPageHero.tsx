import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AmbientBackground } from "@/components/AmbientBackground";
import { HeroPill } from "@/components/ui/hero-pill";
import { Surface } from "@/components/Surface";

type PlatformMetric = {
  label: string;
  value: string;
  detail?: string;
};

type PlatformPageHeroProps = {
  eyebrow: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  metrics?: PlatformMetric[];
  actions?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function PlatformPageHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  metrics = [],
  actions,
  aside,
  footer,
  children,
  className,
}: PlatformPageHeroProps) {
  const hasSidePanel = Boolean(aside || metrics.length > 0 || actions);

  return (
    <section className={cn("platform-hero auto-page-hero", className)}>
      <AmbientBackground variant="hero" />

      <div className="layout-shell relative z-10 py-10 sm:py-12 md:py-14">
        <HeroPill
          icon={Icon ? <Icon className="h-3.5 w-3.5" /> : undefined}
          className="platform-hero-pill mb-4 animate-fade-up"
        >
          {eyebrow}
        </HeroPill>

        <div
          className={cn(
            "grid gap-8 lg:items-start",
            hasSidePanel ? "lg:grid-cols-[minmax(0,1.12fr)_minmax(280px,380px)]" : "max-w-3xl",
          )}
        >
          <div className="space-y-5 animate-fade-up" style={{ animationDelay: "50ms" }}>
            <h1 className="headline-display max-w-3xl text-[2rem] leading-[1.08] text-balance sm:text-[2.35rem] lg:text-[2.75rem]">
              {title}
            </h1>
            {description ? <p className="text-lead max-w-xl">{description}</p> : null}
            {children ? <div className="space-y-4 pt-1">{children}</div> : null}
          </div>

          {aside ? (
            <div className="animate-fade-up lg:sticky lg:top-24 lg:self-start" style={{ animationDelay: "110ms" }}>
              {aside}
            </div>
          ) : null}

          {!aside && (metrics.length > 0 || actions) ? (
            <Surface
              variant="glass"
              className="animate-fade-up space-y-4 p-4 lg:sticky lg:top-24 lg:self-start"
              style={{ animationDelay: "110ms" }}
            >
              {metrics.length > 0 ? (
                <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  {metrics.map((metric) => (
                    <div key={metric.label} className="platform-metric-tile px-3 py-3">
                      <dt className="tech-label">{metric.label}</dt>
                      <dd className="mt-1 text-xl font-semibold tracking-tight text-foreground num">{metric.value}</dd>
                      {metric.detail ? <dd className="mt-1 text-xs text-muted-foreground">{metric.detail}</dd> : null}
                    </div>
                  ))}
                </dl>
              ) : null}
              {actions ? <div>{actions}</div> : null}
            </Surface>
          ) : null}
        </div>

        {footer ? (
          <div className="mt-10 flex justify-center animate-fade-up" style={{ animationDelay: "160ms" }}>
            {footer}
          </div>
        ) : null}
      </div>
    </section>
  );
}
