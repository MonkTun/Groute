export default function DiscoverLoading() {
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex shrink-0 items-center gap-2 px-4 py-2.5 sm:py-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-16 shrink-0 animate-pulse rounded-full bg-muted" />
        ))}
      </div>
      <div className="flex flex-1 items-center justify-center bg-muted/30">
        <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    </div>
  )
}
