# Design

## Context

See [proposal.md](proposal.md) for the motivation and product boundary. The six files under `specs/` define acceptance behavior. The repository is greenfield: no application, dependency manifest, tests, database, deployment configuration, or existing specs were found. `README.md` is the original GitLab template. The sponsor's source requirements remain in `docs/project-requirements.md`.

### Research evidence and limits

Inspection date: **2026-10-15**. GoFundMe was reviewed signed out in isolated local Chrome/Playwright contexts at **1440 x 1000 desktop** and **390 x 844 mobile** viewports. Full-page captures retain those widths and extend vertically. Privacy prompts were dismissed before the retained captures. The following are observations, not demonstrated causes of poor engagement:

| Reference | Observed behavior | Design implication and retained evidence |
| --- | --- | --- |
| [Watch Duty community](https://www.gofundme.com/communities/watch-duty) | Introductory hero and totals precede a prominent leaderboard; Activity / Fundraisers / About appear below it. The feed includes mixed campaign and general updates, including test content. | Prioritize relevant discovery and explain update provenance. [Desktop capture](evidence/community-desktop-review-full.png), [mobile capture](evidence/community-mobile-review.png). |
| [Wildfire fundraiser](https://www.gofundme.com/f/realtime-alerts-for-wildfire-safety-r5jkk) | Desktop donation panel and mobile photo-led hero already exist. The live page includes community and organizer-profile links, a cause section, and a leaderboard. Both internal relationship links were followed successfully. | Preserve the connections and strong support actions; improve the short overview and progress explanation. [Desktop](evidence/fundraiser-desktop-review.png), [mobile](evidence/fundraiser-mobile-review.png). |
| [Janahan profile](https://www.gofundme.com/u/janahan) | Identity, follower/impact counts, interests, featured causes, activity, and people discovery already exist. | Add personal context to featured causes and improve the hierarchy rather than presenting profiles or following as new inventions. [Desktop](evidence/profile-desktop-review-full.png), [mobile](evidence/profile-mobile-review.png). |
| Fundraiser sharing and community following | The share sheet already offers tailored messages and generated posters. Following while signed out navigates to sign-in with a return URL. No authenticated behavior or real transaction was tested. | Do not make generic AI captions the differentiator. Keep the prototype's simpler identity behavior explicit. [Share sheet](evidence/fundraiser-mobile-share.png). |
| [Polymarket detail](https://polymarket.com/event/texas-senate-election-winner) | In view-only mode, current values, a time-range chart, contextual information, and an action panel are visible together. | Reuse the hierarchy for actual funding history; percentage funded never represents outcome probability. [Detail capture](evidence/polymarket-detail-review.png), 1440 x 1000. The displayed market is a UI reference only. |
| [TikTok Explore](https://www.tiktok.com/explore) and [discovery documentation](https://support.tiktok.com/en/getting-started/for-you/test-for-you) | The public desktop Explore grid showed portrait media, creator attribution, and topic filters. Following the login Skip path produced a birthday prompt, so further interaction was not inspected. | Borrow visual browsing and attribution. A personalized algorithm, authenticated TikTok behavior, and any demographic benefit are not verified findings. |

The requirements transcription's fundraiser suffix and profile URL uncertainties were resolved by successful retrieval of the exact GoFundMe URLs above. They are research references, not content or credentials to import into the prototype. This design records the resolution without silently altering the sponsor transcription.

## Goals / Non-Goals

**Goals:**

- Keep campaign facts, totals, action state, and AI sources consistent across page types.
- Deliver a credible, visually polished demonstration within one week, with explicit boundaries around simulated participation.
- Keep initial pages useful when the AI provider is slow or absent and make the AI's evidence and uncertainty inspectable.
- Give the implementation a concrete data model, route structure, failure model, and verification plan.

**Non-Goals:**

- Production identity recovery, payments, public user-generated publishing/moderation, shared multi-visitor fundraising, or an operational recommendation service.
- Reproducing the reference sites' complete product surfaces or scraping them at runtime.
- Establishing statistically significant retention improvement or a verified preference among younger adults in a one-week demo.

## Decisions

### 1. One Next.js application with narrow interactive components

Use TypeScript, Next.js App Router, and React. Render story and profile content on the server; use client components for discovery controls, panels, chart controls, and immediate interaction feedback. Use shared design tokens and CSS rather than assembling three unrelated templates. Verify compatible package versions and commit a lockfile during implementation.

Next.js documents this server/client division and supports a Node deployment: [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components), [self-hosting](https://nextjs.org/docs/app/guides/self-hosting), checked 2026-10-15. Initial page rendering must not call the model provider. AI credentials, database queries, and authoritative mutation logic remain server-only.

**Alternative considered:** A browser-only static app with local storage would simplify hosting but weaken durability, server-validated donations, and the live-AI boundary. A separate frontend/backend pair adds unnecessary deployment work for this scope.

### 2. Three page types and a focused route map

| Route | Role |
| --- | --- |
| `/` | Redirect to the seeded community. |
| `/communities/[slug]` | Cause overview; Discover and Following; search/topics; community and fundraiser updates. |
| `/fundraisers/[slug]` | Story overview, full source sections, updates, progress chart, support actions, and Ask panel. |
| `/profiles/[slug]` | Seeded organizer profile, featured causes, communities, and public demo activity. |
| `/me` | The current visitor's private demo profile using the same profile layout. |

Public URLs remain shareable and load without prior navigation. There is no separate global social feed or full analytics dashboard. Following is a view of the seeded community. Use query parameters for view/topic/search and per-tab navigation state for the last card/scroll offset; restore that state on browser Back. Invalid entities get an explicit not-found page.

**Alternative considered:** Full-screen nested modals for all navigation feel fluid but complicate deep links, focus, and browser history. Use ordinary page routes with lightweight action panels.

### 3. Visual direction and content hierarchy

Use a warm neutral canvas, high-contrast text, a recognizable green action accent, expressive headings, and strong original or licensed photography. Desktop discovery uses an efficient card grid; mobile uses a single-column portrait story rhythm with native scrolling. Provide distinct visual treatments for authored community updates and fundraiser updates. Keep the organizer, beneficiary, source dates, and demo labeling visible.

The community leads with a compact cause introduction, current information, and discovery controls. Fundraisers provide a brief need/use-of-funds overview before the full narrative, and a compact progress visualization near support actions. Profiles connect personal reasons for supporting causes to current campaigns. Motion is brief interaction feedback and respects reduced motion. No automatic video/audio, forced swipe navigation, or excessive decorative animation is necessary.

**Alternative considered:** A full TikTok-style video feed requires production media and playback/upload work. Photo-led browsing demonstrates the discovery concept within the week. A money-ranked leaderboard would repeat the current emphasis, so no new ranking system is required.

### 4. Immutable demo content and PostgreSQL-backed visitor state

Keep a validated, versioned fixture dataset in the repository: one fictional community, four campaigns, four organizers, beneficiary descriptions, topics, authored reasons, dated updates, and seed donation records. Include a mixture of complete and missing budget detail and enough dated contributions to exercise the chart ranges. Media is original, generated as clearly fictional illustration, or properly licensed; do not invent testimonials from real people or reuse research screenshots as product assets.

Use PostgreSQL with a small server-side data-access layer and explicit SQL migrations for mutable demo state. Immutable source content does not need an authoring backend. All values involving money use integer USD cents. Validate fixture identifiers and positive goals before serving them. Seed timestamps remain fixed; rendering or restarting must not fabricate fresh donations or updates.

| Persisted entity | Key information and constraint |
| --- | --- |
| Demo visitor | Opaque visitor identity, creation time, and session-token hash; no real personal details required. |
| Follow | Visitor, target type and ID, created time; unique visitor/target relationship. |
| Simulated donation | Visitor, fundraiser, amount in cents, created time, idempotency key; unique visitor/key pair. |
| Featured cause | Visitor, fundraiser, plain-text reason, updated time; one feature per visitor/fundraiser. |
| Update viewing state | Visitor, fundraiser, last update-view timestamp. |
| Analytics session | Visitor, start and last-activity times, test/demo label. |
| Event | Unique event ID, session, event type, time, permitted identifiers and measurements. |
| AI usage window | Visitor/window request count, supporting persistent request limits. |

Public fundraiser totals are projected for the active visitor: **immutable seed ledger + that visitor's completed simulated donations**. This makes the demo repeatable and prevents another reviewer changing the user's experience. The application visibly explains that actions affect the current demo. Public profile baseline activity stays seeded; `/me` contains private visitor activity. Do not put personalized projections into a shared cache. Prefer uncached visitor-bound reads for this small dataset.

**Alternative considered:** SQLite could work on one server with a persistent volume, but PostgreSQL avoids tying durability to a particular web host's filesystem. A shared global demo ledger would create interference between reviewers and make test resets hazardous.

### 5. Demo identity and mutations

Create a random, unguessable demo-session token on the first necessary session request, store only its hash server-side, and use a same-site, HTTP-only cookie, secure in HTTPS environments. The server derives the visitor from that token; mutation bodies never choose the acting visitor. Persist the token for the demo period, document that clearing it creates a fresh demo, and provide no cross-device account-recovery claim.

Use same-origin mutation handlers with schema validation, origin checks, target validation, and bounded input sizes. The configured public origin (`APP_ORIGIN`) and any explicitly listed browser-facing preview origins (`APP_PREVIEW_ORIGINS`, comma-separated) define the trusted origin set. Compare the request Origin against this set; never infer trust from Host, forwarded headers, or the internal request URL. Missing or malformed server configuration fails closed. This handles a preview proxy changing the visible hostname/port while preserving the canonical direct address. Check amounts on the server and render saved profile reasons as text. Submit one idempotency key per intended donation; retrying that key with different campaign/amount data is a conflict, not a second donation. A successful donation, its profile activity projection, and its completion measurement derive from the same saved transaction.

Support actions have pending, success, and failure states. Follow controls can update optimistically with rollback; donations show success only after a confirmed durable save. Revalidate the affected projections after mutation. The next chart, community, profile, and AI funding snapshot must agree. Client cancellation after save does not undo the saved transaction.

Use native Web Share when available, then clipboard, then a selectable URL. An external share destination is never opened or posted to without a user action. Native-share resolution is a browser-reported outcome, not proof of receipt or referral conversion. Share public community and fundraiser URLs; do not expose `/me` as a public identity.

**Alternative considered:** Full OAuth onboarding is outside the accepted demo scope. A purely local success animation would not exercise durable state or credible error behavior.

### 6. Deterministic discovery, freshness, and funding history

Discover uses a seeded editorial rank, not an opaque engagement model. Apply search and topic filters to that ordering. Following resolves the union of directly followed campaigns, campaigns in followed communities, and campaigns owned by followed organizers, then deduplicates by campaign ID. Community updates enter Following through a community follow; fundraiser updates enter through the resolved campaign set. Sort update lists newest first with a stable ID tie-breaker.

Freshness compares an update timestamp to the visitor's previous `last update-view` time. The first view says Latest updates. Opening a fundraiser's updates marks its currently available updates as viewed; merely opening Discover does not. Do not mark an unseen update read before its content becomes visible. Persist this timestamp so returning visits behave consistently.

Funding calculations use the same ledger projection everywhere. Show `round(100 * raised / goal)` as percentage funded and cap only the visual track, not the displayed overfunded percentage. Remaining amount is `max(goal - raised, 0)`. Donation count counts completed records; follower counts are separate and never labeled donors.

Chart ranges use UTC calendar days, visibly labeled, and include today: 7 days begins at UTC midnight six days ago; 30 days begins 29 days ago. The cumulative line begins with the pre-window funding balance, while period change includes only in-window amounts. Show daily balances, period change/count, and the snapshot time in an accessible alternative. A flat period remains flat. A lightweight SVG chart is sufficient for one series; use explicit touch/keyboard time-range controls and optional point details.

**Alternative considered:** Predictive probabilities and trading metaphors do not represent campaign outcomes. Recomputing each surface separately risks inconsistent numbers. A chart library is optional only if it reduces accessible implementation work without unnecessary bundle cost.

### 7. One bounded, evidence-linked AI endpoint

Use one server-side endpoint for the selected campaign and one question at a time. Each request includes at most two recent completed question/answer pairs for reference resolution plus a fresh authoritative campaign/funding snapshot. The history envelope names the same campaign, alternates user/assistant messages, limits user text to 1,000 characters and assistant text to 1,500 characters, and caps combined history at 5,000 characters. The client drops oldest complete pairs when needed to remain inside the 8,192-character request-body limit. Conversation is transient and campaign-local; it is neither a trusted factual source nor stored in the database or analytics. A general multi-campaign conversational agent remains out of scope.

The panel uses a stable header and composer around an independently scrolling transcript. Enter sends, Shift+Enter inserts a newline, and IME composition must not submit. Submitting a typed question or suggestion immediately adds one user message and clears the composer; repeated activation while pending sends only once. Pending, answer, and retryable error states appear beside that turn. A retry reuses the failed turn without duplicating it or overwriting a new draft. Suggestions are an initial convenience, not a question whitelist. References are deduplicated by source and grouped in a footer after each answer, followed by the funding snapshot when relevant; they do not interrupt individual sentences. Keep the composer reachable on mobile, preserve readable scrollback, and retain accessible focus/citation behavior.

The request pipeline is:

1. Resolve the visitor and campaign; validate the question and bounded recent history; enforce the request allowance.
2. Build a bounded evidence bundle from that campaign's story sections, its updates, related organizer/beneficiary records, and a fresh funding projection. Every source has a stable ID, source kind, campaign relationship, date/version, and internal deep link.
3. Call one explicitly configured provider with a source-only instruction and a strict output contract. Campaign text and conversation history are data, not instructions; current source facts override remembered or user-supplied numbers. The model has no browsing, mutation, or account tools.
4. Validate the response status, length, citation IDs, campaign membership, and structured funding references before display. Reject malformed, unknown-source, or mismatched-campaign outputs. Render response text and source links safely.
5. Show a concise answer or missing-information response, with citations and the funding snapshot time when applicable. Source links reveal and focus the referenced section.

The browser requests `text/event-stream`. The server uses one real upstream streaming Responses request and emits a `start` event, `partial` validated answer snapshots as complete short claims arrive, then a fully validated `done` answer or a safe `error`. An incremental structured-JSON parser must handle escaped strings and split transport frames; it must never expose raw JSON, unknown citations, unresolved placeholders, or unvalidated numerical fragments. Partial claims use the same frozen per-request funding snapshot and checks as the final answer. Final validation must agree with already emitted claims; incomplete/refused/truncated/malformed streams fail safely and the client discards partial content with a retry affordance. Only final completion records a completed/abstained analytics event. Closing/navigating/client timeout cancels upstream work. Existing JSON callers remain supported. This is streaming of verified sentence-sized claims, not artificial character-by-character playback after a complete response.

The output contract separates supported narrative statements with evidence IDs, missing-information statements, and typed funding facts. The model receives actual funding values and server-calculated derived figures, including average contribution (raised cents divided by completed contribution count, rounded to cents; undefined at zero count), from the same visitor projection as the page. It can use these as cited evidence in natural answers with validated placeholders such as `{average}`, `{raised}`, and `{count}`, while the legacy answer contract retains typed facts for compatibility. New provider outputs require an empty `fundingFacts` array so prose is not repeated as a separate funding summary. Placeholder claims must cite the funding source; the server substitutes current formatted values and rejects unknown placeholders. Funding arithmetic stays server-owned; historical answers never override the fresh snapshot. Average means per contribution, not per unique donor. Unsupported forecasts or outcomes still require abstention. Statements about other numbers, such as a budget item in the story, must be supported by the cited source and evaluated in the grounding test set. Citation validity alone does not prove factual entailment; evaluation must check whether each cited source supports the claim.

Use at most 12,000 serialized source bytes, newest updates first while preserving the story and organizer/beneficiary identity. Record which sources were included; if a question requires omitted evidence, abstain rather than infer. Cap answers at approximately 350 words. Use an 18-second upstream deadline and a 20-second client-visible timeout, no automatic model retry, and initially 10 requests per visitor per 10-minute window plus a deployment-wide request budget. Cancel or disregard stale responses after navigation. Do not retain raw questions/answers in analytics or ordinary application logs.

The provider adapter takes a model identifier and explicit server-only credentials. Select and pin one provider/model during implementation after checking the user's authorized runtime credentials; changing this adapter does not change the product contract. The user's coding subscriptions do not imply application API credits. Do not use inherited `ANTHROPIC_API_KEY` or silently substitute another billing path. Missing configuration leaves Ask honestly unavailable with source links. The rest of the application stays usable, but live-AI acceptance remains incomplete until a permitted live smoke test succeeds.

**Alternatives considered:** A FAQ-only implementation would not satisfy the agreed live generative feature. A vector database, autonomous agent, or whole-site chatbot adds retrieval, permissions, and evaluation work without benefit for four small campaigns. Generic social-caption generation duplicates an observed reference feature.

### 8. Measurable behavior with small operational overhead

Use a first-party event endpoint and a reproducible report command, not a new analytics dashboard. Validate event names and allowed property keys server-side. Only client-observable events use the public collector; donation completions and saved follow/feature changes are emitted by the corresponding mutation logic. Prevent clients from spoofing those completion events.

| Events | Useful interpretation |
| --- | --- |
| `page_view`, `discovery_card_open`, `discovery_filter_changed` | Discovery entry and navigation; no impression-to-click rate without actual impression data. |
| `follow_changed`, `cause_featured`, `cause_unfeatured` | Saved participation, with target type and resulting state. |
| `donation_started`, `donation_completed` | Simulated donation funnel; completions keyed to the saved donation. |
| `share_opened`, `share_copied`, `native_share_completed`, `share_cancelled`, `share_failed` | Explicit share outcomes without claiming delivery or attributable donors. |
| `update_opened`, `ai_question_submitted`, `ai_answer_completed`, `ai_answer_abstained`, `ai_answer_failed`, `ai_citation_opened` | Information seeking, missing evidence, failure/latency, and evidence inspection. |
| `performance_measured` | Route and metric name/value, tool/source, and sample context. |

Assign a new analytics session after 30 minutes of inactivity using stored activity times. A return requires a previous session for the same visitor. An event ID deduplicates delivery, while a new navigation or intentionally new interaction receives a new ID. Separate tests from human demo visits by session metadata. Campaign/target IDs, status, latency, and constrained amounts/counts are sufficient; exclude raw search terms, questions, answers, notes, URL queries, cookies, and secrets.

For durable mutations, write the completion record in the same database transaction as the action; derive the profile timeline from that action rather than a separate asynchronous write. Client-event delivery is best effort and must not block the primary UI; document possible undercounting and expose delivery failures only in developer diagnostics.

The report defines: unique community visitors opening a fundraiser / unique community visitors; visitors adding a follow / eligible visitors; completed donation attempts / started attempt IDs; share outcomes separately; returning visitors among visitors observed in the selected window; AI supported/abstained/failed counts and citation-open rate. No early demo statistic establishes population retention or causal donation uplift.

**Alternative considered:** A third-party analytics product adds account configuration and privacy plumbing. First-party events are sufficient to demonstrate instrumentation and explain its limits.

### 9. Validation and the one-week implementation budget

Use unit/integration checks for ledger arithmetic, time windows, input validation, relationship resolution, session boundaries, idempotency, and event deduplication. Use Playwright for the complete cross-page journey, Back restoration, reload/restart persistence, two-visitor isolation, clipboard/native-share fallback, AI source navigation, and failures. Run keyboard/focus and reduced-motion checks at 390 x 844 and 1440 x 1000, with an additional narrow-width sanity check. Inspect actual screenshots, not only test assertions. Run automated accessibility checks and resolve serious/critical issues in the implemented flows.

Create an AI evaluation set covering supported purpose, missing budget, newest update, exact totals after a donation, contradictory dated sources, out-of-scope requests, misleading verification requests, prompt injection in sources, invalid citations, timeout, rate limit, and stale responses. Deterministic fixtures exercise failure handling; a live run against the authorized provider checks source support and numeric consistency. Any unsupported verification/impact claim, mismatched citation, cross-campaign disclosure, or wrong funding figure is a release failure for Ask.

Performance targets are proposed acceptance budgets, not sponsor-provided thresholds: median LCP <= 2.5 s and CLS <= 0.1 for each representative page type over three cold runs of a pinned Lighthouse mobile preset against a production build. Save the exact preset, route, dataset, environment, and raw results. Inspect interaction traces separately; do not claim a field INP percentile from lab-only traffic. Optimize hero images/fonts, reserve media dimensions, and defer charts/AI code when appropriate.

| Day | Intended outcome |
| --- | --- |
| 1 | App shell, content fixtures, storage/session foundation, visual direction, and start the AI usage log. |
| 2 | Community discovery and fundraiser overview with responsive shared components. |
| 3 | Profiles, cross-page links, follow/feature/share actions, and browsing continuity. |
| 4 | Durable simulated donations, progress charts, update freshness, and event reporting. |
| 5 | Grounded AI endpoint/panel, source links, eval fixtures, and authorized live validation. |
| 6 | Journey/error tests, responsive/accessibility review, performance measurements, and fixes. |
| 7 | Final verification, technical/tradeoff documentation, demo recording, and submission packaging. |

If time is tight, simplify decorative transitions and optional point-hover chart affordances first. Do not silently replace live AI with canned answers, remove one of the three page types, skip persistence, or omit submission deliverables. A material scope reduction requires an explicit plan revision.

### Milestone performance correction

Milestone verification on 2026-10-16 found that the shared chat component and globally inlined chat styles increased the profile route payload; its refreshed three-run median LCP was about 2.625 seconds. Load the Ask transcript, stream handling, and chat-specific styles only when the visitor opens Ask. Keep the trigger available in the initial page, provide an accessible cancellable loading state and a retryable module-load failure, and prevent a completed load from reopening a dismissed panel. Re-run the production performance and browser checks and record the demo against the corrected build. The earlier failing measurements remain retained as development evidence.

## Risks / Trade-offs

- **Younger-audience appeal is unvalidated** -> Treat the design as a hypothesis; report any observed usability feedback and its sample without making demographic or retention claims.
- **Four campaigns provide limited discovery variety** -> Use distinct authored needs, imagery, and update states; make the curated scope clear rather than simulating a large recommendation system.
- **AI can cite a source while misstating it** -> Combine source-ID validation with claim-level evaluation and explicit abstention; retain a useful non-AI reading path.
- **Runtime provider credentials or credits may be unavailable** -> Confirm the permitted provider before the AI integration task. Record the dependency, keep the rest working, and report live AI as blocked until verified; never consume inherited Anthropic API credits.
- **Progress displays can imply outcomes beyond funding** -> Label money, donation counts, and dates precisely; use no fabricated urgency, probability, or per-dollar outcome.
- **Visitor-specific projections complicate caching** -> Use a single projection layer and no shared cache for personalized totals, profiles, or AI answers.
- **Public demo AI can consume resources** -> Enforce server-side request and size limits, provider timeouts, and a deployment-wide budget; avoid retaining private input in logs.
- **Demo persistence is not production identity** -> Clearly describe cookie-bound recovery limits and the private nature of `/me`.
- **Research pages change and some content was incomplete** -> Keep dated screenshots and observed navigation outcomes here; do not generalize loading placeholders or blocked TikTok flows into product defects.

## Migration Plan

There is no existing application or user data to migrate. Implementation will create the app, introduce the database migrations, validate/load the fixed demo dataset, and establish automated checks. Verify the build locally before provisioning a compatible Node/PostgreSQL environment. A public deployment requires the user's authorization unless already given in the implementation session; preparing a runnable build and deployment instructions does not depend on it.

Use additive initial database migrations and retain versioned fixture IDs. Roll back a faulty app release to the prior build while retaining compatible demo-state tables; do not reset all visitors to resolve an application error. Keep any fixture/reset command explicit and scoped to a test database or named demo visitor. Environment configuration contains no committed secrets. A missing AI configuration affects only Ask availability and its readiness status.

## Open Questions

- **Deployment destination:** Which available Node/PostgreSQL host should serve the review build? AWS is a sponsor preference, not a requirement. This does not change the application, persistence, or acceptance contract.
- **Authorized AI runtime configuration:** Which available provider/model and credential should the adapter use? The grounding contract, test suite, and task boundary are fixed; live acceptance depends on confirming this before integration. No subscription-to-API assumption is made.
- **Final presentation details:** Fictional campaign names, original/licensed imagery, exact typeface, and accent shades can be selected during the visual implementation without changing scope or requirements.
