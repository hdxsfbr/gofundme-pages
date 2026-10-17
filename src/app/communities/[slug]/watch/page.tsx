import { notFound } from "next/navigation";
import { community } from "@/lib/content";
import { viewer } from "@/lib/store";
import { Shell } from "@/components/experience";
import { WatchFeed } from "@/components/watch-feed";
import { clipById } from "@/lib/video-content";

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ clip?: string | string[] }>;
}) {
  if ((await params).slug !== community.id) notFound();
  const requested = (await searchParams).clip;
  const requestedId = Array.isArray(requested) ? requested[0] : requested;
  const selectedClip = requestedId ? clipById(requestedId) : undefined;
  return (
    <Shell initial={await viewer()}>
      <WatchFeed
        initialClipId={selectedClip?.id}
        initialInvalidClip={requestedId && !selectedClip ? requestedId : ""}
      />
    </Shell>
  );
}
