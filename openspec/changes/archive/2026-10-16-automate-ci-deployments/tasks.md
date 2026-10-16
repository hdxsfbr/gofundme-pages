# Tasks

## 1. Hosted runtime

- [x] 1.1 Add the standalone non-root production container and upload exclusions; verify a container build and startup with environment-only configuration.
- [x] 1.2 Make migrations runtime-compatible, serialized and bounded; verify repeated migrations preserve existing data and failure exits nonzero.
- [x] 1.3 Add side-effect-free readiness and hosted cookie handling; verify healthy, unavailable, invalid-config, and no-cookie responses with focused tests.
- [x] 1.4 Document runtime configuration, migration/health behavior, container operation, and hosted demo limitations in the deployment runbook.

## 2. CI and hosting

- [x] 2.1 Add GitLab validation and serialized main-only Railway deployment, fixing browser environment setup; verify GitLab CI lint and focused deployment-script failure checks.
- [x] 2.2 Provision dedicated Railway app/PostgreSQL services with private database reference, HTTPS origin, and runtime secrets; verify configuration by names and identifiers without exposing values.
- [x] 2.3 Attach an available GitLab runner and configure a masked protected project/environment deployment token; verify runner/variable metadata and outdated-deployment protection.
- [x] 2.4 Document triggers, variables, deployment identity checks, investigation and rollback, and append the deployment work to the AI usage log.

## 3. Integrated release verification

- [x] 3.0 Repair the timestamp hydration mismatch exposed by CI; verify a server snapshot remains stable when the browser clock crosses a minute or UTC day and the first donation interaction works.
- [x] 3.1 Publish the reviewed implementation and obtain a passing required-check job on main, recording its pipeline URL and test counts.
- [x] 3.2 Publish the checked source to main and verify automatic deployment success, matching readiness identity, HTTPS pages/assets, and a healthy database.
- [x] 3.3 Exercise hosted desktop/mobile journeys and verify saved actions survive a subsequent application deployment; capture and view screenshots and record any limitations.
- [x] 3.4 Record final pipeline/deployment evidence and validate the completed OpenSpec artifacts without altering historical milestone evidence.

## Workflow follow-up

- Sync and archive the completed change after verification, then verify the archive and main specs.
