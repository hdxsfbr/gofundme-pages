import Link from "@/components/link";
export default function NotFound() {
  return (
    <main id="main" className="container empty-state">
      <p className="eyebrow">A SMALL DETOUR</p>
      <h1>This cause isn’t here.</h1>
      <p>Let’s find another good thing to be part of.</p>
      <Link className="button" href="/communities/a-greener-tomorrow">
        Back to discovery
      </Link>
    </main>
  );
}
