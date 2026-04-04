import { Skeleton } from "@/components/ui/skeleton"

export function ChatSkeleton() {
  return (
    <div className="flex h-screen">
      {/* Sidebar skeleton */}
      <div className="w-52 border-r border-border p-3 space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-16" />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-7 w-full rounded-md" />
          ))}
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-7 w-full rounded-md" />
          ))}
        </div>
      </div>
      {/* Main area */}
      <div className="flex-1 flex flex-col">
        <div className="h-12 border-b border-border px-4 flex items-center gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-2.5">
              <Skeleton className="h-8 w-8 rounded-md shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-full max-w-[300px]" />
                <Skeleton className="h-3 w-full max-w-[200px]" />
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border px-4 py-3">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-5">
      <Skeleton className="h-5 w-24" />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border rounded-md p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-md p-4">
            <Skeleton className="h-3 w-20 mb-4" />
            <Skeleton className="h-32 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-card border border-border rounded-md divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-5 w-5 rounded-sm shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-3 w-10" />
        </div>
      ))}
    </div>
  )
}
