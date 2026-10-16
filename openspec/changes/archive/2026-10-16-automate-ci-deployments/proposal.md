## Why

The completed prototype currently runs only on the developer machine. The repository is hosted on Gauntlet GitLab, but has no CI workflow, assigned runner, production image, or deployment target. The user requested deployments connected to CI, with DigitalOcean or Railway as acceptable hosts.

## What Changes

- Add a reproducible production container for the existing Next.js application, bounded database migrations, and a readiness endpoint.
- Use GitLab CI to validate branches and deploy passing main commits to a dedicated Railway app and PostgreSQL service.
- Configure scoped deployment credentials outside the repository, serialize deployments, and verify the specific deployment becomes ready over HTTPS.
- Document setup, operation, rollback, validation evidence, and demo limitations without rewriting the earlier milestone evidence.

## Capabilities

### New Capabilities
- `deployment-automation`: Checked source deployments, private persistent storage, release readiness, credential handling, and an operational runbook.

### Modified Capabilities
None. The existing support actions, pages, analytics, and assistant behavior are preserved.

## Impact

Adds Docker/Railway/GitLab configuration, a health route, migration runner changes, CI compatibility fixes, and deployment documentation. Creates one dedicated Railway project with app and PostgreSQL services and attaches an existing GitLab runner to this repository. Main becomes the automatic production deployment branch. Paid hosting resources and the already-authorized optional AI provider are used; donations remain simulations. Production account authentication, real payments, custom domains, additional environments, infrastructure migration, and creator publishing remain outside this change.
