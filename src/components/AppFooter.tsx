import { ArrowUpRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

const platformLinks = [
  { label: "Overview", to: "/#overview" },
  { label: "Market", to: "/#market" },
  { label: "Trends", to: "/trends" },
  { label: "Valuation", to: "/estimate" },
];

const toolLinks = [
  { label: "Calculator", to: "/calculator" },
  { label: "EV Hub", to: "/ev-hub" },
  { label: "Best Picks", to: "/best-picks" },
  { label: "District Map", to: "/map" },
];

const moreLinks = [
  { label: "Dealer", to: "/dealer" },
  { label: "Pro Preview", to: "/pro-preview" },
  { label: "Settings", to: "/settings" },
  { label: "Journal", to: "/blogs" },
];

const externalLinks = [
  { label: "Ardeno Studio", href: "https://ardeno-studio-website.vercel.app/" },
  { label: "GitHub", href: "https://github.com/SuvenSeo/Vehicle-Platform" },
];

function FooterColumn({ title, links }: { title: string; links: Array<{ label: string; to: string }> }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <div className="mt-4 grid gap-2.5">
        {links.map((link) => (
          <Link
            key={link.label}
            to={link.to}
            className="group inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted-foreground no-underline transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <span>{link.label}</span>
            <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 border-t border-border bg-background" aria-labelledby="platform-footer-title">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="layout-shell py-12 md:py-16">
        {/* Brand + tagline */}
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg border border-border bg-foreground/[0.03]">
            <img src="/logo.svg" alt="AutoLens LK logo" className="h-7 w-7 object-contain" loading="lazy" decoding="async" />
          </div>
          <div>
            <h2 id="platform-footer-title" className="font-display text-lg font-semibold tracking-tight text-foreground">
              AutoLens<span className="ml-1 font-normal text-muted-foreground">LK</span>
            </h2>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Vehicle Intelligence for Sri Lanka
            </p>
          </div>
        </div>

        {/* Nav columns */}
        <nav aria-label="Footer navigation" className="mt-10 grid gap-8 border-t border-border pt-8 sm:grid-cols-2 lg:grid-cols-4">
          <FooterColumn title="Platform" links={platformLinks} />
          <FooterColumn title="Tools" links={toolLinks} />
          <FooterColumn title="More" links={moreLinks} />

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Studio</p>
            <div className="mt-4 grid gap-2.5">
              {externalLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted-foreground no-underline transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  {link.label === "GitHub" && <ExternalLink className="h-3 w-3" />}
                  <span>{link.label}</span>
                  <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
                </a>
              ))}
            </div>
          </div>
        </nav>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {year} Ardeno Studio</p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="w-fit text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            Back to top
          </button>
        </div>
      </div>
    </footer>
  );
}
