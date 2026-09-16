export function ListingCardSkeleton() {
  return (
    <div className="liquid-panel vehicle-card relative block h-full overflow-hidden rounded-3xl">
      <div className="skeleton-shimmer aspect-[16/10]" />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="skeleton-shimmer h-5 w-3/5 rounded-full" />
          <div className="skeleton-shimmer h-4 w-10 rounded-full" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <div className="skeleton-shimmer h-6 w-20 rounded-full" />
          <div className="skeleton-shimmer h-6 w-16 rounded-full" />
          <div className="skeleton-shimmer h-6 w-14 rounded-full" />
        </div>
        <div className="skeleton-shimmer h-1.5 w-full rounded-full" />
        <div className="flex items-center justify-between border-t border-border pt-3.5">
          <div className="space-y-1.5">
            <div className="skeleton-shimmer h-3.5 w-24 rounded-full" />
            <div className="skeleton-shimmer h-3 w-20 rounded-full" />
          </div>
          <div className="skeleton-shimmer h-9 w-9 rounded-full" />
        </div>
      </div>
    </div>
  );
}
