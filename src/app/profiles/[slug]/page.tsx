import { notFound } from "next/navigation";
import { organizerById } from "@/lib/content";
import { viewer } from "@/lib/store";
import { ProfileContent, Shell } from "@/components/experience";
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const o = organizerById((await params).slug);
  if (!o) notFound();
  return (
    <Shell initial={await viewer()}>
      <main id="main">
        <ProfileContent organizerId={o.id} />
      </main>
    </Shell>
  );
}
