import { pool } from "@/lib/db";
import { readiness } from "@/lib/health";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  const result = await readiness((sql) => pool.query(sql));
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
