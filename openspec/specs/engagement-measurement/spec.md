# engagement-measurement Specification

## Purpose

Make discovery, support actions, AI assistance, return visits, and loading performance observable without misrepresenting demo activity as real fundraising or proven audience impact.

## Requirements

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

### Requirement: Defined video discovery events
Analytics SHALL distinguish entering Watch, a clip remaining active and visible for at least one second, actual playback starting, and opening its campaign. Events SHALL carry the existing session/visitor context, campaign identity where applicable, and a validated clip identifier. Preloading, hidden tabs, failed playback, and repeated observation callbacks SHALL not fabricate exposure or playback events.

#### Scenario: Preload and then view a clip
- **WHEN** an adjacent clip preloads before becoming active and later remains active for one second
- **THEN** no impression is recorded during preloading and one qualified impression is recorded for the active exposure
- **AND** a play-start event is recorded only after media playback advances

#### Scenario: Revisit or resume a clip
- **WHEN** a visitor returns to a clip or resumes it after closing a panel
- **THEN** reporting deduplicates impressions and play starts per visitor, analytics session, and clip within the report window
- **AND** it does not label replay or resume as a new visitor or return session

### Requirement: Support outcomes retain explicit video attribution
Follow, share, donation-start, and donation-completion events originating in Watch SHALL identify the clip and campaign. Saved follows and donation completions SHALL receive server-validated clip provenance through the existing trusted event path. Optional provenance SHALL preserve existing callers and donation idempotency; retries SHALL never create a second completion or rewrite the original attribution.

#### Scenario: Complete and retry a video-origin donation
- **WHEN** a visitor donates from a clip and retries the same successful attempt
- **THEN** exactly one trusted completion records the original valid clip and campaign, matching the original start's attempt identifier
- **AND** fundraiser totals and profile activity increase only once

#### Scenario: Validate optional provenance
- **WHEN** an action supplies an unknown clip or a clip belonging to another campaign
- **THEN** the server rejects the invalid request without saving an action or attributed completion
- **AND** existing requests without clip provenance continue to use the original support flow

#### Scenario: Share or follow from a clip
- **WHEN** a visitor follows a fundraiser or opens its share panel in Watch
- **THEN** the saved follow or actual share outcome retains the originating clip
- **AND** cancellation, copying, and browser-reported native sharing remain distinct outcomes

### Requirement: Video discovery reports have explicit denominators
The aggregate report SHALL include unique qualified exposures, play starts, confirmed campaign arrivals, saved follows, share outcomes, and simulated donation starts/completions by clip. Rates SHALL state their numerator, denominator, window, and exclusions, returning null for zero denominators. It SHALL disclose missing client events and distinguish direct Watch attribution from later unattributed actions without inferring causation.

#### Scenario: Report an observed video journey
- **WHEN** a recorded session views a clip, opens its campaign, returns, and completes a simulated donation from Watch
- **THEN** the report links the arrival to a matching campaign page view and matches the donation start/completion by visitor, campaign, clip, and attempt identifier
- **AND** it labels financial values as simulated and excludes automated-test sessions by default

#### Scenario: Client analytics are lost
- **WHEN** a trusted completion exists but its client start or exposure event is unavailable
- **THEN** the completion remains visible as an unmatched attributed completion and is excluded from the matched-attempt conversion numerator
- **AND** lost telemetry does not undo the saved donation or get treated as a zero-valued observed journey

#### Scenario: No observed video traffic
- **WHEN** no eligible video events exist in the report window
- **THEN** video metrics have zero counts and null rates with their denominators shown, and existing non-video metrics retain their definitions

### Requirement: Concierge outcomes are measured without conversational content
Analytics SHALL distinguish concierge dialog opens, requests started, requests completed, requests failed, and recommended campaign opens from fundraiser Ask events. Events SHALL exclude visitor questions, generated messages, recommendation reasons, and transcript text. Concierge requests SHALL consume the same deployment and visitor AI usage allowance as fundraiser Ask.

#### Scenario: Report a concierge recommendation journey
- **WHEN** a visitor opens the concierge, receives a recommendation, and opens its campaign
- **THEN** reporting can distinguish the concierge open, completed request, and campaign open from fundraiser Ask activity
- **AND** no conversational text is stored in analytics

#### Scenario: Visitor uses both assistants
- **WHEN** a visitor sends requests to fundraiser Ask and the discovery concierge
- **THEN** both request types count against the same configured visitor and deployment allowance
