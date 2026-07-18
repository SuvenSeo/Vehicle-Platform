import { scrollBehavior } from "@/lib/motion";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Crown, ExternalLink, LogOut, Menu, MoreHorizontal, UserCircle2, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
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
      { label: t("nav.home", "Home"), href: "/", id: "home", isRoute: true, activeOn: ["overview"] },
      { label: t("nav.market", "Market"), href: "#market", id: "market" },
      { label: t("nav.trends", "Trends"), href: "/trends", id: "trends", isRoute: true },
      { label: t("nav.valuation", "Valuation"), href: "/estimate", id: "estimate", isRoute: true },
      { label: "Pricing", href: "/pricing", id: "pricing", isRoute: true },
      { label: "Docs", href: "/docs", id: "docs", isRoute: true },
    ],
    [t],
  );

  const moreSections = useMemo(
    () => [
      { label: "Calculator", href: "/calculator", detail: "Import duty & cost breakdown" },
      { label: "EV Hub", href: "/ev-hub", detail: "Battery and charging checks" },
      { label: "Best Picks", href: "/best-picks", detail: "Strict deal-score shortlist" },
      { label: "Price Index", href: "/price-index", detail: "Mix-adjusted market index" },
      { label: "Official Pulse", href: "/official-pulse", detail: "DMT, Customs & import signals" },
      { label: "Dealer", href: "/dealer", detail: "Operator command center" },
      { label: "Map", href: "/map", detail: "District market geography" },
      { label: "Journal", href: "/blogs", detail: "Editorial market guides" },
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
      ? "bg-emerald-500"
      : liveState === "delayed"
        ? "bg-primary"
        : "bg-primary/70 animate-pulse-soft";

  const isSectionActive = ({ id, href, activeOn, isRoute }: NavSection) =>
    isRoute
      ? pathname === href
      : pathname === "/" && [id, ...(activeOn ?? [])].includes(activeSection);

  const handleScroll = (e: MouseEvent<HTMLAnchorElement>, path: string, isRoute?: boolean) => {
    if (isRoute) {
      e.preventDefault();
      if (path === "/" && pathname === "/") {
        window.scrollTo({ top: 0, behavior: scrollBehavior() });
        setActiveSection("overview");
        setMobileOpen(false);
        return;
      }
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
        element.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
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
              className="group flex shrink-0 items-center gap-2.5 rounded-xl px-2 py-1 no-underline outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <div className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface">
                <img src="/logo.svg" alt="MilaMark logo" className="h-6 w-6 object-contain" />
                <span className={`absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full ${statusDot}`} />
              </div>
              <div className="hidden min-[390px]:block leading-none">
                <p className="font-display text-[15px] font-semibold tracking-tight text-foreground leading-none">
                  MilaMark
                </p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Vehicle Intelligence
                </p>
              </div>
            </Link>

            {/* ── Desktop nav tabs ──────────────────────── */}
            <div className="hidden min-w-0 flex-1 justify-center lg:flex">
              <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-foreground/[0.03] p-1">
                {sections.map((section) => {
                  const active = isSectionActive(section);
                  return (
                    <a
                      key={`${section.id}-${section.label}`}
                      href={section.href}
                      onClick={(event) => handleScroll(event, section.href, section.isRoute)}
                      aria-current={active ? "page" : undefined}
                      data-active={active}
                      className={`relative rounded-full px-3.5 py-1.5 text-[12px] font-medium tracking-tight no-underline outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/50 ${
                        active
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {active && (
                        <span className="absolute inset-0 rounded-full bg-card shadow-soft" />
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
                    className="hidden h-8 items-center gap-1.5 rounded-full border border-border bg-foreground/[0.03] px-3 text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 md:inline-flex"
                    aria-label="More workspaces"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                    <span className="text-[12px] font-medium tracking-tight">More</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-60 rounded-2xl border-border bg-popover/95 p-1.5 text-foreground shadow-soft-lg backdrop-blur-2xl"
                >
                  <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Workspaces
                  </p>
                  <DropdownMenuSeparator className="bg-border" />
                  {moreSections.map((section) => (
                    <DropdownMenuItem
                      key={section.href}
                      onSelect={() => navigate(section.href)}
                      className="rounded-xl px-3 py-2 text-foreground/80 focus:bg-accent focus:text-foreground"
                    >
                      <div>
                        <p className="text-[13px] font-semibold">{section.label}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{section.detail}</p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Locale switcher */}
              <div className="hidden md:flex">
                <LocaleSwitcher compact />
              </div>

              {/* Live status pill */}
              <div className="hidden items-center gap-2 rounded-full border border-border bg-foreground/[0.03] px-3 py-1.5 xl:inline-flex">
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                <div className="leading-none">
                  <p className="text-[11px] font-medium tracking-tight text-foreground">{liveLabel}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{liveFreshnessLabel}</p>
                </div>
              </div>

              {/* Auth actions */}
              {isAuthenticated && user ? (
                <div className="hidden items-center gap-1 sm:flex">
                  <button
                    type="button"
                    onClick={() => navigate("/pro")}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 text-primary-bright outline-none transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <Crown className="h-3 w-3" />
                    <span className="text-[12px] font-medium tracking-tight">Pro</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground outline-none transition-colors hover:border-destructive/30 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive/40"
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
                  className="hidden h-8 gap-1.5 rounded-full border-border bg-transparent px-4 text-foreground/80 hover:bg-foreground/[0.04] hover:text-foreground sm:inline-flex"
                >
                  <UserCircle2 className="h-3 w-3" />
                  <span className="text-[12px] font-medium tracking-tight">{t("nav.signIn", "Sign In")}</span>
                </Button>
              )}

              {/* GitHub */}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open MilaMark repository"
                className="hidden h-8 items-center gap-1.5 rounded-full border border-border bg-foreground/[0.03] px-3 text-muted-foreground no-underline outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 lg:inline-flex"
              >
                <ExternalLink className="h-3 w-3" />
                <span className="text-[12px] font-medium tracking-tight">GitHub</span>
                {stars !== null && <span className="text-[11px] font-semibold text-muted-foreground num">{stars.toLocaleString()}</span>}
              </a>

              {/* Mobile toggle */}
              <button
                type="button"
                onClick={() => setMobileOpen((open) => !open)}
                onKeyDown={(e) => { if (e.key === "Escape") setMobileOpen(false); }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground/80 outline-none transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 lg:hidden"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
                aria-controls="mobile-menu"
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
          id="mobile-menu"
          className="mx-auto mt-2 w-[min(92vw,500px)] pointer-events-auto px-3"
          aria-label="Navigation menu"
          onKeyDown={(e) => { if (e.key === "Escape") setMobileOpen(false); }}
        >
          <div className="rounded-2xl border border-border bg-popover/95 p-3 shadow-soft-lg backdrop-blur-2xl">
            <div className="flex items-center justify-between gap-4 px-1 pb-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Platform</p>
                <p className="mt-0.5 text-[11px] font-semibold text-foreground">MilaMark</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-foreground/[0.03] px-3 py-1">
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                <span className="text-[11px] font-medium tracking-tight text-foreground">{liveLabel}</span>
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
                    data-active={active}
                    className={`rounded-xl border px-3 py-2.5 text-center text-[11px] font-medium tracking-tight no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 ${
                      active
                        ? "border-primary/20 bg-primary/10 text-primary-bright"
                        : "border-border text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
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
                    className="col-span-2 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5 text-primary-bright outline-none transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <span className="inline-flex items-center gap-2 text-[12px] font-medium tracking-tight">
                      <Crown className="h-3 w-3" />
                      Pro Dashboard
                    </span>
                    <span className="text-[11px] font-medium text-primary/70">{user.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="col-span-2 flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-muted-foreground outline-none transition-colors hover:border-destructive/30 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive/40"
                  >
                    <LogOut className="h-3 w-3" />
                    <span className="text-[12px] font-medium tracking-tight">Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={openSignIn}
                  className="col-span-2 flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-foreground/80 outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <span className="inline-flex items-center gap-2 text-[12px] font-medium tracking-tight">
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
              className="mt-2 flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-muted-foreground no-underline outline-none transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <span className="inline-flex items-center gap-2 text-[12px] font-medium tracking-tight">
                <ExternalLink className="h-3 w-3" />
                Repository
              </span>
              {stars !== null && <span className="text-[11px] font-semibold text-muted-foreground num">{stars.toLocaleString()}</span>}
            </a>
          </div>
        </div>
      )}

      <SignInPortalModal open={signInOpen} onOpenChange={setSignInOpen} />
    </header>
  );
}
