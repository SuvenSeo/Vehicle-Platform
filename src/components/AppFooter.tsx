import { prefersReducedMotion, scrollBehavior } from "@/lib/motion";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.777-1.333-1.777-1.09-.745.083-.729.083-.729 1.205.084 1.84 1.236 1.84 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

const platformLinks = [
  { label: "Home", to: "/" },
  { label: "Market", to: "/#market" },
  { label: "Trends", to: "/trends" },
  { label: "Calculator", to: "/calculator" },
];

const toolLinks = [
  { label: "EV Hub", to: "/ev-hub" },
  { label: "Valuation", to: "/estimate" },
  { label: "Pricing", to: "/pricing" },
  { label: "Docs", to: "/docs" },
];

const moreLinks = [
  { label: "Official Pulse", to: "/official-pulse" },
  { label: "Dealer", to: "/dealer" },
  { label: "Best Picks", to: "/best-picks" },
  { label: "Price Index", to: "/price-index" },
  { label: "Pro Preview", to: "/pro-preview" },
  { label: "Alerts", to: "/alerts" },
  { label: "Settings", to: "/settings" },
];

const studioLinks = [
  { label: "Ardeno Studio", href: "https://ardeno-studio-website.vercel.app/", external: true },
  { label: "GitHub", href: "https://github.com/SuvenSeo/Vehicle-Platform", external: true },
];

const socialLinks = [
  {
    label: "GitHub",
    href: "https://github.com/SuvenSeo/Vehicle-Platform",
    icon: GitHubIcon,
  },
  {
    label: "Ardeno Studio",
    href: "https://ardeno-studio-website.vercel.app/",
    icon: ExternalLink,
  },
];

function FooterColumn({ title, links }: { title: string; links: Array<{ label: string; to: string }> }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">{title}</p>
      <ul className="mt-6 space-y-4">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              to={link.to}
              className="group inline-flex items-center gap-1.5 text-[14px] leading-none text-zinc-400 no-underline transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
            >
              <span>{link.label}</span>
              <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity duration-200 group-hover:opacity-70" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AppFooter() {
  const year = new Date().getFullYear();
  const reduceMotion = useReducedMotion() ?? prefersReducedMotion();

  return (
    <footer
      className="app-footer relative z-10 overflow-hidden px-3 pb-20 pt-8 md:px-6 md:pb-6 md:pt-12"
      aria-labelledby="platform-footer-title"
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 28 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: EASE }}
        className="app-footer__panel relative mx-auto max-w-[1680px] overflow-hidden rounded-[30px] border border-white/[0.1] px-5 py-12 shadow-[0_-24px_90px_rgba(8,47,73,0.28)] sm:px-8 md:rounded-[42px] md:px-14 md:py-16 lg:px-20"
      >
        {/* Atmosphere — cyan / blue gradient field */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(10,122,255,0.22),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(34,211,238,0.16),transparent_50%),linear-gradient(160deg,#030914_0%,#04101f_42%,#02060d_100%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundSize: "128px",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[-14rem] top-[-16rem] h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.28),transparent_68%)] blur-[100px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[-18rem] left-[-10rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(10,122,255,0.26),transparent_70%)] blur-[110px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent"
        />

        <div className="relative z-10 grid gap-12 lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.45fr)] lg:gap-16">
          <div className="max-w-sm">
            <h2 id="platform-footer-title" className="sr-only">
              Motormila
            </h2>
            <Link
              to="/"
              className="group inline-flex items-center gap-3 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
              aria-label="Go to Motormila home"
            >
              <img
                src="/logo.png"
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-[22%] object-cover shadow-sm ring-1 ring-white/15"
                decoding="async"
              />
              <span className="flex flex-col leading-none">
                <span className="font-display text-[17px] font-extrabold italic tracking-[-0.045em] text-white">
                  Motor<span className="bg-gradient-to-r from-sky-300 via-cyan-300 to-teal-300 bg-clip-text text-transparent">mila</span>
                </span>
                <span className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-100/45">
                  Market Intelligence
                </span>
              </span>
            </Link>

            <p className="mt-6 text-[14px] leading-7 text-zinc-400">
              Sri Lanka vehicle market intelligence — live listings, fair-value signals, and tools built for buyers and dealers.
            </p>

            <motion.div whileHover={reduceMotion ? undefined : { y: -2 }} whileTap={reduceMotion ? undefined : { scale: 0.98 }}>
              <Link
                to="/pricing"
                className="mt-8 inline-flex items-center gap-2 rounded-[14px] bg-gradient-to-r from-sky-400 via-cyan-300 to-teal-300 px-6 py-4 text-[13px] font-semibold text-[#04101f] no-underline shadow-[0_10px_40px_rgba(34,211,238,0.25)] transition-[filter] duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70"
              >
                Explore Pro
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>

          <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
            <FooterColumn title="Platform" links={platformLinks} />
            <FooterColumn title="Tools" links={toolLinks} />
            <FooterColumn title="More" links={moreLinks} />

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">Studio</p>
              <ul className="mt-6 space-y-4">
                {studioLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-1.5 text-[14px] leading-none text-zinc-400 no-underline transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                    >
                      {link.label === "GitHub" && <GitHubIcon className="h-3.5 w-3.5" />}
                      <span>{link.label}</span>
                      <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity duration-200 group-hover:opacity-70" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>

        <div className="relative z-10 mt-16 flex flex-col gap-5 border-t border-white/[0.08] pt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-[12px] text-zinc-500">&copy; {year} Ardeno Studio. Built in Sri Lanka.</p>

          <div className="flex flex-wrap items-center gap-2.5">
            {socialLinks.map(({ icon: Icon, label, href }) => (
              <motion.a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-white/[0.1] bg-white/[0.04] text-zinc-400 transition-colors duration-200 hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                whileHover={
                  reduceMotion
                    ? undefined
                    : { y: -2, borderColor: "rgba(103,232,249,0.35)", backgroundColor: "rgba(34,211,238,0.12)" }
                }
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              >
                <Icon className="h-3.5 w-3.5" />
              </motion.a>
            ))}
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: scrollBehavior() })}
              className="ml-1 rounded-[11px] border border-white/[0.1] bg-white/[0.04] px-3.5 py-2 text-[12px] font-medium text-zinc-400 transition-colors duration-200 hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
            >
              Back to top
            </button>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="relative z-0 mt-10 flex select-none items-center justify-center gap-[clamp(0.9rem,2.4vw,2rem)] overflow-hidden border-t border-white/[0.06] pt-8 md:mt-12 md:pt-10"
        >
          <img
            src="/logo.png"
            alt=""
            width={190}
            height={190}
            className="h-[clamp(4.5rem,10vw,9.5rem)] w-auto opacity-60 grayscale contrast-125"
            loading="lazy"
            decoding="async"
          />
          <span className="app-footer__watermark whitespace-nowrap bg-gradient-to-b from-cyan-200/20 via-sky-300/10 to-transparent bg-clip-text font-display text-[clamp(3.4rem,11.5vw,12rem)] font-black uppercase leading-none tracking-[-0.03em] text-transparent">
            Motormila
          </span>
        </div>
      </motion.div>
    </footer>
  );
}
