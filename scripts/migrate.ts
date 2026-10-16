import pg from "pg";
import { readFile } from "node:fs/promises";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const name of ["001_initial.sql", "002_event_outbox.sql"])
    await client.query(
      await readFile(new URL("../db/" + name, import.meta.url), "utf8"),
    );
  await client.query("COMMIT");
  console.log("Database migration complete.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
