import { useMemo, useState } from "react";
import { ArrowRight, BarChart3, Clock3, Search, SlidersHorizontal, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

type BlogPost = {
  id: number; title: string; excerpt: string; content: string;
  category: "Market Intel" | "Buying Guides" | "Data Stories" | "Platform Updates";
  readTime: string; publishedAt: string; author: string; tags: string[];
  signal: string; keyTakeaways: string[];
  metricLabel: string; metricValue: string; metricDelta: string;
};

const BLOG_POSTS: BlogPost[] = [
  { id: 1, title: "Q2 2026 Snapshot: Hybrid SUVs Keep Gaining Share in Colombo", excerpt: "Demand is holding because pricing has become smarter, not because buyers are blind to value.", content: "Hybrid SUVs now account for a larger share of premium listing activity in Colombo compared to the same period last year. The stronger signal is tighter pricing discipline rather than volume alone.", category: "Market Intel", readTime: "5 min", publishedAt: "2026-04-16", author: "Ardeno Research", tags: ["Hybrid", "SUV", "Colombo", "Pricing"], signal: "Hybrid SUV pricing is compressing toward smarter seller expectations.", keyTakeaways: ["Median spreads are tightening in Colombo.", "Condition-adjusted comps matter more than list volume.", "District supply gaps still create negotiation openings."], metricLabel: "Market Spread", metricValue: "4.8%", metricDelta: "Tighter vs last quarter" },
  { id: 2, title: "How to Validate a Fair Deal Score Before You Buy", excerpt: "A practical way to separate genuinely under-market listings from noisy scoring.", content: "A deal score only becomes trustworthy when three signals align: enough comparables, fresh listings, and a district context that is not distorted by tiny samples.", category: "Buying Guides", readTime: "4 min", publishedAt: "2026-04-10", author: "Ardeno Editorial", tags: ["Deal Score", "Checklist", "Negotiation"], signal: "Strong deal scores without sample depth should be treated with caution.", keyTakeaways: ["Check sample size before trusting the signal.", "Use freshness to avoid comparing against stale inventory.", "District context changes the confidence level."], metricLabel: "Score Confidence", metricValue: "3 checks", metricDelta: "Sample, freshness, district" },
  { id: 3, title: "Inside the Live Sync Pipeline: What Updates Every 45 Seconds", excerpt: "A look at how Ardeno separates fast operational freshness from heavier market analysis.", content: "The platform pipeline batches source updates, validates schema quality, then refreshes operational and analytical layers on different cadences.", category: "Platform Updates", readTime: "6 min", publishedAt: "2026-04-07", author: "Ardeno Engineering", tags: ["Pipeline", "Freshness", "Operations"], signal: "Operational freshness and analytical trust are being tuned independently.", keyTakeaways: ["Fast UI signals and slower aggregate updates serve different purposes.", "Freshness labels should not be read as full-market recalculations.", "Operational transparency improves trust in the data layer."], metricLabel: "Sync Cadence", metricValue: "45s", metricDelta: "Operational refresh cycle" },
  { id: 4, title: "District Demand Heat: Why Northern Supply Behaves Differently", excerpt: "Low supply does not always mean weak opportunity when buyer urgency stays high.", content: "Northern district activity shows a different relationship between listing concentration and price movement than Colombo-heavy markets.", category: "Data Stories", readTime: "5 min", publishedAt: "2026-04-03", author: "Ardeno Data Team", tags: ["Districts", "Demand", "Heatmap"], signal: "Scarcity effects are stronger when trusted listings are thin on the ground.", keyTakeaways: ["Low volume can still support firm pricing.", "Small-sample outliers distort district narratives quickly.", "Cross-district benchmarks prevent false confidence."], metricLabel: "District Signal", metricValue: "North +7%", metricDelta: "Relative urgency vs broader market" },
  { id: 5, title: "Luxury Sedan Resale in 2026: What Actually Moves Price", excerpt: "Mileage and records are now beating year-only logic in higher-ticket segments.", content: "In premium sedan categories, condition-adjusted pricing is increasingly dominant. Listings with verifiable maintenance history close the gap faster.", category: "Market Intel", readTime: "7 min", publishedAt: "2026-03-29", author: "Ardeno Research", tags: ["Sedan", "Resale", "Premium"], signal: "Maintenance transparency is turning into a pricing multiplier in premium segments.", keyTakeaways: ["Year alone is weakening as the primary premium signal.", "Records and seller transparency now move faster than cosmetic polish.", "Condition-adjusted comp sets are mandatory in the segment."], metricLabel: "Premium Bias", metricValue: "Maintenance-led", metricDelta: "Quality signal shift" },
  { id: 6, title: "From Saved Listings to Decision: A 15-Minute Buyer Routine", excerpt: "A short workflow that turns browsing into a tighter shortlist.", content: "Start with a broad saved list, remove stale and incomplete listings, then rank what remains by deal-score confidence, district convenience, and comparable depth.", category: "Buying Guides", readTime: "3 min", publishedAt: "2026-03-24", author: "Ardeno Editorial", tags: ["Saved Listings", "Workflow", "Shortlist"], signal: "Decision speed improves when noise is removed first, not analyzed longer.", keyTakeaways: ["Shortlisting is more valuable than over-reading weak candidates.", "Freshness and metadata completeness should eliminate entries early.", "Confidence beats volume when it is time to contact sellers."], metricLabel: "Decision Loop", metricValue: "15 min", metricDelta: "From saved list to shortlist" },
];

const CATEGORIES = ["All", "Market Intel", "Buying Guides", "Data Stories", "Platform Updates"] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-LK", { day: "2-digit", month: "short", year: "numeric" });
}

function parseMin(v: string): number { const m = v.match(/\d+/); return m ? Number(m[0]) : 0; }

export default function Blogs() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [activePostId, setActivePostId] = useState(BLOG_POSTS[0].id);
  const [decisionMode, setDecisionMode] = useState<"value" | "balanced" | "premium">("balanced");
  const [riskTolerance, setRiskTolerance] = useState(45);
  const [timelineDays, setTimelineDays] = useState(14);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BLOG_POSTS.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (q && !p.title.toLowerCase().includes(q) && !p.excerpt.toLowerCase().includes(q) && !p.tags.some((t) => t.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [category, query]);

  const active = useMemo(() => filtered.find((p) => p.id === activePostId) || filtered[0] || null, [activePostId, filtered]);

  const topicSignals = useMemo(() => {
    const c = new Map<string, number>();
    filtered.forEach((p) => p.tags.forEach((t) => c.set(t, (c.get(t) || 0) + 1)));
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filtered]);

  const decisionBrief = useMemo(() => {
    let cat: BlogPost["category"] = decisionMode === "value" ? "Buying Guides" : decisionMode === "premium" ? "Market Intel" : "Data Stories";
    if (riskTolerance <= 30) cat = "Buying Guides";
    if (riskTolerance >= 75) cat = "Market Intel";
    const timeline = timelineDays <= 7 ? "Immediate" : timelineDays <= 21 ? "Short watch" : "Patient watch";
    return { cat, timeline };
  }, [decisionMode, riskTolerance, timelineDays]);

  const guidedPosts = useMemo(() => {
    return filtered.map((p) => {
      let s = 0;
      if (p.category === decisionBrief.cat) s += 3;
      if (decisionMode === "value" && p.tags.some((t) => ["Checklist", "Negotiation", "Workflow"].includes(t))) s += 2;
      if (decisionMode === "premium" && p.tags.some((t) => ["Premium", "Resale", "Pricing"].includes(t))) s += 2;
      return { p, s };
    }).sort((a, b) => b.s - a.s).slice(0, 3).map((i) => i.p);
  }, [decisionBrief.cat, decisionMode, filtered]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]/70">Journal</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-[-0.035em] leading-[1.02] text-foreground sm:text-[2.75rem] lg:text-[3rem]">Market briefings.</h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">{filtered.length} signals in view · Ardeno Research</p>

          {/* Search + categories */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 focus-within:border-primary/20">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search topics or tags" className="h-10 w-full bg-transparent text-sm text-foreground placeholder-zinc-600 outline-none" />
            </div>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors ${c === category ? "bg-primary/8 text-primary border border-primary/15" : "text-muted-foreground hover:text-foreground border border-transparent"}`}
                >{c}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10 space-y-8">
        {/* Featured */}
        {active && (
          <article className="grid gap-6 rounded-xl border border-border bg-card p-5 sm:p-6 lg:grid-cols-[1.3fr_0.7fr]">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-primary/15 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary/80">{active.category}</span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 className="h-3 w-3" /> {active.readTime}</span>
                <span className="text-[10px] text-muted-foreground">{formatDate(active.publishedAt)}</span>
              </div>
              <h2 className="mt-4 font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{active.title}</h2>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{active.excerpt}</p>
              <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">{active.content}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {active.tags.map((t) => (
                  <button key={t} type="button" onClick={() => setQuery(t)} className="rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground">{t}</button>
                ))}
              </div>
              <p className="mt-4 text-[11px] text-muted-foreground">By {active.author}</p>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{active.metricLabel}</p>
                <p className="num mt-2 text-xl font-bold text-primary">{active.metricValue}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{active.metricDelta}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Signal</p>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{active.signal}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Takeaways</p>
                <ul className="mt-2 space-y-1.5">
                  {active.keyTakeaways.map((t) => (
                    <li key={t} className="flex gap-2 text-[11px] text-muted-foreground"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          {/* Decision lab + grid */}
          <div className="space-y-6">
            {/* Decision lab */}
            <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">Decision lab</h3>
                <span className="flex items-center gap-1.5 rounded-md border border-primary/15 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary/80">
                  <Target className="h-3 w-3" /> {decisionBrief.timeline}
                </span>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex gap-1.5">
                    {(["value", "balanced", "premium"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => setDecisionMode(m)}
                        className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold capitalize transition-colors ${m === decisionMode ? "border-primary/15 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                      >{m}</button>
                    ))}
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><SlidersHorizontal className="h-3 w-3 text-primary/60" /> Risk</span>
                      <span className="num font-semibold text-foreground">{riskTolerance}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={5} value={riskTolerance} onChange={(e) => setRiskTolerance(Number(e.target.value))} className="mt-1.5 w-full accent-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Timeline</span><span className="num font-semibold text-foreground">{timelineDays}d</span>
                    </div>
                    <input type="range" min={3} max={45} value={timelineDays} onChange={(e) => setTimelineDays(Number(e.target.value))} className="mt-1.5 w-full accent-amber-400" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Recommended</p>
                  {guidedPosts.map((p) => (
                    <button key={p.id} type="button" onClick={() => setActivePostId(p.id)}
                      className="block w-full rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-border"
                    >
                      <p className="text-[10px] text-muted-foreground">{p.category}</p>
                      <p className="mt-1 text-[12px] font-semibold text-foreground truncate">{p.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Grid */}
            <div>
              <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">All signals · {filtered.length}</h3>
              {filtered.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {filtered.map((p) => (
                    <button key={p.id} type="button" onClick={() => setActivePostId(p.id)}
                      className={`rounded-xl border p-4 text-left transition-colors ${active?.id === p.id ? "border-primary/15 bg-primary/5" : "border-border bg-surface hover:border-border"}`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className={active?.id === p.id ? "text-primary/80" : ""}>{p.category}</span>
                        <span>{p.readTime}</span>
                      </div>
                      <p className="mt-2 text-[13px] font-semibold text-foreground leading-snug">{p.title}</p>
                      <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-2">{p.excerpt}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border py-12 text-center">
                  <p className="text-[12px] text-muted-foreground">No signals match this filter.</p>
                  <button type="button" onClick={() => { setQuery(""); setCategory("All"); }} className="mt-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground">Clear filters</button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4 self-start xl:sticky xl:top-20">
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Topic signals</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {topicSignals.map(([t, c]) => (
                  <button key={t} type="button" onClick={() => setQuery(t)} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground">
                    {t} <span className="num text-muted-foreground">{c}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Quick links</p>
              <Link to="/" className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5 text-[12px] font-semibold text-foreground no-underline hover:border-border">
                Dashboard <TrendingUp className="h-3 w-3 text-primary/60" />
              </Link>
              <Link to="/best-picks" className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5 text-[12px] font-semibold text-foreground no-underline hover:border-border">
                Best picks <BarChart3 className="h-3 w-3 text-primary/60" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
