export default function ProfileLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
      <div className="mb-4 sm:mb-6">
        <div className="h-7 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-foreground/10 p-4">
          <div className="mb-4 h-5 w-28 animate-pulse rounded bg-muted" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-foreground/10 p-4">
          <div className="mb-4 h-5 w-44 animate-pulse rounded bg-muted" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
