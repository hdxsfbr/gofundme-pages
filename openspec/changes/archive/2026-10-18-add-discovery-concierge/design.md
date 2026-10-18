# Design: discovery concierge

## Context and boundaries

The community-discovery spec already provides campaign cards, search, topic filters, and a normal fundraiser navigation path. The fundraiser-assistant spec establishes the existing Responses provider, structured generation, bounded recent conversation, privacy, timeout, and composer conventions. This change adds a separate discovery-scoped capability; it does not replace either experience. Recommendations are about matching a visitor's stated interests to available catalog entries, not verifying a fundraiser or predicting its outcomes.

## Request and response

Expose `POST /api/concierge` independently from fundraiser Ask. Validate a non-empty `question` of 1–1,000 characters and no more than two completed prior user/assistant exchange pairs. The server derives the four current campaign records from its trusted catalog and includes that catalog in every model request; client-supplied campaign records are never authoritative. Use the already configured `AI_MODEL` and OpenAI Responses structured-output path. Do not add a provider, retrieval system, persistent conversation store, upload path, or external campaign lookup.

The response contains a user-facing `message` and zero to three recommendations. Each recommendation must identify a catalog campaign, give a concise reason grounded in the visitor's request and supplied campaign information, and link to that campaign's canonical detail route. Validate returned IDs and link targets against the server catalog; reject malformed output or invented/mismatched campaigns. The message can ask a focused clarifying question when intent is underspecified. When the catalog has no suitable match, it says so directly and returns no recommendation. It must not imply that a campaign is legitimate, independently verified, urgent, effective, or that a donation will achieve a stated outcome. Avoid numeric funding claims; direct visitors to fundraiser details for current totals and existing donate/share/feature actions.

Treat the visitor question, conversation, and campaign text as untrusted input. Pass only the current request and bounded completed history needed for follow-up resolution. Do not persist the transcript or include its text in logs or analytics. Clear history when the dialog closes or the visitor navigates away from Discover. The existing shared AI allowance applies across fundraiser Ask and concierge requests for the deployment and visitor; concierge does not get a second allowance.

## Discover interaction

On Discover only, add a concise banner invitation and a floating entry point that opens the concierge dialog. Reuse the existing assistant dialog shell and composer behavior: Enter submits, Shift+Enter inserts a newline, IME composition does not submit, and pending, retry, cancellation, and 20-second timeout behavior match the established assistant. A failed response leaves the rest of Discover usable. Preserve keyboard access, focus behavior, and responsive layout.

Render recommendations as campaign cards or compact results with a clear reason and a normal internal fundraiser link. Opening a result uses the existing route, so campaign totals and support actions stay on the detail page. Closing the dialog, closing its containing surface, or navigating away clears the conversation. Do not add a chat route or persistent thread.

## Measurement

Use distinct event names for concierge dialog opened, request started, request completed, request failed, and recommended campaign opened. Event properties may include event/session/visitor identifiers, outcome, latency, request ID, and validated campaign ID. Never send the question, answer, reason text, or transcript. Validate campaign-open IDs against the catalog. Keep existing event definitions intact. Report concierge activity separately from fundraiser Ask and use the shared AI request allowance for both.

## Failure handling and risks

Provider absence, allowance exhaustion, timeout, provider error, and invalid structured output produce a clear retryable/unavailable state without blocking campaign browsing. Closing or navigating aborts in-flight work and prevents stale results from appearing after the context is gone. Catalog validation and explicit no-match behavior contain hallucination risk, but recommendation quality still depends on the four supplied records; do not overstate fit or coverage. Without external retrieval, recommendation coverage is intentionally limited to the current catalog.

## Rollout and documentation

Implement as a separate change using existing deployment configuration. No database migration is needed for ephemeral conversation state. Update technical and analytics documentation with the API contract, data boundaries, allowance behavior, event definitions, and limits. Retain implementation and acceptance evidence with dates and identify fixture-based checks separately from any live-provider smoke test. Update the demo walkthrough and AI usage log if the feature is included in the submitted demo. Do not mark acceptance tasks complete until evidence exists.
