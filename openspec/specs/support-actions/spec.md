# support-actions Specification

## Purpose

Let visitors participate in the prototype through follows, explicit sharing, and clearly simulated donations while preserving consistent, isolated demo state.

## Requirements

### Requirement: Persistent isolated demo participation
The system SHALL establish a demo visitor identity without requiring production account registration. Saved actions SHALL survive page reloads and application process restarts while the visitor retains their session identifier and persistent storage remains intact. New visitors SHALL receive independent action histories over the same seeded baseline.

#### Scenario: Reload after following a cause
- **WHEN** a visitor follows a cause and reloads or returns after an application restart
- **THEN** the saved follow state and related views still reflect that action

#### Scenario: Visitor identity is lost
- **WHEN** a visitor clears their session identifier or opens a separate browser
- **THEN** the application starts a new demo identity without claiming cross-device recovery

### Requirement: Honest demo boundaries
The application SHALL identify itself as a demonstration using fictional seed data. Donation entry and confirmation SHALL explicitly state that no money is charged. The flow SHALL not request card, bank, or payment credentials and SHALL not claim a tax receipt or real charitable transfer.

#### Scenario: Enter the donation flow
- **WHEN** a visitor activates Donate
- **THEN** the amount-entry view clearly identifies a simulated transaction before confirmation

### Requirement: Follow and unfollow are consistent
Visitors SHALL be able to follow and unfollow communities, fundraisers, and organizer profiles. Each visitor-target relationship SHALL be unique and reversible. The visible state, Following view, and profile connections SHALL reflect the saved result across navigation and reloads.

#### Scenario: Repeated follow request
- **WHEN** the same visitor submits the same follow action more than once
- **THEN** only one relationship exists and follower-related displays do not double-count it

#### Scenario: Follow cannot be saved
- **WHEN** the persistence request fails
- **THEN** the control returns to the last confirmed state and shows a retryable failure without claiming the follow succeeded

### Requirement: Validated simulated donation amounts
The demo SHALL accept USD donation amounts from $1.00 through $10,000.00 with no more than two decimal places. It SHALL reject invalid, non-finite, negative, zero, out-of-range, or over-precision amounts before completing a donation. No real payment action SHALL occur.

#### Scenario: Valid amount
- **WHEN** a visitor submits $12.50 and confirms the simulation
- **THEN** the completed donation records exactly $12.50 in USD and displays a clear simulated confirmation

#### Scenario: Invalid amount
- **WHEN** a visitor submits $0, a negative value, $1.001, or more than $10,000
- **THEN** the application explains the valid amount constraint and records no completed donation

### Requirement: Donation completion is durable and idempotent
A donation SHALL be shown as completed only after its record is durably saved. Repeated submissions or retries of the same intended donation SHALL yield one completed record, one activity entry, and one completed-donation event. A new explicitly initiated donation SHALL remain a separate transaction.

#### Scenario: Double submission or uncertain response
- **WHEN** a visitor double-clicks confirmation or retries after losing the response to a saved donation
- **THEN** the same completed donation is returned without increasing totals a second time

#### Scenario: Storage failure
- **WHEN** the donation cannot be saved
- **THEN** no successful confirmation is shown, the entered amount is retained for retry, and funding totals remain unchanged

### Requirement: Share actions are user initiated and accurately reported
Fundraiser and community sharing SHALL expose a canonical public URL through native sharing when supported and a copy-link fallback. The application SHALL distinguish opening a share interface, successfully copying a link, native-share completion, cancellation, and failure. It SHALL not claim a recipient received a share or that a new donor resulted.

#### Scenario: Copy a campaign link
- **WHEN** a visitor chooses Copy link and the clipboard write succeeds
- **THEN** the canonical fundraiser URL is copied and success is acknowledged

#### Scenario: Sharing is canceled or unavailable
- **WHEN** the visitor cancels native sharing or the browser lacks native sharing or clipboard support
- **THEN** cancellation is not counted as a completed share
- **AND** a selectable canonical URL remains available when copying cannot be performed automatically

### Requirement: Visitor mutations are scoped and rendered safely
Saved actions SHALL derive the acting visitor from their session, validate referenced entities, and reject attempts to mutate another visitor's state. User-authored profile reasons SHALL render as text rather than executable markup. Invalid requests SHALL not alter existing records.

#### Scenario: Attempt to change another visitor's record
- **WHEN** a request supplies another visitor's identifier or an unrelated record identifier
- **THEN** that visitor's record is neither returned nor modified

#### Scenario: Feature reason contains markup
- **WHEN** a visitor saves a reason containing HTML or script-like text
- **THEN** the content is displayed as text and executes no code

### Requirement: Configured browser origins remain usable through a preview proxy
Mutation endpoints SHALL accept the primary configured origin and explicitly configured preview origins while deriving visitor identity from the session cookie. They SHALL reject missing, null, foreign, and unconfigured origins and SHALL NOT infer allowed origins from request Host or forwarding headers. Missing or malformed origin configuration SHALL fail closed.

#### Scenario: Browser uses an explicitly configured preview address
- **WHEN** a browser submits an action from an explicitly configured preview origin whose host or port differs from the internal server address
- **THEN** the request passes origin validation and is subject to the normal identity and input checks
- **AND** the primary configured origin remains usable

#### Scenario: Unconfigured origin spoofs forwarding headers
- **WHEN** a request has an unconfigured Origin and supplies Host or forwarding headers matching that unconfigured origin
- **THEN** the action is rejected before any state change
