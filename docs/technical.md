# Technical notes

## Architecture

The application is a TypeScript, React 19, Next.js App Router project. Route pages render campaign and profile content; client components handle discovery controls, charts, and support interactions. `/` redirects to the seeded community. Main routes are `/communities/[slug]`, `/fundraisers/[slug]`, `/profiles/[slug]`, and the visitor-specific `/me` page.

Immutable content is authored in `src/lib/content.ts`; records use stable string IDs for campaigns, organizers, the community, and updates. The central funding calculation and UTC date helpers are in `src/lib/domain.ts`. PostgreSQL access and visitor/session handling are in server-only modules under `src/lib`. Migrations `db/001_initial.sql` and `db/002_event_outbox.sql` are applied by `scripts/migrate.mjs`. Local Compose runs PostgreSQL 17 on `127.0.0.1:55432` with a named volume. The application pool allows eight connections with connection and statement timeouts.

## Local setup and hosted deployment

Use Node.js 22 or newer and npm. For local development:

```sh
npm ci
docker compose up -d --wait db
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Configure `.env.local` (or the deployment's secret/environment manager) with:

```dotenv
DATABASE_URL=postgresql://demo:local-demo-only@127.0.0.1:55432/gofundme_demo
APP_ORIGIN=http://127.0.0.1:3000
APP_PREVIEW_ORIGINS=
AI_MODEL=gpt-4.1-mini-2025-04-14
OPENAI_API_KEY=
AI_REQUEST_BUDGET=100
```

`APP_ORIGIN` is the required primary browser-visible origin. `APP_PREVIEW_ORIGINS` optionally adds comma-separated, exact browser-facing origins for forwarded previews; for this session the preview origin is `http://localhost:61071`. Add the origin to `.env.local` and restart the server before using that preview. Scheme, hostname, and port are distinct (`http://localhost:61071` differs from `http://127.0.0.1:61071` and from another port). Configure origins only: no path, trailing slash, query, or credentials. Configuration values are normalized and validated; malformed values fail closed with a service-unavailable response rather than allowing a mutation. Keep the optional list empty in general environments unless a preview origin is required. `OPENAI_API_KEY` is optional at startup but required for live Ask answers. The code default for `AI_MODEL` is `gpt-4.1-mini-2025-04-14`. Do not use Anthropic API credentials for application runtime.

For a local Node/PostgreSQL production build, install locked dependencies, set local environment variables, apply migrations, build, then start:

```sh
npm ci
npm run db:migrate
npm run build
npm run start
```

The npm start script binds to `127.0.0.1:3000` for local use. Hosted deployment uses the standalone non-root Node 24 Docker image, which binds to `0.0.0.0:$PORT`; its local build/run procedure, Railway configuration, GitLab release gate, and current deployment status are in the [deployment runbook](deployment.md). Compose's fixed credentials and PostgreSQL 17 volume are local development resources; the hosted PostgreSQL 18 service is separate.

## Available verification commands

- `npm test` runs domain, report, and outbox Vitest suites.
- `npm run test:browser` runs Playwright journeys under `tests/browser/`.
- `npm run typecheck` and `npm run lint` run TypeScript and ESLint checks.
- `npm run report` writes aggregate JSON to stdout, reconciles queued events first, and supports half-open UTC bounds (`--from`, `--to`) plus `--include-test`. Details and privacy boundaries are in [analytics notes](analytics.md).
- `npm run eval:ai` runs the configured live AI evaluation and requires PostgreSQL and authorized OpenAI credentials.

The live eight-case AI run completed all provider requests. The primary Codex agent reviewed each recorded answer against its supplied sources; case findings and limitations are in [AI evaluation](ai-evaluation.md), with raw results at `docs/evidence/ai-live-evaluation.json`. This is a small source-reviewed evaluation, not human sign-off or a reliability guarantee.

## Content, identity, and persistence

One seeded fictional community contains four fictional campaigns and organizers. Campaigns have fixed goals, authored narratives, dated updates, update IDs, and seed contribution records. Restarting the app does not fabricate new activity. Seed ledger entries are sample data, not actual gifts. AI evidence IDs include the stable `story`, `budget`, `organizer`, and `beneficiary` sections plus each update's stable ID; citation links target the matching campaign section.

On first use, the server creates an opaque random token in a same-site, HTTP-only cookie and stores its SHA-256 hash. Mutation handlers derive the visitor from that token. No password, login, recovery, or cross-device account exists. Clearing the cookie creates another visitor while prior records remain. There is no app-level visitor deletion/reset control. `docker compose down -v` removes the entire local database volume and all its visitor state; it is not a visitor-scoped reset. Tests that need destructive isolation create and drop a uniquely named PostgreSQL schema.

Follows, featured causes, update-view timestamps, simulated donations, sessions, first-party events, and AI usage windows are stored in PostgreSQL. Each visitor's fundraising total is the fixed seed ledger plus that visitor's saved simulated donations only. Public organizer profiles display seeded activity; `/me` shows the current visitor's private activity. There is no shared cross-visitor campaign ledger.

Donation amounts are validated from $1 to $10,000 with at most two decimal places and stored as integer USD cents. A per-visitor idempotency key prevents duplicate saves on retry; reusing the same key for another fundraiser or amount is rejected. A confirmed save persists even if the browser subsequently navigates away. After a successful mutation, the client requests a fresh server render for authoritative visitor state instead of patching the local viewer snapshot from the mutation response. The donation confirmation is tied to the current attempt ID, so closing or starting another dialog cannot let a stale request overwrite its state; confirmation appears only after the save succeeds.

## Discovery, update freshness, and funding history

Discover follows the fixture order in `src/lib/content.ts`; search and topic filters preserve that editorial order. Following resolves the deduplicated union of directly followed campaigns, campaigns in followed communities, and campaigns owned by followed organizers. Updates are sorted newest first with a stable ID tie-breaker. Query filters are retained in the URL, and the previous card position is stored per browser tab for Back navigation.

Opening the fundraiser's update section records the visitor's last-view time after the section becomes visible. Community update cards appear in Discover; Following includes the community update when that community is followed and fundraiser updates from the resolved campaign set. A fundraiser update is labeled new when its date is later than the visitor's saved view timestamp. The first visit has no prior timestamp, so the page labels the feed “Latest updates” until updates have been viewed.

Funding totals use the same ledger projection across community cards, campaign detail, charts, and AI funding facts. The percentage is rounded `raised / goal * 100`; the visual progress track is capped while the displayed percentage is not. Remaining funds are `max(goal - raised, 0)`. Counts include completed seed records and that visitor's saved donations; followers are never labeled donors.

Charts use UTC calendar days and include today: 7 days starts at UTC midnight six days earlier; 30 days starts 29 days earlier. The cumulative line starts with the pre-window balance; period change includes only contributions in that window. Dates and snapshot labels use UTC.

## Durable measurement outbox

Authoritative events for donations, follow changes, featured causes, and update views are inserted into `domain_event_outbox` within the same database transaction as the corresponding state change. If durable event intake fails, the action transaction rolls back. After commit, the server projects queued events to the analytics tables in a separate transaction. Projection failure leaves the saved action intact and the event pending; the response still reports saved state. Later visitor activity retries that visitor's pending events, while `npm run report` flushes pending rows across visitors before taking a repeatable-read report snapshot.

Outbox rows preserve event ID, original timestamp, assigned session and test label, entity, and sanitized allowlisted properties. Projection and delivery marking are atomic; retrying cannot double-count a delivered event. Delivery uses row locks and `SKIP LOCKED`. There is no background worker, so an idle pending event remains queued until a later request or report run. Client-generated events still use best-effort browser delivery and may be lost before reaching the server. See [analytics notes](analytics.md) for metrics, privacy filtering, report denominators, and limitations.

## Campaign Watch feed

The community-scoped route is `/communities/a-greener-tomorrow/watch`; `?clip=<catalog-id>` selects a public clip. The selected clip and high-priority poster are server-rendered so the page has useful content before hydration. The Watch navigation link opts out of media-prefetch behavior; Watch attaches media sources only for the active clip and one adjacent clip, using metadata preload. Posters and campaign context stay visible while media loads or fails. Ordinary Discover, Following, fundraiser, and profile routes do not render Watch video elements. Four locally served 360 × 640 H.264 clips, posters, and WebVTT files live under `public/media/watch/`; the typed catalog and association validator are in `src/lib/video-content.ts`. Provenance, license review, sizes, and the demo-fiction boundary are recorded in [media notes](media.md).

Watch uses a single active playback controller. Clips start muted and contain no audio stream, so the sound control reports “No audio” and is disabled. Caption cues display authored demo story copy, not words spoken by the stock performers. A separate “Read story text” panel exposes the copy without relying on captions. The video and page disclose that footage is illustrative stock, and the catalog records that pictured people are not the fictional organizers and do not endorse the campaigns. Play rejection leaves a manual Play action; reduced-motion preference starts paused and uses instant clip changes. Hiding the tab, opening a panel, or switching clips pauses the media, including a late-resolving play request. Session storage keeps per-clip time, active clip, pause intent, muted state, and caption preference only for the current tab; storage denial leaves browsing available. Clip changes replace the selected `clip` query in the current history entry, while opening a campaign/profile route creates normal navigation history for Back restoration.

Touch gestures are recognized on the media region and bounded to one adjacent clip per settled swipe. Desktop visitors can use the feed's scroll region, Previous/Next buttons, or Arrow/Page Up/Down while the feed itself has focus. Buttons and dialogs do not become swipe/keyboard shortcuts. The feed ends after its four catalog entries and requires an explicit Replay to restart. The existing donation, follow, and share controls are reused; Watch changes the donation label to “Donate now” and passes an optional catalog-validated `sourceId` plus `source: "watch"` into support/share event metadata. Donations remain simulated; the server validates the source-to-campaign pairing and saves trusted outcomes through the existing transaction/outbox. Campaign funding and saved follow state continue to come from the existing visitor-scoped store.

The Watch browser suite is `tests/browser/watch-feed.spec.ts`. Its isolated PostgreSQL journey checks ordinary-route zero-video requests, server-rendered direct clips/posters, actual decoded playback, explicit Play after a denied autoplay attempt, one active advancing clip, bounded video elements/requests, touch navigation, donation and share/follow provenance, Back restoration, direct/invalid clip routes, unavailable session storage, and failed-media recovery. Release-specific screenshots, the recorded controlled journey, report, and Lighthouse runs are retained under `docs/evidence/watch-20261016/`; the validation note records the simulated-mobile LCP variance and observed Chrome LCP. Browser emulation is not physical iOS testing; evidence notes identify the browsers, sizes, and device behaviors that were not available for direct testing.

## AI answer path and limits

Ask presents a chat-style transcript for the selected fundraiser, with an independently scrolling message area and a persistent composer while the panel is open. Enter sends and clears a valid draft; Shift+Enter inserts a line break. A submitted turn appears immediately with pending state. Failed turns can be retried without duplicating the user message or replacing a newer draft. When the panel requests streaming, the server relays the provider's SSE response. The provider output is structured JSON; the model is prompted to make each claim a short sentence, and the server emits only fully closed claim objects after resolving and validating their citations and funding placeholders. This is genuine incremental upstream output, not character-by-character playback generated by the client. The transcript shows the growing validated answer and a deduplicated source-reference footer. A final complete response is validated again; only that completed response records the terminal AI completion/abstention analytics event. On stream failure, partial text is cleared and the turn offers retry. Closing the panel or navigating away aborts the client request and upstream work. The endpoint retains the legacy JSON request/response path for callers that do not request an event stream.

The panel retains no conversation when closed or when the visitor changes campaign; there is no account-level or permanent chat memory, and the transcript is not stored in the database, analytics, or ordinary application logs.

Each request sends the current question and at most the two most recent completed question/answer pairs for this campaign. The server validates the alternating roles, per-message and total length bounds, pair count, and campaign ID; partial/pending turns are excluded. Prior conversation is untrusted context to resolve follow-up references, never factual evidence. Fresh campaign records and the current visitor's funding projection remain authoritative. The server calls the OpenAI Responses API with `store: false`, a structured output schema, an 18-second timeout, and the configured model. The endpoint limits use to 10 requests per visitor per 10-minute window and a deployment-wide budget (`AI_REQUEST_BUDGET`, default 100). It has no browsing or mutation tools; campaign text, question, and prior conversation are treated as untrusted data.

The evidence bundle is capped at 12,000 UTF-8 bytes, a conservative ceiling below the planned 12,000-token source limit. Every request includes a fresh authoritative funding snapshot. Average contribution is calculated on the server as raised USD cents divided by completed contribution count, rounded to the nearest cent; it is undefined when the count is zero. For current provider requests the structured schema requires `fundingFacts: []`; funding values appear in natural claim prose using validated placeholders such as `{average}`, which the server substitutes from the current snapshot and accepts only with a funding citation. This keeps arithmetic server-owned while allowing readable wording. The response resolver retains typed funding facts for compatibility with legacy structured responses, but the current stream prompt/schema does not ask the model to emit them. The final streaming evaluation did not duplicate funding summaries. The earlier pre-stream adapter artifact is retained and documents its separate prose/fact duplication limitation. The application validates output shape, answer length, citation IDs and campaign association, and numeric claims against cited text. A valid source ID proves the cited source exists and belongs to the campaign; it does not prove that source supports the full claim. Claim-level inspection and evaluation are distinct from successful API transport. Raw questions and answers are not sent to analytics or ordinary logs. Missing credentials, timeouts, or invalid output leave the campaign sources available and return a bounded error state.

## Product boundaries

Creator campaign publishing was explicitly deferred. There is no campaign editing backend, public comments, real payment processing, external identity, account recovery, cross-device syncing, media upload/transcoding, learned recommendation system, or notification service. Product content is fictional; no facts about real beneficiaries or fundraising outcomes are asserted.

## Rendering and loading tradeoffs

The server renders ready route content directly. Navigation links use Next's pending-link status to show a visible loading message while preserving the readable current page; loading, empty, missing-route and failed-load states stay distinct. One local Manrope variable font is preloaded through `next/font/local`. Experimental `inlineCss` was enabled earlier to remove the blocking stylesheet request. As of 2026-10-17 it is disabled, because Next 16.4.2 emitted the inlined global CSS three times per document, which pushed the HTML past one simulated TCP round trip. The configuration also sets `turbopackChunking.minChunkSize` so fewer small first-load scripts queue for connections. See the [Watch LCP follow-up](evidence/watch-20261017/validation.md). Recheck both options and the performance evidence when upgrading Next.

The community hero and first profile card receive high image priority. Other campaign photographs mount when their reserved card region comes within 200px of the viewport, avoiding the much larger native-lazy lookahead that fetched offscreen photographs during initial loading. Reserved dimensions preserve layout; text/links and descriptive image placeholders remain present before the photographs load. The Ask transcript and chat-specific CSS are split into a dynamic module loaded only on opening the panel; the route shows an accessible loading state and retry action if that module fails. This keeps chat styles and code off the initial profile/page payload while preserving the same chat flow after load. Answer validation is also loaded on demand. The runtime model is never requested on initial render or merely opening its panel.

## Illustrative live donation chart (2026-10-18)

Fundraiser funding sections default to a clearly labeled Live demo with a scrolling SVG chart, a rolling-digit USD total, and a deterministic donation sequence shared across campaigns. The illustration starts at $11,850 and advances roughly every 3.2 seconds. It is client-only: no contribution, analytics, or AI funding records are created or changed. The real demo funding card continues to reflect seeded and visitor-saved contributions.

Pause/resume controls the animation clock; reduced-motion users receive a static illustration. Updates suspend outside the viewport and while the document is hidden. The animation uses a bounded SVG window and approximately 30 visual updates per second, without a chart dependency. History range buttons retain recorded 7-day, 30-day, and all-time data and its dated table. Funding source links and programmatic citation focus reveal recorded history. Selecting Live demo again restarts the illustrative sequence.
