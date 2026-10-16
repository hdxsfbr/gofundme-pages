# Proposal

## Why

The reviewed GoFundMe pages already provide following, activity, sharing, profiles, and cross-page links, but the community prioritizes fundraising rankings before discovery and activity, while understanding a fundraiser still involves reading a long narrative. This one-week prototype will test whether visual discovery, clearer fundraising momentum, and answers grounded in campaign information help people understand a cause, participate, and return; appeal to younger adults is a hypothesis, not an established outcome.

## What Changes

- Build a cohesive, responsive community, fundraiser, and profile experience using the sponsor brief in `docs/project-requirements.md` and the rendered reference review documented in `design.md`.
- Put visual campaign discovery and relevant updates ahead of rankings on the community page. Provide Discover and Following views, topic filters, and browsing-position restoration after visiting a fundraiser. Use curated photo-led content; preserve native scrolling, direct links, and keyboard access.
- Present each fundraiser's need, organizer, beneficiary, intended use of funds, and dated updates clearly. Retain prominent support actions and working links between the three page types.
- Show funding history, explicit percentage funded, recent contributions, and simple time-range controls inspired by Polymarket's information hierarchy. Derive figures from records; make no outcome predictions.
- Give profiles a personal introduction, featured causes with authored reasons for supporting them, community connections, and a participation timeline.
- Implement persistent following, explicit share actions, and simulated donations for an isolated demo visitor. Clearly label the prototype and simulated transactions; do not collect payment details.
- Add one live generative-AI feature, **Ask about this fundraiser**: suggested and free-text questions in a conversational panel, using recent campaign-local turns and current records, with incremental validated answers and references grouped beneath each answer, calculated funding answers including average contribution, transparent missing-information responses, and useful unavailable/error states.
- Instrument discovery, participation, return visits, AI usage, and loading performance. Deliver source code, technical documentation, a demo video, and an AI usage log.

The scope is one seeded community, four fundraisers, their connected organizer profiles, and a demo supporter profile. The signature experience is **discover -> understand -> support -> revisit**. Visual discovery and campaign-specific AI replace the previously discussed weekly participation challenge.

Excluded: real payments, production account onboarding, campaign creation/editing, messaging or open comment posting, media uploads/transcoding, a learned recommendation engine, automatic social posting, push/email notifications, betting/predictions, general-purpose chat, and generated testimonial videos. Cross-device demo identity and synchronization between visitors are also outside this iteration.

## Capabilities

### New Capabilities

- `community-discovery`: Curated visual discovery, followed-content browsing, relevant update categories, filtering, and navigation continuity.
- `fundraiser-experience`: Fundraiser information, linked identities/community, updates, funding-history visualizations, and accessible detail presentation.
- `supporter-profiles`: Public organizer and demo-supporter profiles, featured causes, participation history, and community connections.
- `support-actions`: Isolated persistent demo identity, following, user-initiated sharing, simulated donation processing, and consistent state across pages.
- `fundraiser-assistant`: Campaign-scoped AI questions, evidence-linked answers, factual boundaries, and bounded failure behavior.
- `engagement-measurement`: Defined events, session/return measurement, performance evidence, and interpretable demo reporting.

### Modified Capabilities

None. The repository has no existing capability specs or application implementation.

## Impact

- Greenfield application work: the repository currently contains a template README, the requirements transcription, agent instructions, and OpenSpec setup. There are no existing routes, tests, APIs, or database migrations to preserve.
- The design proposes a TypeScript/Next.js application, persistent relational storage, server-side AI integration, and browser-based verification. Dependency versions and a compatible deployment environment will be verified during implementation.
- New behavior spans all three page types, interaction endpoints, demo data, analytics, and an external AI service. GoFundMe, TikTok, and Polymarket are research references, not runtime integrations.
- A live AI credential and its billing route must be available for live-AI acceptance. Coding subscriptions are not assumed to authorize application API usage; inherited Anthropic API credentials must not be used.
- All proposed acceptance targets and demo simplifications are project decisions, distinct from the sponsor's original requirements. No production migration or backward-incompatible change is involved.
