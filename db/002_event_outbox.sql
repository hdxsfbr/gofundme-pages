-- Durable intake is independent of the rebuildable analytics projection tables.
CREATE TABLE IF NOT EXISTS event_session_state (
 visitor_id uuid PRIMARY KEY REFERENCES visitors(id) ON DELETE CASCADE,
 session_id uuid NOT NULL, started_at timestamptz NOT NULL,
 last_activity_at timestamptz NOT NULL, is_test boolean NOT NULL
);
INSERT INTO event_session_state(visitor_id,session_id,started_at,last_activity_at,is_test)
 SELECT DISTINCT ON (visitor_id) visitor_id,id,started_at,last_activity_at,is_test
 FROM analytics_sessions ORDER BY visitor_id,last_activity_at DESC,id
 ON CONFLICT(visitor_id) DO NOTHING;
CREATE TABLE IF NOT EXISTS domain_event_outbox (
 id uuid PRIMARY KEY, visitor_id uuid NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
 session_id uuid NOT NULL, session_started_at timestamptz NOT NULL,
 is_test boolean NOT NULL, name text NOT NULL, entity_id text,
 properties jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL,
 delivered_at timestamptz
);
CREATE INDEX IF NOT EXISTS outbox_pending ON domain_event_outbox(created_at,id) WHERE delivered_at IS NULL;
