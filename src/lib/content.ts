export type Topic =
  | "Food & community"
  | "Climate & nature"
  | "Clean energy"
  | "Outdoor access";
export type Update = { id: string; date: string; title: string; body: string };
export type Campaign = {
  id: string;
  title: string;
  shortTitle: string;
  need: string;
  topic: Topic;
  organizerId: string;
  beneficiary: string;
  goal: number;
  image: string;
  alt: string;
  location: string;
  story: string;
  budget: string;
  createdAt: string;
  updates: Update[];
  seed: { cents: number; date: string }[];
};
export const community = {
  id: "a-greener-tomorrow",
  name: "A greener tomorrow",
  description: "Small acts. Shared roots. A future we build together.",
  location: "Portland, Oregon",
  updates: [
    {
      id: "community-welcome",
      date: "2026-10-14T16:00:00Z",
      title: "Good things grow together",
      body: "Our four neighborhood projects are welcoming new supporters. Explore their stories, meet the organizers, and find a cause that feels like you.",
    },
  ],
};
export const organizers = [
  {
    id: "maya-chen",
    name: "Maya Chen",
    initials: "MC",
    color: "#e7ead5",
    bio: "A gardener, neighbor, and believer that good food brings us closer. I spend my weekends helping our neighborhood grow.",
    interests: ["Food & community", "Climate & nature"],
    reason:
      "A shared garden means fresh food, new friendships, and a little more room to grow.",
  },
  {
    id: "elias-rivera",
    name: "Elias Rivera",
    initials: "ER",
    color: "#d8e6e5",
    bio: "I help restore the green spaces that make a neighborhood feel like home. One sapling at a time.",
    interests: ["Climate & nature"],
    reason: "Every tree we care for today is shade for someone tomorrow.",
  },
  {
    id: "imani-brooks",
    name: "Imani Brooks",
    initials: "IB",
    color: "#f2dfcd",
    bio: "Making clean energy a community project. I work with neighbors to turn everyday spaces into places of possibility.",
    interests: ["Clean energy", "Food & community"],
    reason:
      "Our neighborhood center should have a brighter, more resilient future.",
  },
  {
    id: "noah-patel",
    name: "Noah Patel",
    initials: "NP",
    color: "#e6dff1",
    bio: "Weekend trail wanderer. Everyday advocate for outdoor spaces that more people can enjoy.",
    interests: ["Outdoor access", "Climate & nature"],
    reason:
      "The outdoors belongs to everyone. Access starts with the path beneath our feet.",
  },
];
function ledger(total: number, count: number, offset: number) {
  return Array.from({ length: count }, (_, i) => ({
    cents: Math.floor(total / count) + (i < total % count ? 1 : 0),
    date: new Date(
      Date.UTC(2026, 8, 10 + Math.floor((i * 35) / count), 12, offset),
    ).toISOString(),
  }));
}
export const campaigns: Campaign[] = [
  {
    id: "grow-a-neighborhood",
    title: "Help a neighborhood grow something good",
    shortTitle: "Room to grow. Food to share.",
    need: "Turn an empty lot into a thriving garden where fresh food and community grow side by side.",
    topic: "Food & community",
    organizerId: "maya-chen",
    beneficiary: "The fictional Maple Street Garden Collective",
    goal: 1500000,
    image: "/media/garden.jpg",
    alt: "Gardening tools, a green trowel, and soil ready for planting",
    location: "Portland, OR",
    createdAt: "2026-09-10T12:00:00Z",
    story:
      "Our Maple Street neighbors have a simple idea: turn an unused lot into a welcoming community garden. The plan includes twelve raised beds, accessible paths, and a shared tool shed. Neighbors will tend the beds together and share seasonal produce through the community pantry. This is a fictional project created for this demo. The garden is organized by Maya Chen on behalf of the Maple Street Garden Collective.",
    budget:
      "The $15,000 goal covers $7,000 for raised beds and soil, $4,000 for accessible paths, $2,500 for shared tools and storage, and $1,500 for seeds and water connections. These are the organizer’s estimates, not independently verified costs.",
    updates: [
      {
        id: "garden-plan",
        date: "2026-10-14T17:00:00Z",
        title: "The garden plan is taking shape",
        body: "Our volunteers have finished the draft layout for twelve raised beds and a wide central path. We are collecting feedback before buying materials. Construction has not started.",
      },
      {
        id: "garden-neighbors",
        date: "2026-10-08T14:00:00Z",
        title: "A place for every neighbor",
        body: "At our planning meeting, neighbors asked for raised beds at different heights. We have included that request in the draft layout.",
      },
    ],
    seed: ledger(1185000, 86, 0),
  },
  {
    id: "roots-for-the-future",
    title: "Plant the roots of a greener future",
    shortTitle: "More trees. A cooler tomorrow.",
    need: "Help neighbors restore native trees along the places we walk, play, and call home.",
    topic: "Climate & nature",
    organizerId: "elias-rivera",
    beneficiary: "The fictional Eastbank Tree Circle",
    goal: 2000000,
    image: "/media/forest.jpg",
    alt: "Sunlight falling through a green woodland",
    location: "Portland, OR",
    createdAt: "2026-09-12T12:00:00Z",
    story:
      "The Eastbank Tree Circle wants to restore native trees around neighborhood green spaces. Elias Rivera is coordinating the project with local volunteers. The proposed work includes selecting suitable planting sites and caring for new trees through their first growing seasons. Permissions and a final planting schedule are still being arranged. This is a fictional demonstration campaign.",
    budget:
      "Funds are intended for native saplings, planting supplies, and follow-up care. An itemized budget has not been supplied.",
    updates: [
      {
        id: "trees-sites",
        date: "2026-10-13T12:00:00Z",
        title: "Finding the right places to plant",
        body: "Volunteers have mapped potential planting sites. Final permissions and the number of trees are not yet confirmed.",
      },
    ],
    seed: ledger(1460000, 112, 1),
  },
  {
    id: "power-our-common-ground",
    title: "Bring clean energy to our community center",
    shortTitle: "A brighter kind of community.",
    need: "Support a solar project for the neighborhood center that brings us all together.",
    topic: "Clean energy",
    organizerId: "imani-brooks",
    beneficiary: "The fictional Common Ground Center",
    goal: 3000000,
    image: "/media/solar.jpg",
    alt: "Solar panels angled toward the sky",
    location: "Portland, OR",
    createdAt: "2026-09-14T12:00:00Z",
    story:
      "Common Ground Center hosts neighborhood meals, workshops, and a weekly repair café. Imani Brooks is organizing a proposed rooftop solar installation. The center plans to use donations for equipment, installation, and a site assessment. Energy savings depend on the final design and cannot yet be quantified. This is a fictional demonstration campaign.",
    budget:
      "The organizer estimates $20,000 for panels and related equipment, $8,000 for installation, and $2,000 for assessment and permits. Final quotes are still pending.",
    updates: [
      {
        id: "solar-assessment",
        date: "2026-10-12T15:00:00Z",
        title: "A first look at the roof",
        body: "The center has scheduled a site assessment. No equipment has been purchased, and the installation date remains to be confirmed.",
      },
    ],
    seed: ledger(1890000, 137, 2),
  },
  {
    id: "a-path-for-everyone",
    title: "Make the neighborhood trail a path for everyone",
    shortTitle: "The outside is for everyone.",
    need: "Help create a more accessible trail entrance so more neighbors can enjoy a little fresh air.",
    topic: "Outdoor access",
    organizerId: "noah-patel",
    beneficiary: "The fictional Open Path Neighbors group",
    goal: 1000000,
    image: "/media/trail.jpg",
    alt: "A walking path winding through trees",
    location: "Portland, OR",
    createdAt: "2026-09-16T12:00:00Z",
    story:
      "Noah Patel and the Open Path Neighbors group want to improve the entrance to a local walking trail. Their proposal includes repairing uneven surfaces, adding clear signage, and consulting people with different access needs. The final scope depends on site approval. This is a fictional demonstration campaign.",
    budget:
      "Funds are intended for access consultation, surface repairs, and wayfinding signs. No itemized budget or confirmed completion date has been provided.",
    updates: [
      {
        id: "trail-listening",
        date: "2026-10-10T16:00:00Z",
        title: "Listening before we build",
        body: "The group is gathering input from people who use mobility aids. No construction has started; an approved plan is still needed.",
      },
    ],
    seed: ledger(740000, 64, 3),
  },
];
export const topics = [...new Set(campaigns.map((c) => c.topic))];
export const campaignById = (id: string) => campaigns.find((c) => c.id === id);
export const organizerById = (id: string) =>
  organizers.find((o) => o.id === id);
export function validTarget(type: string, id: string) {
  return type === "community"
    ? id === community.id
    : type === "fundraiser"
      ? !!campaignById(id)
      : type === "organizer"
        ? !!organizerById(id)
        : false;
}
