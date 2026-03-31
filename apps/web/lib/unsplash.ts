/**
 * Search Unsplash for a trail/nature photo matching the query.
 * Returns the regular-size URL of the first result, or null if none found.
 */
export async function fetchTrailImage(
  query: string
): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY ?? "";
  if (!key) {
    console.warn("UNSPLASH_ACCESS_KEY not set, skipping image fetch");
    return null;
  }

  // Use a simplified query for better results — trail name + "nature trail"
  const simplifiedQuery = query.split(" ").slice(0, 3).join(" ") + " nature trail";

  const params = new URLSearchParams({
    query: simplifiedQuery,
    per_page: "1",
    orientation: "landscape",
  });

  const res = await fetch(
    `https://api.unsplash.com/search/photos?${params}`,
    {
      headers: {
        Authorization: `Client-ID ${key}`,
      },
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!res.ok) return null;

  const data = await res.json();
  const photo = data.results?.[0];
  if (!photo) return null;

  return photo.urls?.regular ?? null;
}
