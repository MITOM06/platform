export default function Loading() {
  return (
    <div className="flex flex-col gap-4 p-6 max-w-4xl mx-auto animate-pulse">
      {/* Title skeleton */}
      <div className="h-7 w-48 rounded-md bg-muted" />
      <div className="h-4 w-72 rounded-md bg-muted" />
      {/* Table skeleton */}
      <div className="mt-4 rounded-xl border divide-y divide-border">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="size-9 rounded-full bg-muted shrink-0" />
            <div className="h-4 flex-1 rounded bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
