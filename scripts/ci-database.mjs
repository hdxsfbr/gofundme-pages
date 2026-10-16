import pg from "pg";
const deadline = Date.now() + 60_000;
while (true) {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 2000,
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
    break;
  } catch {
    if (Date.now() >= deadline)
      throw new Error("CI PostgreSQL did not become ready");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } finally {
    await client.end().catch(() => {});
  }
}
