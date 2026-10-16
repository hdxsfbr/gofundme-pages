import { describe, it, expect } from "vitest";
import {
  campaigns,
  community,
  organizers,
  validTarget,
} from "../src/lib/content";
import {
  amountCents,
  funding,
  history,
  followingCampaigns,
  searchCampaigns,
  needsNewSession,
} from "../src/lib/domain";
import { sanitizeProperties } from "../src/lib/events";
import { resolveAnswer, sources } from "../src/lib/assistant";
const c = campaigns[0];
describe("fixed fictional dataset", () => {
  it("links four campaigns to four organizers and contains positive integer-cent goals", () => {
    expect(campaigns).toHaveLength(4);
    expect(organizers).toHaveLength(4);
    for (const c of campaigns) {
      expect(validTarget("organizer", c.organizerId)).toBe(true);
      expect(c.goal).toBeGreaterThan(0);
      expect(Number.isInteger(c.goal)).toBe(true);
      expect(
        c.seed.every(
          (d) =>
            Number.isInteger(d.cents) &&
            d.cents > 0 &&
            !isNaN(Date.parse(d.date)),
        ),
      ).toBe(true);
      expect(c.updates.every((u) => u.id && u.date)).toBe(true);
      expect(new Set(sources(c).map((s) => s.id)).size).toBe(sources(c).length);
    }
  });
  it("has complete and absent budget details", () => {
    expect(c.budget).toContain("$7,000");
    expect(campaigns[1].budget).toContain("not been supplied");
  });
});
describe("authoritative amounts", () => {
  it.each([
    "0",
    "-1",
    "1.001",
    "10000.01",
    "NaN",
    "Infinity",
    "1e3",
    "",
    "  ",
    "abc",
    "$20",
  ])("rejects %s", (v) => expect(() => amountCents(v)).toThrow());
  it.each([
    ["1", 100],
    ["12.50", 1250],
    ["10000", 1000000],
    [" 25.1 ", 2510],
  ])("parses %s exactly", (v, cents) => expect(amountCents(v)).toBe(cents));
  it("adds only the current campaign and handles overfunding without negative remaining", () => {
    const d = [
      {
        id: "1",
        campaign_id: c.id,
        cents: 1000000,
        created_at: "2026-10-15T12:00:00Z",
      },
      {
        id: "2",
        campaign_id: campaigns[1].id,
        cents: 99999,
        created_at: "2026-10-15T12:00:00Z",
      },
    ];
    expect(funding(c, d)).toEqual({
      raised: 2185000,
      goal: 1500000,
      count: 87,
      percent: 146,
      remaining: 0,
    });
    expect(funding(c, []).raised).toBe(1185000);
  });
  it("includes pre-window balance and precise UTC boundaries", () => {
    const test = {
      ...c,
      seed: [
        { cents: 100, date: "2026-10-08T23:59:59Z" },
        { cents: 200, date: "2026-10-09T00:00:00Z" },
        { cents: 300, date: "2026-10-15T12:00:00Z" },
      ],
    };
    const h = history(test, [], "7", new Date("2026-10-15T15:00:00Z"));
    expect(h.points[0].cents).toBe(100);
    expect(h.change).toBe(500);
    expect(h.count).toBe(2);
    expect(h.points.at(-1)?.cents).toBe(600);
  });
  it("keeps a quiet period flat and zero", () => {
    const h = history(c, [], "7", new Date("2026-12-01T00:00:00Z"));
    expect(h.change).toBe(0);
    expect(h.count).toBe(0);
    expect(new Set(h.points.map((p) => p.cents)).size).toBe(1);
  });
});
describe("discovery and relationships", () => {
  it("combines topic with case-insensitive title/name/need search", () => {
    expect(searchCampaigns(campaigns, "MAYA", "Food & community")).toEqual([c]);
    expect(searchCampaigns(campaigns, "MAYA", "Clean energy")).toEqual([]);
    expect(searchCampaigns(campaigns, "empty lot", "")).toEqual([c]);
  });
  it("deduplicates the follow union and retains indirect relationships", () => {
    const follows = [
      { target_type: "community", target_id: community.id },
      { target_type: "fundraiser", target_id: c.id },
      { target_type: "organizer", target_id: c.organizerId },
    ];
    expect(followingCampaigns(follows)).toHaveLength(4);
    expect(followingCampaigns(follows.slice(0, 1))).toHaveLength(4);
    expect(followingCampaigns([])).toEqual([]);
  });
});
describe("measurement boundaries", () => {
  it("starts a new session at exactly 30 minutes", () => {
    expect(
      needsNewSession("2026-10-15T12:00:00Z", new Date("2026-10-15T12:29:59Z")),
    ).toBe(false);
    expect(
      needsNewSession("2026-10-15T12:00:00Z", new Date("2026-10-15T12:30:00Z")),
    ).toBe(true);
  });
  it("removes raw content, secrets and non-finite metrics", () =>
    expect(
      sanitizeProperties({
        question: "personal",
        answer: "text",
        reason: "note",
        cookie: "secret",
        query: "something",
        pageType: "fundraisers",
        latencyMs: 100,
        value: Infinity,
      }),
    ).toEqual({ pageType: "fundraisers", latencyMs: 100 }));
});
describe("AI response boundary (fixtures, not live generation)", () => {
  const answer = {
    status: "supported",
    claims: [
      { text: "The plan includes twelve raised beds.", sourceIds: ["story"] },
    ],
    missing: "",
    fundingFacts: ["remaining"],
  } as const;
  it("resolves citations and fresh numeric facts from records", () => {
    const a = resolveAnswer(answer, c, [
      {
        id: "1",
        campaign_id: c.id,
        cents: 1250,
        created_at: "2026-10-15T12:00:00Z",
      },
    ]);
    expect(a.facts[0].value).toBe("$3,137.50");
    expect(a.claims[0].citations[0].href).toBe(
      "/fundraisers/" + c.id + "#story",
    );
  });
  it("rejects unknown and another campaign’s citations", () => {
    for (const source of ["invented", "solar-assessment"])
      expect(() =>
        resolveAnswer(
          { ...answer, claims: [{ text: "A claim.", sourceIds: [source] }] },
          c,
          [],
        ),
      ).toThrow();
  });
  it("rejects unsupported numeric statements", () =>
    expect(() =>
      resolveAnswer(
        {
          ...answer,
          claims: [
            { text: "Already planted 999 trees.", sourceIds: ["story"] },
          ],
        },
        c,
        [],
      ),
    ).toThrow());
  it("rejects unsupported and malformed outputs", () => {
    expect(() =>
      resolveAnswer(
        { ...answer, claims: [{ text: "A fact.", sourceIds: [] }] },
        c,
        [],
      ),
    ).toThrow();
    expect(() => resolveAnswer({ claims: [] }, c, [])).toThrow();
  });
  it("accepts explicit missing information without a fabricated citation", () =>
    expect(
      resolveAnswer(
        {
          status: "missing",
          claims: [],
          missing: "No itemized budget was supplied.",
          fundingFacts: [],
        },
        campaigns[1],
        [],
      ).status,
    ).toBe("missing"));
});

it("rejects an unexplained abstention instead of rendering an empty answer", () => {
  expect(() =>
    resolveAnswer(
      { status: "missing", claims: [], missing: "  ", fundingFacts: [] },
      c,
      [],
    ),
  ).toThrow("explanation");
});
