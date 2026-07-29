import { BrandLogo } from "@/components/BrandLogo";
import { scrollBehavior } from "@/lib/motion";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Crown, ExternalLink, LogOut, Menu, MoreHorizontal, Shield, UserCircle2, X } from "lucide-react";
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
import { formatRelativeTimeI18n } from "@/lib/formatting";
import { NotificationBell } from "@/components/NotificationBell";

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
  const { user, logout, isAuthenticated, isAdmin, hasProAccess } = useAuth();
  const pipelineStatus = usePipelineStatus();
  const { t } = useAppPreferences();
  const { hash, pathname } = useLocation();
  const navigate = useNavigate();

  const sections = useMemo<NavSection[]>(
    () => [
      { label: t("nav.home", "Home"), href: "/", id: "home", isRoute: true, activeOn: ["overview"] },
      { label: t("nav.market", "Market"), href: "#market", id: "market" },
      { label: t("nav.trends", "Trends"), href: "/trends", id: "trends", isRoute: true },
      { label: t("nav.calculator", "Calculator"), href: "/calculator", id: "calculator", isRoute: true },
      { label: t("nav.evHub", "EV Hub"), href: "/ev-hub", id: "ev-hub", isRoute: true },
      { label: t("nav.valuation", "Valuation"), href: "/estimate", id: "estimate", isRoute: true },
      { label: t("nav.pricing", "Pricing"), href: "/pricing", id: "pricing", isRoute: true },
      { label: t("nav.docs", "Docs"), href: "/docs", id: "docs", isRoute: true },
    ],
    [t],
  );

  const moreSections = useMemo(
    () => [
      { label: t("nav.bestPicks", "Best Picks"), href: "/best-picks", detail: t("nav.bestPicksDetail", "Strict deal-score shortlist") },
      { label: t("nav.priceIndex", "Price Index"), href: "/price-index", detail: t("nav.priceIndexDetail", "Mix-adjusted market index") },
      { label: t("nav.officialPulse", "Official Pulse"), href: "/official-pulse", detail: t("nav.officialPulseDetail", "DMT, Customs & import signals") },
      { label: t("nav.dealer", "Dealer"), href: "/dealer", detail: t("nav.dealerDetail", "Operator command center") },
      { label: t("nav.alerts", "Alerts"), href: "/alerts", detail: t("nav.alertsDetail", "Saved listing watches") },
      { label: t("nav.settings", "Settings"), href: "/settings", detail: t("nav.settingsDetail", "Language and theme") },
      ...(isAdmin
        ? [{ label: t("nav.admin", "Admin"), href: "/admin", detail: t("nav.adminDetail", "Owner console · users, ops, analytics") }]
        : []),
      isAuthenticated
        ? { label: t("nav.proDashboard", "Pro Dashboard"), href: "/pro", detail: t("nav.proDetail", "Paid market terminal") }
        : { label: t("nav.proPreview", "Pro Preview"), href: "/pro-preview", detail: t("nav.proPreviewDetail", "Locked terminal layout") },
    ],
    [isAuthenticated, isAdmin, t],
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

  // null = still loading / failed — do not pretend the pipeline is actively syncing.
  const liveState = pipelineStatus?.overall_status ?? null;
  const liveLabel =
    liveState === "ok"
      ? t("nav.live", "Live")
      : liveState === "delayed"
        ? t("nav.delayed", "Delayed")
        : liveState === "running"
          ? t("nav.syncing", "Syncing")
          : t("nav.statusUnknown", "Status unknown");
  const liveFreshnessLabel = latestSyncIso
    ? formatRelativeTimeI18n(latestSyncIso, t)
    : liveState
      ? t("nav.awaiting", "Awaiting sync")
      : t("nav.statusUnavailable", "Unavailable");

  const statusDot =
    liveState === "ok"
      ? "bg-emerald-500"
      : liveState === "delayed"
        ? "bg-primary"
        : liveState === "running"
          ? "bg-primary/70 animate-pulse-soft"
          : "bg-muted-foreground/50";

  const isSectionActive = ({ id, href, activeOn, isRoute }: NavSection) => {
    if (id === "home") {
      return pathname === "/" && (activeSection === "overview" || activeSection === "home");
    }
    if (isRoute) return pathname === href;
    return pathname === "/" && [id, ...(activeOn ?? [])].includes(activeSection);
  };

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
    navigate("/sign-in");
    setMobileOpen(false);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-[1000] pointer-events-none">
      <div className="flex justify-center px-2 pt-3 sm:px-3">
        <nav
          className="nav-glass pointer-events-auto w-[min(1480px,calc(100vw-16px))] overflow-visible rounded-full"
          aria-label={t("nav.primaryNavigation", "Primary navigation")}
        >
          <div className="relative flex min-h-[60px] items-center gap-1.5 px-2 py-1.5 sm:min-h-[62px] sm:gap-2 sm:px-3">
            {/* ── Brand ─────────────────────────────────── */}
            <Link
              to="/"
              onClick={onHomeLinkClick}
              className="group flex shrink-0 items-center rounded-full px-2 py-1.5 no-underline outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/50 sm:px-2.5"
              aria-label={t("nav.homeAria", "Motormila home")}
            >
              <span className="relative">
                <BrandLogo size="nav" showTagline={false} />
                <span className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-background ${statusDot}`} />
              </span>
            </Link>

            {/* ── Desktop nav tabs ──────────────────────── */}
            <div className="hidden min-w-0 flex-1 justify-center lg:flex">
              <div
                className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-border bg-foreground/[0.03] p-1 shadow-inner [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none" }}
              >
                {sections.map((section) => {
                  const active = isSectionActive(section);
                  return (
                    <a
                      key={`${section.id}-${section.label}`}
                      href={section.href}
                      onClick={(event) => handleScroll(event, section.href, section.isRoute)}
                      aria-current={active ? "page" : undefined}
                      data-active={active}
                      className={`relative whitespace-nowrap rounded-full px-2 py-1.5 text-[11px] font-medium tracking-tight no-underline outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/50 xl:px-2.5 xl:text-[12px] 2xl:px-3.5 ${
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
                    aria-label={t("nav.moreWorkspaces", "More workspaces")}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                    <span className="text-[12px] font-medium tracking-tight">{t("nav.more", "More")}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-60 rounded-3xl border-border bg-popover/95 p-1.5 text-foreground shadow-soft-lg backdrop-blur-2xl"
                >
                  <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t("nav.workspaces", "Workspaces")}
                  </p>
                  <DropdownMenuSeparator className="bg-border" />
                  {moreSections.map((section) => (
                    <DropdownMenuItem
                      key={section.href}
                      onSelect={() => navigate(section.href)}
                      className="rounded-2xl px-3 py-2 text-foreground/80 focus:bg-accent focus:text-foreground"
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

              {/* Notification bell */}
              <NotificationBell />

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
                  <span
                    className={`inline-flex h-8 items-center rounded-full border px-2.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                      hasProAccess
                        ? "border-primary/25 bg-primary/10 text-primary-bright"
                        : "border-border bg-foreground/[0.03] text-muted-foreground"
                    }`}
                  >
                    {user.plan}
                  </span>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => navigate("/admin")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-foreground/[0.03] px-3 text-foreground outline-none transition-colors hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <Shield className="h-3 w-3" />
                      <span className="text-[12px] font-medium tracking-tight">{t("nav.admin", "Admin")}</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => navigate(hasProAccess ? "/pro" : "/pricing")}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 text-primary-bright outline-none transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <Crown className="h-3 w-3" />
                    <span className="text-[12px] font-medium tracking-tight">
                      {hasProAccess ? t("common.pro", "Pro") : t("nav.upgrade", "Upgrade")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground outline-none transition-colors hover:border-destructive/30 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive/40"
                    aria-label={t("nav.signOut", "Sign out")}
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
                aria-label={t("nav.openRepoAria", "Open Motormila repository")}
                className="hidden h-8 items-center gap-1.5 rounded-full border border-border bg-foreground/[0.03] px-3 text-muted-foreground no-underline outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 lg:inline-flex"
              >
                <ExternalLink className="h-3 w-3" />
                <span className="text-[12px] font-medium tracking-tight">{t("nav.github", "GitHub")}</span>
                {stars !== null && <span className="text-[11px] font-semibold text-muted-foreground num">{stars.toLocaleString()}</span>}
              </a>

              {/* Mobile toggle */}
              <button
                type="button"
                onClick={() => setMobileOpen((open) => !open)}
                onKeyDown={(e) => { if (e.key === "Escape") setMobileOpen(false); }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground/80 outline-none transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 lg:hidden"
                aria-label={mobileOpen ? t("nav.closeMenu", "Close menu") : t("nav.openMenu", "Open menu")}
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
          className="mx-auto mt-2 w-[min(1480px,calc(100vw-16px))] pointer-events-auto px-2 sm:px-3"
          aria-label={t("nav.navigationMenu", "Navigation menu")}
          onKeyDown={(e) => { if (e.key === "Escape") setMobileOpen(false); }}
        >
          <div className="overflow-hidden rounded-3xl border border-border bg-popover/95 p-3.5 shadow-soft-lg backdrop-blur-2xl">
            <div className="flex items-center justify-between gap-4 px-1 pb-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("nav.platform", "Platform")}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-foreground">Motormila</p>
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
                    className={`rounded-2xl border px-3 py-2.5 text-center text-[11px] font-medium tracking-tight no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 ${
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
                    className="col-span-2 flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2.5 text-primary-bright outline-none transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <span className="inline-flex items-center gap-2 text-[12px] font-medium tracking-tight">
                      <Crown className="h-3 w-3" />
                      {t("nav.proDashboard", "Pro Dashboard")}
                    </span>
                    <span className="text-[11px] font-medium text-primary/70">{user.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="col-span-2 flex items-center gap-2 rounded-2xl border border-border px-3 py-2.5 text-muted-foreground outline-none transition-colors hover:border-destructive/30 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive/40"
                  >
                    <LogOut className="h-3 w-3" />
                    <span className="text-[12px] font-medium tracking-tight">{t("nav.signOut", "Sign out")}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={openSignIn}
                  className="col-span-2 flex items-center justify-between rounded-2xl border border-border px-3 py-2.5 text-foreground/80 outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-primary/50"
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
              className="mt-2 flex items-center justify-between rounded-2xl border border-border px-3 py-2.5 text-muted-foreground no-underline outline-none transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <span className="inline-flex items-center gap-2 text-[12px] font-medium tracking-tight">
                <ExternalLink className="h-3 w-3" />
                {t("nav.repository", "Repository")}
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
