import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Scale, Share2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPriceLkrMillions } from "@/lib/formatting";
import { DealScoreBadge } from "@/components/DealScoreBadge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/** Min side-by-side columns in the tray need price vs FMV/km/year/district. */
export interface PinnedListing {
  id: number;
  make: string;
  model: string;
  year?: number | null;
  price_lkr?: number | null;
  fmv_lkr?: number | null;
  mileage_km?: number | null;
  district?: string | null;
  deal_score?: number | null;
}

export const COMPARE_TRAY_KEY = "motormila:compare-tray:v1";
export const MAX_PINNED = 3;
const CHANGE_EVENT = "motormila:compare-tray:change";

export function buildCompareLink(ids: number[]): string {
  const clean = ids.filter((n) => Number.isFinite(n) && n > 0).slice(0, MAX_PINNED);
  return clean.length ? `/compare?ids=${clean.join(",")}` : "/compare";
}

export function loadPinned(): PinnedListing[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(COMPARE_TRAY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is PinnedListing => typeof row === "object" && row !== null && Number.isFinite(Number((row as PinnedListing).id)))
      .map((row) => ({ ...row, id: Number(row.id) }))
      .slice(0, MAX_PINNED);
  } catch {
    return [];
  }
}

function persistPinned(rows: PinnedListing[]): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COMPARE_TRAY_KEY, JSON.stringify(rows));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // Privacy mode — tray simply doesn't persist.
  }
}

export function isPinned(id: number): boolean {
  return loadPinned().some((row) => row.id === id);
}

/** Pin or unpin. Returns { pinned, atCap } so callers can toast when full. */
export function togglePinned(listing: PinnedListing): { pinned: boolean; atCap: boolean } {
  const rows = loadPinned();
  if (rows.some((row) => row.id === listing.id)) {
    persistPinned(rows.filter((row) => row.id !== listing.id));
    return { pinned: false, atCap: false };
  }
  if (rows.length >= MAX_PINNED) return { pinned: false, atCap: true };
  persistPinned([...rows, listing]);
  return { pinned: true, atCap: false };
}

export function removePinned(id: number): void {
  persistPinned(loadPinned().filter((row) => row.id !== id));
}

export function clearPinned(): void {
  persistPinned([]);
}

export function useCompareTray() {
  const [pinned, setPinned] = useState<PinnedListing[]>(() => loadPinned());

  useEffect(() => {
    const refresh = () => setPinned(loadPinned());
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const toggle = useCallback((listing: PinnedListing) => {
    const result = togglePinned(listing);
    setPinned(loadPinned());
    return result;
  }, []);

  const remove = useCallback((id: number) => {
    removePinned(id);
    setPinned(loadPinned());
  }, []);

  const clear = useCallback(() => {
    clearPinned();
    setPinned(loadPinned());
  }, []);

  return { pinned, toggle, remove, clear, isPinned: (id: number) => pinned.some((r) => r.id === id) };
}

function fmtMoney(value: number | null | undefined): string {
  return value != null && Number.isFinite(Number(value)) && Number(value) > 0
    ? formatPriceLkrMillions(Number(value))
    : "—";
}

function fmtDelta(price: number | null | undefined, fmv: number | null | undefined): string {
  if (price == null || fmv == null || !Number.isFinite(Number(price)) || !Number(fmv)) return "—";
  const pct = ((Number(price) - Number(fmv)) / Number(fmv)) * 100;
  if (Math.abs(pct) < 0.5) return "at FMV";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/**
 * Floating compare tray + slide-over. Mount once in the app layout footer area:
 * @see MOUNT_SNIPPET below (App.tsx must stay untouched by TRACK C).
 */
export function CompareTray({ className }: { className?: string }) {
  const { pinned, remove, clear } = useCompareTray();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = buildCompareLink(pinned.map((p) => p.id));

  const copyLink = async () => {
    const url = `${window.location.origin}${link}`;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else throw new Error("no clipboard");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy compare link:", url);
    }
  };

  if (pinned.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-4 right-4 z-40 inline-flex h-11 items-center gap-2 rounded-full border border-primary/25 bg-card/95 px-4 text-[12px] font-bold text-foreground shadow-soft-xl backdrop-blur transition-all hover:border-primary/40 active:scale-[0.97]",
          className,
        )}
        aria-label={`Open compare tray, ${pinned.length} pinned`}
      >
        <Scale className="h-4 w-4 text-primary-bright" aria-hidden />
        Compare
        <span className="num rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] text-primary-bright">
          {pinned.length}/{MAX_PINNED}
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-5 pb-4 pt-5 text-left">
            <SheetTitle className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary-bright" aria-hidden />
              Compare tray
            </SheetTitle>
            <SheetDescription>
              Pin up to {MAX_PINNED}. Price vs FMV, km, year and district side-by-side.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
            <div className={cn("grid gap-3", pinned.length > 1 && "sm:grid-cols-2")}>
              {pinned.map((p) => (
                <div key={p.id} className="relative rounded-2xl border border-border bg-surface/50 p-3.5">
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    aria-label={`Remove ${p.make} ${p.model} from compare`}
                    className="absolute right-2 top-2 rounded p-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <p className="pr-6 font-display text-[14px] font-semibold text-foreground">
                    {p.make} {p.model}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{p.year ?? "—"}{p.district ? ` · ${p.district}` : ""}</p>
                  <div className="mt-2">
                    <DealScoreBadge score={p.deal_score} priceLkr={p.price_lkr} fmvLkr={p.fmv_lkr} />
                  </div>
                  <dl className="mt-3 space-y-1.5 border-t border-border/70 pt-2.5 text-[12px]">
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Price</dt><dd className="num font-semibold text-foreground">{fmtMoney(p.price_lkr)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">FMV</dt><dd className="num font-semibold text-foreground">{fmtMoney(p.fmv_lkr)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">vs FMV</dt><dd className="num font-semibold text-foreground">{fmtDelta(p.price_lkr, p.fmv_lkr)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Km</dt><dd className="num font-medium text-foreground">{p.mileage_km != null ? `${Number(p.mileage_km).toLocaleString()} km` : "—"}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Year</dt><dd className="num font-medium text-foreground">{p.year ?? "—"}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">District</dt><dd className="font-medium text-foreground">{p.district || "—"}</dd></div>
                  </dl>
                  <Link
                    to={`/listing/${p.id}`}
                    className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-border bg-card text-[11px] font-semibold text-foreground no-underline transition-colors hover:border-primary/30 hover:text-primary-bright"
                  >
                    Open listing <ArrowUpRight className="h-3 w-3" aria-hidden />
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-border px-5 py-4">
            <div className="flex gap-2">
              <Link
                to={link}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-[12px] font-bold text-primary-foreground no-underline transition-colors hover:bg-primary/90"
              >
                <Scale className="h-3.5 w-3.5" aria-hidden />
                Open full compare
              </Link>
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <Share2 className="h-3.5 w-3.5" aria-hidden />
                {copied ? "Copied!" : "Share"}
              </button>
            </div>
            <button
              type="button"
              onClick={clear}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Trash2 className="h-3 w-3" aria-hidden />
              Clear all ({pinned.length})
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
