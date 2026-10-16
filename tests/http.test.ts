import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { body, RequestError } from "../src/lib/http";

const primary = "http://127.0.0.1:3000";
const preview = "http://localhost:61071";
function request(
  origin: string | null = primary,
  text = '{"action":"follow"}',
  extra: Record<string, string> = {},
) {
  return new Request("http://untrusted-request-host.invalid/api/actions", {
    method: "POST",
    headers: { ...(origin === null ? {} : { origin }), ...extra },
    body: text,
  });
}
async function rejected(req: Request, status: number, message: string) {
  await expect(body(req)).rejects.toMatchObject({ status, message });
}

describe("explicit mutation origin allowlist", () => {
  beforeEach(() => {
    vi.stubEnv("APP_ORIGIN", primary);
    vi.stubEnv("APP_PREVIEW_ORIGINS", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("accepts the configured primary regardless of the request URL host", async () => {
    expect(await body(request())).toEqual({ action: "follow" });
  });
  it("accepts only explicitly configured preview origins and deduplicates entries", async () => {
    vi.stubEnv(
      "APP_PREVIEW_ORIGINS",
      `${preview}, https://preview.example, ${preview}`,
    );
    expect(await body(request(preview))).toEqual({ action: "follow" });
    expect(await body(request("https://preview.example"))).toEqual({
      action: "follow",
    });
    expect(await body(request(primary))).toEqual({ action: "follow" });
  });
  it.each([
    ["  HTTPS://EXAMPLE.COM:443  ", "https://example.com"],
    ["HTTP://LOCALHOST:80", "http://localhost"],
    ["http://[::1]:61071", "http://[::1]:61071"],
  ])(
    "normalizes configured origin %s to %s",
    async (configured, serialized) => {
      vi.stubEnv("APP_ORIGIN", configured);
      expect(await body(request(serialized))).toEqual({ action: "follow" });
    },
  );
  it.each([
    null,
    "null",
    "https://foreign.example",
    "http://localhost:61072",
    "http://127.0.0.1:61071",
    "https://localhost:61071",
    "http://localhost:61071.evil.example",
    "http://localhost.evil.example:61071",
    `${preview}/`,
    `${preview}/path`,
    `${preview}?query=1`,
    `${preview}#fragment`,
    "http://user@localhost:61071",
    "HTTP://LOCALHOST:61071",
    `${preview}, ${primary}`,
    `${preview} ${primary}`,
  ])(
    "rejects missing, foreign, unconfigured or nonserialized Origin %j",
    async (origin) => {
      vi.stubEnv("APP_PREVIEW_ORIGINS", preview);
      await rejected(
        request(origin),
        403,
        "This action must come from this site.",
      );
    },
  );
  it("does not trust Host, forwarded headers, or request URL as an origin allowlist", async () => {
    await rejected(
      request("https://foreign.example", undefined, {
        host: "foreign.example",
        "x-forwarded-host": "foreign.example",
        "x-forwarded-proto": "https",
        forwarded: 'host="foreign.example";proto=https',
      }),
      403,
      "This action must come from this site.",
    );
    await rejected(
      request("http://untrusted-request-host.invalid"),
      403,
      "This action must come from this site.",
    );
    await rejected(
      request(null, undefined, { host: "127.0.0.1:3000" }),
      403,
      "This action must come from this site.",
    );
  });
  it.each([
    undefined,
    "",
    "   ",
    "null",
    "*",
    "file:///tmp",
    "ftp://example.com",
    "https://example.com/",
    "https://example.com/path",
    "https://example.com\\",
    "https://example.com?query=1",
    "https://example.com#fragment",
    "https://user@example.com",
    "https://user:password@example.com",
    "https://example.com:bad",
    "https://example.com\n.evil.example",
    "https://example.com,https://other.example",
  ])(
    "fails closed for missing or malformed APP_ORIGIN %j",
    async (configured) => {
      vi.stubEnv("APP_ORIGIN", configured);
      vi.stubEnv("APP_PREVIEW_ORIGINS", preview);
      await rejected(
        request(preview),
        503,
        "Site origin configuration is unavailable.",
      );
    },
  );
  it.each([
    ",",
    `${preview},`,
    `,${preview}`,
    `${preview},,https://example.com`,
    `${preview},https://example.com/path`,
    `${preview},http://user@example.com`,
    `${preview},*`,
  ])(
    "fails closed for malformed preview list %j even on primary-origin requests",
    async (previews) => {
      vi.stubEnv("APP_PREVIEW_ORIGINS", previews);
      await rejected(
        request(primary),
        503,
        "Site origin configuration is unavailable.",
      );
    },
  );
  it("treats an absent or whitespace-only preview setting as no previews", async () => {
    for (const value of [undefined, "", "   "]) {
      vi.stubEnv("APP_PREVIEW_ORIGINS", value);
      expect(await body(request(primary))).toEqual({ action: "follow" });
      await rejected(
        request(preview),
        403,
        "This action must come from this site.",
      );
    }
  });
  it("preserves the body-size bound and safe JSON errors", async () => {
    const exact = JSON.stringify("x".repeat(8190));
    expect(exact).toHaveLength(8192);
    expect(await body(request(primary, exact))).toBe("x".repeat(8190));
    await rejected(request(primary, exact + " "), 413, "Request is too large.");
    await rejected(
      request(primary, "private malformed JSON"),
      400,
      "Invalid request.",
    );
    await expect(body(request(primary, "{"))).rejects.toBeInstanceOf(
      RequestError,
    );
  });
});
