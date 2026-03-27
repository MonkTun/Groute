export default function SocialLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
      <div className="mb-4 h-7 w-20 animate-pulse rounded bg-muted" />
      <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex-1 rounded-md py-2">
            <div className="mx-auto h-4 w-16 animate-pulse rounded bg-muted-foreground/10" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
