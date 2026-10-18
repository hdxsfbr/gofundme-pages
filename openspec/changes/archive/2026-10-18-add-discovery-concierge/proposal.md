# Add a discovery concierge

## Why

Discover already supports browsing, search, and topic filters. A visitor with a cause in mind may still need help translating that interest into one of the small set of campaigns available in this demo. A conversational entry point can recommend those existing campaigns while preserving ordinary browsing and making the recommendation evidence easy to inspect.

## What changes

- Add a Discover-only concierge entry in a banner and floating launcher. It asks a visitor what they care about and recommends up to three campaigns from the current four-campaign catalog, with grounded reasons and links to each fundraiser.
- Add an independent `POST /api/concierge` contract using the existing configured OpenAI Responses provider and structured output. Each request supplies the current catalog, one question (1–1,000 characters), and at most two completed prior exchange pairs.
- Keep recommendations read-only: the assistant cannot create campaigns, donate, share, follow, feature causes, or claim campaign legitimacy or impact. It asks a clarifying question when needed and explicitly reports no matches when appropriate.
- Reuse the existing assistant dialog/composer interaction behavior, 20-second limit, and shared deployment/visitor AI usage budget. Keep conversation ephemeral and out of analytics.
- Add separate concierge request, completion, failure, dialog-open, and campaign-open event names.

## Scope boundaries

This is a user-proposed feature for the demo, not a requirement stated in the sponsor brief. It builds on the sponsor's integrated discovery experience and instrumentation goals. It does not require uploads, external search, retrieval infrastructure, a vector database, campaign creation, or a separate account system. Campaign detail pages remain the source for totals and the existing donate/share/feature actions. Preserve the existing Discover experience and fundraiser-specific Ask assistant.

Implementation and validation remain open tasks; this proposal does not claim the feature has been implemented or tested. Keep the one-week project limit and submission deliverables (source, technical documentation, demo video, and AI usage log) in view when scheduling implementation.
