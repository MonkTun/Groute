# Groute Roadmap — Discovery MVP

> Last updated: 2026-03-29
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

### EAS Build & TestFlight
- EAS production build profile with auto-increment versioning
- TestFlight distribution working (v0.1.7)
- Fixed crash-on-launch caused by duplicate React instances in pnpm monorepo bundle (see `docs/eas-build-fixes.md`)
- Custom `index.js` entry point with global error handler for module-init crashes
- Error boundary in root layout catches React render errors and displays them on-screen
- `app.config.ts` env var resolution works for both local `.env` (NEXT_PUBLIC_ prefix) and EAS cloud env vars (no prefix)

### AI-Powered Search
- Natural language activity search via Gemini API
- Parses queries like "easy hike this weekend near me" into structured filters
- Integrated into Explore page search bar (web + mobile)

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

### Phase D: Enhanced Onboarding & Profile (NEXT UP)
> Richer user data for smarter matching + activity history on profiles

#### D1: Onboarding Questionnaire Expansion
> Add questions after sport selection (step 2) to capture experience depth and logistics

| # | Task | Status | Notes |
|---|------|--------|-------|
| D1.1 | **Experience depth questions (per selected sport):** | NOT STARTED | Conditional on sports chosen |
| | - Highest altitude reached (ft/m) | | Hiking/mountaineering |
| | - Longest single-day distance (mi/km) | | Hiking, running, cycling |
| | - Total trips in the last 12 months | | All sports |
| | - Years of experience | | All sports |
| | - Certifications (Wilderness First Aid, belay cert, dive cert, etc.) | | Multi-select, sport-specific |
| | - Terrain comfort (trail, off-trail, scramble, technical, snow/ice) | | Multi-select for hiking |
| | - Water comfort level (flatwater, Class I-V rapids, open ocean) | | Kayaking, surfing, SUP |
| D1.2 | **Logistics & availability questions:** | NOT STARTED | Critical for LA car-dependent matching |
| | - Do you have a car / can you drive to trailheads? (yes / no / sometimes) | | Key for carpool matching |
| | - Willing to carpool / give rides? (yes / no / within X miles) | | Enables transport coordination |
| | - How far are you willing to drive for an activity? (10/25/50/100+ mi) | | Filters discovery radius |
| | - Preferred group size (solo+1, small 2-4, medium 5-8, large 8+) | | Matching signal |
| | - Preferred time of day (early morning, morning, afternoon, evening) | | Scheduling alignment |
| | - Weekday vs weekend availability | | Scheduling alignment |
| D1.3 | **Gear & preparedness questions:** | NOT STARTED | Safety + compatibility signals |
| | - Do you own hiking/camping gear? (none / basic / full kit) | | Helps hosts gauge readiness |
| | - Comfort with overnight trips (day trips only / car camping / backcountry) | | Activity type matching |
| | - Fitness self-assessment (casual / active / athletic / competitive) | | Cross-sport baseline |
| | - Any physical limitations or accessibility needs? (optional, free text) | | Inclusive matching |
| D1.4 | **Social & safety preferences:** | NOT STARTED | Trust + comfort signals |
| | - Comfortable with strangers? (prefer friends-of-friends / open to anyone) | | Matching filter |
| | - Emergency contact info (optional) | | Safety feature |
| | - Languages spoken (select multiple) | | Already have preferred, add spoken |
| D1.5 | DB schema: `user_experience` table (per-sport metrics) + `user_preferences` table (logistics/social) | NOT STARTED | New tables in shared schema |
| D1.6 | Zod validators for all new questionnaire fields | NOT STARTED | `packages/shared/src/validators/` |
| D1.7 | Onboarding UI: new step(s) between sport selection and extras | NOT STARTED | Web + mobile |

#### D2: Experience Scoring
| # | Task | Status | Notes |
|---|------|--------|-------|
| D2.1 | Compute experience score (1-100) per sport from questionnaire answers | NOT STARTED | Weighted formula |
| D2.2 | Factor in completed Groute activities into score over time | NOT STARTED | Score improves as you use the app |
| D2.3 | Use score in recommendation algorithm (replace simple skill match) | NOT STARTED | Improve existing scoring |

#### D3: Profile — Activity History
> Show completed activities on user profiles so others can gauge experience

| # | Task | Status | Notes |
|---|------|--------|-------|
| D3.1 | "Past Activities" section on profile page (web + mobile) | NOT STARTED | Reverse-chron list of completed trips |
| D3.2 | Activity history cards: sport icon, title, date, location, group size | NOT STARTED | Compact card design |
| D3.3 | Stats summary on profile: total trips, unique sports, people met | NOT STARTED | Above activity history |
| D3.4 | Privacy toggle: show/hide activity history on public profile | NOT STARTED | Settings page |
| D3.5 | API endpoint: `GET /api/users/[id]/activities` (past completed) | NOT STARTED | Paginated, respects privacy |

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
| H.5 | EAS Build for iOS/Android | DONE | Production builds on TestFlight (v0.1.7). See `docs/eas-build-fixes.md` |
| H.6 | GitHub Actions CI (lint + typecheck + test) | NOT STARTED | |

---

## Recommended Next Steps

### Immediate (high impact — NEXT UP)
1. **Phase D1: Onboarding questionnaire** — Capture experience depth (altitude, distance, frequency) and logistics (car access, drive radius, group size) during onboarding. This data is the foundation for smarter matching in LA's car-dependent geography.

2. **Phase D3: Profile activity history** — Show past activities on profiles so users can assess each other's experience. Builds trust and encourages repeat usage.

3. **Phase D2: Experience scoring** — Replace simple beginner/intermediate/advanced with a 1-100 score derived from questionnaire + activity history. Dramatically improves recommendation quality.

### Medium-term (product differentiator)
4. **Phase E.2: Map on activity detail** — Small map showing the activity pin. Quick win using existing WebView map pattern.

5. **Phase F: Strava integration** — Verifying skill levels with real data builds trust. Users with Strava-verified badges are more likely to get join requests accepted.

6. **Phase G.2: Push notifications** — Critical for engagement. Users need to know when someone wants to join their trip or sends a message.

### Later (polish)
7. **Phase E.1: Photo gallery** — Multiple photos per activity make listings more compelling.
8. **Phase H: Testing & deploy** — Automated testing and CI/CD before scaling.

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
