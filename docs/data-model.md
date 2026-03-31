# Data Model

All schema definitions live in `packages/shared/src/db/schema/`. This is the source of truth — never define tables outside this directory.

## Core Tables

```
users
├── id (uuid, PK, default gen_random_uuid())
├── email (text, unique, not null)
├── display_name (text, not null)
├── bio (text, nullable)
├── avatar_url (text, nullable)
├── location (geography POINT, 4326)         — PostGIS, user's home location
├── location_name (text, nullable)            — "Silver Lake, LA"
├── strava_athlete_id (bigint, nullable)
├── strava_connected (boolean, default false)
├── strava_access_token (text, nullable)      — encrypted at rest
├── strava_refresh_token (text, nullable)     — encrypted at rest
├── strava_token_expires_at (bigint, nullable) — unix timestamp
├── created_at (timestamptz, default now())
└── updated_at (timestamptz, default now())

user_sports                                   — one row per sport per user
├── id (uuid, PK)
├── user_id (FK → users, on delete cascade)
├── sport_type (text, enum-like)              — hiking | climbing | trail_running | surfing | cycling | mountain_biking | skiing | kayaking | yoga
├── self_reported_level (text, enum-like)     — beginner | intermediate | advanced | expert
├── strava_verified_level (text, nullable)    — computed from Strava data
└── strava_stats (jsonb, nullable)            — { total_activities, avg_distance_km, avg_elevation_m, total_distance_km }

activities                                    — the core discovery content
├── id (uuid, PK)
├── creator_id (FK → users, on delete cascade)
├── title (text, not null)
├── description (text, nullable)
├── sport_type (text, not null)
├── skill_level_min (text, not null)
├── skill_level_max (text, not null)
├── location (geography POINT, 4326)          — where the activity takes place
├── location_name (text, not null)
├── max_participants (int, not null, default 4)
├── scheduled_at (timestamptz, not null)
├── status (text, default 'open')             — open | full | completed | cancelled
├── created_at (timestamptz, default now())
└── updated_at (timestamptz, default now())

activity_participants
├── id (uuid, PK)
├── activity_id (FK → activities, on delete cascade)
├── user_id (FK → users, on delete cascade)
├── status (text, default 'requested')        — requested | accepted | declined
└── joined_at (timestamptz, default now())

connections
├── id (uuid, PK)
├── requester_id (FK → users, on delete cascade)
├── receiver_id (FK → users, on delete cascade)
├── status (text, default 'pending')           — pending | accepted | blocked
└── created_at (timestamptz, default now())

messages
├── id (uuid, PK)
├── sender_id (FK → users, on delete cascade)
├── receiver_id (FK → users, on delete cascade)
├── content (text, not null)
├── read_at (timestamptz, nullable)
└── created_at (timestamptz, default now())

strava_activities                              — cached from Strava API, never queried live
├── id (uuid, PK)
├── user_id (FK → users, on delete cascade)
├── strava_activity_id (bigint, unique, not null)
├── sport_type (text, not null)
├── name (text, nullable)                      — activity name from Strava
├── distance_meters (double precision, nullable)
├── elevation_gain_meters (double precision, nullable)
├── moving_time_seconds (int, nullable)
├── start_date (timestamptz, nullable)
├── start_latlng (text, nullable)              — stored as "lat,lng" string
└── synced_at (timestamptz, not null, default now())
```

## Required Indexes

Define these alongside the schema, not in separate migration files:

```sql
-- Geospatial (critical for discovery)
CREATE INDEX idx_users_location ON users USING GIST (location);
CREATE INDEX idx_activities_location ON activities USING GIST (location);

-- Discovery queries
CREATE INDEX idx_activities_sport_status ON activities (sport_type, status, scheduled_at);
CREATE INDEX idx_user_sports_type_level ON user_sports (sport_type, self_reported_level);
CREATE INDEX idx_strava_activities_user ON strava_activities (user_id, sport_type);

-- Messaging
CREATE INDEX idx_messages_conversation ON messages (sender_id, receiver_id, created_at);

-- Connections
CREATE UNIQUE INDEX idx_connections_pair ON connections (
  LEAST(requester_id, receiver_id),
  GREATEST(requester_id, receiver_id)
);
```

## Core Discovery Query Pattern

This is the fundamental query the app is built around. All discovery endpoints should follow this pattern:

```sql
SELECT
  a.*, u.display_name, u.avatar_url,
  ST_Distance(a.location, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography) AS distance_meters
FROM activities a
JOIN users u ON a.creator_id = u.id
WHERE a.status = 'open'
  AND a.sport_type = ANY($sport_types)
  AND a.skill_level_min <= $my_level
  AND a.skill_level_max >= $my_level
  AND ST_DWithin(a.location, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography, $radius_meters)
  AND a.scheduled_at > NOW()
ORDER BY a.scheduled_at ASC
LIMIT 20;
```

## Supabase RLS Policies

Every table must have Row Level Security enabled. Key policies:

- `users`: Users can read any profile. Users can only update their own row.
- `activities`: Anyone can read open activities. Only the creator can update/delete.
- `activity_participants`: Users can read participants for activities they're part of. Users can insert (request to join). Only the activity creator can update participant status.
- `messages`: Users can only read messages where they are sender or receiver. Users can insert messages only as the sender.
- `connections`: Users can read their own connections. Users can insert requests where they are the requester.
- `strava_activities`: Users can only read their own Strava data.
