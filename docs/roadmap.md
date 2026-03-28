# Groute Roadmap — Discovery MVP

> Last updated: 2026-03-27
> Platform: **Web (Next.js) + Mobile (Expo)**. Shared backend via Next.js API routes + direct Supabase queries.

---

## What's Built (Completed)

### Foundation & Auth
- Turborepo + pnpm monorepo with Next.js web, Expo mobile, shared package
- Supabase Auth (email/password), middleware route protection, session refresh
- Profile completion gate with cookie caching
- Mobile auth: login/signup with AsyncStorage session persistence

### Database Schema (Drizzle ORM + Supabase)
- `users` — profile fields, avatar_url, live location tracking, date_of_birth, preferred_language, edu_email
- `user_sports` — per-sport skill levels (self-reported + Strava verified)
- `activities` — sport type, skill level, visibility, banner_url, location, scheduling
- `activity_participants` — join requests with accept/decline status
- `messages` — unified table for group chat (activity_id) + DMs (receiver_id)
- `follows` — one-directional follow system, mutual = friends
- `notifications` — follow, invite, join_accepted, join_request types
- Supabase Storage buckets: `avatars`, `activity-photos`

### User Profiles (Web + Mobile)
- Onboarding wizard (3-step: basics -> activities -> extras)
- Country + state/province dropdown with 20 countries and region data
- Preferred language selection (10 languages)
- Profile view with cards: Personal Info, Activities & Experience, Friends
- Inline edit mode (web) / dedicated edit screen (mobile)
- Avatar upload (both platforms, base64 approach on mobile)
- Sports selection with per-sport skill level (beginner/intermediate/advanced)
- `.edu` email verification badge
- Sign out

### Activity CRUD
- Create activity: title, description, sport type, skill level, visibility, location, date/time, max participants, friend invite
- Cover photo upload for activities (Supabase Storage `activity-photos` bucket)
- Activity detail page with banner, description, details grid, host card, member list
- Banner photo edit for activity creators (both web + mobile)
- Delete activity (owner only, with confirmation)
- Join / Request to join with auto-accept for public activities
- Confetti on activity creation and join (web)
- "Spots left" indicator on feed cards (1-3 spots remaining)

### Navigation Structure
- **Web:** Right Now | Explore | My Trips | Profile
- **Mobile:** Right Now | Explore | My Trips | Profile (with emoji tab icons)

### Right Now Page (Web + Mobile)
- Airbnb-style landing with time-based greeting
- "Happening Soon" section (next 6 hours, featured cards with green pulse dot)
- "For You" section (activities matching user's sports)
- "Coming Up" section (next 48 hours)
- Search bar filtering across title, location, sport type
- CTA link to Explore map
- Activity cards with banner photos, sport badges, participant avatars, "spots left"

### Explore / Map Experience (Web + Mobile)
- **Web:** Mapbox GL JS with native GeoJSON clustering (GPU-rendered)
- **Mobile:** Mapbox GL JS via WebView with DOM-based markers and client-side clustering
- Clusters: dark circles with orange ring, count label, sport emoji summary
- Individual pins: color-coded by skill level (amber/blue/red) with sport emoji
- Click cluster to zoom in, click pin to open activity detail
- Friend locations: profile photo pins with name labels, 24h freshness filter
- User location: blue dot with glow ring, auto-center on load, updates server
- Sport filter pills + calendar time filter (Today/3d/Week/2 weeks/Month)
- Smart search bar (web): parses "easy hike this weekend" -> filters
- Activity feed sidebar (web) with search, sport badges, distance, thumbnails
- FAB to create activity (mobile)

### Personalized Recommendations
- `GET /api/activities/recommended` endpoint with scoring algorithm
- Scoring: sport match (40pts), skill proximity (20pts), distance (20pts), friend overlap (15pts), co-participant history (5pts)
- "For You" panel on web explore map (top-right, dismissable)
- "For You" section on Right Now page (both platforms)

### Social & Messaging
- Friends list (mutual follows) on Profile page
- Incoming follow requests with "Follow Back" button
- Notifications: follow, invite, join_request, join_accepted
- DM chat: 1:1 messaging with realtime (Supabase Realtime on mobile, polling on web)
- Group chat: per-activity messages with sender avatars
- Follow/unfollow system with auto-notification
- Friend invite when creating activities

### My Trips
- Upcoming/past sections with SectionList (mobile) / server-rendered (web)
- HOST/GOING/REQUESTED badges
- Pending join request management (accept/decline) inline
- Inline expandable group chat per trip (web)
- Chat button per trip (mobile)

### Mobile-Specific
- Full Expo Router navigation: tabs + stack for detail screens
- Edit profile modal with country/region/language dropdowns
- Activity photo upload via expo-image-picker + base64-arraybuffer
- expo-location for current position
- expo-blur for filter overlays
- Light theme matching web's design language
- WebView-based Mapbox map (works in Expo Go without native build)

### API Endpoints (28 routes)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/activities` | List + create activities |
| DELETE | `/api/activities/[id]` | Delete activity (owner) |
| POST | `/api/activities/[id]/join` | Join or request to join |
| PATCH | `/api/activities/[id]/participants/[id]` | Accept/decline participant |
| POST | `/api/activities/[id]/photo` | Upload activity cover photo |
| GET | `/api/activities/recommended` | Personalized recommendations |
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
| GET | `/api/auth/callback` | OAuth callback handler |

---

## What's Next — Prioritized

### Phase D: Experience Level Gauge (NEXT UP)
> Internal 1-100 score per sport, used for smarter matching

| # | Task | Status | Notes |
|---|------|--------|-------|
| D.1 | Onboarding questionnaire: trip frequency, max distance hiked/run, certifications | NOT STARTED | Add to onboarding step 2 |
| D.2 | Compute experience score (1-100) from questionnaire + activity history | NOT STARTED | Weighted formula |
| D.3 | Use score in recommendation algorithm (replace simple skill match) | NOT STARTED | Improve Phase C scoring |
| D.4 | Soft matching signals (prefers mornings, into photography, group size preference) | NOT STARTED | New user_preferences table |

### Phase E: Trip Page Polish
> Full detail page with everything needed to commit

| # | Task | Status | Notes |
|---|------|--------|-------|
| E.1 | Multiple cover photos per trip (swipeable gallery) | NOT STARTED | New `activity_photos` table |
| E.2 | Map snippet on trip detail page | NOT STARTED | Small Mapbox embed showing pin |
| E.3 | "What to bring" / "Where to meet" structured fields | NOT STARTED | New activity columns |
| E.4 | Sticky "Request to join" button at bottom (mobile) | NOT STARTED | iOS-style fixed CTA |
| E.5 | Activity edit screen for creators (title, description, time) | NOT STARTED | Currently can only edit banner |

### Phase F: Strava Integration
| # | Task | Status | Notes |
|---|------|--------|-------|
| F.1 | Strava OAuth connect flow | NOT STARTED | `docs/strava.md` has full spec |
| F.2 | Token exchange + refresh | NOT STARTED | |
| F.3 | Initial sync: 6 months of activities | NOT STARTED | |
| F.4 | Webhook for new activities | NOT STARTED | |
| F.5 | Skill verification logic + badge | NOT STARTED | Compare self-reported vs Strava data |
| F.6 | Redis caching (Upstash) | NOT STARTED | Cache Strava API responses |

### Phase G: Realtime & Polish
| # | Task | Status | Notes |
|---|------|--------|-------|
| G.1 | Supabase Realtime for web chat (replace polling) | NOT STARTED | Mobile already uses Realtime |
| G.2 | Push notifications (Expo + APNs/FCM) | NOT STARTED | New activity invites, messages, join requests |
| G.3 | Unread message badges on tab bar | NOT STARTED | Both platforms |
| G.4 | Pull-to-refresh on all list screens (mobile) | PARTIAL | Some screens have it |
| G.5 | Loading skeletons on mobile screens | NOT STARTED | Web has them |
| G.6 | Error boundaries + graceful error states | NOT STARTED | Both platforms |

### Phase H: Testing & Deploy
| # | Task | Status | Notes |
|---|------|--------|-------|
| H.1 | Vitest setup + workspace config | NOT STARTED | |
| H.2 | Zod validator tests | NOT STARTED | |
| H.3 | API route tests (mocked Supabase) | NOT STARTED | |
| H.4 | Vercel deployment + preview branches | NOT STARTED | |
| H.5 | EAS Build for iOS/Android | NOT STARTED | Requires dev client for native map |
| H.6 | GitHub Actions CI (lint + typecheck + test) | NOT STARTED | |

---

## Recommended Next Steps

### Immediate (high impact, low effort)
1. **Phase D.1-D.2: Experience scoring** — The recommendation algorithm currently uses simple beginner/intermediate/advanced matching. A 1-100 score from a short questionnaire ("How often do you hike? What's your longest trail?") would dramatically improve match quality.

2. **Phase E.2: Map on activity detail** — A small map showing the activity pin on the detail page helps users understand the location without leaving the page. Quick win using the existing WebView map pattern.

3. **Phase G.1: Realtime chat on web** — Web chat currently polls every 5s. Supabase Realtime subscription (already working on mobile) would make it instant.

### Medium-term (product differentiator)
4. **Phase F: Strava integration** — Verifying skill levels with real data builds trust. Users with Strava-verified badges are more likely to get join requests accepted.

5. **Phase G.2: Push notifications** — Critical for engagement. Users need to know when someone wants to join their trip or sends a message.

### Later (polish)
6. **Phase E.1: Photo gallery** — Multiple photos per activity make listings more compelling.
7. **Phase H: Testing & deploy** — Automated testing and CI/CD before scaling.

---

## Key Files & References

- **Architecture & conventions:** `CLAUDE.md`
- **Data model:** `docs/data-model.md`
- **Strava integration spec:** `docs/strava.md`
- **Shared types/validators/constants:** `packages/shared/src/`
- **Web API routes:** `apps/web/app/api/`
- **Web components:** `apps/web/components/`
- **Mobile screens:** `apps/mobile/app/`
- **Mobile lib (auth, supabase, api, theme):** `apps/mobile/lib/`
- **Design tokens (mobile):** `apps/mobile/lib/theme.ts`
