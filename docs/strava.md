# Strava Integration

## Configuration

- OAuth scopes requested: `read,activity:read`
- Redirect URI: `{APP_URL}/api/strava/callback`
- Rate limits: 200 requests per 15 minutes, 2,000 requests per day
- Access tokens expire every 6 hours — always check `strava_token_expires_at` before making API calls and refresh if needed using the stored `strava_refresh_token`

## OAuth Flow

Strava login is NOT a primary auth method — it's an optional profile enhancement. User must already be authenticated via Supabase Auth (email/password or social login).

Flow: user taps "Connect Strava" on profile → `GET /api/strava/authorize` returns the Strava OAuth URL → redirect to Strava auth page → Strava redirects to `GET /api/strava/callback` → exchange code for tokens → store tokens in `users` table → trigger initial activity sync + AI verification in background.

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/strava/authorize` | GET | Returns Strava OAuth URL for the authenticated user |
| `/api/strava/callback` | GET | Handles OAuth redirect, stores tokens, triggers sync |
| `/api/strava/webhook` | GET | Webhook subscription validation |
| `/api/strava/webhook` | POST | Receives activity create/update/delete events from Strava |
| `/api/strava/sync` | GET | Returns current verification results per sport |
| `/api/strava/sync` | POST | Triggers a re-sync of activities + AI re-verification |
| `/api/strava/disconnect` | POST | Clears all Strava data and tokens |

## Sync Strategy

1. **Initial sync (on connect):** Fetch last 24 months of activities from `GET /api/v3/athlete/activities`. Paginate with `per_page=100`. Store in `strava_activities` table. Run AI-powered skill verification per sport and update `user_sports`.
2. **Ongoing sync:** Register a Strava webhook (`POST /api/v3/push_subscriptions`). Strava sends POST to `/api/strava/webhook` on new activities. Fetch the new activity, insert into `strava_activities`, recompute verification.
3. **Token refresh:** Before any Strava API call, check if `strava_token_expires_at < now()`. If expired, call `POST https://www.strava.com/oauth/token` with `grant_type=refresh_token`. Store the new access token, refresh token, and expiry. Always store the latest refresh token — old ones are invalidated.
4. **Caching:** All Strava data is cached in the `strava_activities` table. Computed skill stats are cached in `user_sports.strava_stats` (jsonb) and optionally in Redis with a 24-hour TTL (gracefully degrades if Redis is unavailable). The Strava API is **never** called on user-facing request paths.

## Sport Type Mapping

Strava activity types are mapped to app sport types:

| Strava Type | App Sport Type |
|-------------|---------------|
| Hike, Hiking, VirtualHike | hiking |
| TrailRun, Trail_Run | trail_running |
| Run, VirtualRun | running |
| Ride, VirtualRide, MountainBikeRide, GravelRide, EBikeRide, Velodrome, Handcycle | cycling |

Unmapped activity types are skipped during sync.

## AI-Powered Skill Verification

Instead of rigid threshold rules, we use Claude AI to holistically analyze a user's Strava activity data and determine their experience level per sport.

### How It Works

1. **Summarize:** Raw activities are compressed into a structured summary — total count, date range, frequency, weekly consistency streaks, distance/elevation/duration stats, progression trends, and most impressive activity.
2. **Analyze:** The summary is sent to Claude Haiku with a system prompt that instructs it to evaluate holistically: consistency, volume, progression, intensity, and recency.
3. **Output:** Claude returns a structured JSON response:
   ```json
   {
     "level": "beginner" | "intermediate" | "advanced" | "expert",
     "confidence": "low" | "medium" | "high",
     "reasoning": "Third-person summary highlighting accomplishments",
     "highlights": ["key achievement 1", "key achievement 2"]
   }
   ```
4. **Store:** The result is saved to `user_sports.strava_verified_level` and `user_sports.strava_stats` (jsonb).
5. **Fallback:** If the AI call fails, a simple threshold-based calculation is used instead.

### Verification Levels

- **Beginner** — Getting started, fewer activities or shorter distances
- **Intermediate** — Building a solid habit, regular outings with moderate distances
- **Advanced** — Strong and consistent, long distances with significant elevation
- **Expert** — Exceptionally dedicated, very high volume over a year or more (only available via Strava verification, not self-reported)

Verification is a trust signal displayed on profiles (a clickable badge with AI reasoning), not a gatekeeper. Users can always self-report and participate in activities regardless of verification status.

### Key Files

| File | Purpose |
|------|---------|
| `apps/web/lib/strava.ts` | Strava API client — OAuth, token refresh, activity fetching, sync |
| `apps/web/lib/strava-verification.ts` | AI verification — activity summarization, Claude prompt, caching |
| `apps/web/lib/redis.ts` | Optional Redis client for caching (null-safe) |
| `apps/web/lib/ai.ts` | AI provider abstraction (Claude Haiku / Gemini) |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STRAVA_CLIENT_ID` | Yes | From Strava API settings |
| `STRAVA_CLIENT_SECRET` | Yes | From Strava API settings (server-side only) |
| `NEXT_PUBLIC_STRAVA_REDIRECT_URI` | Yes | OAuth callback URL |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Yes | Secret for webhook subscription validation |
| `ANTHROPIC_API_KEY` | Yes | For AI-powered verification |
| `UPSTASH_REDIS_REST_URL` | No | Redis cache (optional, degrades gracefully) |
| `UPSTASH_REDIS_REST_TOKEN` | No | Redis cache (optional) |

## Error Handling

- 401 (token expired): refresh using stored `strava_refresh_token`, then retry. If refresh fails (user revoked access), mark `strava_connected = false`.
- 429 (rate limited): throw error, log warning. The sync can be retried later.
- Network errors: fail gracefully — show profiles without verification badges.
- AI failure: fall back to threshold-based verification, log error.
- Redis unavailable: skip caching, fall through to DB queries. Never let Redis break the flow.
- Strava down: never let it break the core experience.
