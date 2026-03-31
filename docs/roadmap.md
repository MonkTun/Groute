# Groute Roadmap — Discovery MVP

> Last updated: 2026-03-31
> Platform: **Web (Next.js) + Mobile (Expo)**. Shared backend via Next.js API routes + direct Supabase queries.

---

## What's Built (Completed)

### Foundation & Auth
- Turborepo + pnpm monorepo with Next.js web, Expo mobile, shared package
- Supabase Auth (email/password), middleware route protection, session refresh
- Profile completion gate with cookie caching
- Mobile auth: login/signup with AsyncStorage session persistence

### Database Schema (Drizzle ORM + Supabase)
- `users` — profile fields, avatar_url, live location tracking, home location, date_of_birth, preferred_language, edu_email
- `user_sports` — per-sport skill levels (self-reported + Strava verified)
- `user_experience` — per-sport experience metrics (altitude, distance, certifications, terrain comfort)
- `user_preferences` — logistics preferences (car, carpool, drive distance, group size, availability)
- `activities` — sport type, skill level, visibility, banner_url, unsplash_image_url, location, trail data, scheduling
- `activity_participants` — join requests with accept/decline status
- `activity_logistics` — meeting point, parking (name, paid/free, cost, notes), transport notes, checklist, estimated return
- `activity_rides` — carpool offers/requests with pickup location, seats, departure time
- `ride_passengers` — driver-passenger matching with confirm/decline
- `user_transit_plans` — per-user transport plans (mode, leave time, route summary)
- `messages` — unified table for group chat (activity_id) + DMs (receiver_id)
- `follows` — one-directional follow system, mutual = friends
- `notifications` — follow, invite, join_accepted, join_request types
- Supabase Storage buckets: `avatars`, `activity-photos`

### Design System — "Natural Whimsy"
- OKLCH color palette: warm cream backgrounds, deep forest green primary, sunset coral accent, warm tan borders
- Fonts: Quicksand (headings) + DM Sans (body) — organic, nature-friendly
- Nature utility classes: `bg-nature-dawn`, `bg-nature-forest`, `bg-nature-sunset` gradients
- Organic section dividers: wave clips, mountain silhouette
- Rounded cards (rounded-3xl), warm shadows, nature-bark ring colors
- Mobile theme parity in `apps/mobile/lib/theme.ts`

### User Profiles (Web + Mobile)
- 5-step onboarding wizard: basics → sports → experience → logistics preferences → extras
- Country + state/province dropdown with 20 countries and region data
- Preferred language selection (10 languages)
- Profile view with cards: Personal Info, Activities & Experience, Friends
- Inline edit mode (web) / dedicated edit screen (mobile)
- Avatar upload (both platforms)
- Sports selection with per-sport skill level
- Experience depth: altitude, distance, trips, years, certifications, terrain comfort
- Logistics preferences: car access, carpool willingness, drive distance, group size, availability
- `.edu` email verification badge

### Activity CRUD — Trailhead-First Flow
- **Step 1: Trailhead** — search by trail name (Nominatim) or location (Mapbox geocoding), select from nearby trails (Overpass), or drop a custom pin
- **Step 2: Transport** — AI-powered logistics suggestions via Claude Haiku:
  - Parking options with free/paid badges and cost
  - Meeting point suggestions
  - Carpool meeting spot for pre-trail meetup
  - Transport tips (toggleable checkboxes to keep/remove)
  - Custom input for all fields
  - Shimmer loading bar with sparkle icon during AI planning
- **Step 3: Details** — activity type, title (auto-suggests from trail name), description, skill level, date/time, cover photo, visibility, max participants
- **Step 4: Invite** — friend invitations + full review summary
- Cover photo upload or automatic Unsplash trail image
- Delete activity (owner only, with confirmation)
- Join / Request to join with auto-accept for public activities
- Confetti on creation and join

### Logistics & Transportation Planning
- **GettingTherePanel** — multi-modal transport planner with 5 tabs:
  - Drive: Mapbox directions, leave-by time, Google Maps/Apple Maps/Waze links
  - Transit: Google Maps transit routes with step-by-step breakdown (or fallback link)
  - Rideshare: Uber/Lyft deep links, estimated cost, leave-by time
  - Carpool: browse/join ride offers, post offers/requests, multi-stop driver routes
  - Walk: walking directions for nearby trailheads
- Personalized "Leave by" times based on user's location and chosen transport mode
- "Save my plan" persists transport choice to `user_transit_plans`
- **LogisticsTab** — trip plan timeline:
  - Meeting point → Drive to trailhead → Activity start → Estimated return
  - Parking info with name, free/paid badge, cost, tips
  - Transport tips from AI + host
  - "Who's Coming" section: participant avatars, areas, transport modes, departure times
  - What to bring checklist (host-editable)
  - Host notes
- **CarpoolBoard** — creator management view for all ride offers/requests

### Trail Integration
- Trail name search via Nominatim (shows location/region in results)
- Nearby trail search via Overpass API
- Trail geometry visualization on Mapbox
- Approach route calculation (parking → trailhead walking time)
- Custom trailhead pin drop for unlisted trails
- Trail names displayed on all activity cards

### Auto-Sourced Images
- Unsplash API integration for trail/nature photos
- Auto-fetched at activity creation time
- Backfilled on activity list API for older activities
- Fallback chain: user photo → Unsplash → sport emoji

### Navigation Structure
- **Web:** Right Now | Explore | My Trips | Profile
- **Mobile:** Right Now | Explore | My Trips | Profile (with emoji tab icons)

### Right Now Page (Web + Mobile)
- Time-based greeting with "New Activity" button
- Static border search bar with AI-powered natural language search
- "Happening Soon" section (next 6 hours, featured cards with green pulse dot)
- "For You" section (activities matching user's sports)
- "Coming Up" section (next 48 hours)
- Activity cards with trail names, Unsplash images, sport badges, participant avatars

### Explore / Map Experience (Web + Mobile)
- Mapbox GL JS with GeoJSON clustering
- Sport filter pills + timeframe presets (Today/3d/Week/2 weeks/Month)
- Specific date picker with dismissible badge
- Smart search bar parsing natural language queries
- Activity feed sidebar with search, sport badges, distance, thumbnails
- Trail name display on all card types

### Personalized Recommendations
- Scoring algorithm: sport match (40pts), skill proximity (20pts), distance (20pts), friend overlap (15pts), co-participant history (5pts)
- "For You" panels on explore map and Right Now page

### Social & Messaging
- Friends list (mutual follows) on Profile page
- Incoming follow requests
- Notifications: follow, invite, join_request, join_accepted
- DM chat + group chat per activity
- Friend invite when creating activities

### My Trips
- Upcoming/past sections
- HOST/GOING/REQUESTED badges
- Pending join request management
- Inline group chat

### Strava Integration
- OAuth connect/disconnect flow
- Activity sync (last 24 months)
- AI-powered skill verification via Claude Haiku
- Webhook support for real-time activity updates

### API Endpoints (40+ routes)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/activities` | List + create activities |
| GET/PATCH/DELETE | `/api/activities/[id]` | Activity CRUD |
| POST | `/api/activities/[id]/join` | Join or request |
| PATCH | `/api/activities/[id]/participants/[id]` | Accept/decline |
| POST | `/api/activities/[id]/photo` | Upload cover photo |
| GET/PUT | `/api/activities/[id]/logistics` | Logistics CRUD |
| GET/POST | `/api/activities/[id]/rides` | Carpool offers/requests |
| PATCH/DELETE | `/api/activities/[id]/rides/[rideId]` | Manage rides |
| POST/PATCH | `/api/activities/[id]/rides/[rideId]/passengers` | Join/manage ride |
| GET | `/api/activities/[id]/transport-options` | All transport modes |
| GET/POST | `/api/activities/[id]/transport-plan` | Save transport plan |
| POST | `/api/activities/suggest-logistics` | AI logistics suggestions |
| GET | `/api/activities/recommended` | Personalized recommendations |
| GET | `/api/directions` | Mapbox driving directions |
| GET | `/api/directions/transit` | Google Maps transit |
| POST | `/api/directions/multi-stop` | Multi-waypoint driving |
| GET | `/api/trails` | Search trails by location |
| GET | `/api/trails/geometry` | Trail GeoJSON |
| GET | `/api/trails/approach` | Walking approach route |
| GET | `/api/trails/search-by-name` | Search trails by name |
| POST | `/api/unsplash` | Fetch + cache trail image |
| GET/POST | `/api/profile` | User profile CRUD |
| GET/POST | `/api/messages/[activityId]` | Group chat |
| GET/POST | `/api/dm/[userId]` | Direct messages |
| POST/DELETE | `/api/follow` | Follow/unfollow |
| GET | `/api/friends` | Mutual follows |
| POST | `/api/search` | AI-powered search |

---

## What's Next — Prioritized

### Phase E: Trip Page Polish
| # | Task | Status | Notes |
|---|------|--------|-------|
| E.1 | Multiple cover photos per trip | NOT STARTED | |
| E.2 | Activity edit screen for creators | NOT STARTED | |
| E.3 | Weather integration on activity detail | NOT STARTED | OpenWeather or Weather.gov |

### Phase F: Realtime & Push
| # | Task | Status | Notes |
|---|------|--------|-------|
| F.1 | Supabase Realtime for web chat | NOT STARTED | Mobile already uses Realtime |
| F.2 | Push notifications (Expo + APNs/FCM) | NOT STARTED | |
| F.3 | Unread message badges | NOT STARTED | |

### Phase G: Testing & Deploy
| # | Task | Status | Notes |
|---|------|--------|-------|
| G.1 | Vitest setup + workspace config | NOT STARTED | |
| G.2 | Zod validator tests | NOT STARTED | |
| G.3 | API route tests | NOT STARTED | |
| G.4 | Vercel deployment | NOT STARTED | |
| G.5 | GitHub Actions CI | NOT STARTED | |

---

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
NEXT_PUBLIC_STRAVA_REDIRECT_URI=
NEXT_PUBLIC_MAPBOX_TOKEN=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ANTHROPIC_API_KEY=
GOOGLE_MAPS_API_KEY=          # optional, for transit routing
UNSPLASH_ACCESS_KEY=           # for auto-sourced trail images
NEXT_PUBLIC_APP_URL=
```
