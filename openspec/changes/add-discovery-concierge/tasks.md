# Tasks

These tasks track the implemented local feature and retained acceptance evidence. Production publication and a combined final submission recording are separate follow-up work.

## 1. API and model contract

- [x] 1.1 Inspect the existing Ask route, provider wrapper, catalog, and shared usage allowance; implement independent `POST /api/concierge` using the same configured Responses structured-output path and shared deployment/visitor budget.
- [x] 1.2 Validate 1–1,000 character questions and at most two completed prior exchange pairs; derive and send the current four-campaign catalog on every request; reject malformed output and campaign IDs or routes outside the catalog.
- [x] 1.3 Enforce grounded reasons, zero-to-three recommendations, clarifying questions, explicit no-match responses, no numerical funding claims, and no legitimacy/impact assertions. Ensure the route cannot invoke support or campaign-creation actions.
- [x] 1.4 Add focused route/provider contract coverage for valid recommendations, clarification, no match, invalid history/input, malformed output, hallucinated campaign references, provider absence/failure, shared allowance exhaustion, and cancellation/timeout behavior.

## 2. Discover experience

- [x] 2.1 Add a Discover-only invitation banner and floating launcher that open the concierge using the established assistant dialog and responsive interaction conventions.
- [x] 2.2 Implement ephemeral conversation display and submission, reusing Enter/Shift+Enter, IME, pending, retry, close cancellation, focus, and 20-second timeout behavior; clear history on close or navigation.
- [x] 2.3 Render only catalog-valid recommendations with grounded reasons and ordinary internal fundraiser links; ensure failure does not block browsing and detail pages retain existing support actions.
- [x] 2.4 Verify keyboard and mobile/desktop journeys, including opening, follow-up with bounded history, no-match, failure/retry, close/navigation clearing, result navigation, and continued Discover use.

## 3. Measurement and documentation

- [x] 3.1 Add separate concierge open/request/completion/failure/campaign-open events; validate campaign associations and prove that no question, answer, reason, or transcript text enters analytics or ordinary logs.
- [x] 3.2 Document the API, shared allowance, ephemeral data handling, event meanings, recommendation boundaries, and limits in technical and analytics documentation.
- [x] 3.3 Update the demo walkthrough and AI usage log if concierge is demonstrated; distinguish fixtures from a successful live-provider smoke test.

## 4. Integrated acceptance

- [x] 4.1 Review desktop and mobile rendering and complete discovery-to-campaign journeys; retain dated visual and interaction evidence, including loading, empty/no-match, and error states.
- [x] 4.2 Run appropriate checks and the original Discover and fundraiser Ask regressions; verify no regression to page browsing or existing AI allowance behavior. Record live-provider status separately from fixture validation.
- [x] 4.3 Reconcile implementation and evidence with this change, then run strict OpenSpec validation. Sync/archive only after acceptance is complete.

Evidence: `docs/evidence/concierge-20261018/validation.md`, final six-call live evaluation, event reconciliation, desktop/mobile screenshots, and Discover performance reports. 205 unit/integration tests and 18 relevant browser checks passed. Strict OpenSpec validation passed.
