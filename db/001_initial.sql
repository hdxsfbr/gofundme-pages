CREATE TABLE IF NOT EXISTS visitors (
 id uuid PRIMARY KEY, token_hash text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS follows (
 visitor_id uuid NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
 target_type text NOT NULL CHECK (target_type IN ('community','fundraiser','organizer')),
 target_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(visitor_id,target_type,target_id)
);
CREATE TABLE IF NOT EXISTS donations (
 id uuid PRIMARY KEY, visitor_id uuid NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
 campaign_id text NOT NULL, cents integer NOT NULL CHECK(cents BETWEEN 100 AND 1000000),
 idempotency_key uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(visitor_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS features (
 visitor_id uuid NOT NULL REFERENCES visitors(id) ON DELETE CASCADE, campaign_id text NOT NULL,
 reason text NOT NULL DEFAULT '' CHECK(char_length(reason)<=280), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(visitor_id,campaign_id)
);
CREATE TABLE IF NOT EXISTS update_views (
 visitor_id uuid NOT NULL REFERENCES visitors(id) ON DELETE CASCADE, campaign_id text NOT NULL,
 viewed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(visitor_id,campaign_id)
);
CREATE TABLE IF NOT EXISTS analytics_sessions (
 id uuid PRIMARY KEY, visitor_id uuid NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
 started_at timestamptz NOT NULL, last_activity_at timestamptz NOT NULL, is_test boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS sessions_visitor ON analytics_sessions(visitor_id,last_activity_at DESC);
CREATE TABLE IF NOT EXISTS events (
 id uuid PRIMARY KEY, visitor_id uuid NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
 session_id uuid NOT NULL REFERENCES analytics_sessions(id), name text NOT NULL,
 entity_id text, properties jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_usage (
 scope text NOT NULL, window_start timestamptz NOT NULL, count integer NOT NULL DEFAULT 0,
 PRIMARY KEY(scope,window_start)
);
