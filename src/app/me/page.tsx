import { viewer } from "@/lib/store";
import { ProfileContent, Shell } from "@/components/experience";
export default async function Me() {
  return (
    <Shell initial={await viewer()}>
      <main id="main">
        <ProfileContent />
      </main>
    </Shell>
  );
}
