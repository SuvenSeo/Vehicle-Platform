import { Activity, ArrowUpRight, Database, ExternalLink, Gauge, MapPinned } from "lucide-react";
import { Link } from "react-router-dom";

const platformLinks = [
  { label: "Overview", to: "/#overview" },
  { label: "Market", to: "/#market" },
  { label: "Trends", to: "/trends" },
  { label: "Valuation", to: "/estimate" },
];

const workspaceLinks = [
  { label: "Calculator", to: "/calculator" },
  { label: "EV Hub", to: "/ev-hub" },
  { label: "Best Picks", to: "/best-picks" },
  { label: "District Map", to: "/map" },
];

const proLinks = [
  { label: "Dealer", to: "/dealer" },
  { label: "Pro Preview", to: "/pro-preview" },
  { label: "Settings", to: "/settings" },
  { label: "Journal", to: "/blogs" },
];

const externalLinks = [
  { label: "Ardeno Studio", href: "https://ardeno-studio-website.vercel.app/" },
  { label: "GitHub", href: "https://github.com/SuvenSeo/Vehicle-Platform" },
];

const imageCredits = [
  {
    label: "Dan Koehl",
    href: "https://commons.wikimedia.org/wiki/File:DKoehl_colombo_auto_rickshaw.JPG",
  },
  {
    label: "Vincent van Zeijst",
    href: "https://commons.wikimedia.org/wiki/File:Sri_Lanka,_Kurunegala,_traffic_jam_(1).jpg",
  },
  {
    label: "Indi Samarajiva",
    href: "https://commons.wikimedia.org/wiki/File:Trishaw_And_Jeep_On_A9.jpg",
  },
];

const opsLanes = [
  { label: "Source coverage", value: "11 feeds", detail: "Listings and import signals", icon: Database },
  { label: "Market scope", value: "25 districts", detail: "Sri Lanka coverage", icon: MapPinned },
  { label: "Decision stack", value: "Live tools", detail: "Search, valuation, trends", icon: Gauge },
];

function FooterColumn({ title, links }: { title: string; links: Array<{ label: string; to: string }> }) {
  return (
    <div>
      <p className="tech-label tracking-[0.16em] text-zinc-600">{title}</p>
      <div className="mt-4 grid gap-3">
        {links.map((link) => (
          <Link
            key={link.label}
            to={link.to}
            className="group inline-flex w-fit items-center gap-2 text-sm font-semibold text-zinc-400 no-underline transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
          >
            <span>{link.label}</span>
            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer-lanka relative z-10 border-t border-border bg-background/80 backdrop-blur-md" aria-labelledby="platform-footer-title">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" />
      <div className="layout-shell py-10 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div className="max-w-xl">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl border border-white/[0.1] bg-white/[0.035] shadow-[0_0_40px_rgba(216,155,53,0.12)]">
                <img
                  src="/logo.svg"
                  alt="AutoLens LK logo"
                  className="h-8 w-8 object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div>
                <h2 id="platform-footer-title" className="headline-display text-xl">
                  AutoLens <span className="font-medium text-zinc-500">LK</span>
                </h2>
                <p className="tech-label mt-1 tracking-[0.16em] text-zinc-600">
                  By Ardeno Studio
                </p>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-zinc-500">
              Live listings, pricing, and decision tools for Sri Lanka.
            </p>

            <div className="tech-label mt-6 inline-flex items-center gap-2 rounded-lg border border-amber-300/18 bg-amber-400/8 px-3 py-2 text-amber-200">
              <Activity className="h-3.5 w-3.5" />
              Market operations online
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {opsLanes.map((lane) => {
              const Icon = lane.icon;
              return (
                <div key={lane.label} className="data-card motion-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="tech-label">{lane.label}</p>
                    <Icon className="h-4 w-4 text-amber-300" />
                  </div>
                  <p className="mt-4 text-xl font-semibold text-white">{lane.value}</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">{lane.detail}</p>
                </div>
              );
            })}
          </div>
        </div>

        <nav aria-label="Footer navigation" className="mt-10 grid gap-8 border-t border-white/[0.06] pt-8 sm:grid-cols-2 lg:grid-cols-4">
          <FooterColumn title="Platform" links={platformLinks} />
          <FooterColumn title="Tools" links={workspaceLinks} />
          <FooterColumn title="Pro" links={proLinks} />

          <div>
            <p className="tech-label tracking-[0.16em] text-zinc-600">Studio</p>
            <div className="mt-4 grid gap-3">
              {externalLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex w-fit items-center gap-2 text-sm font-semibold text-zinc-400 no-underline transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                >
                  {link.label === "GitHub" && <ExternalLink className="h-3.5 w-3.5" />}
                  <span>{link.label}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              ))}
            </div>
          </div>
        </nav>

        <div className="tech-label mt-10 flex flex-col gap-4 border-t border-white/[0.06] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {year} Ardeno Studio. All rights reserved.</p>
          <p className="normal-case tracking-normal text-zinc-700">
            Sri Lanka vehicle imagery:{" "}
            {imageCredits.map((credit, index) => (
              <span key={credit.label}>
                <a
                  href={credit.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-600 underline-offset-2 transition-colors hover:text-zinc-300 hover:underline"
                >
                  {credit.label}
                </a>
                {index < imageCredits.length - 1 ? ", " : ""}
              </span>
            ))}
          </p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="w-fit text-zinc-500 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
          >
            Back to top
          </button>
        </div>
      </div>
    </footer>
  );
}
