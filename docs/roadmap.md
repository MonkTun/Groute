# Groute Phase 1 Roadmap (Discovery MVP)

> Last updated: 2026-03-27

## Product Summary

Groute connects young adults (18-35) through outdoor activities in LA. Core loop: create profile → pick sports/skill levels → optionally connect Strava for verification → browse nearby activities on a map/list → request to join → message the host → meet up IRL.

Architecture: one Next.js backend serving both a web frontend and an Expo mobile app, backed by Supabase (Postgres + PostGIS), Strava API for skill verification, Mapbox for maps, Upstash Redis for caching.

## Phase 1 Scope

**In scope:** user profiles with sports/skill levels, Strava OAuth + skill verification, geolocation-based activity feed (map + list), activity posting and join requests, direct messaging (1:1), map-based discovery view with activity pins.

**Not in scope:** real-time "going out now" beacons, transport coordination, gas splitting, group/club management, guide marketplace, condition reporting.

---

## Milestone 0: Foundation & Tooling

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.1 | Monorepo setup (Turborepo + pnpm workspaces) | DONE | |
| 0.2 | Next.js web app scaffold (App Router, Tailwind v4, shadcn/ui) | DONE | |
| 0.3 | Expo mobile app scaffold (Expo Router, React Native) | DONE | |
| 0.4 | Shared package with types, constants, Zod validators | DONE | `packages/shared` |
| 0.5 | Root env var loading for both apps (dotenv-cli) | DONE | Web uses dotenv-cli in scripts, mobile uses dotenv in app.config.ts |
| 0.6 | ESLint + TypeScript strict mode across all packages | DONE | |
| 0.7 | CI pipeline (GitHub Actions: lint, typecheck, test) | NOT STARTED | |
| 0.8 | Vitest setup + workspace config | NOT STARTED | |

---

## Milestone 1: Authentication

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Supabase client utilities (server + browser) | DONE | `apps/web/lib/supabase/` |
| 1.2 | Web auth middleware (session refresh, route protection) | DONE | `apps/web/middleware.ts` |
| 1.3 | Web login/signup pages | DONE | `apps/web/app/(auth)/` |
| 1.4 | Web auth callback route (email confirmation) | DONE | `apps/web/app/api/auth/callback/route.ts` |
| 1.5 | `useAuth()` hook (login, signup, signOut) | DONE | `apps/web/hooks/useAuth.ts` |
| 1.6 | Protected (main) layout + sign-out | DONE | `apps/web/app/(main)/layout.tsx`, `SignOutButton.tsx` |
| 1.7 | Mobile Supabase client (AsyncStorage session) | DONE | `apps/mobile/lib/supabase.ts` |
| 1.8 | Mobile AuthProvider + `useSession()` | DONE | `apps/mobile/lib/AuthProvider.tsx` |
| 1.9 | Mobile login/signup screens | DONE | `apps/mobile/app/(auth)/` |
| 1.10 | Mobile tab navigation (Discover, Profile) | DONE | `apps/mobile/app/(tabs)/` |
| 1.11 | Root redirects (both platforms) | DONE | |

**Architecture:** UI pages call `useAuth()` hook (web) or `supabase` client directly (mobile). No custom API routes for auth — Supabase SDK handles login/signup directly. Auth callback route exists only for email confirmation code exchange. Backend logic is swappable by changing hook internals without touching UI.

---

## Milestone 2: Database Schema & ORM

> **Blocked by:** nothing — next priority
> **Reference:** `docs/data-model.md` has full table definitions, indexes, and RLS policies

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | `drizzle.config.ts` pointing to Supabase | NOT STARTED | In `packages/shared/` |
| 2.2 | Drizzle schema: `users` table (with PostGIS location) | NOT STARTED | |
| 2.3 | Drizzle schema: `user_sports` table | NOT STARTED | |
| 2.4 | Drizzle schema: `activities` table (with PostGIS location) | NOT STARTED | |
| 2.5 | Drizzle schema: `activity_participants` table | NOT STARTED | |
| 2.6 | Drizzle schema: `connections` table | NOT STARTED | |
| 2.7 | Drizzle schema: `messages` table | NOT STARTED | |
| 2.8 | Drizzle schema: `strava_activities` table | NOT STARTED | |
| 2.9 | All indexes (GIST spatial, composite, unique constraints) | NOT STARTED | |
| 2.10 | Supabase RLS policies for all tables | NOT STARTED | Applied via Supabase dashboard or migration SQL |
| 2.11 | Push schema to Supabase (`pnpm db:push`) | NOT STARTED | |
| 2.12 | Update barrel exports in `packages/shared` | NOT STARTED | |

---

## Milestone 3: User Profiles & Sports

> **Blocked by:** M2 (database schema)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | Zod validators: `updateUserSchema`, `userSportSchema` | NOT STARTED | In `packages/shared/src/validators/` |
| 3.2 | API: `GET /api/users/[id]` (fetch profile) | NOT STARTED | |
| 3.3 | API: `PATCH /api/users/me` (update profile, location) | NOT STARTED | |
| 3.4 | API: `PUT /api/users/me/sports` (set sports + skill levels) | NOT STARTED | |
| 3.5 | Web: profile setup flow after signup (name, location, sports) | NOT STARTED | |
| 3.6 | Web: `/profile/[id]` page (view profile + skill cards) | NOT STARTED | |
| 3.7 | Web: `/settings` page (edit profile, manage sports) | NOT STARTED | |
| 3.8 | Mobile: profile setup screens | NOT STARTED | |
| 3.9 | Mobile: profile view screen | NOT STARTED | |
| 3.10 | Geolocation: `useLocation` hook (web + mobile) | NOT STARTED | Web: browser Geolocation API, Mobile: expo-location |

---

## Milestone 4: Activity CRUD & Discovery

> **Blocked by:** M2 (database schema), M3 (user profiles for creator info)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | Zod validators: extend `createActivitySchema` | PARTIAL | Basic schema exists in `packages/shared/src/validators/` |
| 4.2 | API: `POST /api/activities` (create) | NOT STARTED | |
| 4.3 | API: `GET /api/activities` (discovery feed with PostGIS `ST_DWithin`) | NOT STARTED | Core query pattern documented in `docs/data-model.md` |
| 4.4 | API: `GET /api/activities/[id]` (detail) | NOT STARTED | |
| 4.5 | API: `PATCH /api/activities/[id]` (update/cancel) | NOT STARTED | |
| 4.6 | API: `POST /api/activities/[id]/join` (request to join) | NOT STARTED | |
| 4.7 | API: `PATCH /api/activities/[id]/participants/[userId]` (accept/decline) | NOT STARTED | |
| 4.8 | Web: activity creation form | NOT STARTED | |
| 4.9 | Web: `/discover` list view (replace placeholder) | NOT STARTED | Currently shows hardcoded sport labels |
| 4.10 | Web: `/activity/[id]` detail page + join button | NOT STARTED | |
| 4.11 | Mobile: activity creation screen | NOT STARTED | |
| 4.12 | Mobile: discover list view (replace placeholder) | NOT STARTED | Currently shows hardcoded sport labels |
| 4.13 | Mobile: activity detail screen | NOT STARTED | |

---

## Milestone 5: Map-Based Discovery

> **Blocked by:** M4 (activities API to populate map)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.1 | Mapbox GL JS integration (web) | NOT STARTED | `mapbox-gl` already installed |
| 5.2 | Web: map view on `/discover` with activity pins | NOT STARTED | |
| 5.3 | Web: map/list toggle on discover page | NOT STARTED | |
| 5.4 | `@rnmapbox/maps` integration (mobile) | NOT STARTED | Needs install |
| 5.5 | Mobile: map view on Discover tab | NOT STARTED | |
| 5.6 | Pin click → activity detail navigation (both platforms) | NOT STARTED | |
| 5.7 | Location permission flow (both platforms) | NOT STARTED | |
| 5.8 | Mapbox geocoding for location search + result caching | NOT STARTED | Cache in Redis |

---

## Milestone 6: Direct Messaging

> **Blocked by:** M2 (database schema)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.1 | Zod validators: `sendMessageSchema` | NOT STARTED | |
| 6.2 | API: `GET /api/messages` (list conversations) | NOT STARTED | |
| 6.3 | API: `GET /api/messages/[userId]` (conversation thread) | NOT STARTED | |
| 6.4 | API: `POST /api/messages` (send message) | NOT STARTED | |
| 6.5 | Supabase Realtime subscription for new messages | NOT STARTED | Mobile connects directly via JWT |
| 6.6 | Web: `/messages` inbox page | NOT STARTED | |
| 6.7 | Web: `/messages/[userId]` chat view | NOT STARTED | |
| 6.8 | Mobile: messages tab + inbox screen | NOT STARTED | |
| 6.9 | Mobile: chat screen | NOT STARTED | |
| 6.10 | Unread message indicators (both platforms) | NOT STARTED | |

---

## Milestone 7: Strava Integration

> **Blocked by:** M2 (database schema), M3 (user profiles for storing tokens)
> **Reference:** `docs/strava.md` has full OAuth flow, sync strategy, and verification logic

| # | Task | Status | Notes |
|---|------|--------|-------|
| 7.1 | API: `GET /api/strava/connect` (initiate OAuth redirect) | NOT STARTED | |
| 7.2 | API: `GET /api/strava/callback` (exchange tokens, store in users table) | NOT STARTED | |
| 7.3 | API: `POST /api/strava/webhook` (receive new activity notifications) | NOT STARTED | |
| 7.4 | Strava token refresh utility | NOT STARTED | Check expiry before every API call |
| 7.5 | Initial sync: fetch 6 months of activities, store in `strava_activities` | NOT STARTED | Paginate with `per_page=100` |
| 7.6 | Skill verification logic (compute level from activity data per sport) | NOT STARTED | Thresholds in `docs/strava.md` |
| 7.7 | Redis caching for Strava stats (Upstash, 24h TTL) | NOT STARTED | |
| 7.8 | Web: "Connect Strava" button on settings page | NOT STARTED | |
| 7.9 | Web: verification badge on profile skill cards | NOT STARTED | |
| 7.10 | Mobile: Strava connection flow | NOT STARTED | |
| 7.11 | Mobile: verification badge on profile | NOT STARTED | |

---

## Milestone 8: Connections

> **Blocked by:** M2 (database schema), M3 (user profiles)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 8.1 | API: `POST /api/connections` (send connection request) | NOT STARTED | |
| 8.2 | API: `PATCH /api/connections/[id]` (accept/block) | NOT STARTED | |
| 8.3 | API: `GET /api/connections` (list user's connections) | NOT STARTED | |
| 8.4 | Connect button on profiles (both platforms) | NOT STARTED | |
| 8.5 | Connection request notifications | NOT STARTED | |

---

## Milestone 9: Testing & Quality

> **Can start alongside:** M2 (validator tests immediately, API tests as routes are built)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 9.1 | Vitest config (root `vitest.config.ts` + workspace) | NOT STARTED | |
| 9.2 | Zod validator tests (shared package) | NOT STARTED | Test valid/invalid/edge cases |
| 9.3 | API route tests (mocked Supabase client via `vi.mock`) | NOT STARTED | |
| 9.4 | Strava verification logic tests | NOT STARTED | Various activity data inputs |
| 9.5 | PostGIS discovery query integration tests | NOT STARTED | Known coordinates, expected results |

---

## Milestone 10: Polish & Deploy

> **Blocked by:** M4+ (needs features to polish)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 10.1 | Error boundaries (web + mobile) | NOT STARTED | |
| 10.2 | Loading skeletons for all data-fetching pages | NOT STARTED | |
| 10.3 | GitHub Actions CI (lint, typecheck, test on every PR) | NOT STARTED | |
| 10.4 | Vercel deployment (web, auto-deploy on push) | NOT STARTED | |
| 10.5 | EAS Build config (mobile, internal distribution for testing) | NOT STARTED | |
| 10.6 | Staging Supabase project + env separation | NOT STARTED | |

---

## Progress Summary

| Milestone | Done | Total | % |
|-----------|------|-------|---|
| 0. Foundation | 6 | 8 | 75% |
| 1. Authentication | 11 | 11 | 100% |
| 2. Database Schema | 0 | 12 | 0% |
| 3. User Profiles | 0 | 10 | 0% |
| 4. Activity CRUD | 0.5 | 13 | 4% |
| 5. Map Discovery | 0 | 8 | 0% |
| 6. Messaging | 0 | 10 | 0% |
| 7. Strava | 0 | 11 | 0% |
| 8. Connections | 0 | 5 | 0% |
| 9. Testing | 0 | 5 | 0% |
| 10. Polish & Deploy | 0 | 6 | 0% |
| **Total** | **~18** | **99** | **~18%** |

## Critical Path

```
M2 (Database) → M3 (Profiles) → M4 (Activities) → M5 (Maps)
                                                  ↘ M6 (Messaging)
                               → M7 (Strava)
                               → M8 (Connections)
```

Everything is blocked on M2 (Database Schema). M6 (Messaging) and M7 (Strava) can be parallelized after M3 is done. M9 (Testing) can start immediately alongside M2 for validator tests.

## Key Files & References

- **Architecture & conventions:** `CLAUDE.md`
- **Data model (tables, indexes, RLS, discovery query):** `docs/data-model.md`
- **Strava integration (OAuth, sync, verification):** `docs/strava.md`
- **Shared types/validators:** `packages/shared/src/`
- **Web Supabase clients:** `apps/web/lib/supabase/`
- **Web auth hook:** `apps/web/hooks/useAuth.ts`
- **Mobile auth provider:** `apps/mobile/lib/AuthProvider.tsx`
- **Mobile Supabase client:** `apps/mobile/lib/supabase.ts`
