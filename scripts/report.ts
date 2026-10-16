import pg from "pg";
import {
  engagementReport,
  reportWindow,
  type ReportEvent,
  type ReportOptions,
  type ReportSession,
} from "../src/lib/report";
import { flushOutbox } from "../src/lib/outbox";

function argumentsForReport(args: string[]): ReportOptions {
  const options: ReportOptions = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--include-test") options.includeTest = true;
    else if (
      (flag === "--from" || flag === "--to") &&
      args[i + 1] &&
      !args[i + 1].startsWith("--")
    )
      options[flag === "--from" ? "from" : "to"] = args[++i];
    else
      throw new Error(
        "Usage: npm run report -- [--from ISO_TIMESTAMP] [--to ISO_TIMESTAMP] [--include-test]",
      );
  }
  reportWindow(options);
  return options;
}

let pool: pg.Pool | undefined;
try {
  const options = argumentsForReport(process.argv.slice(2));
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  // Reconcile durable events before taking the read-only report snapshot.
  let reconciled = 0;
  for (let batch = 0; batch < 20; batch++) {
    const count = await flushOutbox(pool);
    reconciled += count;
    if (count < 500) break;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    // Fetch only report fields; retain pre-window sessions to recognize returns.
    const sessions = await client.query<ReportSession>(
      "SELECT id, visitor_id, started_at, is_test FROM analytics_sessions WHERE ($1::boolean OR NOT is_test) AND ($2::timestamptz IS NULL OR started_at < $2)",
      [!!options.includeTest, options.to ?? null],
    );
    const events = await client.query<ReportEvent>(
      `SELECT e.id, e.visitor_id, e.session_id, e.name, e.entity_id, e.created_at,
      jsonb_strip_nulls(jsonb_build_object('pageType',e.properties->'pageType','active',e.properties->'active',
        'attemptId',e.properties->'attemptId','requestId',e.properties->'requestId','cents',e.properties->'cents',
        'latencyMs',e.properties->'latencyMs')) AS properties
      FROM events e JOIN analytics_sessions s ON s.id=e.session_id
      WHERE ($1::boolean OR NOT s.is_test) AND ($2::timestamptz IS NULL OR e.created_at >= $2)
        AND ($3::timestamptz IS NULL OR e.created_at < $3)`,
      [!!options.includeTest, options.from ?? null, options.to ?? null],
    );
    const pending = await client.query(
      "SELECT count(*)::integer AS count FROM domain_event_outbox WHERE delivered_at IS NULL",
    );
    await client.query("COMMIT");
    console.log(
      JSON.stringify(
        {
          ...engagementReport(events.rows, sessions.rows, options),
          outbox: { reconciled, pending: pending.rows[0].count },
        },
        null,
        2,
      ),
    );
  } finally {
    client.release();
  }
} catch (error) {
  // Database errors may contain connection details; only our input errors are printed.
  console.error(
    error instanceof Error &&
      /^(Usage:|DATABASE_URL|Time bounds|Invalid analytics timestamp|The start)/.test(
        error.message,
      )
      ? error.message
      : "Analytics report failed. Check database connectivity and migrations.",
  );
  process.exitCode = 1;
} finally {
  await pool?.end();
}
