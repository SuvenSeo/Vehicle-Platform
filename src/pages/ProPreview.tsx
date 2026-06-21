import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Car,
  Crown,
  Download,
  FileText,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PlatformPageHero } from "@/components/PlatformPageHero";
import { PageCanvas } from "@/components/PageCanvas";
import { SectionHeader } from "@/components/SectionHeader";
import { Surface } from "@/components/Surface";
import { Button } from "@/components/ui/button";

const PREVIEW_METRICS = [
  { label: "Market depth", value: "18.4K" },
  { label: "Source mix", value: "5" },
  { label: "Hot deals", value: "342" },
];

const PREVIEW_LANES = [
  { name: "Toyota Aqua", listings: 824, median: "Rs. 7.8M", district: "Colombo" },
  { name: "Honda Vezel", listings: 612, median: "Rs. 11.2M", district: "Gampaha" },
  { name: "Suzuki Wagon R", listings: 589, median: "Rs. 5.4M", district: "Kandy" },
  { name: "Nissan Leaf", listings: 311, median: "Rs. 6.1M", district: "Colombo" },
];

const PREVIEW_CHART = [
  { label: "Ikman", count: 9400 },
  { label: "Riyasewana", count: 5100 },
  { label: "AutoLanka", count: 1800 },
  { label: "Patpat", count: 1300 },
  { label: "AutoDirect", count: 800 },
];

const LOCKED_REPORTS = ["Executive PDF", "Editable Word brief", "CSV data pack", "JSON API snapshot", "Print-ready report"];

function LockedOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-background/60 backdrop-blur-[3px]">
      <div className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-center">
        <Lock className="mx-auto mb-2 h-5 w-5 text-primary" />
        <p className="tech-label font-semibold text-foreground">Unlock with Pro</p>
      </div>
    </div>
  );
}

export default function ProPreview() {
  return (
    <PageCanvas>
      <PlatformPageHero
        eyebrow="Pro preview"
        title="Pro workspace preview."
        description="See the depth of lane drill-downs, district profiles, and export packs before you sign in."
        icon={Crown}
        metrics={PREVIEW_METRICS}
        actions={
          <div className="grid gap-2">
            <Button asChild className="h-11 w-full">
              <Link to="/sign-in">
                <ShieldCheck className="h-3.5 w-3.5" />
                Sign in to unlock
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 w-full">
              <Link to="/">Browse public data</Link>
            </Button>
          </div>
        }
      />

      <section className="layout-shell grid gap-6 py-10 md:py-12 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Surface variant="elevated" className="relative p-5">
            <LockedOverlay />
            <SectionHeader eyebrow="Vehicle intelligence" title="Pro lane drill-downs" />
            <div className="mt-4 overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    {["Vehicle", "Listings", "Median", "Top area"].map((heading) => (
                      <th key={heading} className="field-label px-4 py-3 text-left text-muted-foreground">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PREVIEW_LANES.map((lane) => (
                    <tr key={lane.name} className="border-t border-border">
                      <td className="px-4 py-3 font-medium text-foreground">{lane.name}</td>
                      <td className="px-4 py-3 text-muted-foreground num">{lane.listings}</td>
                      <td className="px-4 py-3 text-primary num">{lane.median}</td>
                      <td className="px-4 py-3 text-muted-foreground">{lane.district}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>

          <Surface variant="elevated" className="relative p-5">
            <LockedOverlay />
            <div className="flex items-center justify-between gap-4">
              <SectionHeader eyebrow="Source and area intelligence" title="Coverage quality preview" className="mb-0" />
              <BarChart3 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            </div>
            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={PREVIEW_CHART}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Surface>
        </div>

        <aside className="space-y-6">
          <Surface variant="elevated" className="p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-foreground">What Pro adds</h2>
            <div className="mt-4 space-y-2">
              {[
                "Vehicle lane drill-downs with live sample listings",
                "District opportunity profiles and source mix",
                "Trend studio with exportable price history",
                "Data quality and freshness coverage",
                "Download packs for PDF, Word, CSV, JSON, and print",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <p className="text-sm leading-relaxed text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </Surface>

          <Surface variant="elevated" className="p-5">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Report formats</h2>
            </div>
            <div className="mt-4 grid gap-2">
              {LOCKED_REPORTS.map((report) => (
                <button
                  key={report}
                  type="button"
                  disabled
                  className="flex h-10 items-center justify-between rounded-lg border border-border bg-muted/20 px-3 text-left text-xs font-medium text-muted-foreground"
                >
                  <span>{report}</span>
                  <Download className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </Surface>

          <Button asChild className="h-11 w-full">
            <Link to="/sign-in">
              <MapPin className="h-3.5 w-3.5" />
              Unlock live Pro workspace
            </Link>
          </Button>
        </aside>
      </section>
    </PageCanvas>
  );
}
