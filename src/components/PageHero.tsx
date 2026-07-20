import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { revealItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type PageTheme =
  | "default"
  | "trends"
  | "valuation"
  | "ev"
  | "deals"
  | "calculator"
  | "official"
  | "dealer"
  | "alerts"
  | "docs"
  | "settings";

export type PageHighlight = {
  label: string;
  value: string;
  hint?: string;
};

type PageHeroProps = {
  eyebrow: string;
  eyebrowIcon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  theme?: PageTheme;
  watermarkIcon?: LucideIcon;
  highlights?: PageHighlight[];
  actions?: React.ReactNode;
  children?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
};

function HighlightChip({
  label,
  value,
  hint,
  tilt,
}: PageHighlight & { tilt: string }) {
  return (
    <div className={cn("page-hero__highlight", `page-hero__highlight--${tilt}`)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-[22px] font-semibold leading-none tracking-tight text-foreground num">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function PageHero({
  eyebrow,
  eyebrowIcon: EyebrowIcon,
  title,
  description,
  theme = "default",
  watermarkIcon: WatermarkIcon,
  highlights,
  actions,
  children,
  align = "left",
  className,
}: PageHeroProps) {
  const centered = align === "center";

  return (
    <motion.section
      variants={revealItem}
      className={cn("page-hero platform-hero", `page-hero--${theme}`, className)}
    >
      <div className="page-hero__atmosphere" aria-hidden>
        <div className="page-hero__grid" />
        <div className="page-hero__orb page-hero__orb--a" />
        <div className="page-hero__orb page-hero__orb--b" />
        {WatermarkIcon ? (
          <div className="page-hero__watermark">
            <WatermarkIcon strokeWidth={1.2} />
          </div>
        ) : null}
      </div>

      <div className={cn("layout-shell page-hero__inner", centered && "page-hero__inner--center")}>
        <div className={cn("page-hero__copy", centered && "mx-auto text-center")}>
          <p className="page-hero__eyebrow">
            <span className="page-hero__eyebrow-pill">
              <span aria-hidden className="page-hero__eyebrow-dot" />
              {EyebrowIcon ? <EyebrowIcon className="h-3.5 w-3.5" aria-hidden /> : null}
              {eyebrow}
            </span>
          </p>

          <h1 className={cn("display-hero mt-5 text-foreground", centered ? "mx-auto max-w-4xl" : "max-w-3xl")}>
            {title}
          </h1>

          {description ? (
            <p className={cn("text-body-lg mt-5", centered ? "mx-auto max-w-2xl" : "max-w-xl")}>{description}</p>
          ) : null}

          {actions ? (
            <div className={cn("mt-8 flex flex-wrap gap-3", centered && "justify-center")}>{actions}</div>
          ) : null}

          {children}
        </div>

        {highlights?.length ? (
          <div className="page-hero__highlights" aria-hidden={false}>
            {highlights.map((item, index) => (
              <HighlightChip
                key={item.label}
                {...item}
                tilt={["a", "b", "c"][index % 3]}
              />
            ))}
          </div>
        ) : null}
      </div>
    </motion.section>
  );
}
