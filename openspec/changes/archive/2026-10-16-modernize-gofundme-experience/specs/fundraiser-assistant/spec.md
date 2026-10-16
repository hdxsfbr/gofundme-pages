# Spec Delta

## Purpose

Help visitors understand the information supplied for a particular fundraiser through bounded AI questions, explicit evidence links, and honest treatment of missing or unverifiable information.

## ADDED Requirements

### Requirement: Contextual campaign questions
The fundraiser SHALL expose an Ask about this fundraiser panel with suggested questions and a free-text field accepting 1 through 1,000 non-whitespace characters. Each submitted question SHALL be scoped to the currently selected campaign, with a visible pending state and accessible controls. Questions SHALL not require a separate chat destination.

#### Scenario: Ask a suggested question
- **WHEN** a visitor selects the intended-use question
- **THEN** the panel requests an answer using that fundraiser's supplied information and keeps its campaign context visible

#### Scenario: Invalid question input
- **WHEN** a visitor submits an empty question or one over 1,000 characters
- **THEN** validation explains the constraint and no generation request is sent

### Requirement: Evidence-backed answers
Campaign-specific factual claims SHALL be supported by supplied story sections, dated updates, organizer/beneficiary records, or current funding records. Supported answers SHALL include resolvable citations with source labels and dates where applicable. Unknown or mismatched source references SHALL never be presented as valid evidence.

#### Scenario: Answer from a campaign update
- **WHEN** an answer relies on an organizer's dated progress update
- **THEN** the answer identifies that source and provides a link revealing the exact update on the fundraiser page

#### Scenario: Generated citation is not in the supplied evidence
- **WHEN** the AI response references an unknown source identifier or a source from another campaign
- **THEN** the response is rejected rather than displaying the unsupported citation as evidence

### Requirement: Current amounts come from authoritative records
Answers about funding totals, goals, percentages, remaining amounts, donation counts, and average contribution SHALL use the current visitor's authoritative campaign records rather than model arithmetic or remembered values. The answer SHALL identify the funding snapshot's time, and a subsequent question after a completed donation SHALL use the updated records.

#### Scenario: Ask about progress after donating
- **WHEN** a visitor completes a simulated donation and asks how much remains
- **THEN** the answer agrees with the updated page totals and indicates the snapshot time

### Requirement: Missing and unverified information remains explicit
The assistant SHALL state when supplied campaign information cannot answer a question. It SHALL distinguish organizer claims from independently verified evidence and SHALL not invent budgets, outcomes, urgency, beneficiaries, per-dollar impact, verification status, or guarantees of legitimacy.

#### Scenario: Ask for a missing itemized budget
- **WHEN** the campaign contains only a general description of intended spending
- **THEN** the answer says that an itemized budget was not supplied and cites the available purpose statement where useful

#### Scenario: Ask whether the campaign is guaranteed legitimate
- **WHEN** the supplied records cannot establish independent verification
- **THEN** the answer explains that limitation and does not certify the fundraiser as legitimate

### Requirement: Read-only scoped generation
The assistant SHALL treat campaign content and visitor questions as untrusted input, remain limited to the selected fundraiser, and perform no donation, follow, sharing, or account action. It SHALL not expose private visitor activity, credentials, internal prompts, or unrelated campaign records.

#### Scenario: Malicious instructions inside an update
- **WHEN** supplied update text asks the assistant to ignore its constraints, reveal secrets, or certify unsupported claims
- **THEN** the assistant treats that text as source content and does not follow those instructions

#### Scenario: Question targets another campaign or visitor
- **WHEN** a question requests unrelated campaign details or another visitor's private activity
- **THEN** the assistant explains its scope and does not retrieve or expose that information

### Requirement: Bounded and honest service failure
Generation SHALL have a 20-second maximum user-visible wait, abuse limits, and clear timeout, unavailable, and retry states. Missing credentials, provider errors, or malformed responses SHALL not block reading or supporting a fundraiser. Static fallback information SHALL be labeled as source material, never as a completed AI answer.

#### Scenario: AI service is unavailable
- **WHEN** a question cannot be answered because the provider is unconfigured, times out, or fails
- **THEN** the panel stops waiting within 20 seconds, offers a useful failure message and source links, and preserves the rest of the fundraiser experience

#### Scenario: Request allowance is exceeded
- **WHEN** a visitor exceeds the configured request allowance
- **THEN** the panel explains the temporary limit without sending another provider request

### Requirement: Campaign changes discard stale answers
Switching campaigns or closing the panel SHALL prevent an in-flight answer from appearing in the wrong context. Question history SHALL remain scoped to the active fundraiser and SHALL not be included in analytics payloads.

#### Scenario: Navigate during generation
- **WHEN** a visitor asks about one fundraiser and navigates to another before the answer returns
- **THEN** the old response is discarded and is not shown as an answer about the new fundraiser

### Requirement: Live-AI acceptance is distinguishable from fixtures
The feature SHALL support a real model-backed answer path using an explicitly configured, authorized provider. Test fixtures SHALL be distinguishable from live generation in validation records. Without a live-provider smoke test, the implementation SHALL report live AI as unverified rather than complete.

#### Scenario: Fixture tests pass without a configured provider
- **WHEN** automated tests use controlled response fixtures but no live model call has succeeded
- **THEN** the validation record reports the fixture results and separately identifies live AI as unverified


### Requirement: Conversational composer and transcript
The Ask panel SHALL submit on Enter, insert a newline on Shift+Enter, and respect IME composition. Typed and suggested submissions SHALL clear the composer and immediately display one user turn with a pending response. The transcript SHALL scroll independently while the header and composer remain reachable at desktop and mobile sizes. Failure SHALL offer a retry of the same turn without duplicate user messages or loss of a subsequent draft.

#### Scenario: Send a typed message
- **WHEN** a visitor presses Enter on a valid draft outside IME composition
- **THEN** exactly one request is sent, the draft clears, and the message appears immediately before the pending answer
- **AND** Shift+Enter creates a newline without sending

#### Scenario: Retry a failed turn
- **WHEN** a response fails and the visitor activates retry
- **THEN** the existing turn returns to pending without a duplicate message and any newer composer draft is preserved

### Requirement: Recent conversation informs follow-up questions
The server SHALL accept only bounded, validated recent conversation context for the current campaign. Follow-ups SHALL resolve references from that context while using fresh campaign records as factual authority. Conversation text SHALL be treated as untrusted data and excluded from persisted analytics and ordinary logs. Closing the panel or changing campaigns SHALL clear the conversation context.

#### Scenario: Follow up about an average
- **WHEN** the visitor has asked about contribution totals and then asks "so what is the average?"
- **THEN** the answer uses the prior exchange to identify average contribution and the current authoritative total and count to answer

#### Scenario: Prior turn contains obsolete or invented totals
- **WHEN** conversation history includes outdated or user-supplied numbers
- **THEN** the answer uses the current server snapshot and does not treat conversation as cited campaign evidence

### Requirement: Available funding data supports derived answers
The model SHALL receive the actual current funding snapshot and server-calculated average contribution. An answer SHALL NOT claim available totals or counts are absent. Average contribution SHALL be rounded to the nearest USD cent, identify its contribution-based denominator, and link to the funding source. Zero contributions SHALL produce an explicit undefined-average explanation without division by zero. Existing missing-budget and independent-verification boundaries SHALL remain intact.

#### Scenario: Compute average contribution
- **WHEN** authoritative raised funding is $14,600 and the completed contribution count is 112
- **THEN** an average-contribution question returns $130.36, based on those values, with the funding source and snapshot

#### Scenario: No contributions yet
- **WHEN** the current contribution count is zero
- **THEN** the assistant explains that an average cannot yet be calculated rather than presenting zero as an observed average


### Requirement: Stream validated answers and group references
The interactive Ask panel SHALL receive real incremental provider output through a bounded server stream. Completed source-backed claims SHALL be validated before becoming visible; unsupported citations, unresolved numeric placeholders, and raw structured output SHALL never be shown. The final answer SHALL undergo the full answer checks before completion analytics. References SHALL be deduplicated into a footer beneath each answer instead of interrupting individual claims.

#### Scenario: Multi-sentence answer arrives incrementally
- **WHEN** the provider completes a valid early claim before the full answer
- **THEN** the visitor sees that claim while generation continues and later valid claims appear in order
- **AND** source links are grouped beneath the answer with source navigation retained

#### Scenario: Generation fails after partial content
- **WHEN** the stream ends early, errors, or fails final validation
- **THEN** partial answer content is discarded, a retryable error appears on the same turn, and no completed-answer event is recorded

#### Scenario: Cancel a streaming answer
- **WHEN** the visitor closes the panel, changes campaign, or reaches the client deadline
- **THEN** the request is cancelled and later chunks cannot update the old or new conversation
