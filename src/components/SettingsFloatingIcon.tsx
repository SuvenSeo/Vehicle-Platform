import { Link, useLocation } from "react-router-dom";
import { Settings2 } from "lucide-react";
import { useAppPreferences } from "@/lib/appPreferences";

export function SettingsFloatingIcon() {
  const { t } = useAppPreferences();
  const location = useLocation();
  const isActive = location.pathname === "/settings";

  return (
    <div
      className="fixed bottom-6 left-6 z-[99] max-sm:hidden"
      title={t("nav.settings", "Settings")}
    >
      <Link
        to="/settings"
        aria-label={t("nav.settings", "Settings")}
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div
          className={
            "floating-action-menu-item flex items-center justify-center w-12 h-12 rounded-full border transition-[border-color,background-color,color,opacity] duration-200 " +
            (isActive
              ? "bg-primary text-primary-foreground border-primary"
              : "floating-control text-muted-foreground hover:text-foreground")
          }
        >
          <Settings2 className="w-5 h-5" />
        </div>
      </Link>
    </div>
  );
}
