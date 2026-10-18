# Tasks

These tasks track implementation and acceptance. Mark a task complete only when its evidence exists; recorded limitations remain explicit. Dependencies follow the numbered groups; playback and support integration can share an agreed catalog while media preparation finishes, but acceptance requires the actual clips.

## 1. Curated content and media

- [x] 1.1 Source four distinct 15–20-second clips, one per fictional campaign, and record provenance and permitted use in `docs/media.md`; review the source footage and license terms, disclose the silent stock footage, and do not imply performer endorsement.
- [x] 1.2 Prepare portrait MP4s, WebP posters, matching captions and text alternatives under a bounded local asset collection; disclose that story copy is editorial rather than a speech transcript. Verify full decode, browser playback, caption timing/readability, and the proposed 8 MB per clip / 80 MB total budget.
- [x] 1.3 Add the curated catalog with stable clip/campaign/profile IDs and role metadata; add focused validation covering missing assets, invalid associations, duplicate IDs, and content bounds, and verify all release entries pass while invalid fixtures fail.

## 2. Watch route and browsing

- [x] 2.1 Add the community Watch route and navigation entries with the shared viewer state and responsive stage; verify desktop/mobile entry, correct active navigation, direct clip links, missing-community and invalid-clip recovery, and unchanged Discover/Following links in focused browser tests.
- [x] 2.2 Implement full-height vertical snapping, single active selection, wheel/arrow/button navigation, and finite end/replay behavior; verify adjacent touch gestures, fast gesture bursts, interrupted swipes, control taps, and desktop navigation without multi-clip skips or partially settled cards.
- [x] 2.3 Add muted inline playback, caption/story-text and audio-availability controls, pause/resume intent, visibility handling, and denied-play fallback; verify with decodable media that only one video advances and manual pause/reduced motion survive panel and tab transitions.
- [x] 2.4 Bound source attachment/preloading to the active and one adjacent clip and implement poster/loading/error/empty states; verify request counts, failed-load Retry/Next/exit, and zero video requests on ordinary routes including navigation prefetch.
- [x] 2.5 Preserve clip/time/preferences on campaign/profile navigation and browser Back without one history entry per swipe; verify nonzero-time restoration, explicit clip URLs, fresh-tab defaults, unavailable session storage, and filtered discovery return independently.
- [x] 2.6 Document the Watch route, media lifecycle, navigation, and browser-policy fallbacks in `docs/technical.md`; verify keyboard focus, inactive-item focus exclusion, captions/action separation, safe areas, short landscape layout, and doubled text-size reflow at representative desktop/mobile sizes, retaining reviewed captures. The text-size check is page-level emulation, not browser-toolbar zoom.

## 3. Connected campaign actions

- [x] 3.1 Add the Donate now presentation and panel-state/source hooks to the existing donation control, preserving default fundraiser behavior; verify paused playback and locked background navigation, amount validation, pending/failure/retry behavior, focus restoration, and one durable contribution after duplicate submission in focused browser/integration tests.
- [x] 3.2 Wire current campaign funding, profile/campaign links, fundraiser follow, and campaign sharing into each active clip; verify correct targets when moving between campaigns, persistent follow state in Following, canonical share URLs and outcomes, and refreshed funding without resetting the active clip/time.
- [x] 3.3 Extend action request validation with optional catalog-validated clip provenance and carry it into trusted follow/completion events; verify no-source compatibility, invalid/mismatched-source rejection, immutable original donation attribution on retries, and reuse of the existing visitor isolation/outbox transaction.
- [x] 3.4 Document Watch's simulated-support behavior and optional provenance contract in `docs/technical.md`; verify it matches the API validation and retained original donation behavior, including late responses after panels close.

## 4. Measurement and reporting

- [x] 4.1 Add the four video event names, qualified visible exposure timing, actual play-start observation, Watch page classification, and source metadata on client support/share events; validate clip/campaign associations at collection and verify no preloading/hidden/modal-covered false views or content text/private playback state in stored events.
- [x] 4.2 Extend aggregate reporting with per-clip exposure/play/arrival and saved support metrics, explicit joins and denominators, null empty rates, and unmatched outcomes; add tests for duplicate delivery, replay, canceled shares, matching arrivals, lost client events, and automated-test exclusions without changing existing metric definitions.
- [x] 4.3 Update `docs/analytics.md` with the event names, qualification rules, attribution limits, and report examples; run a controlled Watch-to-campaign-to-Watch support journey and reconcile its recorded events/report with the actual interactions.

## 5. Integrated experience and release evidence

- [x] 5.1 Run the connected desktop/mobile journey with actual clips, including campaign/profile Back, follow, sharing, simulated donation, end/replay, and error recovery; review screenshots and playback, attempt Safari/WebKit, and record browser/device coverage and untested physical iOS behavior in new dated evidence. WebKit could not launch because an OS library is unavailable.
- [x] 5.2 Run the appropriate full checks and original journey regressions, measure Watch poster/layout against the existing mobile lab budgets, and record first-frame/media-transfer observations; verify no video-loading regression on the three original page types and retain reproducible results without replacing historical evidence. Checks and measurements are recorded. The 2026-10-16 Watch simulated-LCP median was 126 ms over the 2.5 s target after media deferral (retained in `docs/evidence/watch-20261016/`). The 2026-10-17 follow-up in `docs/evidence/watch-20261017/` measures a Watch median of 2,329.9 ms, and the community, fundraiser, and profile medians are 2,473.8, 2,398.8, and 2,471.9 ms (all passing, none regressed).
- [x] 5.3 Update the demo walkthrough/recording and source/technical documentation links, validation notes, and AI usage log for this feature; verify the new recording plays and demonstrates the implemented swipe and Donate now behavior with honest fictional/simulated labeling.
- [x] 5.4 Publish the reviewed implementation through the established CI pipeline, verify matching hosted release readiness and actual video/caption delivery, then exercise one hosted support-and-return journey; record the pipeline/release identifiers, source revision, observed results, and material limitations. Recorded in `docs/evidence/watch-hosted-20261017/`: main pipeline 59049, deploy job 240206, Railway deployment `005f29af-3a78-4ae8-97ee-f4124465e074`, source `ea67836`.
- [x] 5.5 Reconcile completed tasks with acceptance evidence and run strict OpenSpec validation; verify all three deltas match the delivered behavior and the historical milestone evidence remains unchanged.

## Workflow follow-up

- Sync the implemented deltas into the main specs and archive this change after all tracked tasks are complete.
- Validate the archived change and main specs, and report the hosted feature, evidence, and any remaining limitations.
- CI is too slow on shared runner #282: the single `validate` job takes about 23–26 minutes (browser suite about 16–18 minutes on one worker) and has failed on runner-speed timing flakes. Needs better CI infrastructure or a parallel/sharded browser suite.
