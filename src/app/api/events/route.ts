import { z } from "zod";
import { clientEvents } from "@/lib/events";
import { body, failure, RequestError } from "@/lib/http";
import { event, visitor } from "@/lib/store";
const schema = z
  .object({
    id: z.uuid(),
    name: z.enum(clientEvents),
    entityId: z.string().max(80).nullable(),
    properties: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export async function POST(req: Request) {
  try {
    const p = schema.safeParse(await body(req));
    if (!p.success) throw new RequestError("Invalid event.");
    const a = p.data;
    await event(await visitor(), a.name, a.entityId, a.properties, a.id);
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
