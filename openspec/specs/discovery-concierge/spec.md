# discovery-concierge Specification

## Purpose

Help visitors on Discover describe the causes they care about and find relevant campaigns in the available catalog through bounded, transparent AI recommendations.

## Requirements

### Requirement: Discover-scoped concierge entry
Discover SHALL provide a clear banner invitation and floating entry point to open a conversational campaign concierge. The concierge SHALL remain within Discover and SHALL not replace campaign browsing, search, or topic filters.

#### Scenario: Open the concierge from Discover
- **WHEN** a visitor activates either concierge entry point
- **THEN** the conversation dialog opens without navigating away from Discover
- **AND** the underlying discovery experience remains available after the dialog closes
- **AND** the floating control's accessible name includes its visible text

#### Scenario: Visit another page
- **WHEN** a visitor navigates away from Discover
- **THEN** the concierge conversation is cleared and is not restored as a persistent chat

### Requirement: Catalog-bounded campaign recommendations
The concierge SHALL use the server's current four-campaign catalog supplied with each request. It SHALL return a message and at most three recommendations. Every recommendation SHALL identify a catalog campaign, provide a reason grounded in the visitor's expressed interest and supplied campaign information, and link to that campaign's canonical detail page. The service SHALL reject malformed structured output and unknown or mismatched campaign identifiers or links.

#### Scenario: Recommend matching campaigns
- **WHEN** a visitor describes a cause represented in the available catalog
- **THEN** the response recommends up to three matching catalog campaigns with grounded reasons and working detail links

#### Scenario: No catalog campaign matches
- **WHEN** the visitor's interest has no suitable match among available campaigns
- **THEN** the assistant explicitly says there is no match in the available catalog and returns no fabricated campaign

### Requirement: Clarification and honest recommendation boundaries
The concierge SHALL ask a focused clarifying question when the visitor's interest is too ambiguous to make a useful recommendation. It SHALL not assert independent verification, legitimacy, urgency, fundraising impact, or guaranteed outcomes, and SHALL avoid numeric funding claims. It SHALL direct visitors to campaign detail pages for current funding totals and the existing donate, share, and feature actions.

#### Scenario: Interest is underspecified
- **WHEN** the visitor's request does not identify a useful cause or need
- **THEN** the assistant asks a clarifying question rather than guessing or listing unrelated campaigns

#### Scenario: Ask for legitimacy or donation impact
- **WHEN** the visitor asks whether a campaign is guaranteed legitimate or what a donation will achieve
- **THEN** the assistant explains that the supplied catalog cannot establish that claim and links to the campaign details where useful

#### Scenario: Ask about raised totals
- **WHEN** the visitor asks how much a campaign has raised
- **THEN** the response avoids a numeric total and links to the detail page for current funding information

### Requirement: Bounded ephemeral conversation service
The independent concierge endpoint SHALL use the configured AI model and a fresh catalog. Requests SHALL contain a 1–1,000 character question and at most two completed prior exchange pairs. Concierge and fundraiser Ask SHALL share deployment and visitor allowances. Conversation text SHALL be untrusted, ephemeral, and excluded from analytics and ordinary logs.

#### Scenario: Submit a bounded follow-up
- **WHEN** a visitor submits a valid question with up to two completed exchange pairs
- **THEN** the server validates the request and catalog-bounds the structured response

#### Scenario: Input exceeds limits
- **WHEN** the question is empty, exceeds 1,000 characters, or history exceeds two completed exchange pairs
- **THEN** the request is rejected without a provider call

#### Scenario: Shared usage limit is exhausted
- **WHEN** the visitor reaches the shared AI allowance through concierge and/or fundraiser Ask requests
- **THEN** another provider call is not sent and the visitor receives a clear temporary-limit state

#### Scenario: Close during generation
- **WHEN** the visitor closes the concierge or navigates away while a request is pending
- **THEN** the request is cancelled where possible and no late response is shown in a later context

### Requirement: Reuse assistant interaction and preserve browsing
The concierge SHALL reuse the established assistant composer behavior: Enter submits, Shift+Enter inserts a newline, and IME composition does not submit. It SHALL show pending, retryable failure, and timeout states with a maximum 20-second user-visible wait. Its failure SHALL not prevent campaign browsing. Recommendation links SHALL use normal internal fundraiser navigation so existing campaign totals and support actions remain available.

#### Scenario: Submit from the composer
- **WHEN** a valid draft is submitted with Enter outside IME composition
- **THEN** one request is sent; Shift+Enter creates a newline without submitting

#### Scenario: Provider fails or times out
- **WHEN** the provider is unavailable, returns invalid output, or exceeds the 20-second deadline
- **THEN** the dialog shows an understandable retryable failure and Discover remains usable

#### Scenario: Open a recommendation
- **WHEN** a visitor activates a recommendation
- **THEN** its normal fundraiser detail page opens with the existing support actions available

### Requirement: Concierge analytics protect visitor text
The application SHALL record distinct concierge-opened, request-started, request-completed, request-failed, and recommended-campaign-opened events. Events MAY include validated campaign identifiers, outcome, latency, and request identifiers, but SHALL exclude question, answer, recommendation-reason, and transcript text. Campaign-open events SHALL validate the campaign against the current catalog.

#### Scenario: Measure a recommendation journey
- **WHEN** a visitor opens the concierge, completes a request, and opens a recommended campaign
- **THEN** the events identify those outcomes and the valid campaign in chronological order
- **AND** no conversational text is included in event properties
