import { campaigns, community, organizerById, type Campaign } from "./content";
export type Donation = {
  id: string;
  campaign_id: string;
  cents: number;
  created_at: string;
};
export type Follow = { target_type: string; target_id: string };
export type Feature = {
  campaign_id: string;
  reason: string;
  updated_at: string;
};
export type Viewer = {
  follows: Follow[];
  donations: Donation[];
  features: Feature[];
  views: { campaign_id: string; viewed_at: string }[];
};
export const emptyViewer: Viewer = {
  follows: [],
  donations: [],
  features: [],
  views: [],
};
export function money(cents: number, decimals = cents % 100 !== 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(cents / 100);
}
export function amountCents(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,5}(\.\d{1,2})?$/.test(value.trim()))
    throw new Error(
      "Enter $1 to $10,000, with no more than two decimal places.",
    );
  const [d, c = ""] = value.trim().split(".");
  const cents = Number(d) * 100 + Number(c.padEnd(2, "0"));
  if (cents < 100 || cents > 1000000)
    throw new Error("Enter an amount from $1 to $10,000.");
  return cents;
}
export function ledger(c: Campaign, donations: Donation[]) {
  return [
    ...c.seed,
    ...donations
      .filter((d) => d.campaign_id === c.id)
      .map((d) => ({ cents: d.cents, date: d.created_at })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}
export function funding(c: Campaign, donations: Donation[]) {
  const records = ledger(c, donations),
    raised = records.reduce((n, d) => n + d.cents, 0);
  return {
    raised,
    count: records.length,
    percent: Math.round((100 * raised) / c.goal),
    remaining: Math.max(0, c.goal - raised),
    goal: c.goal,
  };
}
export function followingCampaigns(follows: Follow[]) {
  return campaigns.filter((c) =>
    follows.some(
      (f) =>
        (f.target_type === "fundraiser" && f.target_id === c.id) ||
        (f.target_type === "community" && f.target_id === community.id) ||
        (f.target_type === "organizer" && f.target_id === c.organizerId),
    ),
  );
}
export function searchCampaigns(
  items: Campaign[],
  query: string,
  topic: string,
) {
  const q = query.trim().toLowerCase();
  return items.filter(
    (c) =>
      (!topic || c.topic === topic) &&
      (!q ||
        `${c.title} ${c.need} ${organizerById(c.organizerId)?.name}`
          .toLowerCase()
          .includes(q)),
  );
}
export function history(
  c: Campaign,
  donations: Donation[],
  range: "7" | "30" | "all",
  now = new Date(),
) {
  const records = ledger(c, donations).filter(
    (r) => new Date(r.date).getTime() <= now.getTime(),
  );
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const first = records.length ? new Date(records[0].date).getTime() : today;
  const start =
    range === "all"
      ? Date.UTC(
          new Date(first).getUTCFullYear(),
          new Date(first).getUTCMonth(),
          new Date(first).getUTCDate(),
        )
      : today - (Number(range) - 1) * 86400000;
  const before = records
    .filter((r) => new Date(r.date).getTime() < start)
    .reduce((n, r) => n + r.cents, 0);
  const period = records.filter((r) => new Date(r.date).getTime() >= start);
  let balance = before;
  const points = [
    {
      date: new Date(start).toISOString(),
      cents: before,
      label: "Opening balance",
    },
  ];
  for (let t = start; t <= today; t += 86400000) {
    balance += period
      .filter(
        (r) =>
          new Date(r.date).getTime() >= t &&
          new Date(r.date).getTime() < t + 86400000,
      )
      .reduce((n, r) => n + r.cents, 0);
    points.push({
      date: new Date(t).toISOString(),
      cents: balance,
      label: new Date(t).toISOString().slice(0, 10),
    });
  }
  return {
    points,
    change: period.reduce((n, r) => n + r.cents, 0),
    count: period.length,
    start: new Date(start).toISOString(),
    end: now.toISOString(),
  };
}
export const dateLabel = (s: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(s));
export function needsNewSession(last: string | Date, now: Date) {
  return now.getTime() - new Date(last).getTime() >= 30 * 60 * 1000;
}
