# Animated donation chart validation — 2026-10-18

Local production build: `Omen9MAnqwPLTa34-Law9`, served at `http://127.0.0.1:3100`. Google Chrome via Playwright, isolated demo visitors, desktop 1440 × 1000 and mobile 390 × 844. Source is the `codex/live-donation-chart` change. No production deployment is claimed.

- Production build, ESLint, TypeScript, formatting, and all 187 unit/integration tests passed (database environment supplied).
- Three focused browser checks passed in 25.8 seconds: moving line/increasing total, pause/resume, unchanged recorded funding, no tick-generated network writes, keyboard historical ranges/table, source focus, reduced motion, and desktop/mobile overflow and page errors.
- Two existing minute/day-boundary hydration checks and the historical range/table regression passed separately.
- Mid-transition computed styling confirmed a rolling digit's `donation-roll` animation and an intermediate translateY transform.
- Primary and delegated agents reviewed desktop.png and mobile.png. Captures show the illustration paused after a $25 increment; seeded campaign funding remained $11,850 while the illustrative total was $11,875.

Reproduction: start the production server with APP_ORIGIN matching the test URL, then run `BASE_URL=http://127.0.0.1:3100 npx playwright test tests/browser/live-donation-chart.spec.ts`. Use separate Playwright output directories for simultaneous runs; an initial concurrent run encountered trace cleanup interference, and the clean isolated rerun passed.

The illustration uses no live donations or model calls. These are Chromium checks, not physical-device/Safari coverage or a new performance benchmark. Visibility suspension is implemented; full tab/background-device behavior was not separately benchmarked.
