import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { campaignClips } from "../src/lib/video-content";
import { community } from "../src/lib/content";

const fixture = vi.hoisted(() => ({
  recorded: [] as Array<{
    name: string;
    entity: string;
    properties: Record<string, unknown>;
  }>,
  saved: undefined as
    | { campaignId: string; cents: number; key: string }
    | undefined,
  follows: 0,
}));
vi.mock("@/lib/http", () => ({
  body: async (request: Request) => request.json(),
  RequestError: class RequestError extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
  failure: (error: { message: string; status?: number }) =>
    Response.json({ error: error.message }, { status: error.status ?? 503 }),
}));
vi.mock("@/lib/store", () => ({
  visitor: async () => "visitor",
  state: async () => ({
    donations: fixture.saved ? [fixture.saved] : [],
    follows: [],
  }),
  eventContext: async () => ({ isTest: true }),
  deliverPendingEvents: async () => 0,
  record: async (
    _client: unknown,
    _visitor: string,
    name: string,
    entity: string,
    properties: Record<string, unknown>,
  ) => {
    fixture.recorded.push({ name, entity, properties });
  },
  event: async (
    _visitor: string,
    name: string,
    entity: string,
    properties: Record<string, unknown>,
  ) => {
    fixture.recorded.push({ name, entity, properties });
  },
}));
vi.mock("@/lib/db", () => ({
  transaction: async (fn: (client: unknown) => Promise<void>) =>
    fn({
      query: async (sql: string, values: unknown[]) => {
        if (sql.includes("SELECT * FROM donations"))
          return {
            rows: fixture.saved
              ? [
                  {
                    campaign_id: fixture.saved.campaignId,
                    cents: fixture.saved.cents,
                  },
                ]
              : [],
          };
        if (sql.includes("INSERT INTO donations")) {
          fixture.saved = {
            campaignId: String(values[2]),
            cents: Number(values[3]),
            key: String(values[4]),
          };
          return { rowCount: 1, rows: [] };
        }
        if (sql.includes("INSERT INTO follows"))
          return { rowCount: ++fixture.follows === 1 ? 1 : 0, rows: [] };
        return { rowCount: 0, rows: [] };
      },
    }),
}));

import { POST as action } from "../src/app/api/actions/route";
import {
  POST as collect,
  validClientEventAssociation,
} from "../src/app/api/events/route";

const clip = campaignClips[0];
const other = campaignClips.find(
  (candidate) => candidate.campaignId !== clip.campaignId,
)!;
const request = (path: string, value: object) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(value),
  });

beforeEach(() => {
  fixture.recorded.length = 0;
  fixture.saved = undefined;
  fixture.follows = 0;
});

describe("Watch source validation and trusted outcomes", () => {
  it("accepts an original donation source and retains it through a same-key retry", async () => {
    const key = randomUUID();
    const initial = {
      action: "donate",
      campaignId: clip.campaignId,
      amount: "25",
      key,
      sourceId: clip.id,
    };
    expect((await action(request("/api/actions", initial))).status).toBe(200);
    expect(
      (
        await action(
          request("/api/actions", { ...initial, sourceId: undefined }),
        )
      ).status,
    ).toBe(200);
    expect(fixture.recorded).toEqual([
      {
        name: "donation_completed",
        entity: clip.campaignId,
        properties: {
          cents: 2500,
          attemptId: key,
          source: "watch",
          sourceId: clip.id,
        },
      },
    ]);
    expect(fixture.saved?.campaignId).toBe(clip.campaignId);
  });
  it("rejects unknown/mismatched source and non-fundraiser follow before mutations", async () => {
    for (const sourceId of ["unknown-clip", other.id]) {
      expect(
        (
          await action(
            request("/api/actions", {
              action: "donate",
              campaignId: clip.campaignId,
              amount: "25",
              key: randomUUID(),
              sourceId,
            }),
          )
        ).status,
      ).toBe(400);
    }
    expect(
      (
        await action(
          request("/api/actions", {
            action: "follow",
            targetType: "community",
            targetId: community.id,
            active: true,
            sourceId: clip.id,
          }),
        )
      ).status,
    ).toBe(400);
    expect(fixture.saved).toBeUndefined();
    expect(fixture.recorded).toEqual([]);
  });
  it("keeps old callers and records a valid source only on a saved fundraiser follow", async () => {
    expect(
      (
        await action(
          request("/api/actions", {
            action: "donate",
            campaignId: clip.campaignId,
            amount: "10",
            key: randomUUID(),
          }),
        )
      ).status,
    ).toBe(200);
    expect(fixture.recorded[0].properties.sourceId).toBeUndefined();
    const follow = {
      action: "follow",
      targetType: "fundraiser",
      targetId: clip.campaignId,
      active: true,
      sourceId: clip.id,
    };
    expect((await action(request("/api/actions", follow))).status).toBe(200);
    expect((await action(request("/api/actions", follow))).status).toBe(200);
    expect(fixture.recorded.filter((e) => e.name === "follow_changed")).toEqual(
      [
        {
          name: "follow_changed",
          entity: clip.campaignId,
          properties: {
            targetType: "fundraiser",
            active: true,
            source: "watch",
            sourceId: clip.id,
          },
        },
      ],
    );
  });
  it("validates clip events and sourced share/starts without confusing AI citation IDs", async () => {
    const valid = {
      name: "video_clip_impression",
      entityId: clip.campaignId,
      properties: { source: "watch", sourceId: clip.id },
    };
    expect(validClientEventAssociation(valid)).toBe(true);
    for (const value of [
      { ...valid, entityId: other.campaignId },
      { ...valid, properties: { source: "watch", sourceId: "missing" } },
      { ...valid, name: "share_copied", properties: { source: "watch" } },
      { ...valid, name: "donation_started", properties: { sourceId: clip.id } },
    ]) {
      expect(validClientEventAssociation(value)).toBe(false);
      expect(
        (await collect(request("/api/events", { id: randomUUID(), ...value })))
          .status,
      ).toBe(400);
    }
    expect(
      validClientEventAssociation({
        name: "ai_citation_opened",
        entityId: clip.campaignId,
        properties: { sourceId: "story" },
      }),
    ).toBe(true);
    expect(
      validClientEventAssociation({
        name: "video_feed_opened",
        entityId: "unknown",
        properties: {},
      }),
    ).toBe(false);
    expect(fixture.recorded).toEqual([]);
  });
});
