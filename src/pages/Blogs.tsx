import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Clock3,
  Gauge,
  Newspaper,
  Search,
  SlidersHorizontal,
  Target,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PlatformPageHero } from "@/components/PlatformPageHero";
import { PageCanvas } from "@/components/PageCanvas";

type BlogPost = {
  id: number;
  title: string;
  excerpt: string;
  content: string;
  category: "Market Intel" | "Buying Guides" | "Data Stories" | "Platform Updates";
  readTime: string;
  publishedAt: string;
  author: string;
  coverGradient: string;
  tags: string[];
  signal: string;
  keyTakeaways: string[];
  metricLabel: string;
  metricValue: string;
  metricDelta: string;
};

const BLOG_POSTS: BlogPost[] = [
  {
    id: 1,
    title: "Q2 2026 Snapshot: Hybrid SUVs Keep Gaining Share in Colombo",
    excerpt: "Demand is holding because pricing has become smarter, not because buyers are blind to value.",
    content:
      "Hybrid SUVs now account for a larger share of premium listing activity in Colombo compared to the same period last year. The stronger signal is tighter pricing discipline rather than volume alone: asking prices are clustering closer to observed medians, which means buyers need sharper condition-adjusted comparisons to find real edge. Inventory depth still matters, especially when district-level supply thins out and superficially similar listings diverge on mileage, condition, and seller confidence.",
    category: "Market Intel",
    readTime: "5 min",
    publishedAt: "2026-04-16",
    author: "Ardeno Research",
    coverGradient: "from-amber-500/32 via-zinc-500/12 to-amber-300/12",
    tags: ["Hybrid", "SUV", "Colombo", "Pricing"],
    signal: "Hybrid SUV pricing is compressing toward smarter seller expectations.",
    keyTakeaways: [
      "Median spreads are tightening in Colombo.",
      "Condition-adjusted comps matter more than list volume alone.",
      "District supply gaps still create negotiation openings.",
    ],
    metricLabel: "Market Spread",
    metricValue: "4.8%",
    metricDelta: "Tighter vs last quarter",
  },
  {
    id: 2,
    title: "How to Validate a Fair Deal Score Before You Buy",
    excerpt: "A practical way to separate genuinely under-market listings from noisy scoring.",
    content:
      "A deal score only becomes trustworthy when three signals align: enough comparables, fresh listings, and a district context that is not distorted by tiny samples. When one of those weakens, the score becomes directional rather than decisive. Buyers should treat the score as the start of the conversation, not the final verdict, and pressure-test it against sample depth, seller quality, and the nearest comparable listings still active in-market.",
    category: "Buying Guides",
    readTime: "4 min",
    publishedAt: "2026-04-10",
    author: "Ardeno Editorial",
    coverGradient: "from-zinc-500/26 via-amber-500/16 to-amber-300/12",
    tags: ["Deal Score", "Checklist", "Negotiation"],
    signal: "Strong deal scores without sample depth should be treated with caution.",
    keyTakeaways: [
      "Check sample size before trusting the signal.",
      "Use freshness to avoid comparing against stale inventory.",
      "District context changes the confidence level.",
    ],
    metricLabel: "Score Confidence",
    metricValue: "3 checks",
    metricDelta: "Sample, freshness, district",
  },
  {
    id: 3,
    title: "Inside the Live Sync Pipeline: What Updates Every 45 Seconds",
    excerpt: "A look at how Ardeno separates fast operational freshness from heavier market analysis.",
    content:
      "The platform pipeline batches source updates, validates schema quality, then refreshes operational and analytical layers on different cadences. That split is intentional: near-real-time operational signals keep the dashboard responsive, while broader aggregates refresh more carefully to preserve statistical quality. Understanding this refresh model helps users read freshness indicators correctly and distinguish live feed changes from slower-moving market conclusions.",
    category: "Platform Updates",
    readTime: "6 min",
    publishedAt: "2026-04-07",
    author: "Ardeno Engineering",
    coverGradient: "from-zinc-500/25 via-amber-500/15 to-amber-300/12",
    tags: ["Pipeline", "Freshness", "Operations"],
    signal: "Operational freshness and analytical trust are being tuned independently.",
    keyTakeaways: [
      "Fast UI signals and slower aggregate updates serve different purposes.",
      "Freshness labels should not be read as full-market recalculations.",
      "Operational transparency improves trust in the data layer.",
    ],
    metricLabel: "Sync Cadence",
    metricValue: "45s",
    metricDelta: "Operational refresh cycle",
  },
  {
    id: 4,
    title: "District Demand Heat: Why Northern Supply Behaves Differently",
    excerpt: "Low supply does not always mean weak opportunity when buyer urgency stays high.",
    content:
      "Northern district activity shows a different relationship between listing concentration and price movement than Colombo-heavy markets. Supply can stay thin, but trusted listings still attract strong pricing when buyers do not have many comparable alternatives. The correct reading is not simply 'low volume', but whether price movement is being driven by genuine scarcity or by noisy, small-sample outliers. Cross-district median comparisons are essential here.",
    category: "Data Stories",
    readTime: "5 min",
    publishedAt: "2026-04-03",
    author: "Ardeno Data Team",
    coverGradient: "from-amber-500/28 via-orange-500/16 to-red-500/18",
    tags: ["Districts", "Demand", "Heatmap"],
    signal: "Scarcity effects are stronger when trusted listings are thin on the ground.",
    keyTakeaways: [
      "Low volume can still support firm pricing.",
      "Small-sample outliers distort district narratives quickly.",
      "Cross-district benchmarks prevent false confidence.",
    ],
    metricLabel: "District Signal",
    metricValue: "North +7%",
    metricDelta: "Relative urgency vs broader market",
  },
  {
    id: 5,
    title: "Luxury Sedan Resale in 2026: What Actually Moves Price",
    excerpt: "Mileage and records are now beating year-only logic in higher-ticket segments.",
    content:
      "In premium sedan categories, condition-adjusted pricing is increasingly dominant. Listings with verifiable maintenance history and clear photographic consistency are closing the gap between ask and market median faster than comparable year-only listings. Buyers in this segment should prioritize service transparency and seller quality signals because the market is increasingly rewarding documented care, not just model-year position.",
    category: "Market Intel",
    readTime: "7 min",
    publishedAt: "2026-03-29",
    author: "Ardeno Research",
    coverGradient: "from-slate-500/25 via-zinc-500/14 to-amber-500/18",
    tags: ["Sedan", "Resale", "Premium"],
    signal: "Maintenance transparency is turning into a pricing multiplier in premium segments.",
    keyTakeaways: [
      "Year alone is weakening as the primary premium signal.",
      "Records and seller transparency now move faster than cosmetic polish.",
      "Condition-adjusted comp sets are mandatory in the segment.",
    ],
    metricLabel: "Premium Bias",
    metricValue: "Maintenance-led",
    metricDelta: "Quality signal shift",
  },
  {
    id: 6,
    title: "From Saved Listings to Decision: A 15-Minute Buyer Routine",
    excerpt: "A short workflow that turns browsing into a tighter shortlist.",
    content:
      "Start with a broad saved list, remove stale and incomplete listings, then rank what remains by deal-score confidence, district convenience, and comparable depth. The point is to reduce emotional browsing and force a practical shortlist fast. Once that shortlist exists, buyers can spend time where it matters: verifying seller quality, history, and actual market position rather than endlessly comparing obvious non-contenders.",
    category: "Buying Guides",
    readTime: "3 min",
    publishedAt: "2026-03-24",
    author: "Ardeno Editorial",
    coverGradient: "from-amber-600/24 via-amber-500/18 to-amber-300/14",
    tags: ["Saved Listings", "Workflow", "Shortlist"],
    signal: "Decision speed improves when noise is removed first, not analyzed longer.",
    keyTakeaways: [
      "Shortlisting is more valuable than over-reading weak candidates.",
      "Freshness and metadata completeness should eliminate entries early.",
      "Confidence beats volume when it is time to contact sellers.",
    ],
    metricLabel: "Decision Loop",
    metricValue: "15 min",
    metricDelta: "From saved list to shortlist",
  },
];

const CATEGORIES = ["All", "Market Intel", "Buying Guides", "Data Stories", "Platform Updates"] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

function formatPublishDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-LK", { day: "2-digit", month: "short", year: "numeric" });
}

function parseReadMinutes(value: string): number {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export default function Blogs() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [activePostId, setActivePostId] = useState<number>(BLOG_POSTS[0].id);
  const [decisionMode, setDecisionMode] = useState<"value" | "balanced" | "premium">("balanced");
  const [riskTolerance, setRiskTolerance] = useState(45);
  const [timelineDays, setTimelineDays] = useState(14);

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();

    return BLOG_POSTS.filter((post) => {
      const categoryMatch = category === "All" || post.category === category;
      const queryMatch =
        !q ||
        post.title.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q) ||
        post.signal.toLowerCase().includes(q) ||
        post.tags.some((tag) => tag.toLowerCase().includes(q));

      return categoryMatch && queryMatch;
    });
  }, [category, query]);

  const activePost = useMemo(
    () => filteredPosts.find((post) => post.id === activePostId) || filteredPosts[0] || null,
    [activePostId, filteredPosts],
  );

  const topicSignals = useMemo(() => {
    const counts = new Map<string, number>();
    filteredPosts.forEach((post) => {
      post.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [filteredPosts]);

  const categoryMix = useMemo(() => {
    const counts = new Map<string, number>();
    filteredPosts.forEach((post) => counts.set(post.category, (counts.get(post.category) || 0) + 1));

    return CATEGORIES.filter((item) => item !== "All").map((item) => ({
      label: item,
      count: counts.get(item) || 0,
      ratio: filteredPosts.length ? ((counts.get(item) || 0) / filteredPosts.length) * 100 : 0,
    }));
  }, [filteredPosts]);

  const statCards = useMemo(() => {
    const avgRead =
      filteredPosts.length > 0
        ? (filteredPosts.reduce((total, post) => total + parseReadMinutes(post.readTime), 0) / filteredPosts.length).toFixed(1)
        : "0";

    return [
      {
        label: "Active Signals",
        value: filteredPosts.length.toString().padStart(2, "0"),
        detail: "Stories in the current grid",
        icon: Activity,
      },
      {
        label: "Avg Read",
        value: `${avgRead} min`,
        detail: "Tight, operator-friendly briefs",
        icon: Gauge,
      },
      {
        label: "Topic Density",
        value: topicSignals.length ? topicSignals[0][0] : "None",
        detail: topicSignals.length ? `${topicSignals[0][1]} mentions in current view` : "No tags matched the search",
        icon: TrendingUp,
      },
    ];
  }, [filteredPosts, topicSignals]);

  const decisionBrief = useMemo(() => {
    let primaryCategory: BlogPost["category"] =
      decisionMode === "value"
        ? "Buying Guides"
        : decisionMode === "premium"
          ? "Market Intel"
          : "Data Stories";

    if (riskTolerance <= 30) primaryCategory = "Buying Guides";
    if (riskTolerance >= 75) primaryCategory = "Market Intel";

    const timelineLabel =
      timelineDays <= 7
        ? "Immediate buy window"
        : timelineDays <= 21
          ? "Short watch window"
          : "Patient watch window";

    const modeLine =
      decisionMode === "value"
        ? "You are optimizing for negotiation edge and downside protection."
        : decisionMode === "premium"
          ? "You are optimizing for long-term quality and confidence in segment signals."
          : "You are balancing fair pricing, confidence, and availability.";

    const checklist = [
      riskTolerance <= 40 ? "Prioritize deeper comparable depth" : "Prioritize fast-moving market signals",
      timelineDays <= 14 ? "Keep only listings with complete metadata" : "Track district drift before shortlisting",
      primaryCategory === "Buying Guides" ? "Validate seller trust signals first" : "Benchmark district medians before contacting sellers",
    ];

    return { primaryCategory, timelineLabel, modeLine, checklist };
  }, [decisionMode, riskTolerance, timelineDays]);

  const guidedPosts = useMemo(() => {
    return filteredPosts
      .map((post) => {
        let score = 0;
        if (post.category === decisionBrief.primaryCategory) score += 3;
        if (decisionMode === "value" && post.tags.some((tag) => ["Checklist", "Negotiation", "Workflow"].includes(tag))) score += 2;
        if (decisionMode === "premium" && post.tags.some((tag) => ["Premium", "Resale", "Pricing"].includes(tag))) score += 2;
        if (timelineDays <= 14 && post.tags.some((tag) => ["Freshness", "Pipeline", "Deal Score"].includes(tag))) score += 1;
        score += Math.max(0, 10 - Math.abs(parseReadMinutes(post.readTime) - (riskTolerance >= 60 ? 6 : 4)));
        return { post, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.post);
  }, [decisionBrief.primaryCategory, decisionMode, filteredPosts, riskTolerance, timelineDays]);

  const secondaryCards = filteredPosts.filter((post) => post.id !== activePost?.id).slice(0, 4);

  const decisionModes: { key: "value" | "balanced" | "premium"; label: string }[] = [
    { key: "value", label: "Value-first" },
    { key: "balanced", label: "Balanced" },
    { key: "premium", label: "Premium" },
  ];

  return (
    <PageCanvas>
      <PlatformPageHero
        eyebrow="Ardeno signal grid"
        title="Market briefings."
        icon={Newspaper}
        metrics={statCards.map((card) => ({
          label: card.label,
          value: card.value,
        }))}
      >
        {/* Search + category filter rail */}
        <div className="data-card p-4 md:p-5">
          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <label className="flex items-center gap-3 rounded-[10px] border border-border bg-background/60 px-4 py-3 focus-within:border-amber-400/40">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
              <span className="sr-only">Search blog posts</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search topics, tags, or specific market angles"
                className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-600 outline-none"
                aria-label="Search blog posts"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
              {CATEGORIES.map((item) => {
                const active = item === category;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(item)}
                    className={`rounded-[10px] border px-3 py-2 tech-label font-bold transition-colors ${
                      active
                        ? "border-amber-400/45 bg-amber-500/15 text-amber-200"
                        : "border-border bg-card text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </PlatformPageHero>

      <section className="layout-shell space-y-10 py-10 md:py-14">
        {/* ===== Featured briefing ===================================== */}
        <div>
          <header className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="tech-label">Featured briefing</p>
              <h2 className="headline-display mt-2 text-2xl md:text-[1.75rem]">The signal in focus.</h2>
            </div>
            <span className="hidden ui-caption sm:inline">
              <span className="num text-zinc-300">{filteredPosts.length}</span> in current view
            </span>
          </header>

          {activePost ? (
            <article className="premium-surface p-5 md:p-7">
              <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
                {/* Lede column */}
                <div className="flex min-w-0 flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="status-chip border-amber-400/35 bg-amber-500/10 text-amber-200">
                      {activePost.category}
                    </span>
                    <span className="ui-caption">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                        {activePost.readTime} read
                      </span>
                      <span className="mx-2 text-zinc-700">/</span>
                      {formatPublishDate(activePost.publishedAt)}
                    </span>
                  </div>

                  <h3 className="headline-display mt-4 text-2xl leading-tight text-white md:text-4xl">
                    {activePost.title}
                  </h3>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 md:text-base">{activePost.excerpt}</p>

                  <p className="mt-6 text-sm leading-7 text-zinc-400">{activePost.content}</p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {activePost.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setQuery(tag)}
                        className="rounded-full border border-border bg-card px-3 py-1 tech-label text-zinc-400 transition-colors hover:border-amber-400/35 hover:text-zinc-100"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>

                  <p className="mt-5 text-xs font-medium text-zinc-500">
                    By <span className="text-zinc-300">{activePost.author}</span>
                  </p>
                </div>

                {/* Signal rail */}
                <aside className="flex min-w-0 flex-col gap-4">
                  <div className="data-card p-4">
                    <p className="field-label">{activePost.metricLabel}</p>
                    <p className="num mt-2 text-2xl font-semibold text-amber-400">{activePost.metricValue}</p>
                    <p className="mt-1 ui-caption">{activePost.metricDelta}</p>
                  </div>

                  <div className="data-card p-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                      <p className="field-label">Why it matters</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-300">{activePost.signal}</p>
                  </div>

                  <div className="data-card p-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                      <p className="field-label">Key takeaways</p>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {activePost.keyTakeaways.map((item) => (
                        <li
                          key={item}
                          className="flex gap-2.5 text-sm leading-6 text-zinc-300"
                        >
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </aside>
              </div>
            </article>
          ) : (
            <div className="console-empty">
              <p className="text-sm font-medium text-zinc-300">No signal cards match this filter yet.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("All");
                }}
                className="action-soft mt-4 h-9"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>

        {/* ===== Workspace: stack + sidebar =========================== */}
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            {/* --- Interactive buyer playbook --- */}
            <section className="premium-surface p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="tech-label">Decision lab</p>
                  <h3 className="headline-display mt-2 text-xl text-white md:text-2xl">Interactive buyer playbook</h3>
                </div>
                <span className="status-chip border-amber-400/35 bg-amber-500/10 text-amber-200">
                  <Target className="h-3.5 w-3.5" aria-hidden="true" />
                  {decisionBrief.timelineLabel}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-zinc-400">{decisionBrief.modeLine}</p>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                {/* Controls */}
                <div className="data-card space-y-5 p-4">
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Decision mode">
                    {decisionModes.map((option) => {
                      const active = decisionMode === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setDecisionMode(option.key)}
                          className={`rounded-full border px-3 py-1.5 tech-label font-bold transition-colors ${
                            active
                              ? "border-amber-400/45 bg-amber-500/15 text-amber-200"
                              : "border-border bg-background/40 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-5">
                    <div>
                      <div className="mb-2 flex items-center justify-between ui-caption text-zinc-400">
                        <label htmlFor="risk-appetite" className="inline-flex items-center gap-1.5">
                          <SlidersHorizontal className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                          Risk appetite
                        </label>
                        <span className="num font-semibold text-zinc-200">{riskTolerance}%</span>
                      </div>
                      <input
                        id="risk-appetite"
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={riskTolerance}
                        onChange={(event) => setRiskTolerance(Number(event.target.value))}
                        className="w-full accent-amber-400"
                      />
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between ui-caption text-zinc-400">
                        <label htmlFor="decision-timeline">Decision timeline</label>
                        <span className="num font-semibold text-zinc-200">{timelineDays} days</span>
                      </div>
                      <input
                        id="decision-timeline"
                        type="range"
                        min={3}
                        max={45}
                        step={1}
                        value={timelineDays}
                        onChange={(event) => setTimelineDays(Number(event.target.value))}
                        className="w-full accent-amber-400"
                      />
                    </div>
                  </div>

                  <div className="rounded-[10px] border border-border bg-background/40 p-3.5">
                    <p className="field-label">Priority category</p>
                    <p className="mt-2 text-sm font-semibold text-white">{decisionBrief.primaryCategory}</p>
                    <ul className="mt-3 space-y-2">
                      {decisionBrief.checklist.map((item) => (
                        <li key={item} className="flex gap-2.5 text-[12px] leading-5 text-zinc-300">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-400" aria-hidden="true" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Recommended reading stack */}
                <div className="data-card p-4">
                  <p className="field-label">Recommended reading stack</p>
                  <div className="mt-3 space-y-2.5">
                    {guidedPosts.length ? (
                      guidedPosts.map((post) => (
                        <button
                          key={post.id}
                          type="button"
                          onClick={() => setActivePostId(post.id)}
                          className="block w-full rounded-[10px] border border-border bg-background/40 px-3 py-3 text-left transition-colors hover:border-amber-400/35"
                        >
                          <div className="flex items-center justify-between gap-3 tech-label text-zinc-500">
                            <span>{post.category}</span>
                            <span>{post.readTime}</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-snug text-white">{post.title}</p>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-500">No recommendations for this filter stack yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* --- Live research stack --- */}
            <section className="premium-surface p-5 md:p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="tech-label">Signal grid</p>
                  <h3 className="headline-display mt-2 text-xl text-white md:text-2xl">Browse the live research stack.</h3>
                </div>
                <p className="ui-caption">
                  <span className="num text-zinc-300">{filteredPosts.length}</span> stories in view
                </p>
              </div>

              {filteredPosts.length ? (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {filteredPosts.map((post) => {
                    const active = activePost?.id === post.id;
                    return (
                      <button
                        key={post.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setActivePostId(post.id)}
                        className={`rounded-[10px] border p-4 text-left transition-colors ${
                          active
                            ? "border-amber-400/40 bg-amber-500/[0.07]"
                            : "border-border bg-card hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 tech-label text-zinc-500">
                          <span className={active ? "text-amber-200" : undefined}>{post.category}</span>
                          <span>{post.readTime}</span>
                        </div>
                        <p className="mt-3 text-base font-semibold leading-snug text-white">{post.title}</p>
                        <p className="mt-2 text-sm leading-6 text-zinc-400">{post.excerpt}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {post.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-border px-2.5 py-1 tech-label text-zinc-500"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="console-empty mt-6">
                  <p className="text-sm font-medium text-zinc-300">Nothing in the stack matches your search.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setCategory("All");
                    }}
                    className="action-soft mt-4 h-9"
                  >
                    Clear search
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* --- Sidebar console --- */}
          <aside className="space-y-6 self-start xl:sticky xl:top-24">
            <div className="data-card p-5">
              <div className="flex items-center gap-2">
                <Gauge className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                <p className="tech-label">Topic signals</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {topicSignals.length ? (
                  topicSignals.map(([topic, count]) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => setQuery(topic)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3 py-1.5 tech-label text-zinc-400 transition-colors hover:border-amber-400/35 hover:text-zinc-100"
                    >
                      {topic}
                      <span className="num text-zinc-600">{count}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">No topic signals for the current query yet.</p>
                )}
              </div>
            </div>

            <div className="data-card p-5">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                <p className="tech-label">Category mix</p>
              </div>
              <div className="mt-4 space-y-3">
                {categoryMix.map((row) => (
                  <button
                    key={row.label}
                    type="button"
                    onClick={() => setCategory(row.label as CategoryFilter)}
                    className="block w-full rounded-[10px] border border-border bg-background/40 px-3 py-3 text-left transition-colors hover:border-white/20"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm font-semibold text-zinc-200">
                      <span>{row.label}</span>
                      <span className="num text-zinc-500">{row.count}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                      <span
                        className="block h-full rounded-full bg-amber-400"
                        style={{ width: `${Math.max(row.ratio, row.count > 0 ? 12 : 0)}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="data-card p-5">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                <p className="tech-label">Latest briefs</p>
              </div>
              <div className="mt-4 space-y-3">
                {secondaryCards.length ? (
                  secondaryCards.map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => setActivePostId(post.id)}
                      className="block w-full rounded-[10px] border border-border bg-background/40 px-3 py-3 text-left transition-colors hover:border-white/20"
                    >
                      <p className="tech-label text-zinc-500">{post.category}</p>
                      <p className="mt-2 text-sm font-semibold leading-snug text-white">{post.title}</p>
                      <div className="mt-3 flex items-center gap-3 ui-caption">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3 w-3" aria-hidden="true" />
                          {post.readTime}
                        </span>
                        <span>{formatPublishDate(post.publishedAt)}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">No other briefs in the current view.</p>
                )}
              </div>
            </div>

            <div className="data-card p-5">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                <p className="tech-label">Action layer</p>
              </div>
              <div className="mt-4 space-y-3">
                <Link
                  to="/"
                  className="flex items-center justify-between rounded-[10px] border border-border bg-background/40 px-4 py-3 text-sm font-semibold text-zinc-100 no-underline transition-colors hover:border-amber-400/35"
                >
                  Open dashboard
                  <TrendingUp className="h-4 w-4 text-amber-400" aria-hidden="true" />
                </Link>
                <Link
                  to="/best-picks"
                  className="flex items-center justify-between rounded-[10px] border border-border bg-background/40 px-4 py-3 text-sm font-semibold text-zinc-100 no-underline transition-colors hover:border-amber-400/35"
                >
                  Review best picks
                  <BarChart3 className="h-4 w-4 text-amber-400" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </PageCanvas>
  );
}
