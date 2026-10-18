# Hosted Watch release check (task 5.4)

**Checked:** 2026-10-17 19:04 CDT (2026-10-18 00:04 UTC), signed out, fresh browser context.

## Release

- Source revision: `ea678369826150e79a11e7254d4dd89eb11905eb` (merge of MR !1 into `main`)
- Main pipeline: [59049](https://labs.gauntletai.com/andrebatista/gofundme-pages/-/pipelines/59049), passed. `validate` passed 187 unit/integration and 70 browser checks.
- Deploy job: [240206](https://labs.gauntletai.com/andrebatista/gofundme-pages/-/jobs/240206), passed.
- Railway deployment: `005f29af-3a78-4ae8-97ee-f4124465e074`, `SUCCESS`. `/api/health` returned this same deployment ID. See [`deployment-result.json`](deployment-result.json).
- Origin: https://web-production-7e5023.up.railway.app

## Results

- `/communities/a-greener-tomorrow/watch` returned 200 (`text/html`).
- All four clips (`garden`, `trees`, `solar`, `trail`) returned 200 for `.mp4` as `video/mp4` and for `.vtt` as `text/vtt; charset=UTF-8`. Response sizes matched the repository files. `Range: bytes=0-99` returned 206 with `Accept-Ranges: bytes` and the correct `Content-Range`.
- Browser journey, using [`hosted-check.mjs`](hosted-check.mjs) in headless Chrome at 390 × 844:
  - The Watch page opened on `garden-neighbors`. The video reached `readyState` 2 or higher, and its caption track loaded with 2 cues.
  - Opening the linked fundraiser and going Back returned to the same clip.
  - A $1.00 simulated donation from the Watch page showed "No money was charged." Closing the dialog returned to the same clip, and its video was still attached.
- Only the active and next clips' media were requested (MP4 as 206 ranges). See [`hosted-check-result.json`](hosted-check-result.json), [`watch-mobile.png`](watch-mobile.png), and [`donation-confirmed.png`](donation-confirmed.png).

## Production data created

All browser requests sent `x-demo-test: true`, so the session is labeled `is_test` and excluded from default reports (see [analytics](../../analytics.md)).

- One new anonymous visitor and its session.
- One $1.00 simulated donation to `grow-a-neighborhood`, with Watch source `garden-neighbors`, at 2026-10-18T00:04:37Z. It affects only that visitor's totals.
- Test-labeled first-party events: feed opened, clip impressions, donation start and completion, and fundraiser arrival and return.
- A single header-tagged `curl` request to the Watch page may also have created a test-labeled session.

The app has no visitor deletion or reset control (see [technical notes](../../technical.md)), so these rows remain. They can be identified by the `is_test` label, campaign, clip, and timestamp.

## Limitations

- One browser (headless Chrome) at one mobile size. No physical iOS or Safari check.
- This is a single moment of release readiness, not monitoring.
- Request headers and cookies are not retained. The script stores no session state.
- CI on the shared runner #282 is slow (about 25–28 minutes for `validate`) and has had timing flakes. This is tracked as a follow-up in the change's `tasks.md`.
