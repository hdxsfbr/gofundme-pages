import { describe, expect, it } from "vitest";
import { campaigns } from "../src/lib/content";
import { fundingSnapshot, resolveAnswer } from "../src/lib/assistant";
const now = new Date("2026-10-16T12:00:00Z");
const c = {
  ...campaigns[0],
  seed: [
    { cents: 1448900, date: "2026-10-15T12:00:00Z" },
    ...Array.from({ length: 111 }, () => ({
      cents: 100,
      date: "2026-10-15T12:00:00Z",
    })),
  ],
};
const answer = (text: string, sourceIds = ["funding"]) => ({
  status: "supported",
  claims: [{ text, sourceIds }],
  missing: "",
  fundingFacts: [],
});
describe("authoritative funding answers (deterministic fixtures)", () => {
  it("computes $14,600 / 112 as $130.36 with a dated campaign-local source", () => {
    const snapshot = fundingSnapshot(c, [], now);
    expect(snapshot).toMatchObject({
      raisedCents: 1460000,
      contributionCount: 112,
      averageCents: 13036,
      values: { average: "$130.36" },
      snapshot: now.toISOString(),
    });
    const result = resolveAnswer(
      answer("Across {count} contributions, the average is {average}."),
      c,
      [],
      now,
    );
    expect(result.claims[0]).toEqual({
      text: "Across 112 contributions, the average is $130.36.",
      citations: [
        {
          id: "funding",
          label: "Current demo funding",
          date: now.toISOString(),
          href: "/fundraisers/" + c.id + "#funding",
        },
      ],
    });
    expect(result.snapshot).toBe(now.toISOString());
  });
  it("supports the additive average fact and never represents zero-count average as zero or NaN", () => {
    expect(
      resolveAnswer(
        {
          status: "supported",
          claims: [],
          missing: "",
          fundingFacts: ["average"],
        },
        c,
        [],
        now,
      ).facts,
    ).toEqual([{ label: "Average contribution", value: "$130.36" }]);
    const empty = { ...c, seed: [] };
    expect(fundingSnapshot(empty, [], now)).toMatchObject({
      averageCents: null,
      values: { average: null },
    });
    expect(fundingSnapshot(empty, [], now).source.text).toContain(
      "undefined because there are no completed contributions",
    );
    expect(() =>
      resolveAnswer(answer("The average is {average}."), empty, [], now),
    ).toThrow("undefined");
    expect(() =>
      resolveAnswer(
        {
          status: "supported",
          claims: [],
          missing: "",
          fundingFacts: ["average"],
        },
        empty,
        [],
        now,
      ),
    ).toThrow("undefined");
    expect(
      resolveAnswer(
        {
          status: "missing",
          claims: [],
          missing:
            "There are no completed contributions, so an average is not defined yet.",
          fundingFacts: [],
        },
        empty,
        [],
        now,
      ).status,
    ).toBe("missing");
  });
  it("removes selected facts only for keys rendered through cited placeholders", () => {
    const result = resolveAnswer(
      {
        ...answer(
          "Across {count} contributions, the average is {average}; that average is {average}.",
        ),
        fundingFacts: ["average", "count", "raised", "raised"],
      },
      c,
      [],
      now,
    );
    expect(result.claims[0].text).toBe(
      "Across 112 contributions, the average is $130.36; that average is $130.36.",
    );
    expect(result.facts).toEqual([
      { label: "Raised in your demo", value: "$14,600.00" },
    ]);
    const literal = resolveAnswer(
      { ...answer("The average is $130.36."), fundingFacts: ["average"] },
      c,
      [],
      now,
    );
    expect(literal.facts).toEqual([
      { label: "Average contribution", value: "$130.36" },
    ]);
  });
  it.each([
    ["The average is {average}.", ["story"]],
    ["The amount is {invented}.", ["funding"]],
    ["The amount is {{raised}}.", ["funding"]],
    ["The average is $8,888.", ["funding"]],
  ])(
    "rejects unknown, unsourced, malformed or forged funding claims (%s)",
    (text, ids) => {
      expect(() => resolveAnswer(answer(text, ids), c, [], now)).toThrow();
    },
  );
  it("rejects contradictions between missing status and selected known facts", () => {
    expect(() =>
      resolveAnswer(
        {
          status: "missing",
          claims: [],
          missing: "The average is unavailable.",
          fundingFacts: ["average"],
        },
        c,
        [],
        now,
      ),
    ).toThrow("available funding facts");
    expect(() =>
      resolveAnswer(
        {
          status: "supported",
          claims: [],
          missing: "The funding is unknown.",
          fundingFacts: ["raised"],
        },
        c,
        [],
        now,
      ),
    ).toThrow("missing information");
  });
});
