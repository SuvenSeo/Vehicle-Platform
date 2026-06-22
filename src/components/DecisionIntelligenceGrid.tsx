import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Calculator, Gauge, MapPinned, ShieldCheck } from "lucide-react";
import { RevealSection } from "@/components/RevealSection";

const toolCards = [
  {
    title: "Valuation",
    description: "Estimate fair value for any make and model.",
    Icon: Gauge,
    to: "/estimate",
  },
  {
    title: "District map",
    description: "Compare listing density and median prices by area.",
    Icon: MapPinned,
    to: "/map",
  },
  {
    title: "Trends",
    description: "Track median price movement for any vehicle lane.",
    Icon: BarChart3,
    href: "#trends",
  },
  {
    title: "Calculator",
    description: "Import duty, tax breakdown, and cost estimation.",
    Icon: Calculator,
    to: "/calculator",
  },
  {
    title: "Pro workspace",
    description: "Deep lane drill-downs, district profiles, and export.",
    Icon: ShieldCheck,
    to: "/pro-preview",
  },
];

export function DecisionIntelligenceGrid() {
  return (
    <RevealSection id="decision-intelligence" className="layout-shell order-2 scroll-mt-28 py-10 lg:py-14">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {toolCards.map(({ title, description, Icon, to, href }) => {
          const inner = (
            <div className="group/card flex h-full flex-col rounded-xl border border-white/[0.05] bg-[hsl(220,8%,6%)] p-4 transition-all duration-300 hover:border-white/[0.08] hover:bg-[hsl(220,8%,7%)]">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <Icon className="h-3.5 w-3.5 text-amber-400/70" aria-hidden="true" />
                </div>
                <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
              </div>
              <p className="mt-3 flex-1 text-[12px] leading-relaxed text-zinc-500">{description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500 transition-colors group-hover/card:text-amber-300">
                Open
                <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover/card:translate-x-0.5" aria-hidden="true" />
              </span>
            </div>
          );

          return to ? (
            <Link key={title} to={to} className="block h-full no-underline">
              {inner}
            </Link>
          ) : (
            <a key={title} href={href} className="block h-full no-underline">
              {inner}
            </a>
          );
        })}
      </div>
    </RevealSection>
  );
}
