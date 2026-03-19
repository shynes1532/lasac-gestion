interface SkeletonProps {
  className?: string
}

// Alias para compatibilidad con imports existentes
export function LoadingSkeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse bg-bg-tertiary rounded-lg ${className}`} />
}


export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-bg-tertiary rounded-lg ${className}`} />
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-4 w-48" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-24" />
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  )
}
