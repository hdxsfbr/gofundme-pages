import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const database = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db", () => ({ pool: database }));
import { GET } from "../src/app/api/health/route";
import { readiness, healthSchemaQuery } from "../src/lib/health";
import { proxy } from "../src/proxy";

const environment = {
  APP_ORIGIN: "https://demo.example",
  DATABASE_URL: "postgresql://runtime:private@database.internal:5432/demo",
  RAILWAY_DEPLOYMENT_ID: "deployment-under-test",
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
describe("readiness", () => {
  it("checks the required schema without reading visitor rows and returns release identity", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    expect(await readiness(query, environment)).toEqual({
      status: 200,
      body: { status: "ok", deploymentId: "deployment-under-test" },
    });
    expect(query).toHaveBeenCalledExactlyOnceWith(healthSchemaQuery);
    expect(healthSchemaQuery).toMatch(/LIMIT 0$/);
    for (const table of [
      "donations",
      "domain_event_outbox",
      "ai_usage",
      "analytics_sessions",
    ])
      expect(healthSchemaQuery).toContain(table);
  });
  it.each([
    { APP_ORIGIN: undefined },
    { APP_ORIGIN: "https://demo.example/path" },
    { APP_PREVIEW_ORIGINS: "https://preview.example," },
    { DATABASE_URL: undefined },
    { DATABASE_URL: "https://database.internal/demo" },
    { DATABASE_URL: "postgresql:/demo" },
  ])(
    "fails closed before querying for invalid configuration %j",
    async (invalid) => {
      const query = vi.fn();
      expect(await readiness(query, { ...environment, ...invalid })).toEqual({
        status: 503,
        body: { status: "unavailable" },
      });
      expect(query).not.toHaveBeenCalled();
    },
  );
  it("does not expose database errors or configuration", async () => {
    const query = vi
      .fn()
      .mockRejectedValue(new Error(environment.DATABASE_URL));
    expect(await readiness(query, environment)).toEqual({
      status: 503,
      body: { status: "unavailable" },
    });
  });
  it("bounds a hung database check", async () => {
    vi.useFakeTimers();
    const result = readiness(() => new Promise(() => {}), environment);
    await vi.advanceTimersByTimeAsync(4000);
    expect(await result).toEqual({
      status: 503,
      body: { status: "unavailable" },
    });
  });
  it("supports local readiness without inventing a deployment identity", async () => {
    expect(
      await readiness(async () => ({}), {
        ...environment,
        RAILWAY_DEPLOYMENT_ID: undefined,
      }),
    ).toMatchObject({
      status: 200,
      body: { deploymentId: null },
    });
  });
});
describe("health route and cookie proxy", () => {
  beforeEach(() => {
    for (const [name, value] of Object.entries(environment))
      vi.stubEnv(name, value);
    vi.stubEnv("APP_PREVIEW_ORIGINS", "");
    database.query.mockResolvedValue({ rows: [] });
  });
  it("returns uncached health without establishing a visitor", async () => {
    const request = new NextRequest("http://internal:3000/api/health");
    const proxied = proxy(request);
    expect(proxied.headers.get("set-cookie")).toBeNull();
    expect(request.cookies.get("demo_session")).toBeUndefined();
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({
      status: "ok",
      deploymentId: environment.RAILWAY_DEPLOYMENT_ID,
    });
  });
  it("sets secure cookies for the configured HTTPS site despite HTTP behind the proxy", () => {
    const response = proxy(
      new NextRequest("http://internal:3000/communities/watch-duty", {
        headers: { "x-forwarded-proto": "http", host: "untrusted.example" },
      }),
    );
    expect(response.cookies.get("demo_session")).toMatchObject({
      secure: true,
      httpOnly: true,
      sameSite: "lax",
    });
  });
  it("keeps explicitly configured local HTTP usable without trusting forwarding headers", () => {
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    const response = proxy(
      new NextRequest("http://localhost:3000/", {
        headers: { "x-forwarded-proto": "https" },
      }),
    );
    expect(response.cookies.get("demo_session")?.secure).toBe(false);
  });
});
