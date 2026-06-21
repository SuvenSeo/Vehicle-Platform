import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, MapPin, SearchX, TrendingUp } from "lucide-react";
import { PlatformPageHero } from "@/components/PlatformPageHero";
import { PageCanvas } from "@/components/PageCanvas";

const recoveryLinks = [
  { to: "/", label: "Inventory cockpit", icon: TrendingUp },
  { to: "/trends", label: "Price trends", icon: BarChart3 },
  { to: "/map", label: "District map", icon: MapPin },
];

const NotFound = () => {
  return (
    <PageCanvas>
      <PlatformPageHero
        eyebrow="Route unavailable"
        title="Page not found."
        icon={SearchX}
        metrics={[
          { label: "Status", value: "404" },
          { label: "Recovery", value: "3" },
          { label: "Shell", value: "Ready" },
        ]}
        actions={
          <Link
            to="/"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/12 px-4 text-label font-mono font-bold uppercase text-amber-100 no-underline transition-colors hover:bg-amber-500/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to dashboard
          </Link>
        }
      />

      <section className="layout-shell py-10 md:py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {recoveryLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className="asset-surface rounded-xl p-5 no-underline transition-colors hover:border-amber-400/25">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <Icon className="h-5 w-5 text-amber-300" />
                </div>
                <h2 className="mt-5 text-lg font-semibold tracking-tight text-white">{item.label}</h2>
              </Link>
            );
          })}
        </div>
      </section>
    </PageCanvas>
  );
};

export default NotFound;
