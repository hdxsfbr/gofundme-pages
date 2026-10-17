import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { campaigns, organizers } from "../src/lib/content";
import {
  campaignClips,
  clipById,
  validateCampaignClips,
} from "../src/lib/video-content";

describe("campaign video catalog", () => {
  it("provides one playable, captioned demo clip for every fictional campaign", () => {
    expect(new Set(campaignClips.map((clip) => clip.campaignId))).toEqual(
      new Set(campaigns.map((campaign) => campaign.id)),
    );
    expect(campaignClips).toHaveLength(campaigns.length);
    for (const campaign of campaigns) {
      const clip = campaignClips.find(
        (item) => item.campaignId === campaign.id,
      );
      expect(clip).toBeDefined();
      expect(clip?.profileId).toBe(campaign.organizerId);
      expect(clip?.role).toBe("organizer");
    }
  });

  it("keeps every local asset present, bounded, and within the release duration", () => {
    for (const clip of campaignClips) {
      expect(clip.duration).toBeGreaterThanOrEqual(15);
      expect(clip.duration).toBeLessThanOrEqual(45);
      expect(clip.provenance).toContain("Pexels");
      expect(clip.storyText.length).toBeGreaterThan(30);
      expect(clip.provenance.toLowerCase()).toMatch(
        /not [^.]+ and (do|does) not endorse/,
      );
      for (const asset of [clip.src, clip.poster, clip.captions]) {
        expect(asset.startsWith("/media/watch/")).toBe(true);
        const file = resolve(process.cwd(), "public", asset.slice(1));
        expect(existsSync(file), `${asset} exists`).toBe(true);
        if (asset.endsWith(".mp4"))
          expect(statSync(file).size).toBeLessThan(8 * 1024 * 1024);
      }
    }
    expect(
      campaignClips.reduce(
        (sum, clip) =>
          sum +
          statSync(resolve(process.cwd(), "public", clip.src.slice(1))).size,
        0,
      ),
    ).toBeLessThan(80 * 1024 * 1024);
  });

  it("looks up clips by stable identifier", () => {
    expect(clipById("garden-neighbors")).toBe(campaignClips[0]);
    expect(clipById("missing")).toBeUndefined();
  });

  it("validates release assets, associations, unique IDs, roles, and content bounds", () => {
    const exists = (asset: string) =>
      existsSync(resolve(process.cwd(), "public", asset.slice(1)));
    const valid = (clips: typeof campaignClips) =>
      validateCampaignClips(
        clips,
        campaigns,
        new Set(organizers.map((organizer) => organizer.id)),
        exists,
      );
    expect(valid(campaignClips)).toEqual([]);

    const [first, ...rest] = campaignClips;
    expect(
      valid([{ ...first, src: "/media/watch/missing.mp4" }, ...rest]),
    ).toContain(
      "Missing or unsupported local media asset for clip garden-neighbors: /media/watch/missing.mp4",
    );
    expect(
      valid([{ ...first, campaignId: "unknown-campaign" }, ...rest]),
    ).toContain("Unknown campaign for clip garden-neighbors.");
    expect(valid([{ ...first, id: rest[0].id }, ...rest])).toContain(
      `Duplicate clip ID: ${rest[0].id}`,
    );
    expect(valid([{ ...first, duration: 90 }, ...rest])).toContain(
      `Clip ${first.id} must be 15–45 seconds long.`,
    );
    expect(valid(rest)).toContain(
      `No Watch clip is published for campaign ${campaigns[0].id}.`,
    );
    expect(
      valid([...campaignClips, ...campaignClips, ...campaignClips.slice(0, 3)]),
    ).toContain("The Watch catalog must contain between four and ten clips.");
  });
});
