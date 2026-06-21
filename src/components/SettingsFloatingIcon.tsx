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
        className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        <div
          className={
            "floating-action-menu-item floating-control flex items-center justify-center w-12 h-12 rounded-xl border transition-[border-color,background-color,color,opacity] duration-200 " +
            (isActive
              ? "bg-amber-500 text-black border-amber-400"
              : "bg-[#080a09]/92 text-zinc-400 border-white/10 backdrop-blur-xl hover:bg-[#111514] hover:text-white hover:border-white/20")
          }
        >
          <Settings2 className="w-5 h-5" />
        </div>
      </Link>
    </div>
  );
}
