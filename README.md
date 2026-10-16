# GoFundMe community experience prototype

A responsive Next.js prototype connecting one fictional community, four fundraisers, organizer profiles, and a private demo supporter profile. Visitors can browse campaigns, follow causes, save featured causes, share public links, and record simulated donations. Fundraiser pages show funding history and an optional campaign-scoped AI question panel with source links.

**This is a demonstration, not GoFundMe or a payment service.** All campaign, organizer, community, update, and seed contribution content is fictional. Donations are simulated and affect only the current browser's demo visitor. No card details are requested. Stock photographs are illustrative and do not depict or verify the fictional beneficiaries.

## Requirements

- Node.js 22 or newer
- npm
- Docker with Compose for local PostgreSQL
- Optional: an authorized OpenAI API key for live answers. Without it, Ask is unavailable and the campaign sources remain readable.

## Run locally

```sh
npm ci
docker compose up -d --wait db
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Open <http://127.0.0.1:3000>. `/` redirects to the seeded community. Main routes are `/communities/a-greener-tomorrow`, `/fundraisers/grow-a-neighborhood`, `/profiles/maya-chen`, and `/me`.

`.env.local` starts from `.env.example`. Keep `DATABASE_URL` and `APP_ORIGIN` aligned with your local database and browser-visible origin. Same-origin mutation requests also accept the comma-separated `APP_PREVIEW_ORIGINS` list. Add the exact preview origin when accessing the app through a forwarded preview (for example, `http://localhost:61071`), then restart the server. Scheme, hostname (`localhost` versus `127.0.0.1`), and port must match; origins cannot include a path, trailing slash, query, or credentials. Leave this setting empty unless you need an additional browser-facing origin. Malformed origin configuration fails closed. To reproduce the local forwarded-preview path, configure `APP_PREVIEW_ORIGINS=http://localhost:61071`, restart the app, and in another terminal run `node scripts/preview-proxy.mjs`; open `http://localhost:61071`. The helper forwards to `http://127.0.0.1:3000` while preserving the browser Origin header. The default `AI_MODEL` is `gpt-4.1-mini-2025-04-14`. Set `OPENAI_API_KEY` only when you have an authorized key for application runtime use; never commit it.

## Deployment

Main deploys automatically through GitLab CI after the required checks pass. The production app and private PostgreSQL service run on Railway; the existing DigitalOcean host supplies the GitLab runner. See the [deployment runbook](docs/deployment.md) for required variables, release verification, troubleshooting, rollback, and hosting limits. Local Compose credentials are for development only.

Available checks:

- `npm test` runs the Vitest suites.
- `npm run test:browser` runs the Playwright journeys.
- `npm run typecheck` checks TypeScript; `npm run lint` runs ESLint.
- `npm run report` exports aggregate engagement metrics and reconciles pending durable events first. See [analytics notes](docs/analytics.md).
- `npm run eval:ai` runs the configured AI evaluation. It requires a database and authorized OpenAI runtime credentials.

To stop local PostgreSQL, run `docker compose down`; its named volume remains. `docker compose down -v` removes all local demo database contents, including all visitors and events.

## Scope and limits

The prototype covers the community, fundraiser, and profile page types plus the private `/me` view. It has visitor-isolated persistent follows/features, simulated donations, UTC funding history, first-party measurement, and optional campaign-grounded AI. Creator campaign publishing was explicitly deferred. There is no production login, account recovery, cross-device identity, real payment, public user-generated posting, or shared cross-visitor donation ledger. Clearing the `demo_session` cookie starts a new visitor but does not erase the old visitor's stored records. There is no in-app visitor reset or deletion control; database-wide reset is available only by deliberately removing the local Compose volume.

### Archived local milestone

The completed local milestone measured build `-6yPHl9lZGab-87T31WH9`. For that recorded source, production build, typecheck, lint, formatting, and all 150 Vitest checks passed; the browser run passed 57/57 checks with 18 release-scene axe scans and zero serious/critical violations, and all three Lighthouse route medians met the project lab budgets. This evidence describes the local milestone build, not the later deployment configuration. Its browser results are in [milestone browser-check.json](docs/evidence/milestone/browser-check.json), with reviewed captures under [milestone/browser](docs/evidence/milestone/browser/) and [milestone/chat](docs/evidence/milestone/chat/). The [milestone demo video](docs/evidence/milestone/demo.webm), [decode/frame review](docs/evidence/milestone/demo-video-check.json), [reviewed frames](docs/evidence/milestone/demo-frames/), and [recording report](docs/evidence/milestone/demo-engagement.json) are preserved with the [milestone release manifest](docs/evidence/milestone/release-manifest.json), which ties 75 source/configuration/media/test/script hashes and 59 evidence hashes to that build and video. The earlier experience change is archived with 47 tasks complete and six main specs synced (46 requirements, 79 scenarios); see its [proposal](openspec/changes/archive/2026-10-16-modernize-gofundme-experience/proposal.md), [design](openspec/changes/archive/2026-10-16-modernize-gofundme-experience/design.md), and [reference evidence](openspec/changes/archive/2026-10-16-modernize-gofundme-experience/evidence/). Earlier browser/live-answer evidence and the earlier demo remain historical. See [validation notes](docs/validation.md), [performance results](docs/performance.md), [AI evaluation](docs/ai-evaluation.md), [technical notes](docs/technical.md), [media and content notes](docs/media.md), [AI usage log](docs/ai-usage-log.md), and [submission checklist](docs/submission.md).

The separate deployment change is active. The Railway database service is provisioned; the protected GitLab project token, first app release, and hosted verification remain pending. Check the [deployment runbook](docs/deployment.md) for the current infrastructure, token setup, pipeline, and hosted evidence status. Campaign fixtures remain authored in `src/lib/content.ts` with stable entity and update IDs and fixed timestamps.
