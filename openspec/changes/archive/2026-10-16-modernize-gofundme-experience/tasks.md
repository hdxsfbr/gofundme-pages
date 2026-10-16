# Tasks

Implement the scope in [proposal.md](proposal.md), using [design.md](design.md) and the six capability specs as the acceptance contract. These are implementation tasks; no application work has been performed by creating this checklist.

The week budget is: foundation on day 1; discovery and fundraiser reading on day 2; profiles and relationships on day 3; donations, history, and measurement on day 4; AI on day 5; integrated quality checks on day 6; submission on day 7. Land tests and documentation with each feature. Keep the AI usage log current throughout. If a required acceptance check fails, leave the affected task unfinished and record the limitation.

## 1. Application and persistence foundation

Covers the foundation for all six specs, especially `support-actions` and `engagement-measurement`.

- [x] 1.1 Scaffold the TypeScript Next.js application with compatible pinned dependencies, lockfile, shared layout, and explicit build/typecheck/lint/test commands; verify a clean install and production build succeed and a minimal route renders.
- [x] 1.2 Establish the responsive design tokens, typography, image sizing, focus styles, accessible panel primitive, and reduced-motion behavior; verify the shell and panel by keyboard and by viewing screenshots at 390 x 844 and 1440 x 1000.
- [x] 1.3 Create the PostgreSQL migrations and server-only data-access layer for visitors, follows, donations, featured causes, update views, sessions, events, and AI usage windows; verify migrations run against an empty test database and uniqueness constraints reject duplicate relationships, donation keys, and event IDs.
- [x] 1.4 Implement cookie-bound demo identity and same-origin, session-derived mutation validation; verify two isolated browser contexts receive separate state, supplied visitor IDs cannot select another visitor, and a reload plus application restart preserves the original identity.
- [x] 1.5 Add the event contract, deduplicating collector, trusted mutation-event writer, and 30-minute inactivity sessions; verify exact-boundary session behavior, duplicate delivery, rejected client-spoofed completion events, test-traffic tagging, and a failed collector that does not block the primary interaction.
- [x] 1.6 Replace the template README with runnable local setup and environment instructions, start technical documentation and the AI usage log, and check availability of an explicitly authorized runtime model/provider without printing secrets; verify the documented setup works and record the provider decision or missing credential dependency before AI integration, without using inherited Anthropic API credentials.

## 2. Fictional content and shared campaign projections

Covers `fundraiser-experience`, `community-discovery`, and `supporter-profiles` data contracts.

- [x] 2.1 Author one fictional community, four campaigns, four organizer profiles, beneficiaries, topics, featured-cause reasons, community/campaign updates, and a fixed dated seed donation ledger; verify identifier relationships, positive goals, integer-cent amounts, complete versus missing budget examples, and explicit fictional/demo labels with fixture validation.
- [x] 2.2 Select original or licensed campaign media with documented provenance and useful alternative text; verify each image loads, has reserved dimensions and responsive sizes, and does not reuse the reference screenshots as product content.
- [x] 2.3 Implement one projection layer for seed-plus-current-visitor funding, community aggregates, donation counts, rounded percentages, and remaining amounts; verify cents, overfunding, empty activity, and two-visitor isolation with unit/integration cases and confirm personalized responses are not shared across visitors by caching.
- [x] 2.4 Add stable source identifiers and deep-link targets for story sections, organizer/beneficiary information, funding snapshots, and dated updates; verify all fixture references resolve and document the fixture format, calculation rules, media provenance, and immutable timestamp policy in the technical documentation.

## 3. Community discovery and fundraiser reading

Covers `community-discovery` and the reading/navigation portions of `fundraiser-experience`.

- [x] 3.1 Build the community overview with aggregate totals and photo-led Discover cards ahead of any ranking content; verify each card's title, organizer, need, progress, and destination at mobile and desktop sizes, with keyboard access and appropriate image alternatives.
- [x] 3.2 Implement combined case-insensitive search and topic filters, deterministic ordering, reset, and separate loading/empty/not-found/retry states; verify matching across title, organizer, and need, combined filters, no-match recovery, and failed content loading with component/browser checks.
- [x] 3.3 Build fundraiser overview, full story, intended use of funds, dated updates, organizer/beneficiary distinction, community/profile links, and reserved support/Ask entry points; verify all four campaigns and missing-budget behavior without invented facts, plus explicit not-found behavior for invalid identifiers.
- [x] 3.4 Implement URL-backed discovery selections, tab-local scroll restoration, direct public links, and source-anchor reveal/focus behavior; verify opening a filtered card and using Back restores its view, search, topic, and position, and opening a citation reveals a collapsed source without sticky controls obscuring it.
- [x] 3.5 Add discovery/page/update events and persist fundraiser update-view timestamps only when the update content becomes visible; verify authored-update attribution, first-visit Latest labeling, newer-update freshness, reload persistence, and expected event payloads, then document discovery ordering and freshness rules beside their tests.

## 4. Profiles, follows, featured causes, and sharing

Covers `supporter-profiles`, Following in `community-discovery`, and the corresponding `support-actions`.

- [x] 4.1 Build organizer profiles and the private `/me` view with introductions, interests, community links, featured causes, and dated typed activity; verify correct cross-page identities, a useful empty demo profile, all featured cards reachable by keyboard, and no public-share or self-follow action for `/me`.
- [x] 4.2 Implement follow/unfollow for communities, campaigns, and organizers with pending feedback, unique saved relationships, and rollback on failure; verify repeated requests, reload persistence, failure recovery, and consistent controls across all three page types.
- [x] 4.3 Implement Following as the deduplicated union of followed campaigns, community campaigns, and organizer campaigns, with the appropriate attributed updates; verify overlapping follows, removing one relationship while another still includes the campaign, and the empty view's route to Discover.
- [x] 4.4 Implement featuring/unfeaturing a campaign with an optional plain-text reason up to 280 characters, saved-state events, and the private activity projection; verify persistence, duplicate prevention, oversized-input rejection, safe rendering of markup, and isolation from both other visitors and seeded organizer profiles.
- [x] 4.5 Implement user-initiated native sharing, copy-link fallback, and a selectable canonical URL with separate opening/success/cancellation/failure events; verify browser outcomes through controlled browser tests, exclude private/session data from URLs, and document profile privacy, relationship semantics, and the limits of share measurement.

## 5. Simulated donations and funding history

Covers donation behavior in `support-actions` and progress behavior in `fundraiser-experience`.

- [x] 5.1 Build the amount-entry and confirmation flow with explicit no-charge demo wording and no payment-credential fields; verify keyboard focus/return, retained input on failure, and both client/server validation for the $1.00–$10,000.00 USD range, two-decimal precision, malformed values, and non-finite input.
- [x] 5.2 Persist donations with visitor-bound idempotency keys and a durable completion event, deriving activity from the saved donation; verify double submission, a lost-response retry, conflicting reuse of a key, deliberately separate donations, and storage failure produce the specified record/event counts and success states.
- [x] 5.3 Refresh community, fundraiser, profile, and source-snapshot projections after a saved donation; verify one end-to-end donation changes all relevant totals/counts once, survives application restart, and leaves a second visitor's demo unchanged.
- [x] 5.4 Implement UTC 7-day, 30-day, and all-time cumulative funding history with period amounts/counts, a pre-window opening balance, range controls, and an accessible dated data alternative; verify boundary timestamps, a flat no-donation period, overfunding, and agreement between chart, summary, and source snapshot.
- [x] 5.5 Verify donation and chart controls at mobile/desktop widths with keyboard and reduced-motion settings, and document idempotency, simulation boundaries, ledger/time-window formulas, and scoped test-reset procedures; completion requires passing feature tests and viewable screenshots without obscured controls or page-level overflow.

## 6. Evidence-linked fundraiser AI

Covers `fundraiser-assistant`; depends on the confirmed runtime configuration from 1.6, source model from 2.4, and funding behavior from group 5.

- [x] 6.1 Build the server-only provider adapter and bounded campaign evidence bundle, using one explicitly configured authorized model, stable source IDs, current funding facts, and the documented source/output limits; verify bundles contain only the selected campaign's allowed records and secrets remain server-side, and document configuration and the unavailable-provider path.
- [x] 6.2 Implement the structured answer contract, citation/campaign validation, explicit missing-information responses, and server-rendered authoritative funding facts; verify supported-purpose, missing-budget, newest/conflicting-update, invalid-citation, unrelated-campaign, unverified-legitimacy, and source-injection cases with deterministic fixtures that remain labeled as fixtures.
- [x] 6.3 Implement persistent per-visitor request limits, a deployment-wide request budget, bounded input, upstream/client deadlines, and safe error handling; verify the 10-requests-per-10-minutes allowance, budget exhaustion, provider failure, malformed output, and a maximum 20-second visible wait without sending unnecessary requests or logging raw questions/answers.
- [x] 6.4 Build the accessible Ask panel with suggested/typed questions, campaign-scoped display history, source citations, loading/retry/abstention states, and stale-response cancellation; verify keyboard behavior, citation reveal/focus, navigation or close during generation, current totals after donation, and minimized outcome/latency/citation events.
- [x] 6.5 Run the grounding evaluation against the configured live provider and record model/configuration, case results, citation support, numeric agreement, and latency separately from fixture results; verify no unsupported verification/impact claims, mismatched citations, private cross-campaign disclosure, or wrong funding figures, and leave live acceptance unfinished if credentials or live evidence are unavailable.
- [x] 6.6 Document the AI data flow, evidence limits, missing-information behavior, failure modes, evaluation results, and remaining limitations, and update the development AI usage log; verify the documentation reproduces the eval procedure and distinguishes AI-assisted development from the application's runtime AI feature.

## 7. Engagement reporting and performance evidence

Covers `engagement-measurement`; feature-specific instrumentation and tests land in the groups above.

- [x] 7.1 Implement a reproducible engagement report/export for discovery-to-campaign visits, follows, donation starts/completions, separate share outcomes, return visits, and AI outcomes/citation use; verify a known event dataset yields expected numerators, denominators, windows, empty-versus-zero results, deduplication, and default exclusion of test traffic.
- [x] 7.2 Document the event dictionary, allowed properties, session/return definition, each metric denominator, delivery limitations, and interpretation of simulated data; verify the report command works as documented and stored payloads exclude raw searches, prompts, answers, profile notes, URL queries, credentials, and payment information.
- [x] 7.3 Measure representative community, fundraiser, and organizer-profile routes in a production build with three cold runs each of a pinned Lighthouse mobile preset; save raw reports and exact tool/environment/settings/dataset details, and verify each route's median LCP is at most 2.5 seconds and CLS at most 0.1, fixing or recording any unresolved failure without claiming field percentiles.
- [x] 7.4 Capture representative filtering, panel, and chart interaction traces and AI latency/error observations, checking that model requests never gate initial rendering; verify the performance document links to the evidence, explains sample limits, and identifies unavailable field responsiveness data honestly.

## 8. Integrated review and submission

This group checks the assembled experience and packages artifacts produced throughout implementation; it does not defer feature tests or documentation from earlier groups.

- [x] 8.1 Run the complete community → fundraiser → organizer → follow → Following → Ask/citation → simulated donation → private-profile journey, including Back restoration, reload/restart, a second isolated visitor, and representative failure paths; verify the browser suite passes and final action states, totals, sources, and report events agree.
- [x] 8.2 Review and view full-page screenshots of all three page types at 390 x 844 and 1440 x 1000 plus a narrow-width sanity check, comparing the intended hierarchy with the retained reference evidence; verify keyboard/focus, reduced motion, readable chart alternatives, and no unresolved serious/critical automated accessibility findings, and record remaining visual/usability limits.
- [x] 8.3 Run the documented clean setup, migrations, production build, lint/typecheck, relevant tests, and final report/eval procedures against the release candidate; verify source code, lockfile, fixture/media attribution, technical/tradeoff documentation, environment example, and AI usage log are complete and contain no secrets.
- [x] 8.4 Record the actual demo video showing the connected experience, simulated support, source-linked AI, missing-information behavior, and measurement evidence; verify the playable recording or submission link exists, the demonstrated build matches the submitted source, and any unverified dependency is described rather than hidden.
- [x] 8.5 Assemble a submission index linking source, technical documentation, demo video, AI usage log, and validation evidence, with runnable build/deployment instructions; verify every listed artifact is accessible and a reviewer can reproduce the demo, recording the hosted URL only if an authorized deployment has actually been completed.

## 9. Preview-origin repair after user verification

- [x] 9.1 Accept the configured primary origin and explicitly configured preview origins for actions, events, and Ask; reject missing, null, foreign, malformed, and unconfigured origins without trusting request Host or forwarded headers, and cover configuration failures with regression tests.
- [x] 9.2 Configure and restart the local review build for the browser-facing preview origin, then verify follow/unfollow, featured notes, simulated donation persistence, event intake, and Ask through a reproduced forwarding path while retaining foreign-origin rejection and direct-origin operation.
- [x] 9.3 Document preview-origin setup and the original verification gap, retain historical release evidence honestly, and record focused regression results and current source/build identities.


## 10. Conversational Ask refinement after user review

- [x] 10.1 Add bounded campaign-local recent conversation and an actual current funding snapshot to the model request; support server-calculated average contribution and cited numerical answers, preserve grounding/privacy/limits, and verify follow-up context, fresh totals, zero-count behavior, invalid history, and injection boundaries with meaningful tests.
- [x] 10.2 Replace the form-like Ask interaction with a stable-header/composer chat transcript, Enter-to-send and Shift+Enter newline, cleared drafts and immediate user messages, pending/retry behavior without duplicates, and accessible campaign-local scrolling/focus; verify keyboard, IME, failure, close/navigation and desktop/mobile behavior.
- [x] 10.3 Build and run the integrated change, verify the screenshot's average-contribution example and contextual follow-ups against the live model through the preview origin, inspect desktop/mobile screenshots and citations, and record new validation/AI usage evidence without relabeling historical artifacts.

- [x] 10.4 Stream genuinely incremental validated claims from one provider request with final validation, bounded failure and cancellation; render incremental progress in the existing turn and deduplicate references into a bottom-of-answer footer; verify split/escaped stream frames, rejected claims, partial failure/cancel, completion analytics, and live streaming evidence.
