import { Skeleton } from "@/components/ui/skeleton"

/**
 * Dashboard-specific loading skeleton.
 * Shows KPI card skeletons + activity feed skeleton.
 */
export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Page title */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* KPI cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-md border border-border p-4 space-y-2 glass-card">
            <Skeleton className="h-3 w-20 shimmer" />
            <Skeleton className="h-8 w-16 shimmer" />
            <Skeleton className="h-3 w-24 shimmer" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-md border border-border p-4 space-y-3 glass-card">
          <Skeleton className="h-4 w-32 shimmer" />
          <Skeleton className="h-40 w-full shimmer" />
        </div>
        <div className="rounded-md border border-border p-4 space-y-3 glass-card">
          <Skeleton className="h-4 w-32 shimmer" />
          <Skeleton className="h-40 w-full shimmer" />
        </div>
      </div>

      {/* Activity feed */}
      <div className="rounded-md border border-border p-4 space-y-4 glass-card">
        <Skeleton className="h-4 w-28 shimmer" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full shimmer" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-3/4 shimmer" />
              <Skeleton className="h-3 w-1/2 shimmer" />
            </div>
            <Skeleton className="h-3 w-16 shimmer" />
          </div>
        ))}
      </div>
    </div>
  )
}
