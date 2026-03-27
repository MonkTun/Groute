# Groute Roadmap — Discovery MVP

> Last updated: 2026-03-27
> Platform focus: **Web first** (Next.js). All APIs are REST endpoints consumed by both web and future Expo mobile app.

## Architecture Note — Mobile Migration

All business logic lives in Next.js API routes (`/api/*`). The web frontend is a thin client that calls these endpoints. When we build the Expo mobile app, it will call the **same API endpoints** — no backend changes needed. The shared package (`@groute/shared`) provides types, validators, and constants to both platforms. Mobile-specific work is purely UI: React Native screens, Expo Router navigation, `@rnmapbox/maps` instead of `mapbox-gl`, `AsyncStorage` instead of cookies.

---

## What's Built (Completed)

### Foundation & Auth
- Turborepo + pnpm monorepo, Next.js web, Expo mobile scaffold, shared package
- Supabase Auth (email/password), middleware route protection, session refresh
- Profile completion gate with cookie caching (avoids DB hit per request)

### Database Schema (Drizzle ORM + Supabase)
- `users` — profile fields, avatar_url, live location tracking (last_location_lat/lng/at)
- `user_sports` — per-sport skill levels
- `activities` — sport type, skill level, visibility (public/discoverable/private), banner_url, location, scheduling
- `activity_participants` — join requests with status
- `messages` — group chat (activity_id) + DMs (receiver_id), unified table
- `follows` — one-directional follow system, mutual = friends
- `notifications` — follow, invite, join_accepted, join_request types

### User Profiles
- Onboarding (3-step: basics → activities → extras), country + state/province selector
- Profile view + inline edit mode, profile picture upload (Supabase Storage)
- `UserAvatar` reusable component used everywhere (5 sizes, photo or initial fallback)
- Sign out from profile page

### Activity CRUD & Discovery
- Create activity modal: title, description, sport type, skill level, visibility, location picker (Mapbox geocoding + draggable pin), date/time, max participants, friend invite selector
- Activity feed sidebar with sport-colored badges, avatar stacks, distance from user
- Delete activity (owner only, with confirmation + cascade)
- Confetti on activity creation and join

### Map Experience (Phase A — Complete)
- Mapbox GL native GeoJSON clustering (GPU-rendered, smooth)
- Clusters: dark circles with orange ring, count label, sport emoji summary per cluster
- Individual pins: color-coded by difficulty (amber=beginner, blue=intermediate, red=advanced) with sport emoji
- Friend locations on map: profile photo pins with name labels, pulsing ring, 24h freshness filter
- User location tracking: auto-geolocate, pushes to server, sorts feed by distance
- Smart search bar: parses "easy hike this weekend" → sport + difficulty + timeframe filters
- Timeframe filter pills (Today/3d/Week/2 weeks/Month) + custom date picker
- Activity detail sheet: centered overlay with banner, 2x2 detail grid, host card, going list, join/request buttons

### Social System
- **Social tab** with 3 sub-tabs: Friends, Chats, Notifications
- **Friends**: mutual follows, incoming follow requests with "Follow Back"
- **Chats**: DM conversations + group chats (per-activity), profile photos on all messages
- **Notifications**: follow events, activity invites with Join/Decline buttons + confetti
- **Follow system**: follow/unfollow, auto-notification, invite friends when creating activities
- **DM chat**: 1:1 with profile photos, back navigation
- **Group chat**: message bubbles with sender avatars, system messages

### My Trips
- Upcoming/past sections, host/going/requested badges
- Pending join request management (accept/decline) inline
- Chat link + click-through to activity detail page

### Design System
- Teal/emerald primary + warm orange accent (OKLch with saturation)
- Brand logo, backdrop-blur nav with avatar in profile tab
- Sport-specific color coding across feed, detail sheet, map
- Cards with shadows, polished segmented tabs, loading skeletons on all routes
- `UserAvatar` component with photo/initial fallback used across entire app

### API Endpoints (27 routes)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/activities` | List + create activities |
| DELETE | `/api/activities/[id]` | Delete activity (owner) |
| POST | `/api/activities/[id]/join` | Join or request to join |
| PATCH | `/api/activities/[id]/participants/[id]` | Accept/decline participant |
| GET/POST | `/api/profile` | Get + update user profile |
| POST | `/api/avatar` | Upload profile picture |
| POST | `/api/location` | Update user's live location |
| GET | `/api/trips` | User's created + participating activities |
| GET/POST | `/api/messages/[activityId]` | Group chat messages |
| GET/POST | `/api/dm/[userId]` | Direct messages |
| POST/DELETE | `/api/follow` | Follow/unfollow |
| GET | `/api/friends` | Mutual follows list |
| GET/PATCH | `/api/notifications` | Fetch + mark read |
| POST | `/api/invites/[notificationId]` | Accept/decline invite |

---

## What's Next — Prioritized

### Phase B: Trip Cards & Cover Photos (NEXT UP)
> AllTrails-style cards — photo-forward, easy to scan

| # | Task | Status | Notes |
|---|------|--------|-------|
| B.1 | Cover photo upload for activities (Supabase Storage) | NOT STARTED | Reuse avatar upload pattern, store in `activities.banner_url` |
| B.2 | Photo display in feed cards (gradient fallback if no photo) | PARTIAL | Gradient + emoji fallback exists, need real photo support |
| B.3 | "Spots left" indicator on cards | NOT STARTED | `max_participants - going_count` |
| B.4 | Host profile pic on feed cards | DONE | Avatar stack shows creator + participants |

### Phase C: "For You" Personalized Feed
> Curated horizontal row of recommended trips

| # | Task | Status | Notes |
|---|------|--------|-------|
| C.1 | Recommendation algorithm: match user sports + skill | NOT STARTED | Score by sport overlap, skill proximity, distance |
| C.2 | Factor in past activity history | NOT STARTED | |
| C.3 | Prioritize trips by friends / past co-participants | NOT STARTED | |
| C.4 | Horizontal "Recommended for you" row above feed | NOT STARTED | |
| C.5 | API: `GET /api/activities/recommended` | NOT STARTED | |

### Phase D: Experience Level Gauge
> Internal 1-100 score per sport, NOT shown to users

| # | Task | Status | Notes |
|---|------|--------|-------|
| D.1 | Onboarding questionnaire: trip count, certifications, max distance | NOT STARTED | |
| D.2 | Compute experience score (1-100) | NOT STARTED | |
| D.3 | Strava data supplement | NOT STARTED | Depends on Phase F |
| D.4 | Soft matching signals (prefers mornings, into photography) | NOT STARTED | |
| D.5 | Use score in recommendation algorithm | NOT STARTED | |

### Phase E: Trip Page Polish
> Full detail page with everything needed to commit

| # | Task | Status | Notes |
|---|------|--------|-------|
| E.1 | Swipeable cover photos (multiple images per trip) | NOT STARTED | |
| E.2 | Map snippet on trip detail page | NOT STARTED | Small Mapbox embed |
| E.3 | "What to bring" / "Where to meet" structured fields | NOT STARTED | New activity fields |
| E.4 | Sticky "Request to join" button at bottom | NOT STARTED | Mobile-focused UX |

### Phase F: Strava Integration
| # | Task | Status | Notes |
|---|------|--------|-------|
| F.1 | Strava OAuth connect flow | NOT STARTED | `docs/strava.md` has full spec |
| F.2 | Token exchange + refresh | NOT STARTED | |
| F.3 | Initial sync: 6 months of activities | NOT STARTED | |
| F.4 | Webhook for new activities | NOT STARTED | |
| F.5 | Skill verification logic + badge | NOT STARTED | |
| F.6 | Redis caching (Upstash) | NOT STARTED | |

### Phase G: Testing & Deploy
| # | Task | Status | Notes |
|---|------|--------|-------|
| G.1 | Vitest setup + workspace config | NOT STARTED | |
| G.2 | Zod validator tests | NOT STARTED | |
| G.3 | API route tests (mocked Supabase) | NOT STARTED | |
| G.4 | Vercel deployment | NOT STARTED | |
| G.5 | GitHub Actions CI | NOT STARTED | |
| G.6 | Error boundaries | NOT STARTED | |
| G.7 | Supabase Realtime for live chat | NOT STARTED | Currently requires refresh |

---

## Recommended Next Task for New Agent

**Phase B: Trip Cover Photos** — This is the highest-impact visual improvement remaining. The activity cards and detail sheet already support `banner_url` display, but there's no way to upload a photo when creating an activity. The work is:

1. Add a photo upload field to `CreateActivityModal` — use the same Supabase Storage pattern as avatar upload (`/api/avatar`), but target an `activity-photos` bucket with path `activities/{activityId}.{ext}`
2. Create `POST /api/activities/[id]/photo` endpoint (or include in the create flow)
3. Show the uploaded photo in the feed card (replace the gradient+emoji placeholder when a photo exists)
4. Show "X spots left" on feed cards (`max_participants - participants.length - 1`)

After that: **Phase C (For You feed)** is the biggest product differentiator — personalized recommendations make discovery feel effortless vs manual browsing. The recommendation API should score activities by: sport match (user's sports vs activity sport), skill proximity, distance from user, and friend overlap.

---

## Key Files & References

- **Architecture & conventions:** `CLAUDE.md`
- **Data model:** `docs/data-model.md`
- **Strava integration spec:** `docs/strava.md`
- **Shared types/validators:** `packages/shared/src/`
- **All API routes:** `apps/web/app/api/`
- **Components:** `apps/web/components/`
- **Reusable avatar:** `apps/web/components/UserAvatar.tsx`
- **Search parser:** `apps/web/lib/searchParser.ts`
- **Confetti utility:** `apps/web/hooks/useConfetti.ts`
