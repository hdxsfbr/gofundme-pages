# Deployment runbook

The live app is at [web-production-7e5023.up.railway.app](https://web-production-7e5023.up.railway.app). Main pipeline [57420](https://labs.gauntletai.com/andrebatista/gofundme-pages/-/pipelines/57420) passed on commit `04873c0bc0911852af4ea20ff9e9a172c2d6abee`: 175 unit/integration checks and 59 browser checks, with no skips, flakes, or unexpected outcomes. Deploy job [234248](https://labs.gauntletai.com/andrebatista/gofundme-pages/-/jobs/234248) succeeded. Railway release `210d080a-ef9e-4b18-b58a-1d4de2cd1ff3` is `SUCCESS`, and HTTPS health returned 200 with the matching deployment ID and no cookie. See [CI validation evidence](evidence/deployment/ci-validation.json) and [release evidence](evidence/deployment/ci-release.json).

The initial manual preflight deployed previously validated commit `fc87cc49c4ecf26f01f7439e5b4fc8fcfa529d63` as Railway deployment `c53ff568-2a53-479c-b86b-fcdb1512e6e0`. The later CI release replaced it. A private-session persistence run confirmed that follow, feature, reason, and one $12.50 simulated donation survived that replacement; see [persistence evidence](evidence/deployment/persistence-2026-10-16T20-34-01-277Z.json). Desktop and mobile routes and interactions were exercised. The full set of eight preflight route captures and four dialog/Ask captures was reviewed. Four final-release captures (desktop fundraiser/private profile and mobile organizer/private profile) also passed visual review; the other five final captures were checked automatically only. See the [preflight visual review](evidence/deployment/preflight-visual-review.json) and [persistence visual review](evidence/deployment/persistence-visual-review.json). A small capture helper waits for lazy images and mobile navigation to finish and makes no application changes.

GitLab project [2247](https://labs.gauntletai.com/andrebatista/gofundme-pages) deploys to one Railway app and a private Railway PostgreSQL service. Runner `282` (`digitalocean`) supplies CI from the existing DigitalOcean host; it does not host the app or database. The Railway project is `ec717278-aa34-4e3d-acc8-c940f1f18ff2`, environment `1127a08f-9115-4ca9-b33c-2fe8dec605da`, app service `web` (`60d642f1-48d3-4cd8-9f79-5084cc8a8ab3`), and PostgreSQL service `68fcd538-2acd-4a70-aa91-bb30f262c316`. The database deployment `36160e10-edbc-4ffd-aee0-e3e7d85c39db` has a 5 GB persistent volume, no TCP proxy, and no public domain; the app connects over Railway's private network.

The subsequent closeout commit records documentation, OpenSpec, hosted evidence, and improvements to the manual screenshot helper. It does not change the application or CI configuration; that push explicitly skips CI to avoid another identical release. The deployed application source remains `04873c0bc0911852af4ea20ff9e9a172c2d6abee`. Future normal main pushes retain automatic validation and deployment.

## Runtime configuration

The production image uses the Node 24 standalone Next.js output and runs as a non-root user. It listens on `0.0.0.0:$PORT`; Railway supplies `PORT`. The production image does not need a developer `.env.local`, source checkout, or development dependencies.

Configure these values in the Railway app service:

| Variable            | Purpose                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | Reference the PostgreSQL service's private connection URL. Never use a public database URL.                                                                |
| `APP_ORIGIN`        | Exact HTTPS origin served by Railway, with no path or trailing slash. Used by mutation origin checks and secure visitor cookies.                           |
| `OPENAI_API_KEY`    | Optional server-side key for the campaign Ask feature. Store only in Railway runtime variables; CI uses controlled fixtures and does not receive this key. |
| `AI_MODEL`          | Optional model override; otherwise the application default applies.                                                                                        |
| `AI_REQUEST_BUDGET` | Optional global Ask request limit per ten-minute window (default 100). Each visitor also has a fixed limit of 10 requests per ten-minute window.           |

Railway supplies `RAILWAY_DEPLOYMENT_ID` to identify the running release. Do not set it manually. The health endpoint reports this identifier, which CI compares with the uploaded deployment. The health route must be reachable without creating a visitor cookie or event and does not check the optional AI provider.

Migrations run once as `node scripts/migrate.mjs` through Railway's pre-deploy command before the new app release activates. One transaction holds a PostgreSQL advisory lock across both migrations; connection, lock, and statement waits are bounded at 5, 15, and 20 seconds. A failed or timed-out migration fails the release. Migrations must remain additive and compatible with the previously active app while Railway rolls out the replacement.

To build and smoke-run the production image locally on Linux:

```sh
docker build -t gofundme-pages:local .
docker run --rm --network host --env-file .env.local \
  -e PORT=8087 -e APP_ORIGIN=http://127.0.0.1:8087 \
  gofundme-pages:local node scripts/migrate.mjs
docker run --rm --network host --env-file .env.local \
  -e PORT=8087 -e APP_ORIGIN=http://127.0.0.1:8087 \
  gofundme-pages:local
```

The ignored `.env.local` supplies `DATABASE_URL` and any optional runtime settings; keep actual values out of commands, image layers, and source control. `--network host` lets this Linux smoke run reach the existing local Compose PostgreSQL 17 at its configured loopback port. It does not recreate, migrate to a new volume, or remove that volume. On another Docker platform, use a PostgreSQL hostname reachable from the container and set `DATABASE_URL` accordingly. The hosted Railway PostgreSQL 18 service is private and has no public TCP proxy, so it is not directly reachable from a developer laptop.

Railway service configuration is represented by the partial IaC file [`.railway/railway.ts`](../.railway/railway.ts), which owns the `web` service settings only and explicitly preserves its nine existing runtime variables. Database provisioning, private references, app variables, and custom domain configuration are managed and read back in the Railway project. Before source upload, CI verifies that the scoped project token matches the configured project and environment and runs a read-only IaC plan. The plan must have zero changes; drift or a changed partial config fails deployment with instructions to review and apply infrastructure changes separately. CI checks the main commit both before and after the plan. This gate never applies infrastructure changes or modifies the database service.

## CI variables and release flow

GitLab project CI/CD variables are `RAILWAY_PROJECT_ID`, `RAILWAY_ENVIRONMENT_ID`, `RAILWAY_SERVICE_ID`, `APP_ORIGIN`, and `RAILWAY_TOKEN`. Their non-secret target identifiers are listed above. All five variables are configured. The production project token `gitlab-production-2247` is scoped to this Railway project and environment; GitLab variable `RAILWAY_TOKEN` is masked and protected with the `production` environment scope. Its value was read back and verified without printing it. Never put its value, the database URL, or the OpenAI key in repository files, job output, or artifacts. Runner `282` (`digitalocean`) is attached to this project and is available for deployment.

The authenticated CLI can provision and deploy with OAuth, but Railway [intentionally blocks creating a persistent project token through OAuth](https://station.railway.com/questions/o-auth-deploy-flow-failing-on-project-tok-883b760b). Create a project credential through the account UI or an authorized account/workspace API token; do not copy a local OAuth session or an account-wide token into CI.

On 2026-10-16, the pre-existing credential in the user-designated local credential store was checked without exposing its value. Railway rejected it with `Not Authorized` through both the CLI and documented account/workspace API authentication; its project-token check also rejected it. This established that the stored credential was not usable for this deployment. Deployment job [234035](https://labs.gauntletai.com/andrebatista/gofundme-pages/-/jobs/234035) stopped at the missing-token check before application upload. A dedicated project token was subsequently created through the API using the valid account/workspace credential supplied by the user and configured in GitLab as described above.

Pushes and merge requests run formatting, lint, database integration checks, unit tests, production build, and type checking against disposable PostgreSQL 18 and controlled AI responses. Chromium browser journeys run only in the optional `browser-tests` manual job. In GitLab, open the pipeline and select Play on `browser-tests` to run them against that pipeline’s source revision. The job provisions its own disposable database and production build and retains results/screenshots for seven days. It can run independently of validation; leaving it unplayed, canceling it, or a browser failure does not block pipeline success or production deployment. A successful automatic pipeline therefore does not establish browser-journey coverage. Passing non-main branches stop after validation. A passing pipeline on protected `main` deploys automatically. Production jobs are serialized with GitLab's outdated-deployment protection; the deploy job also checks that the source commit is still the current main head. The Railway CLI is pinned to 5.63.1 in the deploy job.

Each protected-main push runs validation and then deploys automatically. If a deployment attempt fails after validation succeeds, retry only the failed `deploy-production` job while main remains at the validated SHA.

The deploy job records the source commit and Railway deployment ID, waits up to 18 minutes for that deployment to reach `SUCCESS`, then polls `/api/health` over HTTPS for up to two minutes. Readiness must report the same deployment ID, return success without redirects, and set no cookie. A successful image build or upload alone is not a successful release. A missing token or failed readiness check fails the job.

## Verify and investigate a release

The final source commit `04873c0bc0911852af4ea20ff9e9a172c2d6abee` passed [pipeline 57420](https://labs.gauntletai.com/andrebatista/gofundme-pages/-/pipelines/57420), including 175 unit/integration checks and all 59 browser checks with no skips, flakes, or unexpected outcomes. Deployment job [234248](https://labs.gauntletai.com/andrebatista/gofundme-pages/-/jobs/234248) recorded Railway release `210d080a-ef9e-4b18-b58a-1d4de2cd1ff3`; its state was `SUCCESS` and HTTPS readiness returned the same deployment ID without setting a cookie. The initial manual preflight release is recorded separately in [preflight evidence](evidence/deployment/preflight-release.json). The corrected deployment script's SDK guard, all eight focused checks, and a read-only IaC plan with zero changes passed before the fix commit was pushed.

For a successful deployment, note the source SHA and deployment ID in `deployment-result.json` (also saved as a 30-day CI artifact). Open the corresponding Railway deployment and confirm its state is `SUCCESS`. Then request `APP_ORIGIN/api/health` and verify the returned `deploymentId` matches the pipeline. The endpoint returns a generic failure when origin/database configuration, connectivity, or required schema is unavailable; its database check has a four-second bound and it does not expose connection details or set a visitor cookie.

Earlier CI runs exposed and then repaired a server/browser clock-boundary hydration issue that could lose an initial donation click. The fix serializes the server snapshot and covers minute/day boundaries; the isolated regression evidence is [here](evidence/deployment/hydration-regression.json). The final pipeline also exercised all 59 browser checks successfully. CI retains page and chat screenshots in its seven-day artifacts.

If deployment fails, inspect the failed CI stage first, then the matching Railway deployment build/runtime logs. Check that the database reference is private and points to the intended PostgreSQL service, the pre-deploy migration completed, and `APP_ORIGIN` matches the HTTPS origin exactly. Do not copy secrets into issue text or logs. A successful health response only establishes release readiness at that moment; it is not continuous monitoring.

The verified hosted journey covered community, fundraiser, organizer profile and `/me` routes, follow/feature actions, simulated donation, and the Ask panel. Persistence across the preflight-to-CI release replacement is recorded in the evidence linked above. This public demo uses fictional campaign content, anonymous browser/device-bound visitors, simulated donations, and optional bounded AI. It has no production account system or real payment processing.

## Roll back

Deploy a known-good compatible source commit through the normal checked main pipeline, or use Railway's rollback for the app service and then repeat the health identity check. Confirm the returned identity belongs to the restored deployment and exercise a saved action. Leave the PostgreSQL service and its persistent volume in place. Do not reverse migrations automatically: an older app is safe only when it supports the schema already present. If a migration is not backward compatible, stop and prepare a forward repair before rolling the app back.

For the CI path, revert the offending change with a new commit on main. Rerunning an old pipeline is deliberately rejected by the current-main check.

The database is persistent and private, but this deployment setup does not establish a backup policy or continuous monitoring. These remain operational limitations.
