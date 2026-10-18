# deployment-automation Specification

## Purpose

Publish the prototype from checked source through an observable, repeatable deployment workflow while preserving saved demo state and keeping credentials outside source control.

## Requirements

### Requirement: Checks gate automatic deployments
The pipeline SHALL require formatting, linting, type checking, production compilation, and unit/database integration tests. Passing required checks on protected main SHALL trigger deployment independently of browser journeys. Browser journeys SHALL be an optional, non-blocking manual job with its own database and production build. Missing deployment credentials SHALL fail deployment rather than report a skipped deployment as success.

#### Scenario: A check fails
- **WHEN** a required check fails for a commit
- **THEN** that pipeline does not deploy the commit

#### Scenario: Browser journeys are optional
- **WHEN** the browser job is not started, is canceled, or fails
- **THEN** it does not block required validation or production deployment
- **AND** its tests run only when an operator starts the manual job

#### Scenario: Operator runs browser journeys
- **WHEN** an operator starts the manual browser job
- **THEN** it builds and tests that pipeline's source against its own disposable database and retains diagnostic artifacts

#### Scenario: A branch passes
- **WHEN** a non-main branch passes its checks
- **THEN** it reports successful validation without changing production

#### Scenario: Initial interaction crosses a clock boundary
- **WHEN** fundraiser HTML is rendered on the server and hydrated after a minute or UTC-day boundary in the browser
- **THEN** its funding history uses the same serialized snapshot time during hydration and the first donation interaction opens the dialog without a React hydration error

### Requirement: Serialized observable releases
Production deployment jobs SHALL be serialized and shall reject outdated release jobs. Deployment success SHALL require the uploaded release to finish successfully and its own readiness identity to be returned over HTTPS within a bounded wait. Build or upload success alone SHALL not count as deployment success.

#### Scenario: Replacement fails
- **WHEN** an uploaded release fails to build, migrate, start, or become ready
- **THEN** its deployment job fails and does not report the existing healthy version as the new release

### Requirement: Persistent private application storage
The hosted application SHALL use a dedicated persistent PostgreSQL service through private networking. Application replacement SHALL preserve saved visitor actions. Migrations SHALL be repeatable, serialized, bounded, and completed before a release becomes active. Failed migrations SHALL block release activation without reporting success.

#### Scenario: Deploy after saving an action
- **WHEN** a visitor saves a follow or simulated donation and the app is redeployed
- **THEN** the same visitor can reload the saved action from the persistent database

### Requirement: Side-effect-free readiness
A readiness endpoint SHALL return success only when required configuration and database schema are usable. It SHALL return a generic non-success response when storage or configuration is unavailable, avoid caching, and create no visitor identity, analytics event, or model request. Its response SHALL identify the hosted deployment without exposing secrets.

#### Scenario: Database unavailable
- **WHEN** readiness is requested while the database cannot be reached
- **THEN** it returns a bounded non-success response without internal connection details

### Requirement: Scoped credentials and reproducible runtime
The production image SHALL run from locked dependencies without developer environment files or credentials. Runtime secrets SHALL be configured through hosting variables, and CI SHALL use a masked protected deployment credential scoped to this project and environment. Logs, artifacts, and the repository SHALL not contain those secret values.

#### Scenario: Validate without production secrets
- **WHEN** CI validates a branch
- **THEN** it uses disposable database credentials and controlled AI fixtures without access to the production database or model key

### Requirement: Documented operating evidence
The repository SHALL document deployment triggers, required configuration, release verification, rollback, and material demo limitations. It SHALL retain links to the passing pipeline and hosted validation evidence and distinguish them from historical local milestone measurements.

#### Scenario: Operator reviews the release
- **WHEN** an operator reads the deployment runbook
- **THEN** they can identify the deployed release, inspect its pipeline, and find the procedure for restoring a known good application version while preserving the database
