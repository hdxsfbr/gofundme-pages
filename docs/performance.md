# Performance measurements

## Current production build

Build `-6yPHl9lZGab-87T31WH9` passed the project's proposed lab budgets: median LCP at or below 2,500 ms and median CLS at or below 0.10 for each representative route. The budgets are project-selected acceptance targets, not sponsor requirements. Each route has three sequential Lighthouse launches; CLS was 0.000 in all nine runs.

| Route | LCP run 1 | LCP run 2 | LCP run 3 | Median LCP | Median CLS | Margin to LCP budget |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Community `/communities/a-greener-tomorrow` | 2498.3563 ms | 2471.2088 ms | 1954.1599 ms | 2471.2088 ms | 0.000 | 28.7912 ms |
| Fundraiser `/fundraisers/grow-a-neighborhood` | 2474.9195 ms | 2030.9757 ms | 2104.8101 ms | 2104.8101 ms | 0.000 | 395.1899 ms |
| Profile `/profiles/maya-chen` | 2475.5410 ms | 2474.7396 ms | 2474.8300 ms | 2474.8300 ms | 0.000 | 25.1700 ms |

Community and profile medians pass with narrow headroom. These are lab results with three samples per route; environment or run variation can move a median across the threshold.

The prior streaming build `jltxTNzfwPja4fpuVnTtM` had a profile LCP median of 2624.6514 ms and failed the budget. Its first profile navigation requested 24,945 document bytes and 170,007 script bytes. The current build's comparable profile navigation requested 17,000 document bytes and 167,756 script bytes. After the chat panel and its CSS were split into a click-time chunk, the profile LCP median measured 2474.8300 ms. This before/after observation is from a small local sample; it does not isolate every factor affecting LCP. The change preserves the page layout and chat experience while keeping the unrequested assistant UI and styles off initial route loads.

## Scripted interactions

A separate unthrottled Playwright run used build `-6yPHl9lZGab-87T31WH9` at 390 × 844 in Chrome 151.0.7922.173. It measured from the Playwright action through a visible DOM assertion and two animation frames, including driver overhead and any scrolling; these are not INP or pure event-handler durations.

| Action | Three elapsed samples |
| --- | --- |
| Filter Maya | 51.4, 41.9, 45.4 ms |
| Open Ask panel / ready composer | 127.3, 59.7, 62.1 ms |
| Change chart range | 67.8, 65.9, 67.7 ms |

The first Ask opening includes the lazily loaded assistant module. The run observed zero model requests during page rendering and panel opening. Raw measurements and the redacted trace are [`interactions.json`](evidence/milestone/performance/interactions.json) and [`interactions.zip`](evidence/milestone/performance/interactions.zip). The separate loading-state interaction record is [`loading-dialog-interactions.json`](evidence/milestone/performance/loading-dialog-interactions.json). Trace export redacts cookie/auth headers and cookie arrays; Python 3's standard library is needed only for that export.

## Implementation notes

- The chat transcript and chat-specific stylesheet now load when Ask is opened. The page retains an accessible loading state and retry if the chunk cannot load, while the fundraiser page and its visual layout remain available.
- Initial rendering and opening the panel do not call the AI provider. The interaction capture observed zero `/api/ask` requests in those phases.
- Existing page optimizations remain: one local Manrope variable font, AVIF/WebP images at quality 60, inline CSS, reserved image dimensions, deferred offscreen campaign-card photography, direct server rendering for ready routes, and dynamic response validation after an AI answer.

These source changes describe the measured application; the small before/after sample does not isolate the contribution of each optimization.

## Test conditions and artifacts

The raw runs and settings are in [`docs/evidence/milestone/performance/`](evidence/milestone/performance/), including three JSON and HTML reports per route, the [`summary.json`](evidence/milestone/performance/summary.json), [`settings.json`](evidence/milestone/performance/settings.json), interaction samples, and trace archives. The build ID in the Lighthouse summary is `-6yPHl9lZGab-87T31WH9`.

The run used Lighthouse 13.5.0, Node v24.14.0, Next.js 16.4.2, and headless Chrome 151.0.7922.173 on Linux 7.0.0-38-generic with an Intel Core i9-14900KF and 31 GiB RAM. The simulated mobile preset used a 412 × 823 viewport, device scale factor 1.75, Android 11 Moto G Power 2022 user agent, 4× CPU slowdown, 150 ms RTT, and approximately 1.64 Mbps download throughput. Each route used a fresh temporary browser profile and storage reset, ran sequentially without the browser suite, and used the fixed fictional dataset with a new test visitor. The local server and image optimizer may have warm caches.

Reproduce after building and starting the production app with PostgreSQL configured. Run Lighthouse and scripted interactions sequentially, without browser tests or other measurement captures running:

```sh
PERFORMANCE_EVIDENCE_DIR=docs/evidence/milestone/performance npm run perf
PERFORMANCE_EVIDENCE_DIR=docs/evidence/milestone/performance npm run perf:interactions
```

The Lighthouse command launches each route three times and writes raw JSON/HTML plus summary/settings files into that directory. The interaction command writes its JSON and redacted trace beside them; it uses Python 3's standard library only for redaction.

## Limits and earlier results

These local lab measurements do not represent field performance. Three runs per route cannot establish a p75 or population percentile; no field INP, retention, conversion, or engagement-improvement claim is made. The emulated device/network and local cache behavior do not represent every user environment.

The prior reports remain in [`docs/evidence/milestone-before/performance/`](evidence/milestone-before/performance/) and [`docs/evidence/performance-before/`](evidence/performance-before/). The earlier pre-stream run on build `dEfGzmJ5GREpv04KlgWuH`, its interaction timings, and its trace are retained in [`docs/evidence/performance/`](evidence/performance/); those are historical and not measurements of the current build. The current milestone [recording](evidence/milestone/demo.webm), [engagement report](evidence/milestone/demo-engagement.json), and [decode/frame review](evidence/milestone/demo-video-check.json) are complete; the current [release manifest](evidence/milestone/release-manifest.json) records source/evidence/build identity; the OpenSpec change is archived with 47/47 tasks complete and all six main specs synced. See the [milestone closeout](milestone-closeout.md).

## Watch LCP follow-up (2026-10-17)

This section adds results; the measurements above remain the historical milestone record. With the same `npm run perf` method (Lighthouse 13.5.0, simulated mobile, three runs per route), the Watch route median LCP went from 2,625.1 ms on source `cd330c5` (build `HFy9dXYldPLEajDyREvKr`) to **2,329.9 ms** (build `MFipOH5un3GirzI8szbfW`). It now passes the 2,500 ms budget. The community, fundraiser, and profile medians were 2,473.8, 2,398.8, and 2,471.9 ms, against a same-session baseline of 2,478.1, 2,401.0, and 2,477.5 ms. CLS was 0 throughout.

The change disables experimental `inlineCss`, which had duplicated the global CSS three times in each HTML document, and merges small client chunks with `turbopackChunking.minChunkSize`. The implementation note above about inline CSS describes the earlier build. Watch's simulated FCP is about 90 ms slower because its stylesheets now load as files, while the other routes' FCP improved. The root-cause analysis, per-run tables, and raw reports are in [`evidence/watch-20261017/`](evidence/watch-20261017/validation.md).

