import { Skeleton } from "@/components/ui/skeleton"

/**
 * Default loading skeleton for app routes.
 * Only renders the main content area — the sidebar is already rendered by layout.tsx.
 */
export default function AppLoading() {
  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Page header */}
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />

      {/* Content cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-md border border-border p-4 space-y-3 glass-card">
            <Skeleton className="h-4 w-3/4 shimmer" />
            <Skeleton className="h-3 w-full shimmer" />
            <Skeleton className="h-3 w-5/6 shimmer" />
          </div>
        ))}
      </div>
    </div>
  )
}
