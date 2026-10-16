type OriginEnvironment = Record<string, string | undefined>;
export function configuredOrigin(value: string): string {
  const input = value.trim();
  if (!/^https?:\/\/[^/?#\\\s]+$/i.test(input))
    throw new Error("Invalid origin configuration.");
  const parsed = new URL(input);
  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  )
    throw new Error("Invalid origin configuration.");
  return parsed.origin;
}
export function allowedOrigins(
  environment: OriginEnvironment = process.env,
): Set<string> {
  if (!environment.APP_ORIGIN) throw new Error("Missing origin configuration.");
  const primary = configuredOrigin(environment.APP_ORIGIN);
  const previews = environment.APP_PREVIEW_ORIGINS?.trim();
  return new Set([
    primary,
    ...(previews ? previews.split(",").map(configuredOrigin) : []),
  ]);
}
