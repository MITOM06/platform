export default function Loading() {
  return (
    <div className="flex flex-col gap-4 p-6 max-w-lg mx-auto animate-pulse">
      {/* Cover skeleton */}
      <div className="h-32 rounded-xl bg-muted" />
      {/* Avatar + name skeleton */}
      <div className="flex flex-col items-center gap-3 -mt-8">
        <div className="size-20 rounded-full bg-muted ring-4 ring-background" />
        <div className="h-5 w-40 rounded-md bg-muted" />
        <div className="h-3 w-24 rounded-md bg-muted" />
      </div>
      {/* Info rows skeleton */}
      <div className="space-y-3 mt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 items-center">
            <div className="size-4 rounded bg-muted shrink-0" />
            <div className="h-4 flex-1 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
