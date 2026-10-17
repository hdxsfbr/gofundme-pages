# Watch LCP follow-up (task 5.2)

**Validated:** 2026-10-17 local time (America/Los_Angeles)

**Builds:** baseline `HFy9dXYldPLEajDyREvKr` (source `cd330c5`) and final `MFipOH5un3GirzI8szbfW` (this change). Both are Next.js 16.4.2 production builds (`npm run build && npm run start`) on hdx-lab against a disposable local PostgreSQL 18.3 database.

**Tooling:** the repository's `npm run perf` script: Lighthouse 13.5.0, Node v24.14.0, headless Google Chrome 151.0.7922.173, default simulated mobile preset, three separate Chrome launches per route, no concurrent browser suite. These are the same method, run count, and budget (median LCP ≤ 2,500 ms, median CLS ≤ 0.10) used for the earlier evidence. The earlier reports in [`../watch-20261016/`](../watch-20261016/) are unchanged.

## Results

| Route | Baseline LCP runs (ms) | Baseline median | Final LCP runs (ms) | Final median | Change |
| --- | --- | ---: | --- | ---: | ---: |
| Watch `/communities/a-greener-tomorrow/watch` | 2625.1, 2621.4, 2628.3 | **2625.1** (fail) | 2329.9, 2328.4, 2332.6 | **2329.9** (pass) | −295.2 |
| Community `/communities/a-greener-tomorrow` | 2586.7, 2478.1, 2473.6 | 2478.1 | 2494.2, 2473.8, 2103.6 | 2473.8 | −4.3 |
| Fundraiser `/fundraisers/grow-a-neighborhood` | 2479.1, 2401.0, 2398.5 | 2401.0 | 2398.8, 2397.8, 2399.5 | 2398.8 | −2.2 |
| Profile `/profiles/maya-chen` | 2477.5, 2480.4, 2474.7 | 2477.5 | 2476.9, 1954.0, 2471.9 | 2471.9 | −5.6 |

CLS was 0 in all 24 runs. A separate repeat of the three Watch runs on the final build measured 2327.4, 2325.7, and 2330.9 ms (median 2327.4 ms). Raw reports: [`performance-baseline/`](performance-baseline/), [`performance-final/`](performance-final/), and [`performance-final-watch-repeat/`](performance-final-watch-repeat/).

The original three page types still pass. Their medians are no worse than baseline, but the community and profile margins stay narrow (26–28 ms), as in the historical evidence. No original page type requested a Watch video in either build. Watch still requests the active and next MP4 only after hydration, as before.

Simulated FCP medians changed from 828/816/817/801 ms to 755/906/754/760 ms (community/Watch/fundraiser/profile). Watch FCP is about 90 ms slower because its two stylesheets now load as render-blocking files, while its LCP is about 295 ms faster. Observed (unthrottled) Chrome LCP stayed between 42 and 90 ms.

## Root cause

The Watch LCP element is the selected poster, `img.watch-poster` (`/media/watch/garden.webp`, 14 KB, `fetchpriority=high`). It was already discoverable in the initial HTML, and its load delay and duration were negligible in the observed trace. Poster bytes, video sources, fonts, and hydration did not cause the miss.

The miss came from Lighthouse's simulated network. We ran Lighthouse's own Lantern LCP computation on saved trace artifacts and looked at the simulated node timings. The simulated LCP ended when the largest framework script (`react-dom`, 72 KB) finished downloading, followed by its evaluation. Two things placed that point after 2.5 s:

1. **HTML size.** With experimental `inlineCss`, Next 16.4.2 put the global stylesheet into the document three times: once as a `<style>` tag and twice as RSC text rows. The Watch stylesheet was added as well. That made the Watch document 26.5 KB compressed. It needed an extra simulated TCP round trip, and every subresource started at about 753 ms instead of about 602 ms.
2. **Request queueing.** Fourteen requests (one document, font, poster, and 11 scripts) shared the six simulated HTTP/1.1 connections, so the large script queued behind a full set of connections. Removing a single 249-byte loader chunk in an exploratory build dropped Watch to about 2,478 ms. This shows the result is sensitive to request count. It also explains why the earlier byte-focused experiments (WebP posters, deferred media, card windowing) moved the median only slightly or within noise.

## Change

- `next.config.ts` no longer enables `experimental.inlineCss`. CSS is served as cacheable stylesheet files, which shrank the documents to about 5–10 KB compressed (Watch: 26.5 KB → 6.1 KB).
- `next.config.ts` sets `experimental.turbopackChunking.minChunkSize` to 200,000 bytes so small client chunks merge. First-load script requests drop by 1–3 per route, at the cost of some code repeating across route chunks.

Exploratory builds isolated each part. Watch medians were about 2,477 ms with merging alone, about 2,482 ms with external CSS alone (on a build that also split the Ask loader), and about 2,329 ms with both. Splitting `experience.tsx` into route modules was also tried. It did not move the medians reliably, so it was not kept.

## CI failure fix in the same change

Pipeline 58590 failed `watch-feed.spec.ts › Watch loads media only on entry, plays one clip, navigates, and ends explicitly`. The scroller stayed on `open-path-access` after Next instead of reaching `end`. `settle()` recomputed the destination from `scrollTop`, so when the slow CI runner had not finished the smooth scroll within the settle delay, it snapped back one card. `WatchFeed` now remembers the target of an in-flight button, keyboard, wheel, or swipe step and settles on that target. Native free scrolling still settles from the scroll offset.

The test previously pressed ArrowDown immediately after Replay. Steps closer than 360 ms apart are intentionally ignored, so that press only passed when settling happened to move the feed. The test now waits for Replay to settle on the first story before the keyboard step.

## Checks on the final source

- `npm run format:check`, `npm run lint`, `npm test` (187 passed in 13 files), `npm run build`, and `npm run typecheck` passed.
- The complete Playwright suite passed **69 of 69** against the standalone production server, including the two forwarded preview-origin tests through `scripts/preview-proxy.mjs`. `scripts/assert-ci-results.mjs browser` passed. The Watch spec was also repeated twice in full (20 of 20 passed).
- Watch (390 × 844 and 1440 × 1000), community and fundraiser (390 × 844), and profile (1440 × 1000) captures from the final build were reviewed. Layout and styling matched the earlier captures.

## Limits

These are local lab simulations with three samples per route. They are not field LCP, and run-to-run variation can still move a median by one simulated round trip (about 75–150 ms). The hosted Railway release sits behind a different network path and protocol stack, and it was not measured here. Task 5.4 (hosted release verification) remains open.
