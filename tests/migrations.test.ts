import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { migrate } from "../scripts/migrate.mjs";
import { healthSchemaQuery } from "../src/lib/health";

// Database integration uses an explicitly provided disposable PostgreSQL instance.
const connectionString = process.env.DATABASE_URL;
describe.skipIf(!connectionString)(
  "native migrations (isolated PostgreSQL schemas)",
  () => {
    let admin: pg.Pool;
    const pools: pg.Pool[] = [];
    const schemas: string[] = [];
    async function isolated() {
      const schema = "migration_test_" + randomUUID().replaceAll("-", "");
      schemas.push(schema);
      await admin.query(`CREATE SCHEMA "${schema}"`);
      const pool = new pg.Pool({
        connectionString,
        options: `-c search_path=${schema}`,
        max: 3,
      });
      pools.push(pool);
      return pool;
    }
    beforeAll(() => {
      admin = new pg.Pool({ connectionString });
    });
    afterAll(async () => {
      await Promise.all(pools.map((pool) => pool.end()));
      for (const schema of schemas)
        await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    });
    it("initializes an empty database and preserves saved data on repeated migrations", async () => {
      const pool = await isolated();
      await migrate(pool);
      await pool.query("INSERT INTO visitors(id,token_hash) VALUES($1,$2)", [
        randomUUID(),
        "saved-before-redeploy",
      ]);
      await migrate(pool);
      expect(
        (await pool.query("SELECT token_hash FROM visitors")).rows,
      ).toEqual([{ token_hash: "saved-before-redeploy" }]);
      await expect(pool.query(healthSchemaQuery)).resolves.toMatchObject({
        rows: [],
      });
    });
    it("serializes simultaneous initial migrations using a transaction advisory lock", async () => {
      const pool = await isolated();
      await Promise.all([migrate(pool), migrate(pool), migrate(pool)]);
      await expect(pool.query(healthSchemaQuery)).resolves.toMatchObject({
        rows: [],
      });
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema=current_schema() AND table_type='BASE TABLE'",
          )
        ).rows[0].count,
      ).toBe(10);
    });
    it("rolls back partial schema changes on an incompatible existing schema", async () => {
      const pool = await isolated();
      await pool.query("CREATE TABLE visitors (incompatible text)");
      await expect(migrate(pool)).rejects.toThrow();
      expect(
        (
          await pool.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema()",
          )
        ).rows,
      ).toEqual([{ table_name: "visitors" }]);
      // Failed clients are released and the migration transaction leaves no outstanding lock.
      expect(
        (await pool.query("SELECT 1 AS available")).rows[0].available,
      ).toBe(1);
    });
  },
);
it("the native CLI rejects missing configuration without exposing credentials", () => {
  const result = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: "https://private:secret@example.invalid/demo",
    },
    encoding: "utf8",
  });
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toBe(
    "Database migration failed. Check database configuration, connectivity, and schema compatibility.\n",
  );
});
