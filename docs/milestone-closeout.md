# Milestone closeout — complete

The current measured production build is `-6yPHl9lZGab-87T31WH9`. Production build, typecheck, lint, formatting, and all 150 Vitest checks pass. The final browser run passed 57/57 checks (zero failed, flaky, or skipped); 18 release-scene axe scans reported zero serious/critical violations, and all 18 final captures were viewed. All three route Lighthouse medians meet the project-selected budgets. The current recording and report are saved; full-stream decode and sampled-frame review passed. The current release manifest verifies the build, source/evidence hashes, and video identity. The OpenSpec change is archived with all 47 tasks complete; all six main specs were synced exactly (46 requirements, 79 scenarios), strict validation passed before and after, and no active changes remain.

## Current handoff

- [README and local setup](../README.md), [technical notes](technical.md), [media notes](media.md), and [analytics definitions](analytics.md).
- [AI usage log](ai-usage-log.md) and [AI evaluation](ai-evaluation.md). The eight-answer source-reviewed live streaming evaluation is previous-build evidence; the current demo recording uses four live provider calls.
- [Validation record](validation.md) and the current [57-check browser result](evidence/milestone/browser-check.json). Final captures are in [browser](evidence/milestone/browser/) and [chat](evidence/milestone/chat/).
- [Performance report](performance.md), [raw Lighthouse summary](evidence/milestone/performance/summary.json), [settings](evidence/milestone/performance/settings.json), and scripted [interaction data](evidence/milestone/performance/interactions.json).
- **Current recording:** [silent real-browser video](evidence/milestone/demo.webm), [metadata](evidence/milestone/demo-recording.json), and [recording-window engagement report](evidence/milestone/demo-engagement.json). The report covers one isolated test visitor/session: 30 events, eight page views, one follow, one $12.50 simulated donation, one copied link, two citation opens, and four live AI requests (three supported, one abstained). Its full FFmpeg stream decode passed with zero errors; 13 sampled frames were reviewed. The 55.24-second recording is VP9 at 1440 × 1000 and 25 fps (7,486,360 bytes); see the [decode/frame report](evidence/milestone/demo-video-check.json) and [reviewed frames](evidence/milestone/demo-frames/).
- **Release identity:** [current release manifest](evidence/milestone/release-manifest.json) records 75 source/configuration/media/test/script hashes and 59 evidence-file hashes for the current build. A bounded scan of 331 candidate files found no sensitive-pattern matches and no files over 20 MiB. The OpenSpec change is archived. The older [demo](evidence/demo.webm), [report](evidence/demo-engagement.json), and [manifest](evidence/release-manifest.json) remain historical evidence from earlier builds. The previous streaming manifest is [chat-release.json](evidence/chat-release.json).

## Boundaries and replay

This is a local prototype with fictional campaign content, illustrative stock images, simulated donations, and visitor-scoped state. Creator publishing was deferred. There is no production identity, account recovery, cross-device account, live payment processing, or hosted deployment. A separate human final review is not recorded; this is a documentation limitation, not an outstanding milestone task.

Use [local setup](../README.md#run-locally) for PostgreSQL and the app. For the forwarded-preview reproduction, configure `APP_PREVIEW_ORIGINS=http://localhost:61071` in the ignored environment file and restart the app, then run `node scripts/preview-proxy.mjs` in another terminal. The relay forwards `http://localhost:61071` to `http://127.0.0.1:3000` while preserving the browser Origin header. See the [validation record](validation.md) for the focused regression command.

With the production server running, run these captures sequentially. The separate `replay` directory preserves the submitted evidence. Video recording requires the configured runtime OpenAI key and makes four live provider calls; browser tests use fixtures.

```sh
PREVIEW_BASE_URL=http://localhost:61071 BROWSER_EVIDENCE_DIR=docs/evidence/replay/browser CHAT_EVIDENCE_DIR=docs/evidence/replay/chat npm run test:browser
PERFORMANCE_EVIDENCE_DIR=docs/evidence/replay/performance npm run perf
PERFORMANCE_EVIDENCE_DIR=docs/evidence/replay/performance npm run perf:interactions
npx playwright install ffmpeg # one-time video prerequisite
DEMO_EVIDENCE_DIR=docs/evidence/replay npm run demo:record
```

## Archived planning record

The [archived proposal](../openspec/changes/archive/2026-10-16-modernize-gofundme-experience/proposal.md), [design](../openspec/changes/archive/2026-10-16-modernize-gofundme-experience/design.md), [task list](../openspec/changes/archive/2026-10-16-modernize-gofundme-experience/tasks.md), [six synced main specs](../openspec/specs/), [archived delta specs](../openspec/changes/archive/2026-10-16-modernize-gofundme-experience/specs/), and [reference captures](../openspec/changes/archive/2026-10-16-modernize-gofundme-experience/evidence/) document the completed change. All 47 tasks are done; the six main specs synced exactly with 46 requirements and 79 scenarios. Strict validation passed before and after archive, and no active OpenSpec changes remain.
