import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Clock3, Search, SlidersHorizontal, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

// Editorial guides only — no invented market statistics or fictional research
// bylines. Anything with real numbers must come from the live API, not here.
type BlogPost = {
  id: number; title: string; excerpt: string; content: string;
  category: "Reading the Market" | "Buying Guides" | "Platform Notes";
  readTime: string; publishedAt: string; tags: string[];
  signal: string; keyTakeaways: string[];
};

const BLOG_POSTS: BlogPost[] = [
  { id: 1, title: "How to Read Hybrid SUV Pricing Before You Negotiate", excerpt: "Segment pricing rewards buyers who compare against condition-adjusted peers, not just the asking column.", content: "Popular hybrid SUV listings cluster around visible reference prices, so an asking price alone tells you little. Compare against peers with similar mileage, condition, and district on the Trends and Valuation pages before you anchor a negotiation.", category: "Reading the Market", readTime: "5 min", publishedAt: "2026-04-16", tags: ["Hybrid", "SUV", "Pricing"], signal: "Asking prices anchor negotiations — comps break the anchor.", keyTakeaways: ["Use condition-adjusted comparables, not list volume.", "Check the same model across districts before trusting one price.", "Thin-supply districts can justify firmer asks."] },
  { id: 2, title: "How to Validate a Fair Deal Score Before You Buy", excerpt: "A practical way to separate genuinely under-market listings from noisy scoring.", content: "A deal score only becomes trustworthy when three signals align: enough comparables, fresh listings, and a district context that is not distorted by tiny samples.", category: "Buying Guides", readTime: "4 min", publishedAt: "2026-04-10", tags: ["Deal Score", "Checklist", "Negotiation"], signal: "Strong deal scores without sample depth should be treated with caution.", keyTakeaways: ["Check sample size before trusting the signal.", "Use freshness to avoid comparing against stale inventory.", "District context changes the confidence level."] },
  { id: 3, title: "How AutoLens Keeps Its Listing Data Fresh", excerpt: "What the scrape pipeline does, how often it runs, and what the freshness labels actually mean.", content: "Listings sync from ten Sri Lankan sources on a scheduled pipeline, then aggregates and deal scores refresh in a separate analysis pass. Freshness labels on the dashboard reflect the operational sync, not a full-market recalculation.", category: "Platform Notes", readTime: "4 min", publishedAt: "2026-04-07", tags: ["Pipeline", "Freshness", "Operations"], signal: "Operational freshness and analytical trust are tuned independently.", keyTakeaways: ["Fast UI signals and slower aggregate updates serve different purposes.", "Freshness labels are about sync recency, not recomputed medians.", "Pipeline status is public on the dashboard."] },
  { id: 4, title: "Why Low-Supply Districts Price Differently", excerpt: "Low supply does not always mean weak opportunity when buyer urgency stays high.", content: "Outside the Colombo-centric market, fewer active listings mean each one carries more pricing power, and single outliers can distort the picture quickly. Cross-check any district read against national comparables before concluding a listing is cheap or expensive.", category: "Reading the Market", readTime: "5 min", publishedAt: "2026-04-03", tags: ["Districts", "Demand", "Supply"], signal: "Scarcity effects are stronger when trusted listings are thin on the ground.", keyTakeaways: ["Low volume can still support firm pricing.", "Small-sample outliers distort district narratives quickly.", "Cross-district benchmarks prevent false confidence."] },
  { id: 5, title: "What Actually Moves Premium Resale Prices", excerpt: "Mileage and maintenance records matter more than year-only logic in higher-ticket segments.", content: "In premium categories, buyers pay for verifiable condition: service records, accident history, and consistent mileage. Two same-year sedans can sit millions of rupees apart on those factors alone, so compare within condition tiers.", category: "Reading the Market", readTime: "5 min", publishedAt: "2026-03-29", tags: ["Sedan", "Resale", "Premium"], signal: "Maintenance transparency acts as a pricing multiplier in premium segments.", keyTakeaways: ["Year alone is a weak premium signal.", "Records and seller transparency move price faster than cosmetic polish.", "Condition-adjusted comp sets are mandatory in the segment."] },
  { id: 6, title: "From Saved Listings to Decision: A 15-Minute Buyer Routine", excerpt: "A short workflow that turns browsing into a tighter shortlist.", content: "Start with a broad saved list, remove stale and incomplete listings, then rank what remains by deal-score confidence, district convenience, and comparable depth.", category: "Buying Guides", readTime: "3 min", publishedAt: "2026-03-24", tags: ["Saved Listings", "Workflow", "Shortlist"], signal: "Decision speed improves when noise is removed first, not analyzed longer.", keyTakeaways: ["Shortlisting is more valuable than over-reading weak candidates.", "Freshness and metadata completeness should eliminate entries early.", "Confidence beats volume when it is time to contact sellers."] },
];

const CATEGORIES = ["All", "Reading the Market", "Buying Guides", "Platform Notes"] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-LK", { day: "2-digit", month: "short", year: "numeric" });
}

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
    let cat: BlogPost["category"] = decisionMode === "value" ? "Buying Guides" : "Reading the Market";
    if (riskTolerance <= 30) cat = "Buying Guides";
    if (riskTolerance >= 75) cat = "Reading the Market";
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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04,
        delayChildren: 0.05
      }
    }
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 220,
        damping: 24
      }
    }
  } as const;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="min-h-screen relative overflow-hidden bg-background"
    >
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-10%] w-[450px] h-[450px] bg-primary/5 rounded-full blur-[110px] pointer-events-none" />

      {/* Header */}
      <motion.section variants={itemVariants} className="border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-md relative z-10">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-bright">Journal</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-tight leading-[1.05] text-white sm:text-[2.75rem] lg:text-[3rem]">Market briefings.</h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground font-medium">{filtered.length} editorial guides · For live market numbers, see the dashboard and Trends</p>

          {/* Search + categories */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/40">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search topics or tags" className="h-10 w-full bg-transparent text-sm text-white placeholder:text-zinc-400 outline-none" />
            </div>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                aria-pressed={c === category}
                  className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-all ${c === category ? "bg-primary/10 text-primary-bright border border-primary/20" : "text-muted-foreground hover:text-white border border-transparent"}`}
                >{c}</button>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10 space-y-8 relative z-10">
        {/* Featured */}
        {active && (
          <motion.article variants={itemVariants} className="grid gap-6 rounded-xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 lg:grid-cols-[1.3fr_0.7fr] backdrop-blur-md shadow-lg">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary-bright">{active.category}</span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium"><Clock3 className="h-3 w-3" /> {active.readTime}</span>
                <span className="text-[10px] text-muted-foreground font-medium">{formatDate(active.publishedAt)}</span>
              </div>
              <h2 className="mt-4 font-display text-xl font-bold tracking-tight text-white sm:text-2xl">{active.title}</h2>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground font-medium">{active.excerpt}</p>
              <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground/80 font-medium">{active.content}</p>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {active.tags.map((t) => (
                  <button key={t} type="button" onClick={() => setQuery(t)} className="rounded-md border border-white/5 bg-white/[0.01] px-2 py-0.5 text-[10px] font-bold text-muted-foreground hover:border-primary/25 hover:text-white transition-all">{t}</button>
                ))}
              </div>
              <p className="mt-5 text-[11px] text-muted-foreground font-medium">AutoLens Journal · editorial guide</p>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-white/5 bg-white/[0.01] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Signal</p>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground font-medium">{active.signal}</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/[0.01] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Takeaways</p>
                <ul className="mt-2 space-y-1.5">
                  {active.keyTakeaways.map((t) => (
                    <li key={t} className="flex gap-2 text-[11px] text-muted-foreground font-medium"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.article>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          {/* Decision lab + grid */}
          <div className="space-y-6">
            {/* Decision lab */}
            <motion.div variants={itemVariants} className="rounded-xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-sm font-bold tracking-tight text-white">Decision lab</h3>
                <span className="flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary-bright">
                  <Target className="h-3 w-3" /> {decisionBrief.timeline}
                </span>
              </div>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex gap-1.5">
                    {(["value", "balanced", "premium"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => setDecisionMode(m)}
                        className={`rounded-md border px-2.5 py-1 text-[10px] font-bold capitalize transition-all ${m === decisionMode ? "border-primary/20 bg-primary/10 text-primary-bright" : "border-white/5 bg-white/[0.01] text-muted-foreground hover:text-white"}`}
                      >{m}</button>
                    ))}
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                      <span className="flex items-center gap-1"><SlidersHorizontal className="h-3 w-3 text-primary" /> Risk</span>
                      <span className="num font-bold text-white">{riskTolerance}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={5} value={riskTolerance} onChange={(e) => setRiskTolerance(Number(e.target.value))} className="mt-1.5 w-full accent-primary" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                      <span>Timeline</span><span className="num font-bold text-white">{timelineDays}d</span>
                    </div>
                    <input type="range" min={3} max={45} value={timelineDays} onChange={(e) => setTimelineDays(Number(e.target.value))} className="mt-1.5 w-full accent-primary" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Recommended</p>
                  {guidedPosts.map((p) => (
                    <button key={p.id} type="button" onClick={() => setActivePostId(p.id)}
                      className="block w-full rounded-lg border border-white/5 bg-white/[0.01] p-3 text-left transition-all hover:border-primary/20 hover:bg-white/[0.03]"
                    >
                      <p className="text-[10px] font-bold text-muted-foreground">{p.category}</p>
                      <p className="mt-1 text-[12px] font-bold text-white truncate">{p.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Grid */}
            <motion.div variants={itemVariants}>
              <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">All signals · {filtered.length}</h3>
              {filtered.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {filtered.map((p) => (
                    <button key={p.id} type="button" onClick={() => setActivePostId(p.id)}
                      className={`rounded-xl border p-4 text-left transition-all ${active?.id === p.id ? "border-primary/30 bg-primary/10" : "border-white/5 bg-white/[0.01] hover:border-primary/25 hover:bg-white/[0.03]"}`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                        <span className={active?.id === p.id ? "text-primary font-bold" : ""}>{p.category}</span>
                        <span>{p.readTime}</span>
                      </div>
                      <p className="mt-2 text-[13px] font-bold text-white leading-snug">{p.title}</p>
                      <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-2">{p.excerpt}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 py-12 text-center">
                  <p className="text-[12px] text-muted-foreground font-medium">No signals match this filter.</p>
                  <button type="button" onClick={() => { setQuery(""); setCategory("All"); }} className="mt-2 text-[11px] font-bold text-primary-bright hover:underline">Clear filters</button>
                </div>
              )}
            </motion.div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4 self-start xl:sticky xl:top-20">
            <motion.div variants={itemVariants} className="rounded-xl border border-white/5 bg-white/[0.01] p-4 backdrop-blur-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Topic signals</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {topicSignals.map(([t, c]) => (
                  <button key={t} type="button" onClick={() => setQuery(t)} className="flex items-center gap-1 rounded-md border border-white/5 bg-white/[0.01] px-2.5 py-1 text-[10px] font-bold text-muted-foreground hover:border-primary/25 hover:text-white transition-all hover:bg-white/[0.03]">
                    {t} <span className="num text-primary font-bold">{c}</span>
                  </button>
                ))}
              </div>
            </motion.div>
            <motion.div variants={itemVariants} className="rounded-xl border border-white/5 bg-white/[0.01] p-4 space-y-2 backdrop-blur-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Quick links</p>
              <Link to="/" className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.01] px-3 py-2.5 text-[12px] font-bold text-white no-underline transition-all hover:border-primary/20 hover:bg-white/[0.03]">
                Dashboard <TrendingUp className="h-3 w-3 text-primary" />
              </Link>
              <Link to="/best-picks" className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.01] px-3 py-2.5 text-[12px] font-bold text-white no-underline transition-all hover:border-primary/20 hover:bg-white/[0.03]">
                Best picks <BarChart3 className="h-3 w-3 text-primary" />
              </Link>
            </motion.div>
          </aside>
        </div>
      </div>
    </motion.div>
  );
}
