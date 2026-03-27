# Strava Integration

## Configuration

- OAuth scopes requested: `read,activity:read`
- Redirect URI: `{APP_URL}/api/strava/callback`
- Rate limits: 200 requests per 15 minutes, 2,000 requests per day
- Access tokens expire every 6 hours — always check `strava_token_expires_at` before making API calls and refresh if needed using the stored `strava_refresh_token`

## OAuth Flow

Strava login is NOT a primary auth method — it's an optional profile enhancement. User must already be authenticated via Supabase Auth (email/password or social login).

Flow: user taps "Connect Strava" -> redirect to Strava auth page -> Strava redirects to `/api/strava/callback` -> exchange code for tokens -> store tokens in `users` table -> trigger initial activity sync.

## Sync Strategy

1. **Initial sync (on connect):** Fetch last 6 months of activities from `GET /api/v3/athlete/activities`. Paginate with `per_page=100`. Store in `strava_activities` table. Compute `strava_verified_level` per sport and update `user_sports`.
2. **Ongoing sync:** Register a Strava webhook (`POST /api/v3/push_subscriptions`). Strava sends POST to `/api/strava/webhook` on new activities. Fetch the new activity, insert into `strava_activities`, recompute verification.
3. **Token refresh:** Before any Strava API call, check if `strava_token_expires_at < now()`. If expired, call `POST https://www.strava.com/oauth/token` with `grant_type=refresh_token`. Store the new access token, refresh token, and expiry. Always store the latest refresh token — old ones are invalidated.
4. **Caching:** All Strava data is cached in the `strava_activities` table. Computed skill stats are cached in `user_sports.strava_stats` (jsonb) and in Redis with a 24-hour TTL. The Strava API is **never** called on user-facing request paths.

## Skill Verification Logic

Thresholds are sport-specific. Example for trail running:

| Level | Criteria |
|-------|----------|
| Beginner | < 10 activities OR avg distance < 5km |
| Intermediate | 10-50 activities, avg distance 5-15km, some elevation |
| Advanced | 50+ activities, avg distance 10-25km, significant elevation |
| Expert | 100+ activities, avg distance > 20km, high elevation gain |

Verification is a trust signal displayed on profiles (a badge), not a gatekeeper. Users can always self-report and participate in activities regardless of verification status.

## Error Handling

- 401 (token expired): refresh using stored `strava_refresh_token`, then retry
- 429 (rate limited): back off and retry with exponential delay
- Network errors: fail gracefully — show profiles without verification badges
- Strava down: never let it break the core experience
