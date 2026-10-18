# Discover concierge validation — 2026-10-18

Final local production build: `cwfYiNm8y3ZaiV0SF7yvb`, served at `http://127.0.0.1:3100`. This is branch implementation evidence, not hosted production verification. Browser sessions were signed out, isolated, and marked as test visitors.

## Checks

- Production build, TypeScript, ESLint, formatting, and all **205 unit/integration tests** in 16 files passed. New checks cover request/history limits, provider output, catalog/source validation, shared AI budgets, origin/error behavior, private event properties, and aggregate report joins.
- **17 integrated browser checks** passed: seven concierge checks, six existing fundraiser chat conversation checks, three existing chat lazy-loading/error checks, and the existing search/filter/Back/profile navigation journey. A further focused **IME/20-second timeout check passed**, for 18 relevant browser checks across these runs. Fixtures intercept both AI routes; no provider calls are made by browser tests.
- Concierge fixtures cover desktop 1440 × 1000, mobile 390 × 844 and 320 × 844; banner and floating entry, composer and suggestions, bounded follow-up history, normal campaign/source navigation, no match, pending, error/retry preserving draft, close/abort/context clearing/focus restoration, Following exclusion, and rejection of an outside-catalog reply. No JavaScript errors or horizontal overflow were observed.
- The delegated browser agent reviewed all 13 retained fixture captures in `browser/`; the primary agent reviewed the desktop invitation, mobile recommendation, and final real-provider desktop capture. Screenshots retain their original fixture/live distinction.
- Three Lighthouse simulated-mobile runs on the final build measured Discover LCP of 2,475.99, 1,956.83, and 2,326.82 ms: median **2,326.82 ms**, CLS **0**. All three samples met the project-selected 2,500 ms / 0.1 budgets. Raw reports/settings are in `performance/`. Only Discover was newly benchmarked; these are local lab observations, not hosted or field performance.

## Real provider review

`live-evaluation.json` records six final real Responses API calls: accessibility recommendation (trail), contextual promotion guidance (same trail), a clarifying question for unspecified interests, climate recommendations (trees and solar), no matching cat-veterinary cause, and refusal to invent a verified disaster fundraiser or expose private activity. All six returned valid HTTP 200 responses with catalog-valid links. Two calls ran through the real UI, including the follow-up; four used the app API in the same test context. The primary agent reviewed the returned texts and source associations against authored campaign records. AI explanations may paraphrase or infer thematic relevance; they do not establish verified impact or independent legitimacy.

The first development run included added general environmental benefits; grounding instructions were tightened. The second asked an unnecessary narrowing question for a recognized topic; the prompt was refined to return matching cards immediately. Those twelve development calls remain under `development/`; they are not relabeled as final. Total development plus final runtime calls: **18**. No real donations or outbound sharing occurred.

`live-event-report.json` reconciles request-tagged final events: six submitted, six completed, zero failed/pending/unmatched outcomes, with only request UUID and latency property keys. Default reporting excludes those test sessions. The live run did not open a recommendation, so campaign-open count is zero; recommendation navigation and request-to-click joins are covered separately by browser fixtures and report tests, not claimed as a live donation-conversion experiment.

## Limits and reproduction

This is Chromium coverage, not physical iOS/Safari or a full accessibility certification. The UI supports keyboard focus and a bounded wait; qualitative recommendation quality still depends on the model and source content. Conversation history is transient. The existing fundraiser AI remains separately scoped and streamed; concierge waits for validated complete JSON.

Run the README setup and production server with a matching APP_ORIGIN, then `BASE_URL=http://127.0.0.1:3100 npx playwright test tests/browser/concierge.spec.ts`. Capture screenshots intentionally with `CONCIERGE_BROWSER_EVIDENCE_DIR`; default test runs write under test-results. `scripts/eval-concierge.mjs` makes six real model calls only when deliberately run against a configured app. Existing demo videos predate this feature; the submission index contains the proposed walkthrough addition.
