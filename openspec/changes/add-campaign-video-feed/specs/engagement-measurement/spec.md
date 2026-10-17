# Spec Delta

## ADDED Requirements

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
