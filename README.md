# Groute

Outdoor activity discovery & social platform. Find compatible people to go outside with — right now, near you, at your level.

## Prerequisites

- **Node.js** v18+ (v22 recommended)
- **pnpm** — install with `npm install -g pnpm`
- **Xcode** (for iOS Simulator) — install from the Mac App Store
- **Expo Go** app on your phone (optional, for testing on a real device)

## Setup

```bash
# Clone and navigate to the project root
cd groute

# Install all dependencies
pnpm install
```

## Project Structure

```
groute/
├── apps/
│   ├── web/             → Next.js web app
│   └── mobile/          → Expo (React Native) mobile app
├── packages/
│   └── shared/          → Shared types, Zod schemas, Drizzle ORM
├── turbo.json           → Turborepo config
├── pnpm-workspace.yaml  → Workspace definition
└── .env.example         → Environment variables template
```

## Running the Apps

### Web App

From the project root (`groute/`):

```bash
pnpm dev:web
```

Open http://localhost:3000 in your browser.

### Mobile App

#### Option A: iOS Simulator (requires Xcode)

```bash
cd apps/mobile
npx expo start --ios
```

This launches the iOS Simulator automatically and loads the app.

#### Option B: Real Device with Expo Go

1. Install **Expo Go** from the App Store (iOS) or Play Store (Android)
2. Make sure your phone and laptop are on the same Wi-Fi network
3. Run:

```bash
cd apps/mobile
npx expo start
```

4. Scan the QR code in your terminal:
   - **iOS**: Use your phone's camera app
   - **Android**: Use the Expo Go app's scanner

#### Option C: Android Emulator (requires Android Studio)

```bash
cd apps/mobile
npx expo start --android
```

### Both Apps at Once

From the project root:

```bash
pnpm dev
```

This starts both the web (port 3000) and mobile (port 8081) dev servers in parallel.

## Other Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages and apps |
| `pnpm build:web` | Build web app only |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm clean` | Remove build artifacts |

## Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

Required services (not needed for basic local dev):
- Supabase (auth + database)
- Strava API (skill verification)
- Mapbox (maps)
- Upstash Redis (caching)

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Web**: Next.js 16, Tailwind CSS v4, shadcn/ui
- **Mobile**: Expo 52, React Native
- **Database**: Supabase (PostgreSQL + PostGIS)
- **ORM**: Drizzle
- **Validation**: Zod
