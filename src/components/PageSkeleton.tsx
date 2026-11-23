import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div
      data-testid="page-skeleton"
      aria-busy="true"
      aria-label="Loading page"
      className="space-y-6 py-2 animate-in fade-in-50 duration-200"
    >
      {/* Title & header action skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-44 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Metric/card stats skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>

      {/* Main card/table list skeleton */}
      <div className="space-y-3 rounded-xl border p-4 bg-card">
        <Skeleton className="h-6 w-1/3 rounded-md" />
        <div className="space-y-2 pt-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
