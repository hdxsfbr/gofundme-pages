"use client";
export function track(
  name: string,
  entityId: string | null,
  properties: Record<string, unknown> = {},
) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      name,
      entityId,
      properties,
    }),
    keepalive: true,
  }).catch(() => {});
}
