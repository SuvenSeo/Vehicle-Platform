import { memo, useMemo } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";

export interface TopMoverRow {
  id: string;
  model: string;
  listing_count: number;
  avg_price_lkr: number;
  movement_pct: number;
}

interface TopMoversTableProps {
  rows: TopMoverRow[];
}

const columns: Column<TopMoverRow>[] = [
  { key: "model", label: "Model", truncate: true, priority: "primary" },
  { key: "listing_count", label: "Listed", align: "right", format: { kind: "number", decimals: 0 }, priority: "primary" },
  {
    key: "avg_price_lkr",
    label: "Avg price",
    align: "right",
    format: { kind: "currency", currency: "LKR", decimals: 0 },
    priority: "primary",
  },
  {
    key: "movement_pct",
    label: "Trend",
    align: "right",
    format: { kind: "percent", decimals: 1, showSign: true, basis: "unit" },
    priority: "secondary",
  },
];

/**
 * TopMoversTable — Watermelon data-table block (#16 UI review) wired to
 * live trending-model aggregates. Sortable columns, currency/percent
 * formatting, and the block's responsive card layout on narrow screens.
 */
export const TopMoversTable = memo(function TopMoversTable({ rows }: TopMoversTableProps) {
  const data = useMemo(() => rows.slice(0, 8), [rows]);
  if (!data.length) return null;
  return (
    <div className="mt-10">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-display text-base font-semibold tracking-tight text-foreground">
          Top movers
        </h3>
        <p className="text-[11px] text-muted-foreground">Tap a column to sort</p>
      </div>
      <DataTable
        id="home-top-movers"
        columns={columns}
        data={data}
        rowIdKey="id"
        defaultSort={{ by: "listing_count", direction: "desc" }}
      />
    </div>
  );
});
