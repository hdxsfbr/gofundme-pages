export type CampaignClip = {
  id: string;
  campaignId: string;
  profileId: string;
  role: "organizer" | "supporter";
  title: string;
  publishedAt: string;
  src: string;
  poster: string;
  captions: string;
  storyText: string;
  duration: number;
  hasAudio: boolean;
  provenance: string;
};

/** Four reviewed, fictional demo clips. Stock performers are not the listed organizers. */
export const campaignClips: CampaignClip[] = [
  {
    id: "garden-neighbors",
    campaignId: "grow-a-neighborhood",
    profileId: "maya-chen",
    role: "organizer",
    title: "Room to grow. Food to share.",
    publishedAt: "2026-10-16T12:00:00Z",
    src: "/media/watch/garden.mp4",
    poster: "/media/watch/garden.webp",
    captions: "/media/watch/garden.vtt",
    storyText:
      "A shared garden means fresh food and new friendships. Help turn an empty lot into a welcoming place to grow together.",
    duration: 18,
    hasAudio: false,
    provenance:
      "Editorial demo text over illustrative stock footage by cottonbro studio (Pexels video 9723220), https://www.pexels.com/video/people-planting-plant-together-9723220/. Downloaded 2026-10-16 under the Pexels License. The pictured people are not Maya Chen and do not endorse this fictional campaign.",
  },
  {
    id: "tree-care",
    campaignId: "roots-for-the-future",
    profileId: "elias-rivera",
    role: "organizer",
    title: "More trees. A cooler tomorrow.",
    publishedAt: "2026-10-16T12:05:00Z",
    src: "/media/watch/trees.mp4",
    poster: "/media/watch/trees.webp",
    captions: "/media/watch/trees.vtt",
    storyText:
      "Native trees need neighbors to plant and care for them. Help restore green spaces around the neighborhood.",
    duration: 15.2,
    hasAudio: false,
    provenance:
      "Editorial demo text over illustrative stock footage by Mikhail Nilov (Pexels video 8544140), https://www.pexels.com/video/man-planting-tree-8544140/. Downloaded 2026-10-16 under the Pexels License. The pictured person is not Elias Rivera and does not endorse this fictional campaign.",
  },
  {
    id: "common-ground-solar",
    campaignId: "power-our-common-ground",
    profileId: "imani-brooks",
    role: "organizer",
    title: "A brighter kind of community.",
    publishedAt: "2026-10-16T12:10:00Z",
    src: "/media/watch/solar.mp4",
    poster: "/media/watch/solar.webp",
    captions: "/media/watch/solar.vtt",
    storyText:
      "Help plan a brighter, more resilient community center. Support a proposed rooftop solar installation.",
    duration: 20,
    hasAudio: false,
    provenance:
      "Editorial demo text over illustrative stock footage by Los Muertos Crew (Pexels video 8853459), https://www.pexels.com/video/two-men-carrying-up-a-solar-panel-8853459/. Downloaded 2026-10-16 under the Pexels License. The pictured workers are not Imani Brooks and do not endorse this fictional campaign.",
  },
  {
    id: "open-path-access",
    campaignId: "a-path-for-everyone",
    profileId: "noah-patel",
    role: "organizer",
    title: "The outside is for everyone.",
    publishedAt: "2026-10-16T12:15:00Z",
    src: "/media/watch/trail.mp4",
    poster: "/media/watch/trail.webp",
    captions: "/media/watch/trail.vtt",
    storyText:
      "An accessible trail starts with listening and better paths. Help more neighbors enjoy the outdoors.",
    duration: 16,
    hasAudio: false,
    provenance:
      "Editorial demo text over illustrative stock footage by SHVETS production (Pexels videos 8400732 and 8400826), https://www.pexels.com/video/a-woman-talking-to-her-partner-riding-on-wheelchair-8400732/ and https://www.pexels.com/video/a-woman-assisting-her-partner-riding-on-wheelchair-while-in-the-park-8400826/. Two excerpts edited together. Downloaded 2026-10-16 under the Pexels License. The pictured people are not Noah Patel and do not endorse this fictional campaign.",
  },
];

export const clipById = (id: string) =>
  campaignClips.find((clip) => clip.id === id);

export function validateCampaignClips(
  clips: readonly CampaignClip[],
  campaigns: readonly { id: string; organizerId: string }[],
  profileIds: ReadonlySet<string>,
  assetExists: (path: string) => boolean,
) {
  const errors: string[] = [];
  const ids = new Set<string>();
  const coveredCampaigns = new Set<string>();
  if (clips.length < 4 || clips.length > 10)
    errors.push("The Watch catalog must contain between four and ten clips.");

  for (const clip of clips) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clip.id))
      errors.push(`Invalid clip ID: ${clip.id}`);
    if (ids.has(clip.id)) errors.push(`Duplicate clip ID: ${clip.id}`);
    ids.add(clip.id);

    const campaign = campaigns.find((item) => item.id === clip.campaignId);
    if (!campaign) errors.push(`Unknown campaign for clip ${clip.id}.`);
    else {
      coveredCampaigns.add(campaign.id);
      if (!profileIds.has(clip.profileId))
        errors.push(`Unknown publishing profile for clip ${clip.id}.`);
      const expectedRole =
        campaign.organizerId === clip.profileId ? "organizer" : "supporter";
      if (clip.role !== expectedRole)
        errors.push(`Invalid publishing role for clip ${clip.id}.`);
    }

    if (
      !Number.isFinite(clip.duration) ||
      clip.duration < 15 ||
      clip.duration > 45
    )
      errors.push(`Clip ${clip.id} must be 15–45 seconds long.`);
    if (typeof clip.hasAudio !== "boolean")
      errors.push(`Clip ${clip.id} must declare whether audio is available.`);
    if (!clip.title.trim() || !clip.storyText.trim() || !clip.provenance.trim())
      errors.push(
        `Clip ${clip.id} is missing editorial or provenance details.`,
      );
    for (const asset of [clip.src, clip.poster, clip.captions]) {
      if (!asset.startsWith("/media/watch/") || !assetExists(asset))
        errors.push(
          `Missing or unsupported local media asset for clip ${clip.id}: ${asset}`,
        );
    }
  }

  for (const campaign of campaigns) {
    if (!coveredCampaigns.has(campaign.id))
      errors.push(`No Watch clip is published for campaign ${campaign.id}.`);
  }
  return errors;
}
