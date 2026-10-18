# Validation record

## Final submission review — October 18, 2026

The [submission review](submission-review.md) is the current requirements and validation entry point. It distinguishes fresh hosted checks from the locally corrected build. Evidence is retained under [submission-20261018](evidence/submission-20261018/). The final narrated demo is published on [YouTube](https://youtu.be/ObE-w7e5Pv8) with a repository MP4 fallback. The milestone counts and build identifiers below are historical.

Final corrected build `UopYU4EC7e5SCp2whvSOU` passed **205/205 unit/integration tests with the database configured**, **81/81 browser checks with zero skips/flakes**, production build, lint, typecheck, formatting, and strict validation of all nine main specs. The full browser run includes axe checks at desktop/mobile/narrow widths, a configured preview origin, error/loading states, state isolation/persistence, and Watch/media regressions. All four Lighthouse route medians passed the project lab budgets. These checks cover the local corrected application tree recorded in the [source manifest](evidence/submission-20261018/source-manifest.json); they are separate from the hosted baseline audit. See [summary.json](evidence/submission-20261018/summary.json) for exact counts and build identity.

## Archived milestone record

Project date: October 15, 2026 local time; machine-readable artifact timestamps use UTC. This record distinguishes application checks from live-provider evaluation and real-user evidence.

The milestone measurements below describe the archived local release. Later CI and hosted-release evidence is tracked separately in the [deployment runbook](deployment.md); changing deployment configuration does not update these historical build measurements.

## Reproduction

Use the README setup, then run:

```sh
npm run db:migrate
npm run build
npm run typecheck
npm run lint
npm test
npm run start
# In a second terminal with the production server running:
npm run test:browser
npm run perf
npm run perf:interactions
npm run eval:ai -- --review-saved
npx playwright install ffmpeg # one-time prerequisite for demo recording
npm run demo:record
```

The PostgreSQL unit/integration tests create uniquely named temporary schemas and remove them after each suite. Browser tests use isolated cookie contexts tagged `x-demo-test`; their synthetic rows remain in the local demo database and are excluded from default engagement reports. The server-error test installs a temporary trigger that targets only its own test visitor and removes it in `finally`. No broad reset of another visitor's state is needed.

## Archived local milestone build — `-6yPHl9lZGab-87T31WH9`

Production build, typecheck, lint, formatting, and all 150 Vitest checks passed. The final production browser suite passed 57/57 checks with zero failures, flaky cases, or skips. It ran in headless Chrome 151.0.7922.173 through the local preview relay, at desktop and mobile widths (1440, 390, and 320 px), with isolated test visitors. The full details and exact command are in [`browser-check.json`](evidence/milestone/browser-check.json); the 18 final release-scene screenshots were viewed and are linked from its visual evidence. A capture-readiness rerun replaced six transient chat/loading captures; the recorded release set contains 18 axe scans, with zero serious/critical findings. The wider run plus readiness rerun performed 24 scans total. This is not a complete WCAG conformance claim.

All three route Lighthouse medians pass the project-selected lab budgets; see [performance results](performance.md) and raw [`summary.json`](evidence/milestone/performance/summary.json). Scripted interaction samples and a redacted trace are recorded separately; they are not field INP. The browser suite's AI requests use controlled fixtures and its report records zero live model calls. The current milestone recording, separate from browser testing, made four live provider calls. Its [metadata](evidence/milestone/demo-recording.json) and [engagement report](evidence/milestone/demo-engagement.json) record three supported answers with visible partials before completion, one done-only missing-budget abstention, and a contextual average follow-up using two history messages. The recording window contains one test visitor/session, 30 events, eight page views, one follow, one $12.50 simulated donation, one copied link, two citation opens, zero failed/pending requests, and zero pending outbox rows. Across milestone AI work there are eight runtime calls total: four development calls preserved under `evidence/milestone-before/`, plus four final recording calls. The current silent video is 55.24 seconds (VP9 at 1440 × 1000, 25 fps; 7,486,360 bytes); its full FFmpeg decode passed with zero errors and 13 sampled frames were reviewed. See [`demo-video-check.json`](evidence/milestone/demo-video-check.json), [reviewed frames](evidence/milestone/demo-frames/), [video](evidence/milestone/demo.webm), [metadata](evidence/milestone/demo-recording.json), and [engagement report](evidence/milestone/demo-engagement.json). The current [release manifest](evidence/milestone/release-manifest.json) verifies this build, 75 source/configuration/media/test/script hashes, 59 evidence hashes, and the video identity. The archived OpenSpec change has all 47 tasks complete and synced all six main specs exactly (46 requirements and 79 scenarios). Strict validation passed before and after archival; `openspec list` reports no active changes. See the [synced main specs](../openspec/specs/), [archived proposal](../openspec/changes/archive/2026-10-16-modernize-gofundme-experience/proposal.md), [design](../openspec/changes/archive/2026-10-16-modernize-gofundme-experience/design.md), [task list](../openspec/changes/archive/2026-10-16-modernize-gofundme-experience/tasks.md), and [reference captures](../openspec/changes/archive/2026-10-16-modernize-gofundme-experience/evidence/). This count excludes the separate 31-call earlier conversational evaluation history described in the AI usage log.

To reproduce the browser suite, set the preview origin in the ignored environment file, restart the production server, and start the relay in a second terminal with `node scripts/preview-proxy.mjs`; then run:

```sh
PREVIEW_BASE_URL=http://localhost:61071 BROWSER_EVIDENCE_DIR=docs/evidence/milestone/browser CHAT_EVIDENCE_DIR=docs/evidence/milestone/chat npx playwright test --reporter=list,json
```

The current browser result and captures are in `docs/evidence/milestone/`. The current recording has passed decode/frame review, and the verified release manifest records its identity. Earlier build results below remain historical and are not relabeled.

Live regeneration (`npm run eval:ai`) makes eight provider calls. Recording (`npm run demo:record`) makes four live provider calls and records simulated actions in a new test visitor. Playwright 1.64.1 requires `npx playwright install ffmpeg` for its FFmpeg 1013 build. This is only needed for the video recording step. Run it without concurrent browser tests so the measurement window remains isolated. These are explicit reproducibility commands, not automatic background jobs.

## Earlier release checks — historical build

A clean `npm ci`, both migrations, production build, TypeScript check, ESLint, and all 68 Vitest checks passed on the earlier release build. The suite covers domain calculations and response validation, metric denominators, PostgreSQL outbox recovery, and AI route/adapter behavior with intercepted provider responses. That build's production Playwright run passed all 35 browser checks (0 failed, 0 flaky, 0 skipped); per-spec results and environment are recorded in [browser-results.json](evidence/browser-results.json). The separate previous-streaming-build results are described in the dated Ask update below; current-build checks are recorded above.

The [restart check](evidence/restart-check.json) restored a visitor across a stopped development process and a fresh production process using the same database volume. The saved community follow, $12.50 simulated donation, $11,862.50 campaign total, $52,762.50 community total and private activity persisted; an isolated second visitor retained $11,850 seed funding.

[Production dependency audit](evidence/production-dependency-audit.json) reported zero known production-dependency advisories at capture time. The full development audit reports a high-severity nested-glob issue in `braces` through ESLint tooling (five affected dependency entries); npm's proposed remediation downgrades the Next ESLint stack and was not applied. This concerns development glob processing; it is not included in the production dependency audit. No external untrusted glob patterns are accepted by this app.

## Earlier visual review — historical build

The earlier browser suite captured the community, fundraiser and organizer profile at 1440 × 1000, 390 × 844 and 320 × 844, plus the donation dialog at those widths. Historical screenshots and run results are in [browser screenshots](evidence/browser/) and [browser-results.json](evidence/browser-results.json). Current-build visual evidence is linked in the milestone section above.

The design preserves the reference experience's cause context, funding totals, organizer/beneficiary distinction, follows, updates and public relationship links. The changed hierarchy puts photo-led discovery and search before rankings, makes Following an explicit filter over saved relationships, adds dated funding ranges and a source-linked Ask panel. Public GoFundMe already has follows, feeds and featured causes; these are preserved and connected here, not claimed as inventions. Original signed-out reference screenshots are retained in the [OpenSpec evidence directory](../openspec/changes/archive/2026-10-16-modernize-gofundme-experience/evidence/).

Visual review found readable controls, chart data alternatives, visible keyboard focus, bounded dialogs and no page-level horizontal overflow at the tested widths. The mobile fundraiser places support controls before the photograph and longer story, so the page requires substantial scrolling. Full community discovery is also long on mobile. These are observable layout tradeoffs; there is no user-study evidence that this design attracts a younger audience or improves engagement. Automated axe checks and keyboard interaction checks are scoped to this Chromium build, not every browser, assistive technology or authenticated production account.

## Other evidence

- [Live AI evaluation and limits](ai-evaluation.md), separately from mocked provider/browser tests.
- [Analytics definitions and report procedure](analytics.md), including simulated/test data exclusions and delivery limitations.
- [Performance results](performance.md) record three Lighthouse runs per route on build `-6yPHl9lZGab-87T31WH9` (all median budgets met), plus unthrottled scripted timings and redacted traces. The current interaction record is [`interactions.json`](evidence/milestone/performance/interactions.json); these scripted samples are not field INP or p75 data. Earlier performance results remain historical.
- The [silent demo video](evidence/demo.webm), [record metadata](evidence/demo-recording.json), [full FFmpeg decode check](evidence/demo-video-check.json), [seven sampled frames](evidence/demo-frames/), and [recording-window engagement report](evidence/demo-engagement.json) are from earlier builds. The earlier recordings are historical; the current milestone recording has its own decode and frame review linked above. The older video's closing measurement scene is a CLI report, not an app dashboard; the current demo likewise displays the actual CLI report for its isolated recording window, not an application dashboard. A separate [default report](evidence/default-engagement.json) excludes test sessions and has zero events with null rates because there is no denominator; this does not establish human traffic.

The [earlier release manifest](evidence/release-manifest.json) records 60 SHA-256 hashes for source, configuration, media, tests, and scripts for build `dEfGzmJ5GREpv04KlgWuH`; it does not cover current milestone evidence.

## Dated correction — preview-origin validation (2026-10-15)

The historical 35-check browser run, performance results, and video above used direct access to `http://127.0.0.1:3000`; they did not exercise mutations through the client-forwarded preview origin. A preview session exposed a configuration gap in that validation scope. The application now requires `APP_ORIGIN` and supports optional exact origins in `APP_PREVIEW_ORIGINS`; see the setup instructions in the [README](../README.md) and [technical notes](technical.md). The original artifacts remain evidence for their original build and direct-local topology; this correction does not relabel or replace them.

On build `OWarGDoXxQxksChR2HgFM`, production build, typecheck, lint, formatting, and all 116 Vitest checks passed (68 existing checks plus 48 origin-validation checks). The focused preview-origin Playwright regression passed 2/2 checks (0 failed, flaky, or skipped). [`preview-origin-check.json`](evidence/preview-origin-check.json) records the build, browser, topology, allowed and rejected-origin cases, and reproduction. Configured preview-origin event and action requests succeeded, persisted follow/feature/donation state survived reload, and the primary origin remained independently usable; missing, foreign, and unconfigured origins were rejected. A live Ask request through the preview relay returned HTTP 200 with the expected explicit missing-budget response from one live provider call; see [`preview-live-ask.json`](evidence/preview-live-ask.json) and the [captured response](evidence/preview-origin-ask.png). The build and changed-file identity are recorded in [`preview-origin-release.json`](evidence/preview-origin-release.json). The relay reproduces the forwarded-origin behavior; the embedded browser itself was not directly controlled by this check.

To reproduce, set `APP_PREVIEW_ORIGINS=http://localhost:61071` in the ignored environment file and restart the production server. In a second terminal run `node scripts/preview-proxy.mjs`, then run:

```sh
PREVIEW_BASE_URL=http://localhost:61071 npm run test:browser -- tests/browser/preview-origin.spec.ts
```

This focused result is additional to the earlier 35 browser checks; it is not a new full-browser, performance, or video run.

## Historical conversational Ask update — previous streaming build

The Ask panel keeps its current conversation in memory until closed or the campaign changes; each request includes at most the two most recent completed question/answer pairs. The server validates bounded history and campaign association, treats it as untrusted context rather than evidence, and supplies a fresh authoritative funding snapshot on each request. Average contribution is computed server-side from USD cents and completed contribution count, rounded to cents; zero contributions leave the average undefined. Natural-language funding placeholders are validated and substituted from that server snapshot. The transcript is not persisted in the database, analytics, or ordinary application logs. The streaming UI displays only complete validated claim objects, then validates the final answer; errors clear partial text and allow retry, and closing/navigation cancels the stream.

The previous streaming build `jltxTNzfwPja4fpuVnTtM` passed 150 Vitest and 54 browser checks; see [`chat-browser-check.json`](evidence/chat-browser-check.json) for that run's 18 axe scans, zero serious/critical violations, and screenshots. The current measured build is `-6yPHl9lZGab-87T31WH9`. Its production build, typecheck, lint, formatting, and 150 Vitest checks passed. The current build now has a separate 57/57 browser result, recorded above; the prior 54-check run is retained as historical evidence.

The previous streaming build's live chat journey completed 8/8 actual SSE requests using `gpt-4.1-mini-2025-04-14`; primary-agent review found all answers consistent with fictional campaign sources and the current funding snapshot. Six supported answers emitted validated partials before completion; two missing-information answers emitted no partial claim. See [`chat-live-evaluation.json`](evidence/chat-live-evaluation.json), including timings and the local relay limitation. The current milestone build's browser, recording-window report, and video decode/frame review are recorded above; the current release manifest verifies the source/evidence/build identity; the OpenSpec change is archived with 47/47 tasks complete; all six main specs were synced and strict validation passed before and after archival. The [new performance report](performance.md) records the current build's complete Lighthouse rerun. Previous `chat-release.json` and chat screenshots are retained for build `jltxTNzfwPja4fpuVnTtM`; do not treat them as source hashes or browser verification for `-6yPHl9lZGab-87T31WH9`.

Source/fixture/document files were scanned for API-key and private-key patterns without finding a match. `.env.local`, generated browser session files, caches and test-result scratch data are excluded from source delivery. This scan is a bounded check, not a claim that all possible secrets can be detected by patterns.

## Discover concierge — 2026-10-18

The new Discover-only assistant has separate [validation evidence](evidence/concierge-20261018/validation.md), [reviewed browser captures](evidence/concierge-20261018/browser/), and a [six-request real-provider run](evidence/concierge-20261018/live-evaluation.json). It is evaluated separately from historical fundraiser Ask behavior. The retained development evaluations are not the final result. Source-reference validation does not establish independent verification or guaranteed campaign outcomes.
