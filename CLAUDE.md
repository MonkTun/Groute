# Groute - Outdoor Activity Discovery & Social Platform

## Project Overview

A social networking app connecting young adults (18-35) through shared outdoor activities. Launching in LA. Users discover compatible activity partners based on location, sport, and verified skill level. Inspired by Oak (getoak.app) but built for car-dependent US geography.

Core product loop: User creates profile -> selects sports/skill levels -> optionally connects Strava for verification -> browses nearby activities on a map/list -> requests to join -> messages the host -> meets up IRL.

## Monorepo Structure

```
/
├── apps/
│   ├── web/                          → Next.js (App Router) — API + web frontend
│   │   ├── app/
│   │   │   ├── (auth)/               → Auth pages (login, signup, strava callback)
│   │   │   ├── (main)/               → Authenticated app shell
│   │   │   │   ├── discover/         → Discovery feed (map + list)
│   │   │   │   ├── activity/[id]/    → Activity detail + join request
│   │   │   │   ├── profile/[id]/     → User profile + skill cards
│   │   │   │   ├── messages/         → DM inbox + chat
│   │   │   │   └── settings/         → Profile edit, Strava connection
│   │   │   ├── api/                  → API routes (consumed by both web + mobile)
│   │   │   │   ├── auth/             → Auth helpers, Strava OAuth callback
│   │   │   │   ├── activities/       → CRUD + discovery queries
│   │   │   │   ├── users/            → Profile, matching, search
│   │   │   │   ├── messages/         → Send, read, list conversations
│   │   │   │   └── strava/           → OAuth exchange, webhook, sync
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/                   → shadcn/ui primitives
│   │   │   └── ...                   → Feature components
│   │   ├── lib/                      → Web-specific utilities
│   │   │   ├── supabase/             → Server + client Supabase instances
│   │   │   └── api-client.ts         → Typed fetch wrapper
│   │   ├── middleware.ts             → Auth middleware (protects routes, refreshes sessions)
│   │   └── tailwind.config.ts
│   │
│   └── mobile/                       → Expo (React Native) — iOS + Android
│       ├── app/                      → Expo Router (file-based routing)
│       │   ├── (auth)/               → Login, signup screens
│       │   ├── (tabs)/               → Tab navigator (discover, explore, messages, profile)
│       │   ├── activity/[id].tsx     → Activity detail
│       │   └── _layout.tsx           → Root layout with auth provider
│       ├── components/               → Mobile-specific components
│       ├── lib/                      → Mobile-specific utilities
│       │   ├── supabase.ts           → Supabase client (uses AsyncStorage for session)
│       │   └── api.ts               → API client pointing to Next.js backend
│       └── app.config.ts            → Expo config (env vars via extra)
│
├── packages/
│   └── shared/                       → Single source of truth
│       └── src/
│           ├── db/
│           │   └── schema/           → Drizzle ORM table definitions
│           ├── validators/           → Zod schemas (one file per domain)
│           ├── types/                → Derived TypeScript types (inferred from Zod/Drizzle)
│           ├── constants/            → Enums, sport types, skill levels
│           └── index.ts              → Barrel export
│
├── docs/                             → Extended documentation
│   ├── data-model.md                 → Table definitions, indexes, RLS policies, discovery query
│   └── strava.md                     → OAuth flow, sync strategy, skill verification logic
├── turbo.json                        → Turborepo pipeline config
├── pnpm-workspace.yaml               → Workspace definition
└── .env.example                      → Environment variable template
```

## Tech Stack

| Layer        | Technology                              |
| ------------ | --------------------------------------- |
| Monorepo     | Turborepo + pnpm workspaces             |
| Web          | Next.js (App Router), Tailwind CSS v4, shadcn/ui, TypeScript |
| Mobile       | Expo (React Native), Expo Router, TypeScript |
| Database     | Supabase (PostgreSQL + PostGIS)         |
| ORM          | Drizzle ORM (in `packages/shared`)      |
| Auth         | Supabase Auth (JWT, OAuth for Strava)   |
| Caching      | Upstash Redis                           |
| Maps         | Mapbox (GL JS for web, RN SDK for mobile) |
| Integration  | Strava API v3 (skill verification)      |
| Validation   | Zod (schemas in `packages/shared`)      |
| Testing      | Vitest (unit + integration)             |
| Logging      | `console.error`/`console.warn` (structured JSON in production via Vercel) |
| Hosting      | Vercel (web), EAS Build (mobile)        |

## Commands

```bash
# Development
pnpm dev              # Run all apps in parallel
pnpm dev:web          # Run web app only (port 3000)
pnpm dev:mobile       # Run Expo dev server

# Build
pnpm build            # Build all packages and apps
pnpm build:web        # Build web app only

# Quality
pnpm lint             # Lint all packages
pnpm typecheck        # Type-check all packages
pnpm test             # Run all tests with Vitest
pnpm test:watch       # Run tests in watch mode
pnpm clean            # Remove all build artifacts and node_modules caches

# Database
pnpm db:generate      # Generate Drizzle migrations
pnpm db:push          # Push schema to Supabase
pnpm db:studio        # Open Drizzle Studio for visual DB inspection
```

## Code Conventions

### TypeScript
- Strict mode enabled everywhere (`strict: true`)
- No `any` types — use `unknown` and narrow, or define proper types
- Shared types and Zod schemas live in `packages/shared` — import from `@groute/shared`
- Prefer `interface` for object shapes, `type` for unions/intersections
- Infer types from Zod schemas (`z.infer<typeof schema>`) and Drizzle tables (`typeof users.$inferSelect`) — don't manually duplicate type definitions
- Use `as const` for constant arrays and objects
- Prefer `satisfies` over `as` for type assertions when possible

### File Naming
- React components: `PascalCase.tsx` (e.g., `ActivityCard.tsx`)
- Utilities/hooks: `camelCase.ts` (e.g., `useLocation.ts`)
- Route files (Next.js): follow App Router conventions (`page.tsx`, `layout.tsx`, `route.ts`)
- Route files (Expo): follow Expo Router conventions (`index.tsx`, `[id].tsx`, `_layout.tsx`)
- Database schema files: `kebab-case.ts` (e.g., `user-sports.ts`)
- Validator files: `kebab-case.ts` matching the domain (e.g., `activity.ts`)
- Test files: colocated as `*.test.ts` or `*.test.tsx` next to the file they test

### Imports
- Use `@groute/shared` for shared package imports
- Use `@/` path alias within each app for local imports
- Group imports with blank lines between groups:

```typescript
// 1. External dependencies
import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'

// 2. Shared package
import { createActivitySchema, type Activity } from '@groute/shared'

// 3. Local imports
import { createServerClient } from '@/lib/supabase/server'
import { ActivityCard } from '@/components/ActivityCard'
```

### Naming Conventions
- Database columns: `snake_case` (Postgres convention)
- TypeScript properties: `camelCase` (Drizzle casing transform configured in `packages/shared/src/db/index.ts` via `{ casing: 'snake_case' }`)
- API response fields: `camelCase`
- Environment variables: `UPPER_SNAKE_CASE`
- Zod schemas: `camelCase` with `Schema` suffix (e.g., `createActivitySchema`, `updateUserSchema`)
- React components: `PascalCase` — name must match filename
- Hooks: `use` prefix (e.g., `useActivities`, `useLocation`)
- Boolean variables/props: `is`, `has`, `should`, `can` prefixes (e.g., `isStravaConnected`, `hasVerifiedSkill`)
- Event handlers: `handle` prefix for component handlers, `on` prefix for callback props (e.g., `handleSubmit`, `onActivityCreate`)

### API Routes (Next.js)
- All API routes live in `apps/web/app/api/`
- Validate all inputs with Zod schemas from `@groute/shared`
- Return consistent JSON responses: `{ data }` on success, `{ error: string }` on failure
- Use Supabase server client for all DB access in API routes
- Status codes: `200` (success), `201` (created), `400` (validation), `401` (unauth), `403` (forbidden), `404` (not found), `409` (conflict), `429` (rate limited), `500` (server error)

Every API route should follow this structure:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createActivitySchema } from '@groute/shared'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // 1. Auth check
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Input validation
  const body = await request.json()
  const parsed = createActivitySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  // 3. Business logic + DB operation
  try {
    const activity = await db.insert(activities).values({
      ...parsed.data,
      creatorId: user.id,
    }).returning()

    return NextResponse.json({ data: activity[0] }, { status: 201 })
  } catch (err) {
    console.error('Failed to create activity:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Database
- All schema definitions use Drizzle ORM in `packages/shared/src/db/schema/`
- Use PostGIS `geography(POINT, 4326)` for all location columns
- Indexes defined alongside schema, not in separate migration files
- Never call Strava API on user-facing requests — always use cached data
- See [docs/data-model.md](docs/data-model.md) for full table definitions, indexes, RLS policies, and discovery query pattern

### Components (Web)
- Use shadcn/ui components from `apps/web/components/ui/`
- Tailwind CSS v4 for all styling — no CSS modules, styled-components, or inline styles
- Server Components by default; add `"use client"` only when the component uses hooks, event handlers, browser APIs, or state
- Colocate single-use components with the route. Shared components go in `components/`
- Prop types defined as `interface` above the component in the same file
- Destructure props in the function signature

### Components (Mobile)
- Use Expo Router for file-based navigation
- Use React Native core components (`View`, `Text`, `ScrollView`, `Pressable`) — not web equivalents
- Navigation: `expo-router` with `(tabs)/` layout for the main tab bar
- Storage: `expo-secure-store` for auth tokens, `@react-native-async-storage/async-storage` for non-sensitive data
- Maps: `@rnmapbox/maps` for Mapbox integration
- Location: `expo-location` for permissions and current position
- API calls go to the Next.js backend URL stored in `app.config.ts` under `extra.apiUrl`
- All env vars accessed via `expo-constants` — never use `process.env` in mobile code

### Error Handling & Logging
- API routes: always wrap DB/external calls in try/catch. Return structured error responses, never raw stack traces
- Log errors with `console.error` including context: user ID, endpoint, and relevant input data (sanitized — never log passwords, tokens, or PII)
- Log warnings with `console.warn` for non-fatal issues (e.g., cache miss, degraded service)
- Client-side: use error boundaries for component tree failures. Show user-friendly error states, never blank screens
- Supabase queries: always check for `error` in the response before using `data`
- Strava errors: see [docs/strava.md](docs/strava.md) for handling strategy

### Async/Await
- Always use `async/await` — never raw `.then()/.catch()` chains
- Parallelize independent async operations with `Promise.all()`:

```typescript
const [user, activities] = await Promise.all([
  db.query.users.findFirst({ where: eq(users.id, userId) }),
  db.query.activities.findMany({ where: eq(activities.creatorId, userId) }),
])
```

## Authentication

Both web and mobile use Supabase Auth. Same JWT, same user row, same session system.

**Web (Next.js):**
- Use `@supabase/ssr` for server-side auth
- `middleware.ts` refreshes sessions and redirects unauthenticated users from `(main)/` to `/login`
- Server Components: `createServerClient()` via cookies. Client Components: `createBrowserClient()`
- API routes extract user from `Authorization: Bearer <token>` header or cookies

**Mobile (Expo):**
- `@supabase/supabase-js` with `AsyncStorage` for session persistence
- Auto-refresh expired sessions on app launch
- Pass JWT as `Authorization: Bearer <token>` on all API calls to Next.js backend
- Supabase Realtime for messaging connects directly using the same JWT

**Strava OAuth:** Optional profile enhancement, not a primary auth method. See [docs/strava.md](docs/strava.md) for full flow.

## Testing

### Framework
Vitest for all tests. Configured at the root `vitest.config.ts` with workspace support.

### Structure
- Test files colocated next to source: `ActivityCard.test.tsx` alongside `ActivityCard.tsx`
- API route tests: mock the Supabase client (use `vi.mock`) — do not hit a real Supabase instance in unit tests. Integration tests against a real DB should be separate and clearly marked

### What to Test
- **Zod validators:** valid input, invalid input, edge cases
- **API routes:** request -> response cycle with mocked Supabase. Verify status codes, response shapes, error handling
- **Utility functions:** pure functions in `packages/shared` and app-specific libs
- **Strava verification logic:** skill level computation with various activity data inputs
- **PostGIS queries:** discovery query logic with known coordinates (integration tests)

### What NOT to Test
- shadcn/ui component rendering (tested upstream)
- Supabase/Drizzle internals
- Third-party SDK behavior

### Test Conventions

```typescript
import { describe, it, expect } from 'vitest'
import { createActivitySchema } from './activity'

describe('createActivitySchema', () => {
  it('validates a correct activity', () => {
    const input = { title: 'Morning hike', sportType: 'hiking', /* ... */ }
    const result = createActivitySchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('rejects missing title', () => {
    const input = { sportType: 'hiking' }
    const result = createActivitySchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})
```

## Environment Variables

All env vars documented in `.env.example` at the root. Both apps read from root `.env` in development.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key          # Server-side only

# Strava
STRAVA_CLIENT_ID=your-client-id
STRAVA_CLIENT_SECRET=your-client-secret                  # Server-side only
NEXT_PUBLIC_STRAVA_REDIRECT_URI=http://localhost:3000/api/strava/callback

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-public-token

# Upstash Redis
UPSTASH_REDIS_REST_URL=your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-token              # Server-side only

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Architecture Rules

1. **One backend, two clients** — Both web and mobile consume the same Next.js API routes and Supabase instance. Never duplicate business logic between apps.
2. **Shared package is the source of truth** — DB schema, Zod validators, TypeScript types, and constants live in `packages/shared`. Apps import, never redefine.
3. **Supabase Auth for everything** — Same JWT system for both clients. RLS policies enforce access control at the database level. Never trust client-provided user IDs — always extract from the JWT.
4. **Cache before calling external APIs** — Strava data cached in DB + Redis. Mapbox geocoding results cached. External APIs are never hit on user-facing request paths.
5. **PostGIS for all geo queries** — Use `ST_DWithin` and `ST_Distance` for proximity. Spatial indexes on all location columns. Never do distance calculations in application code.
6. **Validate at the boundary** — All API inputs validated with Zod before touching the database. All external API responses validated before storing.
7. **Fail gracefully** — Strava down? Show profiles without verification badges. Redis down? Fall through to direct DB query. Never let a third-party outage break the core experience.

## Phase 1 Scope (Discovery MVP)

Building only discovery features:
- User profiles with sports/skill levels
- Strava OAuth + skill verification
- Geolocation-based activity feed (map + list views)
- Activity posting and join requests
- Direct messaging (1:1)
- Map-based discovery view with activity pins

**NOT in scope yet:** real-time "going out now" beacons, transport coordination, gas splitting, group/club management, guide marketplace, condition reporting.

## Deployment

| App | Host | Trigger |
|-----|------|---------|
| Web (Next.js) | Vercel | Auto-deploy on push to `main` and `dev` |
| Mobile (Expo) | EAS Build -> App Store + Google Play | Manual or tagged release |
| Database | Supabase | `pnpm db:push` manually or via CI |

Branching: `main` (production), `dev` (integration), feature branches (`feat/`, `fix/`, `chore/`). PR into `dev` for feature work, merge `dev` -> `main` for releases.
