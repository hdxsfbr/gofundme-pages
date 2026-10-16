import "server-only";
import pg from "pg";
const globalDb = globalThis as unknown as { demoPool?: pg.Pool };
export const pool =
  globalDb.demoPool ??
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 8,
    connectionTimeoutMillis: 3000,
    statement_timeout: 5000,
  });
if (process.env.NODE_ENV !== "production") globalDb.demoPool = pool;
export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
