import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Activity, Crown, ExternalLink, LogOut, Menu, MoreHorizontal, UserCircle2, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { SignInPortalModal } from "@/components/SignInPortalModal";
import { HeroPill } from "@/components/ui/hero-pill";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
      { label: "Calculator", href: "/calculator", id: "calculator", isRoute: true },
      { label: t("nav.blog", "Blog"), href: "/blogs", id: "blogs", isRoute: true },
    ],
    [t],
  );

  const moreSections = useMemo(
    () => [
      { label: "EV Hub", href: "/ev-hub", detail: "Battery and charging checks" },
      { label: "Best Picks", href: "/best-picks", detail: "Strict deal-score shortlist" },
      { label: "District Map", href: "/map", detail: "Geo price intelligence" },
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
      {
        root: null,
        threshold: [0.55],
        rootMargin: "-12% 0px -40% 0px",
      },
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

  const statusColor =
    liveState === "delayed"
      ? "bg-amber-400 shadow-amber-400/40"
      : liveState === "ok"
        ? "bg-amber-400 shadow-amber-400/40"
        : "bg-amber-300 shadow-amber-300/40";

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
    <header
      className="fixed inset-x-0 top-3 z-[1000] flex justify-center px-3 sm:px-4 pointer-events-none"
    >
      <nav
        className="nav-glass pointer-events-auto w-[min(1240px,calc(100vw-24px))] overflow-visible rounded-2xl backdrop-blur-2xl"
        aria-label="Primary navigation"
      >
        <div className="relative flex min-h-[64px] items-center gap-2 px-2.5 py-2 sm:px-3">
          <Link
            to="/"
            onClick={onHomeLinkClick}
            className="group flex min-w-0 shrink-0 items-center gap-2.5 rounded-xl px-2 py-1.5 no-underline outline-none transition-colors hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-amber-400/60"
          >
            <div
              className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/[0.12] bg-black/55 shadow-[0_0_32px_rgba(216,155,53,0.12)]"
            >
              <img src="/logo.svg" alt="AutoLens LK logo" className="h-7 w-7 object-contain" />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_14px_rgba(232,182,82,0.9)]" />
            </div>
            <div className="hidden min-[390px]:block leading-none">
              <p className="headline-display text-[15px] leading-none">
                AutoLens <span className="font-medium text-zinc-500">LK</span>
              </p>
              <p className="tech-label mt-1.5">
                By Ardeno Studio
              </p>
            </div>
          </Link>

          <div className="hidden min-w-0 flex-1 justify-center lg:flex">
            <div className="nav-command-panel inline-flex items-center gap-1 rounded-xl p-1">
              {sections.map((section) => {
                const active = isSectionActive(section);

                return (
                  <a
                    key={`${section.id}-${section.label}`}
                    href={section.href}
                    onClick={(event) => handleScroll(event, section.href, section.isRoute)}
                    aria-current={active ? "page" : undefined}
                    data-active={active ? "true" : "false"}
                    className={`relative rounded-xl px-3.5 py-2 tech-label no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
                      active ? "text-white" : "text-zinc-500 hover:text-zinc-100"
                    }`}
                  >
                    {active && (
                      <span
                        className="absolute inset-0 rounded-xl border border-white/15 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      />
                    )}
                    <span className="relative z-10">{section.label}</span>
                  </a>
                );
              })}
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="hidden h-10 items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 text-zinc-300 outline-none transition-colors hover:border-amber-300/35 hover:bg-amber-400/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400/60 md:inline-flex"
                  aria-label="Open more AutoLens workspaces"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                  <span className="tech-label">More</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 rounded-xl border-white/[0.1] bg-[#080a09]/95 p-2 text-zinc-100 shadow-[0_22px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
              >
                <DropdownMenuLabel className="tech-label px-3 py-2">
                  Workspaces
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/[0.08]" />
                {moreSections.map((section) => (
                  <DropdownMenuItem
                    key={section.href}
                    onSelect={() => navigate(section.href)}
                    className="rounded-lg px-3 py-2.5 text-zinc-200 focus:bg-white/[0.06] focus:text-white"
                  >
                    <div>
                      <p className="text-sm font-semibold">{section.label}</p>
                      <p className="ui-caption mt-0.5">{section.detail}</p>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <HeroPill
              className="!hidden items-center gap-2 rounded-xl px-3 py-2 xl:!inline-flex"
              icon={<span className={`h-2 w-2 rounded-full shadow-[0_0_16px_currentColor] ${statusColor}`} />}
            >
              <div className="leading-none">
                <p className="tech-label text-zinc-100">{liveLabel}</p>
                <p className="ui-caption mt-1">{liveFreshnessLabel}</p>
              </div>
            </HeroPill>

            {isAuthenticated && user ? (
              <div className="hidden items-center gap-1.5 sm:flex">
                <button
                  type="button"
                  onClick={() => navigate("/pro")}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 text-amber-50 outline-none transition-colors hover:bg-amber-400/16 focus-visible:ring-2 focus-visible:ring-amber-400/60"
                >
                  <span className="grid h-5 w-5 place-items-center rounded-full border border-amber-300/35 bg-amber-400/18 text-label font-bold text-amber-100">
                    {user.avatarInitials.slice(0, 1)}
                  </span>
                  <Crown className="h-3.5 w-3.5 text-amber-300" />
                  <span className="tech-label">Pro</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.035] text-zinc-500 outline-none transition-colors hover:border-red-400/25 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-300/60"
                  aria-label="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={openSignIn}
                className="hidden h-10 gap-2 rounded-xl sm:inline-flex"
              >
                <UserCircle2 className="h-3.5 w-3.5" />
                <span className="tech-label">{t("nav.signIn", "Sign In")}</span>
              </Button>
            )}

            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open AutoLens LK repository"
              className="hidden h-10 items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 text-zinc-300 no-underline outline-none transition-colors hover:border-amber-300/35 hover:bg-amber-400/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400/60 md:inline-flex"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="tech-label">Repo</span>
              {stars !== null && <span className="ui-caption font-semibold">{stars.toLocaleString()}</span>}
            </a>

            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.1] bg-black/35 text-zinc-200 outline-none transition-colors hover:border-amber-300/35 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400/60 lg:hidden"
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
          <div
            className="absolute left-1/2 top-[calc(100%+10px)] w-[min(92vw,540px)] -translate-x-1/2 pointer-events-auto"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="mobile-menu-panel cinematic-panel rounded-xl p-3">
              <div className="flex items-center justify-between gap-4 px-1 pb-3">
                <div>
                  <p className="tech-label text-zinc-400">Platform</p>
                  <p className="ui-caption mt-1 font-semibold text-zinc-600">AutoLens LK</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
                  <Activity className="h-3.5 w-3.5 text-amber-300" />
                  <span className="tech-label text-zinc-200">{liveLabel}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[...sections, ...moreSections.map((section) => ({ ...section, id: section.href, isRoute: true }))].map((section) => {
                  const active = section.isRoute ? pathname === section.href : isSectionActive(section);

                  return (
                    <a
                      key={`${section.id}-${section.label}`}
                      href={section.href}
                      onClick={(event) => handleScroll(event, section.href, section.isRoute)}
                      aria-current={active ? "page" : undefined}
                      data-active={active ? "true" : "false"}
                      className={`mobile-menu-item rounded-xl border px-3 py-3 text-center tech-label no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
                        active
                          ? "border-amber-300/35 bg-amber-400/14 text-white"
                          : "border-white/[0.08] bg-white/[0.035] text-zinc-400 hover:text-zinc-100"
                      }`}
                    >
                      {section.label}
                    </a>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {isAuthenticated && user ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        navigate("/pro");
                        setMobileOpen(false);
                      }}
                      className="mobile-menu-cta col-span-2 flex items-center justify-between rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 py-3 text-amber-50 outline-none transition-colors hover:bg-amber-400/16 focus-visible:ring-2 focus-visible:ring-amber-400/60"
                    >
                      <span className="inline-flex items-center gap-2 tech-label">
                        <Crown className="h-3.5 w-3.5 text-amber-300" />
                        Pro Dashboard
                      </span>
                      <span className="text-caption font-bold text-amber-200/70">{user.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="col-span-2 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-3 text-zinc-400 outline-none transition-colors hover:border-red-400/25 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-300/60"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span className="tech-label">Sign Out</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={openSignIn}
                    className="mobile-menu-cta col-span-2 flex items-center justify-between rounded-xl border border-white/[0.12] bg-white/[0.05] px-3 py-3 text-zinc-100 outline-none transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-amber-400/60"
                  >
                    <span className="inline-flex items-center gap-2 tech-label">
                      <UserCircle2 className="h-3.5 w-3.5" />
                      {t("nav.signIn", "Sign In")}
                    </span>
                  </button>
                )}

                <div className="col-span-2 rounded-xl border border-white/[0.08] bg-black/30 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 tech-label text-zinc-200">
                      <span className={`h-2 w-2 rounded-full shadow-[0_0_16px_currentColor] ${statusColor}`} />
                      {liveLabel}
                    </span>
                    <span className="ui-caption font-semibold">{liveFreshnessLabel}</span>
                  </div>
                </div>
              </div>

              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-3 text-zinc-300 no-underline outline-none transition-colors hover:border-amber-300/35 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400/60"
              >
                <span className="inline-flex items-center gap-2 tech-label">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Repository
                </span>
                {stars !== null && <span className="ui-caption font-semibold">{stars.toLocaleString()}</span>}
              </a>
            </div>
          </div>
      )}

      <SignInPortalModal open={signInOpen} onOpenChange={setSignInOpen} />
    </header>
  );
}
