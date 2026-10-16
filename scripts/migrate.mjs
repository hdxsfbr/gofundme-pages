import pg from "pg";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
export const migrationLock = 726493018;
export async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '15s'");
    await client.query("SET LOCAL statement_timeout = '20s'");
    await client.query("SELECT pg_advisory_xact_lock($1)", [migrationLock]);
    for (const name of ["001_initial.sql", "002_event_outbox.sql"])
      await client.query(
        await readFile(new URL("../db/" + name, import.meta.url), "utf8"),
      );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const deadline = setTimeout(() => {
    console.error("Database migration timed out.");
    process.exit(1);
  }, 60000);
  deadline.unref();
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
    statement_timeout: 20000,
  });
  try {
    const connection = new URL(process.env.DATABASE_URL ?? "");
    if (
      !["postgres:", "postgresql:"].includes(connection.protocol) ||
      !connection.hostname
    )
      throw new Error();
    await migrate(pool);
    console.log("Database migration complete.");
  } catch {
    console.error(
      "Database migration failed. Check database configuration, connectivity, and schema compatibility.",
    );
    process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
    await pool.end();
  }
}
