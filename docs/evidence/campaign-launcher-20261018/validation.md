# Floating campaign assistant — 2026-10-18

Local production browser checks at http://127.0.0.1:3100 used isolated signed-out test visitors in Chrome. Viewports: 1440 × 1000, 549 × 743 (the user's reported size), 390 × 844, and 320 × 844. Captures are in this directory; desktop, 549px, and 320px captures were visually reviewed.

All four viewport journeys passed: floating launcher visible at initial load and after scrolling to the story, existing campaign-specific dialog opens, composer receives focus, closing restores the activating floating/inline control, donation dialog remains usable, and navigating from the garden to the tree campaign changes assistant context correctly. No horizontal overflow or page exceptions were observed. AI requests were intercepted; opening/closing made zero model calls. See checks.json.

Twelve existing browser regressions passed: conversation submission/retry/context/source behavior, desktop/mobile scrollback and accessibility checks, and lazy loading/chunk failure/early cancellation. Production build, lint, typecheck, formatting, all seven strict main-spec validations, and git diff --check passed. No full unit-suite rerun was needed for this presentation-only change. Production deployment remains pending merge.
