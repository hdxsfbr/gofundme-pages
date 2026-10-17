# Proposal

## Why

The current community helps visitors discover four fictional campaigns through photographs and text, but it does not let people browse short videos advocating for those causes. A curated vertical video feed can connect a person's story directly to campaign details and support actions; whether that improves discovery, return visits, or fundraising is a hypothesis to measure, not an established result.

## What Changes

- Add a visible **Watch** entry beside Discover and Following, opening a dedicated, directly accessible feed for the seeded community.
- Present curated short videos one at a time: swipe up/down on mobile with decisive snapping, scroll or use arrow keys and previous/next controls on desktop, and preserve an accessible way out. The finite collection ends with explicit replay and discovery choices.
- Play only the active clip, initially muted, with captions, sound and playback controls. Pause for action panels, background tabs, and navigation; preserve the current clip and position when returning.
- Keep creator attribution, organizer/supporter role, campaign title, funding progress, and a prominent **Donate now** button visible. Reuse the existing simulated-donation panel over the video, with the same validation, persistence, and idempotency. Provide campaign/profile links, fundraiser follow, and campaign sharing.
- Prepare a small editorial collection of actual playable clips, posters, captions, accessible text alternatives, and provenance. Proposed content target: 6–10 clips, 15–45 seconds each; the minimum release set is four qualified clips, one per existing campaign. For silent illustrative clips, the text alternative is clearly labeled editorial story copy, not a speech transcript. Clearly identify fictional demo content and illustrative footage; never imply a real person endorsed a fictional fundraiser without permission.
- Measure clip exposure/playback and campaign opens, plus feed-origin follow, share, and simulated donation outcomes with explicit attribution and denominators.
- Verify touch behavior, playback lifecycle, action state, accessibility, navigation restoration, media loading, and hosted delivery; update technical/media/analytics documentation, AI usage notes, and the demo walkthrough during implementation.

Public uploads, creator onboarding/publishing, comments, likes, recommendations learned from behavior, real payments, new AI features, and external social-platform integrations remain deferred. Existing Discover and Following behavior remains available.

## Capabilities

### New Capabilities

- `campaign-video-feed`: Curated video content, immersive sequential browsing, playback controls and lifecycle, connected campaign actions, navigation restoration, finite-feed boundaries, and accessible media delivery.

### Modified Capabilities

- `community-discovery`: Add an obvious Watch entry while preserving the established discovery views and their navigation state.
- `engagement-measurement`: Define video exposure/playback metrics and attributable campaign/support outcomes without inflating counts or treating simulated actions as real fundraising.

## Impact

- Add a Next.js community Watch route and focused video/catalog components. Integrate with `src/components/experience.tsx`, its shared shell and action controls, `src/components/dialog.tsx`, and the existing campaign/profile fixtures.
- Extend optional action/event provenance in the shared action components, `src/lib/client-events.ts`, `src/app/api/actions/route.ts`, `src/app/api/events/route.ts`, `src/lib/events.ts`, and `src/lib/report.ts`; retain session-derived identities, trusted completion events, and current database/outbox behavior.
- Add a bounded set of locally served media assets and caption files; no new hosted service, upload endpoint, database table, or third-party player is required for the curated slice.
- Extend focused browser, action, reporting, and media checks, keeping existing journeys and performance budgets intact. Historical milestone evidence remains unchanged.
- The archived milestone intentionally deferred automatic video and publishing. This change adds an opt-in Watch surface; it does not reinterpret that historical scope or claim authenticated TikTok equivalence. The implementation selected four Pexels assets as illustrative demo footage; source details, license notes, and limitations are in `docs/media.md`.
