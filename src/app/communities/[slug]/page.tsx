import { notFound } from "next/navigation";
import { community } from "@/lib/content";
import { viewer } from "@/lib/store";
import { Shell, CommunityHero, Discovery } from "@/components/experience";
export default async function CommunityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if ((await params).slug !== community.id) notFound();
  return (
    <Shell initial={await viewer()}>
      <main id="main">
        <CommunityHero />
        <Discovery />
      </main>
    </Shell>
  );
}
