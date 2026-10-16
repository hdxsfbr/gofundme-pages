import "server-only";
import { allowedOrigins } from "./origins";
export class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function body(req: Request) {
  const origin = req.headers.get("origin");
  // Configuration trims whitespace and normalizes URL casing and default ports.
  // Browser Origin headers must exactly match a configured serialized origin.
  let allowed: Set<string>;
  try {
    allowed = allowedOrigins();
  } catch {
    throw new RequestError("Site origin configuration is unavailable.", 503);
  }
  if (!origin || !allowed.has(origin))
    throw new RequestError("This action must come from this site.", 403);
  const text = await req.text();
  if (text.length > 8192) throw new RequestError("Request is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new RequestError("Invalid request.");
  }
}
export function failure(error: unknown) {
  if (error instanceof RequestError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(
    "Request failed",
    error instanceof Error ? error.name : "unknown",
  );
  return Response.json(
    { error: "We could not save that right now. Please try again." },
    { status: 503 },
  );
}
