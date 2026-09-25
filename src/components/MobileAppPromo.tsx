import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { Smartphone, Sparkles, X } from "lucide-react";
import { useAppPreferences } from "@/lib/appPreferences";
import { springSoft } from "@/lib/motion";

const SEEN_KEY = "motormila.mobile_promo_seen";
/** Never nag on the pages where a floating card would be in the way. */
const SUPPRESSED_PREFIXES = ["/mobile-app", "/compare", "/docs"];

/**
 * Once-per-visitor launch card for the Motormila Android release. Dismissing it
 * is remembered locally; the /mobile-app page stays reachable from the navbar
 * and footer afterwards.
 */
export function MobileAppPromo() {
  const { t } = useAppPreferences();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  const suppressed = SUPPRESSED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    if (suppressed) return;
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;

    // Let the first paint settle before the card slides in.
    const timer = window.setTimeout(() => setVisible(true), 6000);
    return () => window.clearTimeout(timer);
  }, [suppressed]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Session-only dismissal then; acceptable.
    }
  };

  const open = () => {
    dismiss();
    navigate("/mobile-app");
  };

  if (suppressed) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          transition={springSoft}
          aria-label={t("mobile.promoAria", "Motormila mobile app announcement")}
          className="fixed bottom-[112px] left-3 right-3 z-[998] md:bottom-6 md:left-6 md:right-auto md:w-[368px]"
        >
          <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-[linear-gradient(155deg,rgba(7,11,19,0.97),rgba(9,15,26,0.94))] p-4 shadow-[0_28px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(10,122,255,0.28),transparent_68%)] blur-[50px]"
            />
            <div className="relative flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#3D94FF]/30 bg-[#0A7AFF]/15">
                <Smartphone className="h-4 w-4 text-[#5FAFFF]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden />
                  {t("mobile.releasingSoon", "Releasing soon")}
                </span>
                <p className="mt-2 text-[13.5px] font-semibold leading-snug text-white">
                  {t("mobile.promoTitle", "Motormila is going mobile.")}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-white/60">
                  {t(
                    "mobile.promoBody",
                    "Live listings, deal scores, price-drop alerts and plate scanning — in an Android APK built for the road.",
                  )}
                </p>
                <div className="mt-3.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={open}
                    className="inline-flex h-9 items-center rounded-full bg-[#0A7AFF] px-4 text-[12px] font-semibold text-white outline-none transition-colors hover:bg-[#3D94FF] focus-visible:ring-2 focus-visible:ring-white/50"
                  >
                    {t("mobile.promoCta", "See what's coming")}
                  </button>
                  <button
                    type="button"
                    onClick={dismiss}
                    className="inline-flex h-9 items-center rounded-full border border-white/12 px-3.5 text-[12px] font-medium text-white/60 outline-none transition-colors hover:border-white/25 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    {t("mobile.promoDismiss", "Not now")}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label={t("mobile.promoClose", "Dismiss announcement")}
                className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/45 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
