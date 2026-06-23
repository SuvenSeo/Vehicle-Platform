export function ListingCardSkeleton() {
  return (
    <div className="asset-surface relative block h-full rounded-xl">
      <div className="p-4 sm:p-5 flex flex-col space-y-4 sm:space-y-5">
        {/* Header badges */}
        <div className="flex items-start justify-between">
          <div className="flex gap-2">
            <div className="skeleton-shimmer h-5 w-16 rounded" />
            <div className="skeleton-shimmer h-5 w-14 rounded" />
          </div>
          <div className="skeleton-shimmer h-5 w-12 rounded" />
        </div>

        {/* Image placeholder */}
        <div className="skeleton-shimmer aspect-[16/10] rounded-lg" />

        {/* Title row */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="skeleton-shimmer h-5 w-3/5 rounded" />
            <div className="skeleton-shimmer h-4 w-10 rounded" />
          </div>
          {/* Spec grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="skeleton-shimmer h-3.5 rounded" />
            <div className="skeleton-shimmer h-3.5 rounded" />
            <div className="skeleton-shimmer h-3.5 rounded" />
            <div className="skeleton-shimmer h-3.5 rounded" />
            <div className="skeleton-shimmer h-3.5 rounded" />
            <div className="skeleton-shimmer h-3.5 rounded" />
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 flex items-center justify-between border-t border-border mt-auto">
          <div className="space-y-1.5">
            <div className="skeleton-shimmer h-3.5 w-24 rounded" />
            <div className="skeleton-shimmer h-3 w-20 rounded" />
          </div>
          <div className="skeleton-shimmer h-8 w-8 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
