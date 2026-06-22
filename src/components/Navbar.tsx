import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Activity, Crown, ExternalLink, LogOut, Menu, MoreHorizontal, UserCircle2, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { SignInPortalModal } from "@/components/SignInPortalModal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePipelineStatus } from "@/hooks/usePipelineStatus";
import { useAppPreferences } from "@/lib/appPreferences";
import { useAuth } from "@/lib/authContext";
import { formatRelativeTime } from "@/lib/formatting";

const GITHUB_REPO = "SuvenSeo/Vehicle-Platform";
const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

type NavSection = {
  label: string;
  href: string;
  id: string;
  isRoute?: boolean;
  activeOn?: string[];
};

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [stars, setStars] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState("overview");
  const { user, logout, isAuthenticated } = useAuth();
  const pipelineStatus = usePipelineStatus();
  const { t } = useAppPreferences();
  const { hash, pathname } = useLocation();
  const navigate = useNavigate();

  const sections = useMemo<NavSection[]>(
    () => [
      { label: t("nav.overview", "Overview"), href: "#overview", id: "overview" },
      { label: t("nav.market", "Market"), href: "#market", id: "market" },
      { label: t("nav.trends", "Trends"), href: "/trends", id: "trends", isRoute: true },
      { label: t("nav.valuation", "Valuation"), href: "/estimate", id: "estimate", isRoute: true },
      { label: "Map", href: "/map", id: "map", isRoute: true },
      { label: t("nav.blog", "Blog"), href: "/blogs", id: "blogs", isRoute: true },
    ],
    [t],
  );

  const moreSections = useMemo(
    () => [
      { label: "Calculator", href: "/calculator", detail: "Import duty & cost breakdown" },
      { label: "EV Hub", href: "/ev-hub", detail: "Battery and charging checks" },
      { label: "Best Picks", href: "/best-picks", detail: "Strict deal-score shortlist" },
      { label: "Dealer", href: "/dealer", detail: "Operator command center" },
      { label: "Settings", href: "/settings", detail: "Language and theme" },
      isAuthenticated
        ? { label: "Pro Dashboard", href: "/pro", detail: "Paid market terminal" }
        : { label: "Pro Preview", href: "/pro-preview", detail: "Locked analytics teaser" },
    ],
    [isAuthenticated],
  );

  useEffect(() => {
    const CACHE_KEY = "autolens_gh_stars";
    const cached = sessionStorage.getItem(CACHE_KEY);

    if (cached !== null) {
      setStars(Number(cached));
      return;
    }

    fetch(`https://api.github.com/repos/${GITHUB_REPO}`)
      .then((response) => response.json())
      .then((data) => {
        if (typeof data.stargazers_count === "number") {
          setStars(data.stargazers_count);
          sessionStorage.setItem(CACHE_KEY, String(data.stargazers_count));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (pathname === "/" && hash) {
      setActiveSection(hash.replace("#", ""));
    }
  }, [hash, pathname]);

  useEffect(() => {
    if (pathname !== "/") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target?.id) {
          const nextId = visible.target.id;
          setActiveSection((prev) => (prev === nextId ? prev : nextId));
        }
      },
      { root: null, threshold: [0.55], rootMargin: "-12% 0px -40% 0px" },
    );

    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [pathname, sections]);

  const latestSyncIso = useMemo(() => {
    if (!pipelineStatus?.jobs?.length) return null;
    return (
      pipelineStatus.jobs
        .map((job) => job.last_success || job.last_run)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null
    );
  }, [pipelineStatus]);

  const liveState = pipelineStatus?.overall_status ?? "running";
  const liveLabel =
    liveState === "ok"
      ? t("nav.live", "Live")
      : liveState === "delayed"
        ? t("nav.delayed", "Delayed")
        : t("nav.syncing", "Syncing");
  const liveFreshnessLabel = latestSyncIso
    ? formatRelativeTime(latestSyncIso)
    : t("nav.awaiting", "Awaiting sync");

  const statusDot =
    liveState === "ok"
      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
      : liveState === "delayed"
        ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
        : "bg-amber-300/70 shadow-[0_0_8px_rgba(252,211,77,0.3)] animate-pulse-soft";

  const isSectionActive = ({ id, href, activeOn, isRoute }: NavSection) =>
    isRoute
      ? pathname === href
      : pathname === "/" && [id, ...(activeOn ?? [])].includes(activeSection);

  const handleScroll = (e: MouseEvent<HTMLAnchorElement>, path: string, isRoute?: boolean) => {
    if (isRoute) {
      e.preventDefault();
      navigate(path);
      setMobileOpen(false);
      return;
    }

    if (!path.startsWith("#")) return;

    e.preventDefault();
    const targetId = path.replace("#", "");

    const scrollToTarget = () => {
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveSection(targetId);
      }
      setMobileOpen(false);
    };

    if (pathname === "/") {
      scrollToTarget();
    } else {
      navigate({ pathname: "/", hash: targetId });
      setActiveSection(targetId);
      setMobileOpen(false);
    }
  };

  const onHomeLinkClick = () => {
    setMobileOpen(false);
    setActiveSection("overview");
  };

  const openSignIn = () => {
    setSignInOpen(true);
    setMobileOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
    setMobileOpen(false);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-[1000] pointer-events-none">
      <div className="flex justify-center px-3 pt-3 sm:px-4">
        <nav
          className="nav-glass pointer-events-auto w-[min(1280px,calc(100vw-24px))] overflow-visible rounded-2xl"
          aria-label="Primary navigation"
        >
          <div className="relative flex min-h-[56px] items-center gap-2 px-2 py-1.5 sm:px-3">
            {/* ── Brand ─────────────────────────────────── */}
            <Link
              to="/"
              onClick={onHomeLinkClick}
              className="group flex shrink-0 items-center gap-2.5 rounded-xl px-2 py-1 no-underline outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-amber-400/60"
            >
              <div className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/[0.08] bg-black/50">
                <img src="/logo.svg" alt="AutoLens LK logo" className="h-6 w-6 object-contain" />
                <span className={`absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full ${statusDot}`} />
              </div>
              <div className="hidden min-[390px]:block leading-none">
                <p className="font-display text-[14px] font-semibold tracking-tight text-foreground leading-none">
                  AutoLens<span className="ml-1 font-normal text-zinc-600">LK</span>
                </p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">
                  Vehicle Intelligence
                </p>
              </div>
            </Link>

            {/* ── Desktop nav tabs ──────────────────────── */}
            <div className="hidden min-w-0 flex-1 justify-center lg:flex">
              <div className="inline-flex items-center gap-0.5 rounded-lg border border-white/[0.04] bg-white/[0.02] p-0.5">
                {sections.map((section) => {
                  const active = isSectionActive(section);
                  return (
                    <a
                      key={`${section.id}-${section.label}`}
                      href={section.href}
                      onClick={(event) => handleScroll(event, section.href, section.isRoute)}
                      aria-current={active ? "page" : undefined}
                      className={`relative rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] no-underline outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
                        active
                          ? "text-foreground"
                          : "text-zinc-500 hover:text-zinc-200"
                      }`}
                    >
                      {active && (
                        <span className="absolute inset-0 rounded-md border border-white/[0.08] bg-white/[0.06]" />
                      )}
                      <span className="relative z-10">{section.label}</span>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* ── Right actions ─────────────────────────── */}
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {/* More dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="hidden h-8 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 text-zinc-400 outline-none transition-colors hover:border-white/[0.1] hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-amber-400/60 md:inline-flex"
                    aria-label="More workspaces"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">More</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-60 rounded-xl border-white/[0.08] bg-[#0c0d0f]/96 p-1.5 text-zinc-100 shadow-xl backdrop-blur-2xl"
                >
                  <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                    Workspaces
                  </p>
                  <DropdownMenuSeparator className="bg-white/[0.06]" />
                  {moreSections.map((section) => (
                    <DropdownMenuItem
                      key={section.href}
                      onSelect={() => navigate(section.href)}
                      className="rounded-lg px-3 py-2 text-zinc-300 focus:bg-white/[0.04] focus:text-white"
                    >
                      <div>
                        <p className="text-[13px] font-semibold">{section.label}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-500">{section.detail}</p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Live status pill */}
              <div className="hidden items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5 xl:inline-flex">
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                <div className="leading-none">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-300">{liveLabel}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-600">{liveFreshnessLabel}</p>
                </div>
              </div>

              {/* Auth actions */}
              {isAuthenticated && user ? (
                <div className="hidden items-center gap-1 sm:flex">
                  <button
                    type="button"
                    onClick={() => navigate("/pro")}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-400/15 bg-amber-400/6 px-2.5 text-amber-100 outline-none transition-colors hover:bg-amber-400/10 focus-visible:ring-2 focus-visible:ring-amber-400/60"
                  >
                    <Crown className="h-3 w-3 text-amber-300" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">Pro</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] text-zinc-500 outline-none transition-colors hover:border-red-400/20 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-300/60"
                    aria-label="Sign out"
                  >
                    <LogOut className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={openSignIn}
                  className="hidden h-8 gap-1.5 rounded-lg border-white/[0.08] bg-transparent px-3 text-zinc-300 hover:border-white/[0.12] hover:text-white sm:inline-flex"
                >
                  <UserCircle2 className="h-3 w-3" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">{t("nav.signIn", "Sign In")}</span>
                </Button>
              )}

              {/* GitHub */}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open AutoLens LK repository"
                className="hidden h-8 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 text-zinc-400 no-underline outline-none transition-colors hover:border-white/[0.1] hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-amber-400/60 lg:inline-flex"
              >
                <ExternalLink className="h-3 w-3" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">Repo</span>
                {stars !== null && <span className="text-[10px] font-semibold text-zinc-600 num">{stars.toLocaleString()}</span>}
              </a>

              {/* Mobile toggle */}
              <button
                type="button"
                onClick={() => setMobileOpen((open) => !open)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] text-zinc-300 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400/60 lg:hidden"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </nav>
      </div>

      {/* ── Mobile menu ──────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="mx-auto mt-2 w-[min(92vw,500px)] pointer-events-auto px-3"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div className="rounded-xl border border-white/[0.06] bg-[#0c0d0f]/96 p-3 shadow-xl backdrop-blur-2xl">
            <div className="flex items-center justify-between gap-4 px-1 pb-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Platform</p>
                <p className="mt-0.5 text-[11px] font-semibold text-zinc-600">AutoLens LK</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-300">{liveLabel}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {[...sections, ...moreSections.map((section) => ({ ...section, id: section.href, isRoute: true }))].map((section) => {
                const active = section.isRoute ? pathname === section.href : isSectionActive(section);
                return (
                  <a
                    key={`${section.id}-${section.label}`}
                    href={section.href}
                    onClick={(event) => handleScroll(event, section.href, section.isRoute)}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-lg border px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.1em] no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
                      active
                        ? "border-amber-300/20 bg-amber-400/8 text-white"
                        : "border-white/[0.05] text-zinc-500 hover:border-white/[0.08] hover:text-zinc-200"
                    }`}
                  >
                    {section.label}
                  </a>
                );
              })}
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              {isAuthenticated && user ? (
                <>
                  <button
                    type="button"
                    onClick={() => { navigate("/pro"); setMobileOpen(false); }}
                    className="col-span-2 flex items-center justify-between rounded-lg border border-amber-300/15 bg-amber-400/6 px-3 py-2.5 text-amber-100 outline-none transition-colors hover:bg-amber-400/10 focus-visible:ring-2 focus-visible:ring-amber-400/60"
                  >
                    <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em]">
                      <Crown className="h-3 w-3 text-amber-300" />
                      Pro Dashboard
                    </span>
                    <span className="text-[10px] font-semibold text-amber-200/60">{user.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="col-span-2 flex items-center gap-2 rounded-lg border border-white/[0.05] px-3 py-2.5 text-zinc-500 outline-none transition-colors hover:border-red-400/15 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-300/60"
                  >
                    <LogOut className="h-3 w-3" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={openSignIn}
                  className="col-span-2 flex items-center justify-between rounded-lg border border-white/[0.06] px-3 py-2.5 text-zinc-300 outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-amber-400/60"
                >
                  <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em]">
                    <UserCircle2 className="h-3 w-3" />
                    {t("nav.signIn", "Sign In")}
                  </span>
                </button>
              )}
            </div>

            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-between rounded-lg border border-white/[0.05] px-3 py-2.5 text-zinc-400 no-underline outline-none transition-colors hover:border-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400/60"
            >
              <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em]">
                <ExternalLink className="h-3 w-3" />
                Repository
              </span>
              {stars !== null && <span className="text-[10px] font-semibold text-zinc-600 num">{stars.toLocaleString()}</span>}
            </a>
          </div>
        </div>
      )}

      <SignInPortalModal open={signInOpen} onOpenChange={setSignInOpen} />
    </header>
  );
}
