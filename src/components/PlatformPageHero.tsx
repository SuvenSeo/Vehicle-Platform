import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AmbientBackground } from "@/components/AmbientBackground";
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

      <div className="layout-shell relative z-10 py-12 sm:py-16 md:py-20">
        {/* Eyebrow */}
        <div className="animate-fade-up mb-5 inline-flex items-center gap-2.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5">
          {Icon ? <Icon className="h-3.5 w-3.5 text-amber-400/80" /> : null}
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{eyebrow}</span>
        </div>

        <div
          className={cn(
            "grid gap-10 lg:items-start",
            hasSidePanel ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,380px)]" : "max-w-3xl",
          )}
        >
          {/* Main content */}
          <div className="space-y-6 animate-fade-up" style={{ animationDelay: "40ms" }}>
            <h1 className="font-display max-w-3xl text-[2rem] font-semibold leading-[1.04] tracking-tight text-foreground sm:text-[2.5rem] lg:text-[3rem]">
              {title}
            </h1>
            {description ? (
              <p className="max-w-xl text-[15px] leading-relaxed text-zinc-500 sm:text-base">
                {description}
              </p>
            ) : null}
            {children ? <div className="space-y-4 pt-1">{children}</div> : null}
          </div>

          {/* Side panel */}
          {aside ? (
            <div className="animate-fade-up lg:sticky lg:top-24 lg:self-start" style={{ animationDelay: "100ms" }}>
              {aside}
            </div>
          ) : null}

          {!aside && (metrics.length > 0 || actions) ? (
            <Surface
              variant="glass"
              className="animate-fade-up space-y-4 p-4 lg:sticky lg:top-24 lg:self-start"
              style={{ animationDelay: "100ms" }}
            >
              {metrics.length > 0 ? (
                <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  {metrics.map((metric) => (
                    <div key={metric.label} className="platform-metric-tile px-3 py-3">
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{metric.label}</dt>
                      <dd className="mt-1.5 text-xl font-semibold tracking-tight text-foreground num">{metric.value}</dd>
                      {metric.detail ? <dd className="mt-1 text-[11px] text-zinc-500">{metric.detail}</dd> : null}
                    </div>
                  ))}
                </dl>
              ) : null}
              {actions ? <div>{actions}</div> : null}
            </Surface>
          ) : null}
        </div>

        {footer ? (
          <div className="mt-12 flex justify-center animate-fade-up" style={{ animationDelay: "140ms" }}>
            {footer}
          </div>
        ) : null}
      </div>
    </section>
  );
}
