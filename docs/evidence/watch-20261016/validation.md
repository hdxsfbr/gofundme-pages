# Campaign Watch validation

**Validated:** 2026-10-16 local time (2026-10-17 UTC)

**Production build:** `FYJ-xGA4KUQy-sPgV_0eg` (Next.js 16.4.2, isolated local PostgreSQL)
**Browser:** Google Chrome 151.0.7922.173

## Checks

- `npm run build` completed successfully for the production build.
- `npm test` passed 187 tests across 13 files. `npm run lint`, `npm run typecheck`, and `npm run format:check` passed.
- `openspec validate add-campaign-video-feed --strict` passed after reconciling the campaign-video spec's catalog provenance fields with its visitor-facing demo disclosure.
- The complete Playwright production-browser run finished with **67 passed and 2 skipped** out of 69. The skips are the forwarded-preview-origin tests, which require `PREVIEW_BASE_URL`; the normal same-origin browser journeys ran against `http://127.0.0.1:3012`. All ten Watch tests passed, including hydration-bounded media, direct and invalid clip links, touch navigation, support actions, browser Back, storage denial, autoplay and visibility handling, saved and live reduced-motion changes, failed-media retry, and captions.
- The suite checked the existing Discover, Following, fundraiser, profile, chat, and simulated-support journeys. Ordinary pages made no Watch-video requests. The controlled chat tests used fixtures and made no model-provider requests.
- Chrome captures at desktop (1440 × 1000), mobile (390 × 844), narrow mobile (320 px), and landscape (844 × 390) were reviewed. The “200% text zoom” case doubles computed text sizes in the page for reflow coverage; it is not browser-toolbar zoom or operating-system text scaling.
- FFmpeg fully decoded all four final MP4 files. They are portrait H.264 at 360 × 640 and 25 fps, with no audio streams. Each has authored WebVTT cues and an editorial text alternative. The four videos total 1,713,763 bytes; the four WebP posters total 70,826 bytes.
- A WebKit launch was attempted with the installed Playwright browser, but the environment lacks `libgstcodecparsers-1.0.so.0`. Safari and physical iOS behavior therefore remain untested.

## Performance

After deferring offscreen posters and video sources until hydration, three Lighthouse 13.5.0 simulated-mobile Watch runs measured LCP at 2,474 ms, 2,626 ms, and 2,626 ms (median **2,626 ms**), 126 ms above the 2,500 ms budget. Median observed Chrome LCP was **55 ms** and CLS was **0**. This is about 150 ms faster than the preceding WebP run, but the simulated-LCP budget remains unmet; observed browser LCP does not replace that result. Final reports and settings are in [`performance-deferred-media/`](performance-deferred-media/); the earlier measurements remain in [`performance-webp/`](performance-webp/).

A selected-poster preload experiment on a separate build measured a 2,620 ms median, only 5 ms faster and still over budget, so it was reverted; the accepted source build and its measurements above are unchanged. Its reports are retained in [`performance-poster-preload/`](performance-poster-preload/).

A second isolated experiment omitted inactive card contents while retaining snap wrappers. It reduced initial HTML by 13,244 bytes but measured a 2,623 ms median versus a fresh baseline of 2,477 ms; high run-to-run variance prevents attributing that difference to the change. The playback/navigation journey passed, but the LCP goal did not improve, so the experiment was reverted. Its build IDs and measurements are recorded in [`performance-card-window/summary.json`](performance-card-window/summary.json); accepted source and the measurements above are unchanged.

The four pre-optimized JPEG posters totaled about 198 KB; the final 360 × 640 WebP posters total about 71 KB. The browser regression confirms that the initial HTML requests only the selected poster, and that video sources attach only after Watch hydrates, bounded to the active and next clips. The budget result retains the remaining miss rather than changing the measurement method or threshold.

On the same final build, three simulated-mobile Lighthouse runs measured community, fundraiser, and profile median LCP at **1,953 ms**, **2,398 ms**, and **2,473 ms**, with CLS 0 for each. All three met their existing budgets. Raw reports and settings are in [`performance-core-final/`](performance-core-final/). Those page types do not render or request Watch video assets; the final browser suite independently verifies zero such requests.

## Demo and attribution evidence

The silent 6.6-second mobile-emulation recording is [`recordings/watch-mobile-swipe-donate.webm`](recordings/watch-mobile-swipe-donate.webm), with [`watch-demo-recording.json`](watch-demo-recording.json) and [`watch-demo-engagement.json`](watch-demo-engagement.json). FFmpeg decoded the complete VP9 recording (390 × 844, 25 fps, 737,254 bytes). Reviewed frames show the first captioned clip, a swipe to the tree campaign, and the “No money was charged” confirmation.

The recording window contains eight test-tagged events from one visitor and session, including two page views. The report records a qualified garden exposure and play, a tree clip play, and one matched $12.50 simulated donation attributed to the tree clip. The tree donation occurred before a full second of qualified tree exposure, so the report correctly records that completion without an exposure. These controlled events demonstrate the report contract; they are not evidence of audience behavior, causal lift, or real fundraising.

The video and screenshots were produced against the local production build, not the hosted Railway release. OpenSpec task 5.4 remains pending until the protected-main CI deployment and hosted support-and-return journey are verified. The working change remains unarchived while that task is outstanding.
