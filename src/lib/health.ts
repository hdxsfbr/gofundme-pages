import { allowedOrigins } from "./origins";
// LIMIT 0 checks required tables, columns and read permissions without reading visitor data.
export const healthSchemaQuery = `SELECT
 v.id,v.token_hash,v.created_at,f.visitor_id,f.target_type,f.target_id,f.created_at,
 d.id,d.visitor_id,d.campaign_id,d.cents,d.idempotency_key,d.created_at,
 p.visitor_id,p.campaign_id,p.reason,p.updated_at,u.visitor_id,u.campaign_id,u.viewed_at,
 a.id,a.visitor_id,a.started_at,a.last_activity_at,a.is_test,
 e.id,e.visitor_id,e.session_id,e.name,e.entity_id,e.properties,e.created_at,
 s.visitor_id,s.session_id,s.started_at,s.last_activity_at,s.is_test,
 o.id,o.visitor_id,o.session_id,o.session_started_at,o.is_test,o.name,o.entity_id,o.properties,o.created_at,o.delivered_at,
 b.scope,b.window_start,b.count
 FROM visitors v LEFT JOIN follows f ON false LEFT JOIN donations d ON false
 LEFT JOIN features p ON false LEFT JOIN update_views u ON false
 LEFT JOIN analytics_sessions a ON false LEFT JOIN events e ON false
 LEFT JOIN event_session_state s ON false LEFT JOIN domain_event_outbox o ON false
 LEFT JOIN ai_usage b ON false LIMIT 0`;
type HealthEnvironment = Record<string, string | undefined>;
export async function readiness(
  query: (sql: string) => Promise<unknown>,
  environment: HealthEnvironment = process.env,
  timeoutMs = 4000,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    allowedOrigins(environment);
    const connection = new URL(environment.DATABASE_URL ?? "");
    if (
      !["postgres:", "postgresql:"].includes(connection.protocol) ||
      !connection.hostname
    )
      throw new Error();
    await Promise.race([
      query(healthSchemaQuery),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error()), timeoutMs);
      }),
    ]);
    return {
      status: 200,
      body: {
        status: "ok",
        deploymentId: environment.RAILWAY_DEPLOYMENT_ID || null,
      },
    };
  } catch {
    return { status: 503, body: { status: "unavailable" } };
  } finally {
    clearTimeout(timer);
  }
}
