import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FilterState } from "@/types/car";
import { getMakes, getModels } from "@/services/api";
import { SRI_LANKA_DISTRICTS } from "@/data/districts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const ALL = "__all";
const MIN_PRICE = 500_000;
const MAX_PRICE = 100_000_000;

const PRICE_PRESETS: { label: string; min: number; max: number }[] = [
  { label: "Under 3M", min: MIN_PRICE, max: 3_000_000 },
  { label: "3M–6M", min: 3_000_000, max: 6_000_000 },
  { label: "6M–10M", min: 6_000_000, max: 10_000_000 },
  { label: "10M+", min: 10_000_000, max: MAX_PRICE },
];

const QUICK_MAKES = ["Toyota", "Suzuki", "Honda", "Nissan"];

function PillBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
        active
          ? "border-primary/35 bg-primary/[0.12] text-primary"
          : "border-white/10 bg-foreground/[0.03] text-muted-foreground hover:border-white/20 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function FilterSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 border-t border-border pt-4 first:border-0 first:pt-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

export interface MobileFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function MobileFilterSheet({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
}: MobileFilterSheetProps) {
  const [makes, setMakes] = useState<{ make: string; count: number }[]>([]);
  const [modelsList, setModelsList] = useState<{ model: string; count: number }[]>([]);

  const [localMake, setLocalMake] = useState(filters.make || "");
  const [localModel, setLocalModel] = useState(filters.model || "");
  const [localPriceMin, setLocalPriceMin] = useState(
    filters.price_min ? String(filters.price_min) : "",
  );
  const [localPriceMax, setLocalPriceMax] = useState(
    filters.price_max ? String(filters.price_max) : "",
  );
  const [localDistrict, setLocalDistrict] = useState(filters.district || "");

  useEffect(() => {
    getMakes().then(setMakes).catch(() => setMakes([]));
  }, []);

  useEffect(() => {
    if (localMake) {
      getModels(localMake)
        .then(setModelsList)
        .catch(() => setModelsList([]));
    } else {
      setModelsList([]);
    }
  }, [localMake]);

  useEffect(() => {
    if (!open) return;
    setLocalMake(filters.make || "");
    setLocalModel(filters.model || "");
    setLocalPriceMin(filters.price_min ? String(filters.price_min) : "");
    setLocalPriceMax(filters.price_max ? String(filters.price_max) : "");
    setLocalDistrict(filters.district || "");
  }, [open, filters]);

  const activeCount = useMemo(
    () =>
      [
        filters.make,
        filters.model,
        filters.price_min ?? filters.price_max,
        filters.district,
      ].filter(Boolean).length,
    [filters],
  );

  function parsePriceInput(value: string): number | undefined {
    const n = Number(value.replace(/[^\d]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  const handleApply = useCallback(() => {
    startTransition(() => {
      onFiltersChange({
        ...filters,
        make: localMake || undefined,
        model: localModel || undefined,
        price_min: parsePriceInput(localPriceMin),
        price_max: parsePriceInput(localPriceMax),
        district: localDistrict || undefined,
        page: 1,
      });
    });
    onOpenChange(false);
  }, [
    filters,
    localDistrict,
    localMake,
    localModel,
    localPriceMax,
    localPriceMin,
    onFiltersChange,
    onOpenChange,
  ]);

  const handleClear = useCallback(() => {
    setLocalMake("");
    setLocalModel("");
    setLocalPriceMin("");
    setLocalPriceMax("");
    setLocalDistrict("");
    startTransition(() => {
      onFiltersChange({
        ...filters,
        make: undefined,
        model: undefined,
        price_min: undefined,
        price_max: undefined,
        district: undefined,
        page: 1,
      });
    });
    onOpenChange(false);
  }, [filters, onFiltersChange, onOpenChange]);

  const isPriceHidden = filters.price_availability === "unavailable";

  const selectTriggerClass =
    "h-9 rounded-lg border-border bg-foreground/[0.03] text-sm text-foreground";
  const selectContentClass =
    "max-h-64 border-border bg-popover text-foreground";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-0 text-foreground"
      >
        <SheetHeader className="border-b border-border px-5 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              Quick Filters
              {activeCount > 0 && (
                <span
                  aria-label={`${activeCount} active filters`}
                  className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white"
                >
                  {activeCount}
                </span>
              )}
            </SheetTitle>
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear all filters"
            >
              Clear all
            </button>
          </div>
        </SheetHeader>

        <div className="space-y-4 px-5 py-5">
          {/* Make */}
          <FilterSection label="Make">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick make selection">
              {QUICK_MAKES.map((make) => (
                <PillBtn
                  key={make}
                  active={localMake === make}
                  onClick={() => {
                    const next = localMake === make ? "" : make;
                    setLocalMake(next);
                    setLocalModel("");
                  }}
                >
                  {make}
                </PillBtn>
              ))}
            </div>
            <Select
              value={localMake || ALL}
              onValueChange={(v) => {
                setLocalMake(v === ALL ? "" : v);
                setLocalModel("");
              }}
            >
              <SelectTrigger className={selectTriggerClass} aria-label="Select make">
                <SelectValue placeholder="All makes" />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                <SelectItem value={ALL}>All makes</SelectItem>
                {makes.map((m) => (
                  <SelectItem key={m.make} value={m.make}>
                    {m.make} ({m.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterSection>

          {/* Model — shown only when a make is selected and models are available */}
          {localMake && modelsList.length > 0 && (
            <FilterSection label="Model">
              <Select
                value={localModel || ALL}
                onValueChange={(v) => setLocalModel(v === ALL ? "" : v)}
              >
                <SelectTrigger className={selectTriggerClass} aria-label="Select model">
                  <SelectValue placeholder="All models" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value={ALL}>All models</SelectItem>
                  {modelsList.map((m) => (
                    <SelectItem key={m.model} value={m.model}>
                      {m.model} ({m.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterSection>
          )}

          {/* Price — hidden in price-unavailable mode */}
          {!isPriceHidden && (
            <FilterSection label="Price range">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Price range presets">
                {PRICE_PRESETS.map((preset) => {
                  const isActive =
                    localPriceMin === String(preset.min) &&
                    localPriceMax === String(preset.max);
                  return (
                    <PillBtn
                      key={preset.label}
                      active={isActive}
                      onClick={() => {
                        if (isActive) {
                          setLocalPriceMin("");
                          setLocalPriceMax("");
                        } else {
                          setLocalPriceMin(String(preset.min));
                          setLocalPriceMax(String(preset.max));
                        }
                      }}
                    >
                      {preset.label}
                    </PillBtn>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={localPriceMin}
                  onChange={(e) =>
                    setLocalPriceMin(e.target.value.replace(/[^\d]/g, ""))
                  }
                  inputMode="numeric"
                  placeholder="Min LKR"
                  aria-label="Minimum price"
                  className="h-9 rounded-lg border-border bg-foreground/[0.03] text-sm text-foreground"
                />
                <Input
                  value={localPriceMax}
                  onChange={(e) =>
                    setLocalPriceMax(e.target.value.replace(/[^\d]/g, ""))
                  }
                  inputMode="numeric"
                  placeholder="Max LKR"
                  aria-label="Maximum price"
                  className="h-9 rounded-lg border-border bg-foreground/[0.03] text-sm text-foreground"
                />
              </div>
            </FilterSection>
          )}

          {/* District */}
          <FilterSection label="District">
            <Select
              value={localDistrict || ALL}
              onValueChange={(v) => setLocalDistrict(v === ALL ? "" : v)}
            >
              <SelectTrigger className={selectTriggerClass} aria-label="Select district">
                <SelectValue placeholder="All districts" />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                <SelectItem value={ALL}>All districts</SelectItem>
                {SRI_LANKA_DISTRICTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterSection>
        </div>

        {/* Action footer */}
        <div
          className="flex gap-3 border-t border-border px-5 py-4"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-xl border border-border py-3 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 rounded-xl bg-[var(--gold)] py-3 text-[13px] font-bold text-white transition-colors hover:bg-[var(--gold-bright)]"
          >
            Apply filters
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
