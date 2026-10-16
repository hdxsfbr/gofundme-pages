# Spec Delta

## Purpose

Make discovery, support actions, AI assistance, return visits, and loading performance observable without misrepresenting demo activity as real fundraising or proven audience impact.

## ADDED Requirements

### Requirement: Defined behavioral events
The application SHALL record page views, discovery-card opens, filter changes, follow-state changes, cause features, donation starts and completions, share-interface opens and outcomes, update opens, and AI request outcomes and citation opens. Each event SHALL have an event identifier, timestamp, event name, session, pseudonymous visitor, and relevant entity identifiers.

#### Scenario: Complete the main journey
- **WHEN** a visitor discovers a campaign, opens it, follows it, asks a question, opens a citation, and completes a simulated donation
- **THEN** the recorded events identify each step and its related campaign in chronological order

### Requirement: Completion events reflect saved outcomes
Follow changes, cause features, and completed donations SHALL be measured from successful saved results. Duplicate delivery of the same event identifier SHALL not inflate counts. Native sharing, copying a link, and confirmed donation completion SHALL remain distinct metrics.

#### Scenario: Donation retry
- **WHEN** the same intended donation is retried after its successful save
- **THEN** reporting contains one completed donation event and one amount contribution

#### Scenario: Share dialog canceled
- **WHEN** a visitor opens and then cancels native sharing
- **THEN** reporting records the opening and cancellation without labeling them as a completed external share or acquired donor

### Requirement: Sessions and returns have explicit meaning
A session SHALL end after 30 minutes of inactivity. A return SHALL mean the same persistent demo visitor begins a later session. Reporting SHALL distinguish returns from page reloads and same-session navigation and disclose that cleared identifiers or another browser appear as a new visitor.

#### Scenario: Reload within an active session
- **WHEN** a visitor reloads five minutes after their previous activity
- **THEN** the page view belongs to the existing session and does not count as a return visit

#### Scenario: Return after inactivity
- **WHEN** the same visitor returns after more than 30 minutes of inactivity
- **THEN** a new session is recorded and identified as a returning visit

### Requirement: Analytics data is minimized
Analytics SHALL exclude raw AI questions and answers, profile-note text, credentials, payment information, and unfiltered URL queries. Validation fixtures and automated-test traffic SHALL be identifiable and excluded from default engagement summaries. Analytics failures SHALL not prevent visitors from reading pages or completing support actions.

#### Scenario: Ask a question containing personal information
- **WHEN** a visitor submits an AI question
- **THEN** analytics records the campaign, outcome, latency, and request identifier without storing the question or generated answer

#### Scenario: Analytics delivery fails
- **WHEN** the analytics collector is unavailable
- **THEN** the primary interaction still works and the failure can be diagnosed without exposing visitor content

### Requirement: Interpretable engagement reporting
The project SHALL provide a reproducible report or export with documented event definitions, denominators, time window, and exclusions. It SHALL show discovery-to-campaign visits, follows, donation starts/completions, share outcomes, returns, and AI success/abstention/error and citation usage. Results SHALL identify simulated data and avoid claiming causation from observed associations.

#### Scenario: Produce the demo analytics report
- **WHEN** a reviewer follows the documented report procedure after a scripted journey
- **THEN** the report shows the recorded actions with explicit denominators and distinguishes empty metrics from zero-valued observed results
- **AND** it does not claim that AI usage caused donations or that the prototype improved real-world retention

### Requirement: Reproducible loading-performance evidence
The community, fundraiser, and profile page types SHALL each meet proposed lab budgets of median LCP at most 2.5 seconds and CLS at most 0.1 over three cold mobile-profile runs against a production build. The report SHALL record tool version, device/network/CPU settings, route, dataset, and results. AI loading SHALL not gate initial page rendering.

#### Scenario: Measure the representative routes
- **WHEN** a reviewer runs the documented performance procedure against the seeded production build
- **THEN** all three page types have three recorded runs and a median compared with the budgets
- **AND** the report labels the measurements as lab results rather than field-percentile or real-user retention evidence

### Requirement: Interaction and AI performance remain inspectable
The project SHALL record AI latency and failure outcomes and inspect representative interaction latency for filtering, opening panels, and changing chart ranges. Any reported field responsiveness metric SHALL state its sample and collection method; unavailable metrics SHALL not be invented from a build or Lighthouse score.

#### Scenario: Report responsiveness without field traffic
- **WHEN** only lab and scripted browser measurements exist
- **THEN** the report includes the observed interaction timings and states that population-level field responsiveness has not been established
