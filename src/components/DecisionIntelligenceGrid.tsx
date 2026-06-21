import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Gauge, MapPinned, ShieldCheck } from "lucide-react";
import { RevealSection } from "@/components/RevealSection";
import { SectionHeader } from "@/components/SectionHeader";
import { Surface } from "@/components/Surface";

const toolCards = [
  {
    title: "Fair price studio",
    description: "Estimate fair value for a make and model.",
    label: "Valuation",
    Icon: Gauge,
    to: "/estimate",
  },
  {
    title: "District map",
    description: "Compare listing density and median prices by area.",
    label: "Geo",
    Icon: MapPinned,
    href: "#map",
  },
  {
    title: "Trend console",
    description: "Track median movement for a vehicle lane over time.",
    label: "Trends",
    Icon: BarChart3,
    href: "#trends",
  },
  {
    title: "Pro workspace",
    description: "Deeper lane drill-downs, district profiles, and export packs.",
    label: "Pro",
    Icon: ShieldCheck,
    to: "/pro-preview",
  },
];

export function DecisionIntelligenceGrid() {
  return (
    <RevealSection id="decision-intelligence" className="layout-shell order-2 scroll-mt-28 py-12 lg:py-16">
      <SectionHeader
        eyebrow="Tools"
        title="Market workspace"
        description="Search above, then open a focused workflow below."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {toolCards.map(({ title, description, label, Icon, to, href }) => {
          const inner = (
            <Surface interactive className="h-full p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/30 text-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="tech-label rounded-md border border-border bg-background/50 px-2 py-1 text-muted-foreground">
                  {label}
                </span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-foreground/75 transition-colors group-hover:text-primary">
                Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Surface>
          );

          return to ? (
            <Link key={title} to={to} className="group block h-full no-underline">
              {inner}
            </Link>
          ) : (
            <a key={title} href={href} className="group block h-full no-underline">
              {inner}
            </a>
          );
        })}
      </div>
    </RevealSection>
  );
}
