"use client";
export default function ErrorPage() {
  return (
    <main id="main" className="container empty-state">
      <h1>A little pause.</h1>
      <p>
        We couldn’t load this page right now. Your saved actions are still
        yours.
      </p>
      <button className="button" onClick={() => window.location.reload()}>
        Try again
      </button>
    </main>
  );
}
