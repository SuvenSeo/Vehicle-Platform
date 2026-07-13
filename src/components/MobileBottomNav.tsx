import { BarChart2, Bell, Crown, Home, Star, TrendingUp } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

type NavTab = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  matchHash?: string;
};

const TABS: NavTab[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Market", href: "/#market", icon: TrendingUp, matchHash: "market" },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Trends", href: "/trends", icon: BarChart2 },
  { label: "Best Picks", href: "/best-picks", icon: Star },
  { label: "Pro", href: "/pro", icon: Crown },
];

function useIsTabActive(tab: NavTab): boolean {
  const { pathname, hash } = useLocation();

  if (tab.matchHash) {
    return pathname === "/" && hash === `#${tab.matchHash}`;
  }

  if (tab.href === "/") {
    return pathname === "/" && !hash;
  }

  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

function TabItem({ tab }: { tab: NavTab }) {
  const isActive = useIsTabActive(tab);
  const Icon = tab.icon;

  return (
    <Link
      to={tab.href}
      aria-label={tab.label}
      aria-current={isActive ? "page" : undefined}
      data-active={isActive}
      className={`group flex flex-1 flex-col items-center justify-center gap-1 py-2 no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 ${
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <span
        className={`relative flex h-7 w-7 items-center justify-center rounded-xl transition-all duration-200 ${
          isActive ? "bg-primary/10" : "group-hover:bg-foreground/[0.04]"
        }`}
      >
        {isActive && (
          <span className="absolute inset-0 rounded-xl bg-primary/10" aria-hidden />
        )}
        <Icon
          className={`relative z-10 h-4 w-4 transition-transform duration-200 ${
            isActive ? "scale-110" : ""
          }`}
        />
      </span>
      <span
        className={`text-[10px] font-medium tracking-tight leading-none transition-colors ${
          isActive ? "text-primary" : ""
        }`}
      >
        {tab.label}
      </span>
    </Link>
  );
}

export function MobileBottomNav() {
  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="md:hidden fixed inset-x-0 bottom-0 z-[999] pointer-events-auto"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="nav-glass border-t border-border">
        <div className="flex h-16 items-stretch">
          {TABS.map((tab) => (
            <TabItem key={tab.href} tab={tab} />
          ))}
        </div>
      </div>
    </nav>
  );
}
