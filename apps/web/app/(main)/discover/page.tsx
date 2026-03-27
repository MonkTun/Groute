import { SPORT_LABELS } from '@groute/shared'

export default function DiscoverPage() {
  const sports = Object.values(SPORT_LABELS)

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Discover</h1>
      <p className="mt-2 text-muted-foreground">
        Find outdoor activities near you.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {sports.map((sport) => (
          <span
            key={sport}
            className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
          >
            {sport}
          </span>
        ))}
      </div>
      <p className="mt-12 text-sm text-muted-foreground">
        Map and activity feed coming soon.
      </p>
    </div>
  )
}
