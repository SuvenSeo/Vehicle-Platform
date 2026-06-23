import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, MapPin, TrendingUp } from "lucide-react";

const links = [
  { to: "/", label: "Inventory", icon: TrendingUp },
  { to: "/trends", label: "Price trends", icon: BarChart3 },
  { to: "/map", label: "District map", icon: MapPin },
];

const NotFound = () => {
  return (
    <div className="min-h-screen">
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]/70">404</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-[-0.035em] leading-[1.02] text-foreground sm:text-[2.75rem] lg:text-[3rem]">Page not found.</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">This route doesn't exist. Try one of the links below.</p>
          <Link to="/" className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-[11px] font-semibold text-foreground no-underline transition-colors hover:bg-foreground/[0.03]">
            <ArrowLeft className="h-3 w-3" /> Back to dashboard
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6">
        <div className="grid gap-2 sm:grid-cols-3">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <Link key={l.to} to={l.to} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 no-underline transition-colors hover:border-border">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-foreground/[0.03]">
                  <Icon className="h-3.5 w-3.5 text-primary/70" />
                </div>
                <span className="text-[13px] font-semibold text-foreground">{l.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NotFound;
