import { memo, startTransition, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { FilterState, Condition, BodyType, Transmission, FuelType, SortOption } from "@/types/car";
import { getListingSources, getMakes, getModels, formatPrice, type ListingSourceStat } from "@/services/api";
import { SRI_LANKA_DISTRICTS } from "@/data/mockListings";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlidersHorizontal, X } from "lucide-react";

interface FilterSidebarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

const ALL_OPTION = "__all";
const MIN_YEAR = 1990;
const MAX_YEAR = Math.max(2026, new Date().getFullYear());
const MIN_PRICE = 500_000;
const MAX_PRICE = 100_000_000;
const PRICE_STEP = 500_000;
const MAX_MILEAGE = 300_000;
const MILEAGE_STEP = 10_000;

const QUICK_MAKES = ["Toyota", "Suzuki", "Honda", "Nissan"];

const PRICE_PRESETS: Array<{ label: string; min: number; max: number }> = [
  { label: "Under 3M", min: MIN_PRICE, max: 3_000_000 },
  { label: "3M–6M", min: 3_000_000, max: 6_000_000 },
  { label: "6M–10M", min: 6_000_000, max: 10_000_000 },
  { label: "10M+", min: 10_000_000, max: MAX_PRICE },
];

const ALL_SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "deal_score", label: "Best deal" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "mileage_asc", label: "Low mileage" },
];

const UNAVAILABLE_PRICE_SORTS = new Set<SortOption>(["deal_score", "price_asc", "price_desc"]);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseOptionalInteger(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed.replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatMileage(value?: number) {
  if (!value) return "Any";
  return `${Math.round(value / 1000)}k km`;
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="border-t border-border pt-3 first:border-0 first:pt-0">
      <p className="tech-label mb-2 text-muted-foreground">{label}</p>
      {children}
    </section>
  );
}

function PillButton({
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
      className={`rounded-lg border px-2.5 py-1.5 text-caption font-medium transition-colors ${
        active
          ? "border-primary/35 bg-primary/12 text-primary"
          : "border-white/10 bg-foreground/[0.03] text-muted-foreground hover:border-white/20 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function selectTriggerClass() {
  return "h-9 rounded-lg border-border bg-foreground/[0.03] text-sm text-foreground";
}

function selectContentClass() {
  return "max-h-64 border-border bg-popover text-foreground";
}

function FilterContent({ filters, onFiltersChange }: FilterSidebarProps) {
  const [makes, setMakes] = useState<{ make: string; count: number }[]>([]);
  const [modelsList, setModelsList] = useState<{ model: string; count: number }[]>([]);
  const [sourceOptions, setSourceOptions] = useState<ListingSourceStat[]>([]);
  const [keywordInput, setKeywordInput] = useState(filters.q || "");
  const [modelSearchQuery, setModelSearchQuery] = useState("");

  const [yearRange, setYearRange] = useState<[number, number]>([
    filters.year_min ?? MIN_YEAR,
    filters.year_max ?? MAX_YEAR,
  ]);
  const [priceRange, setPriceRange] = useState<[number, number]>([
    filters.price_min ?? MIN_PRICE,
    filters.price_max ?? MAX_PRICE,
  ]);
  const [mileageValue, setMileageValue] = useState<number>(filters.mileage_max ?? MAX_MILEAGE);
  const [mileageInput, setMileageInput] = useState<string>(filters.mileage_max ? String(filters.mileage_max) : "");
  const [priceMinInput, setPriceMinInput] = useState<string>(filters.price_min ? String(filters.price_min) : "");
  const [priceMaxInput, setPriceMaxInput] = useState<string>(filters.price_max ? String(filters.price_max) : "");

  useEffect(() => {
    getMakes().then(setMakes).catch(() => setMakes([]));
  }, []);

  useEffect(() => {
    getListingSources()
      .then(setSourceOptions)
      .catch(() => setSourceOptions([]));
  }, []);

  useEffect(() => {
    if (filters.make) {
      getModels(filters.make).then(setModelsList).catch(() => setModelsList([]));
    } else {
      setModelsList([]);
    }
  }, [filters.make]);

  useEffect(() => {
    setModelSearchQuery("");
  }, [filters.make]);

  useEffect(() => {
    setKeywordInput(filters.q || "");
  }, [filters.q]);

  useEffect(() => {
    setYearRange([filters.year_min ?? MIN_YEAR, filters.year_max ?? MAX_YEAR]);
  }, [filters.year_min, filters.year_max]);

  useEffect(() => {
    setPriceRange([filters.price_min ?? MIN_PRICE, filters.price_max ?? MAX_PRICE]);
    setPriceMinInput(filters.price_min ? String(filters.price_min) : "");
    setPriceMaxInput(filters.price_max ? String(filters.price_max) : "");
  }, [filters.price_min, filters.price_max]);

  useEffect(() => {
    setMileageValue(filters.mileage_max ?? MAX_MILEAGE);
    setMileageInput(filters.mileage_max ? String(filters.mileage_max) : "");
  }, [filters.mileage_max]);

  const filteredModels = useMemo(() => {
    const query = modelSearchQuery.trim().toLowerCase();
    if (!query) return modelsList;
    return modelsList.filter((item) => item.model.toLowerCase().includes(query));
  }, [modelSearchQuery, modelsList]);

  const priceAvailability = filters.price_availability === "unavailable" ? "unavailable" : "priced";
  const sortOptions = useMemo(
    () =>
      priceAvailability === "unavailable"
        ? ALL_SORT_OPTIONS.filter((option) => !UNAVAILABLE_PRICE_SORTS.has(option.value))
        : ALL_SORT_OPTIONS,
    [priceAvailability],
  );

  const update = useCallback(
    (patch: Partial<FilterState>) => {
      startTransition(() => {
        onFiltersChange({ ...filters, ...patch, page: 1 });
      });
    },
    [filters, onFiltersChange],
  );

  const clear = useCallback(() => {
    startTransition(() => {
      onFiltersChange({ sort: "newest", page: 1 });
    });
  }, [onFiltersChange]);

  const setInventoryMode = useCallback(
    (mode: "priced" | "unavailable") => {
      const shouldUseUnavailable = mode === "unavailable";
      update({
        price_availability: shouldUseUnavailable ? "unavailable" : undefined,
        price_min: shouldUseUnavailable ? undefined : filters.price_min,
        price_max: shouldUseUnavailable ? undefined : filters.price_max,
        sort: shouldUseUnavailable && UNAVAILABLE_PRICE_SORTS.has(filters.sort) ? "newest" : filters.sort,
      });
    },
    [filters.price_max, filters.price_min, filters.sort, update],
  );

  const commitKeyword = useCallback(
    (nextKeyword = keywordInput) => {
      const normalized = nextKeyword.trim().split(/\s+/).join(" ");
      update({ q: normalized || undefined });
    },
    [keywordInput, update],
  );

  const commitPriceInputs = useCallback(
    (nextMinInput = priceMinInput, nextMaxInput = priceMaxInput) => {
      const parsedMin = parseOptionalInteger(nextMinInput);
      const parsedMax = parseOptionalInteger(nextMaxInput);

      const normalizedMin = parsedMin == null ? MIN_PRICE : clamp(parsedMin, MIN_PRICE, MAX_PRICE);
      const normalizedMax = parsedMax == null ? MAX_PRICE : clamp(parsedMax, MIN_PRICE, MAX_PRICE);

      const min = Math.min(normalizedMin, normalizedMax);
      const max = Math.max(normalizedMin, normalizedMax);

      setPriceRange([min, max]);
      update({
        price_min: parsedMin == null && min === MIN_PRICE ? undefined : min,
        price_max: parsedMax == null && max === MAX_PRICE ? undefined : max,
      });
    },
    [priceMaxInput, priceMinInput, update],
  );

  const commitMileageInput = useCallback(
    (nextMileageInput = mileageInput) => {
      const parsed = parseOptionalInteger(nextMileageInput);
      const normalized = parsed == null ? MAX_MILEAGE : clamp(parsed, 0, MAX_MILEAGE);

      setMileageValue(normalized);
      update({ mileage_max: parsed == null || normalized === MAX_MILEAGE ? undefined : normalized });
    },
    [mileageInput, update],
  );

  type ActiveChip = { key: string; label: string; onRemove: () => void };

  const activeChips = useMemo((): ActiveChip[] => {
    const chips: ActiveChip[] = [];

    if (filters.q) chips.push({ key: "q", label: filters.q, onRemove: () => update({ q: undefined }) });
    if (filters.make) chips.push({ key: "make", label: filters.make, onRemove: () => update({ make: undefined, model: undefined }) });
    if (filters.model) chips.push({ key: "model", label: filters.model, onRemove: () => update({ model: undefined }) });
    if (filters.district) chips.push({ key: "district", label: filters.district, onRemove: () => update({ district: undefined }) });
    if (filters.condition) {
      chips.push({
        key: "condition",
        label: filters.condition.replace(/_/g, " "),
        onRemove: () => update({ condition: undefined }),
      });
    }
    if (filters.body_type) chips.push({ key: "body", label: filters.body_type, onRemove: () => update({ body_type: undefined }) });
    if (filters.fuel_type) chips.push({ key: "fuel", label: filters.fuel_type, onRemove: () => update({ fuel_type: undefined }) });
    if (filters.transmission) {
      chips.push({ key: "trans", label: filters.transmission, onRemove: () => update({ transmission: undefined }) });
    }
    if (filters.source) chips.push({ key: "source", label: filters.source, onRemove: () => update({ source: undefined }) });
    if (priceAvailability === "unavailable") {
      chips.push({ key: "inv", label: "No price", onRemove: () => setInventoryMode("priced") });
    }
    if (filters.year_min || filters.year_max) {
      chips.push({
        key: "year",
        label: `${filters.year_min ?? MIN_YEAR}–${filters.year_max ?? MAX_YEAR}`,
        onRemove: () => update({ year_min: undefined, year_max: undefined }),
      });
    }
    if (filters.price_min || filters.price_max) {
      chips.push({
        key: "price",
        label: `${formatPrice(filters.price_min ?? MIN_PRICE)}–${formatPrice(filters.price_max ?? MAX_PRICE)}`,
        onRemove: () => update({ price_min: undefined, price_max: undefined }),
      });
    }
    if (filters.mileage_max) {
      chips.push({
        key: "mileage",
        label: `≤ ${formatMileage(filters.mileage_max)}`,
        onRemove: () => update({ mileage_max: undefined }),
      });
    }

    return chips;
  }, [filters, priceAvailability, setInventoryMode, update]);

  const sliderClass =
    "py-1 [&>span:first-child]:h-2 [&>span:first-child]:bg-secondary [&>span:first-child>span]:bg-gradient-to-r [&>span:first-child>span]:from-primary [&>span:first-child>span]:to-primary";

  return (
    <div className="space-y-3 px-3 py-3 text-sm">
      <div className="sticky top-0 z-10 space-y-3 rounded-xl border border-border bg-card/85 px-3.5 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Filters</p>
          {activeChips.length > 0 ? (
            <button
              type="button"
              onClick={clear}
              className="text-caption font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear all
            </button>
          ) : null}
        </div>

        {activeChips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onRemove}
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-caption text-primary"
              >
                <span className="truncate">{chip.label}</span>
                <X className="h-3 w-3 shrink-0 opacity-70" />
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex gap-1 rounded-lg border border-border bg-black/40 p-1">
          <button
            type="button"
            onClick={() => setInventoryMode("priced")}
            className={`flex-1 rounded-md px-2 py-1.5 text-caption font-medium transition-colors ${
              priceAvailability === "priced" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            With price
          </button>
          <button
            type="button"
            onClick={() => setInventoryMode("unavailable")}
            className={`flex-1 rounded-md px-2 py-1.5 text-caption font-medium transition-colors ${
              priceAvailability === "unavailable" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            No price
          </button>
        </div>
      </div>

      <FilterGroup label="Search">
        <Input
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          onBlur={() => commitKeyword()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitKeyword();
            }
          }}
          placeholder="Make, model, year…"
          aria-label="Search listings"
          className="h-9 rounded-lg border-border bg-foreground/[0.03] text-sm text-foreground"
        />
      </FilterGroup>

      <FilterGroup label="Make">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_MAKES.map((make) => (
            <PillButton key={make} active={filters.make === make} onClick={() => update({ make, model: undefined })}>
              {make}
            </PillButton>
          ))}
        </div>
        <Select
          value={filters.make || ALL_OPTION}
          onValueChange={(value) => update({ make: value === ALL_OPTION ? undefined : value, model: undefined })}
        >
          <SelectTrigger className={selectTriggerClass()}>
            <SelectValue placeholder="All makes" />
          </SelectTrigger>
          <SelectContent className={selectContentClass()}>
            <SelectItem value={ALL_OPTION}>All makes</SelectItem>
            {makes.map((make) => (
              <SelectItem key={make.make} value={make.make}>
                {make.make} ({make.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterGroup>

      {filters.make ? (
        <FilterGroup label="Model">
          <div className="space-y-2">
            {modelsList.length > 8 ? (
              <Input
                value={modelSearchQuery}
                onChange={(event) => setModelSearchQuery(event.target.value)}
                placeholder="Find model…"
                aria-label="Search model"
                className="h-9 rounded-lg border-border bg-foreground/[0.03] text-sm text-foreground"
              />
            ) : null}
            <Select value={filters.model || ALL_OPTION} onValueChange={(value) => update({ model: value === ALL_OPTION ? undefined : value })}>
              <SelectTrigger className={selectTriggerClass()}>
                <SelectValue placeholder="All models" />
              </SelectTrigger>
              <SelectContent className={selectContentClass()}>
                <SelectItem value={ALL_OPTION}>All models</SelectItem>
                {filteredModels.map((model) => (
                  <SelectItem key={model.model} value={model.model}>
                    {model.model} ({model.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FilterGroup>
      ) : null}

      <FilterGroup label="Price">
        {priceAvailability === "unavailable" ? (
          <p className="text-caption text-muted-foreground">Switch to &ldquo;With price&rdquo; to filter by budget.</p>
        ) : (
          <div className="space-y-2.5">
            <p className="text-caption font-medium text-foreground">
              {formatPrice(priceRange[0])} – {formatPrice(priceRange[1])}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRICE_PRESETS.map((preset) => {
                const active = priceRange[0] === preset.min && priceRange[1] === preset.max;
                return (
                  <PillButton
                    key={preset.label}
                    active={active}
                    onClick={() => {
                      setPriceRange([preset.min, preset.max]);
                      setPriceMinInput(String(preset.min));
                      setPriceMaxInput(String(preset.max));
                      update({
                        price_min: preset.min === MIN_PRICE ? undefined : preset.min,
                        price_max: preset.max === MAX_PRICE ? undefined : preset.max,
                      });
                    }}
                  >
                    {preset.label}
                  </PillButton>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={priceMinInput}
                onChange={(event) => setPriceMinInput(event.target.value.replace(/[^\d]/g, ""))}
                onBlur={() => commitPriceInputs()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitPriceInputs();
                  }
                }}
                inputMode="numeric"
                placeholder="Min LKR"
                aria-label="Minimum price"
                className="h-9 rounded-lg border-border bg-foreground/[0.03] text-sm text-foreground"
              />
              <Input
                value={priceMaxInput}
                onChange={(event) => setPriceMaxInput(event.target.value.replace(/[^\d]/g, ""))}
                onBlur={() => commitPriceInputs()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitPriceInputs();
                  }
                }}
                inputMode="numeric"
                placeholder="Max LKR"
                aria-label="Maximum price"
                className="h-9 rounded-lg border-border bg-foreground/[0.03] text-sm text-foreground"
              />
            </div>
            <Slider
              min={MIN_PRICE}
              max={MAX_PRICE}
              step={PRICE_STEP}
              value={priceRange}
              onValueChange={(value) => {
                const nextRange: [number, number] = [value[0] ?? MIN_PRICE, value[1] ?? MAX_PRICE];
                setPriceRange(nextRange);
                setPriceMinInput(String(nextRange[0]));
                setPriceMaxInput(String(nextRange[1]));
              }}
              onValueCommit={(value) =>
                update({
                  price_min: value[0] === MIN_PRICE ? undefined : value[0],
                  price_max: value[1] === MAX_PRICE ? undefined : value[1],
                })
              }
              className={sliderClass}
            />
          </div>
        )}
      </FilterGroup>

      <FilterGroup label="Year">
        <p className="mb-2 text-caption font-medium text-foreground">
          {yearRange[0]} – {yearRange[1]}
        </p>
        <Slider
          min={MIN_YEAR}
          max={MAX_YEAR}
          step={1}
          value={yearRange}
          onValueChange={(value) => setYearRange([value[0] ?? MIN_YEAR, value[1] ?? MAX_YEAR])}
          onValueCommit={(value) =>
            update({
              year_min: value[0] === MIN_YEAR ? undefined : value[0],
              year_max: value[1] === MAX_YEAR ? undefined : value[1],
            })
          }
          className={sliderClass}
        />
      </FilterGroup>

      <FilterGroup label="Fuel">
        <div className="flex flex-wrap gap-1.5">
          {[undefined, "petrol", "diesel", "hybrid", "electric"].map((value) => (
            <PillButton
              key={value ?? "all"}
              active={filters.fuel_type === value || (!filters.fuel_type && !value)}
              onClick={() => update({ fuel_type: value as FuelType | undefined })}
            >
              {value ? value.charAt(0).toUpperCase() + value.slice(1) : "All"}
            </PillButton>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Transmission">
        <div className="flex flex-wrap gap-1.5">
          {[undefined, "automatic", "manual", "cvt"].map((value) => (
            <PillButton
              key={value ?? "all"}
              active={filters.transmission === value || (!filters.transmission && !value)}
              onClick={() => update({ transmission: value as Transmission | undefined })}
            >
              {value ? value.charAt(0).toUpperCase() + value.slice(1) : "All"}
            </PillButton>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Condition">
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: undefined, label: "All" },
            { value: "brand_new", label: "New" },
            { value: "reconditioned", label: "Recon" },
            { value: "used", label: "Used" },
          ].map((option) => (
            <PillButton
              key={option.label}
              active={filters.condition === option.value}
              onClick={() => update({ condition: option.value as Condition | undefined })}
            >
              {option.label}
            </PillButton>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Body">
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: undefined, label: "All" },
            { value: "sedan", label: "Sedan" },
            { value: "suv", label: "SUV" },
            { value: "hatchback", label: "Hatch" },
            { value: "van", label: "Van" },
            { value: "pickup", label: "Pickup" },
            { value: "wagon", label: "Wagon" },
          ].map((option) => (
            <PillButton
              key={option.label}
              active={filters.body_type === option.value}
              onClick={() => update({ body_type: option.value as BodyType | undefined })}
            >
              {option.label}
            </PillButton>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Mileage">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Input
              value={mileageInput}
              onChange={(event) => setMileageInput(event.target.value.replace(/[^\d]/g, ""))}
              onBlur={() => commitMileageInput()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitMileageInput();
                }
              }}
              inputMode="numeric"
              placeholder="Max km"
              aria-label="Maximum mileage"
              className="h-9 flex-1 rounded-lg border-border bg-foreground/[0.03] text-sm text-foreground"
            />
            <span className="shrink-0 text-caption font-medium text-muted-foreground">{formatMileage(mileageValue)}</span>
          </div>
          <Slider
            min={0}
            max={MAX_MILEAGE}
            step={MILEAGE_STEP}
            value={[mileageValue]}
            onValueChange={(value) => {
              const nextMileage = value[0] ?? MAX_MILEAGE;
              setMileageValue(nextMileage);
              setMileageInput(String(nextMileage));
            }}
            onValueCommit={(value) => update({ mileage_max: value[0] === MAX_MILEAGE ? undefined : value[0] })}
            className={sliderClass}
          />
        </div>
      </FilterGroup>

      <FilterGroup label="District">
        <Select value={filters.district || ALL_OPTION} onValueChange={(value) => update({ district: value === ALL_OPTION ? undefined : value })}>
          <SelectTrigger className={selectTriggerClass()}>
            <SelectValue placeholder="All districts" />
          </SelectTrigger>
          <SelectContent className={selectContentClass()}>
            <SelectItem value={ALL_OPTION}>All districts</SelectItem>
            {SRI_LANKA_DISTRICTS.map((district) => (
              <SelectItem key={district} value={district}>
                {district}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterGroup>

      <FilterGroup label="Source">
        <Select value={filters.source || ALL_OPTION} onValueChange={(value) => update({ source: value === ALL_OPTION ? undefined : value })}>
          <SelectTrigger className={selectTriggerClass()}>
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent className={selectContentClass()}>
            <SelectItem value={ALL_OPTION}>All sources</SelectItem>
            {sourceOptions.map((source) => (
              <SelectItem key={source.source} value={source.source}>
                {source.label} ({source.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterGroup>

      <FilterGroup label="Sort">
        <Select value={filters.sort} onValueChange={(value) => update({ sort: value as SortOption })}>
          <SelectTrigger className={selectTriggerClass()}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={selectContentClass()}>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterGroup>
    </div>
  );
}

export const FilterSidebar = memo(function FilterSidebar({ filters, onFiltersChange }: FilterSidebarProps) {
  return (
    <>
      <aside className="surface surface--glass filter-command-rail hidden w-full max-h-[calc(100vh-7.5rem)] overflow-y-auto rounded-xl lg:block">
        <FilterContent filters={filters} onFiltersChange={onFiltersChange} />
      </aside>

      <div className="sticky bottom-4 z-40 mt-3 flex justify-end lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button size="sm" className="floating-control h-10 gap-2 rounded-full text-foreground hover:bg-foreground/[0.05]">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="command-surface w-[min(100vw-2rem,320px)] overflow-y-auto p-0">
            <SheetHeader className="px-4 pt-4 pb-0">
              <SheetTitle className="text-base text-foreground">Filters</SheetTitle>
            </SheetHeader>
            <FilterContent filters={filters} onFiltersChange={onFiltersChange} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
});

FilterSidebar.displayName = "FilterSidebar";
