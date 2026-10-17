# Design

## Context

See [proposal.md](proposal.md) for motivation and scope. The application is Next.js/React with four fictional campaigns and PostgreSQL-backed anonymous demo actions. `src/components/experience.tsx` contains `Shell`, `Discovery`, `DonateButton`, `FollowButton`, `ShareButton`, and a viewer context. Donation completion is server-validated, transactional, idempotent, and recorded through the durable outbox in `src/app/api/actions/route.ts`. `src/lib/domain.ts` computes funding from seed records plus the current visitor's donations; Watch must reuse those values. The action type currently lives in `experience.tsx`, not in a separate client module.

`src/components/dialog.tsx` provides modal focus containment and restoration. Discovery stores its return position in session storage. Existing browser tests cover donation retries, pending responses, focus, navigation, and private state; `src/lib/report.ts` already joins starts and completions by visitor/campaign/attempt. There is no media catalog, uploader, transcoder, or public creator-account system.

Research on 2026-10-16 reviewed the retained desktop/mobile community captures from the deployed application and rendered GoFundMe's [creator page](https://www.gofundme.com/c/gofundme-for-creators) signed out at 390 × 844 and 1440 × 1000. A privacy overlay partially obstructed that page; its public profile link successfully reached Joshua Liljenquist's profile. GoFundMe's [video help](https://support.gofundme.com/hc/en-us/articles/4405106210843-Adding-video-s-to-your-fundraiser) documents public YouTube embeds. These observations support a creator-to-campaign connection, not a claim that GoFundMe lacks a video feed. Earlier TikTok research in the archived experience design reached a sign-in/birthday boundary. The requested swipe behavior is a product direction, not a verified reproduction of authenticated TikTok behavior. The new reference captures were inspected in memory; no new durable screenshot collection was created during planning.

## Goals / Non-Goals

**Goals:** Isolate media work to Watch; reuse saved support state; make a single active clip and modal transitions predictable; provide testable interaction and attribution contracts.

**Non-Goals:** Add an upload pipeline, a personalized recommender, a second donation backend, video infrastructure services, or AI media generation. The completed milestone's historical evidence and main specs remain unchanged until this change is implemented and synced.

## Decisions

### 1. Dedicated community Watch route

Add `/communities/[slug]/watch?clip=<stable-id>` with the existing server-side viewer bootstrap. Add Watch to the shell navigation and community discovery controls. Use a Watch-specific shell presentation: a compact navigation/exit area and a media stage sized to the remaining dynamic viewport, rather than placing videos beneath the long community hero. Center a portrait stage on desktop; mobile uses the available width and height with safe-area padding. Keep the campaign card and caption regions separate so they cannot obscure each other. Accommodate text zoom by relaxing fixed-height layout when necessary.

Keep Discover/Following image-based. An ordinary link preserves shareability and an explicit way out. A modal-only feed would complicate direct navigation and nested donation dialogs. Do not fetch media through navigation prefetch: attach video sources only after Watch mounts.

```text
Discover / Following --> Watch: one active clip
                            |         |
                            |         +--> Donate / Share panel
                            |                    |
                            |<-- same clip/time -+
                            |
                            +--> Campaign / Profile --> Back to clip
                            |
                            +--> Next clip --> End: Replay / Explore
```

### 2. Curated assets with a release prerequisite

Create a small `src/lib/video-content.ts` catalog separate from the existing campaign fixtures. Each record has a stable clip ID, campaign ID, publishing organizer/profile ID, organizer/supporter relationship, title/date, MP4/poster/VTT paths, accessible story-text alternative, duration, and provenance reference. Multiple clips may link to one campaign. Publishers must be one of the four existing public organizer profiles: the role is organizer for their own campaign and supporter when championing another existing campaign. No new public supporter identity is introduced. The publishing identity is the editorial demo profile; footage must not silently identify a stock performer as that fictional person. For this slice, Follow follows the campaign; the publishing profile is a normal link using existing profiles.

Target 6–10 real playable clips, 15–45 seconds long, spanning the four campaigns; release requires at least four qualified clips, one per campaign. The smaller minimum bounds content work within the remaining project time, while additional clips provide variety. Prefer original or explicitly permissioned promotional recordings; use licensed illustrative footage with a clearly identified demo narrative only when its permitted use fits that context. Include people and a concrete campaign appeal or update, rather than presenting an image slideshow as a creator video. No unsupported real-person endorsement, scraped social clip, cloned voice, or generated testimonial is necessary. Record provenance and review the actual audio/visual content and captions before acceptance. If suitable footage cannot be sourced, report the specific missing asset/permission instead of marking content complete or substituting misleading media.

Deliver a finite set of locally served H.264/AAC MP4s with progressive-download metadata at the front, portrait compositions, posters, and WebVTT captions. Target at most 8 MB per clip and 80 MB total. Verify actual browser decode and HTTP media delivery, not just filenames. These are implementation budgets, not sponsor requirements. Local assets avoid a new service dependency; a larger catalog would justify a separate storage/CDN decision later. The implementation selected four Pexels clips for illustrative fictional demos; their provenance, license review, silent audio, and non-endorsement treatment are recorded in `docs/media.md` and the catalog.

### 3. Native scrolling with explicit active selection

Use an isolated vertical scroll container with viewport-sized items, mandatory snap alignment and `scroll-snap-stop: always`; MDN documents how [snap stops prevent skipping snap positions](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-snap-stop). Select one active index when the destination settles, with a single controller mediating wheel, touch, arrow keys, and buttons. Pause outgoing playback immediately while transitioning; only the selected sufficiently visible item may play. Include explicit Next/Previous controls for non-gesture navigation and an ending item after the last clip. A clip ending does not auto-advance; it stops with Replay available.

Prefer browser scrolling to global pointer interception because donation inputs, captions, zoom, and accessibility still need normal browser behavior. Do not assume CSS alone proves the requested feel: verify normal and fast up/down gestures, wheel bursts, interrupted swipes, and tapping controls on touch devices. If the tested gesture can skip items, add a bounded transition guard within the feed rather than hijacking document scrolling. Arrow keys act only while focus is in the feed's non-editable browsing surface; controls and dialogs retain their normal keys.

### 4. One player controller and bounded loading

Keep media state local to the Watch component, keyed by stable clip IDs. Track active clip, playback position, desired playing/paused state, sound/caption preference, transition state, open panel, visibility, and error. Keep sources attached to the active clip plus at most the next adjacent clip; detach others after saving position and canceling unnecessary fetches. Do not keep a playing element per catalog card. Preserve the poster and actions while buffering.

Use inline muted video and handle rejected play promises; browser [autoplay policies](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) require a fallback even with muted playback. Default captions on, sound off. A clip with no audio must show that clearly and must not offer an ineffective Sound on toggle; enable the sound control only for a clip with an audible track. The current licensed demo clips are silent, so their audio control reports “No audio” and is disabled. Their WebVTT contains editorial story copy, not a transcript of speech; the text panel must identify it as written demo copy and disclose the illustrative performers. Remember playback and caption preferences during the Watch visit. Reduced motion starts paused with instant navigation transitions; Play remains available. Visible play/pause and captions controls accompany video taps. Use a plain-text story-text panel when no speech is present.

Before a modal opens or the tab hides, capture whether playback was active and its time, then pause. Resume only for the same active clip, when visible, with no panel open, prior playing intent, and browser permission. Manual pause takes precedence. Block background feed navigation throughout dialogs, including inertial scrolling. Source failure shows poster/context with Retry, Next when available, and discovery exit; an empty catalog and invalid selection have explicit states.

### 5. Reuse support components and restore navigation

Add optional presentation label, panel-state callback, and validated source metadata to the existing action components, with unchanged defaults for fundraiser pages. Watch uses the Donate now label. Do not fork the donation implementation: retain amount parsing, active-attempt tracking, pending-response protections, error retention, transaction idempotency, and refresh-driven funding. A refresh after a successful action must update funding without resetting the feed/controller. Share continues to share the canonical fundraiser URL, not the visitor's private state.

Use a namespaced per-tab Watch return record for community, active clip, per-clip position, explicit pause, and media preferences. Save on selection, panel open, navigation, and pagehide; throttle any progress saves. Restore time after metadata is ready, clamping to the playable duration. Fail gracefully when session storage is unavailable. Replace the selected-clip URL without adding a history entry per swipe; preserve the router's history state. URLs contain the public clip identifier only. An explicit different clip URL overrides saved selection. On a fresh tab start muted at time zero. Preserve the existing discovery-return record independently, including entry to Watch from filtered discovery.

### 6. Small extension to existing analytics

Use existing property keys `source: "watch"` and `sourceId: <clip-id>`; retain campaign ID as the entity for clip/support events. Add client names `video_feed_opened` (community entity), `video_clip_impression`, `video_play_started`, and `video_campaign_opened`. Emit impression after one second continuously active/visible, and play start after media time first advances. Reset exposure timing when hidden, modal-covered, or inactive. Deduplicate impressions/play starts by visitor + analytics session + clip in reporting. Do not send per-frame telemetry, raw transcripts, video URLs, private playback positions, or content text. Mark Watch page views distinctly so existing community metrics do not accidentally count every clip change as a page view.

At `/api/events`, validate the known community for feed-open events and the catalog clip-to-campaign pair for clip events and source-tagged donation-start/share events before recording them. Reject unknown or mismatched identifiers; generic property sanitization alone is insufficient. Feed-open has no clip ID. The report also excludes invalid source associations from video aggregates. These checks establish reference integrity, not proof that client-reported viewing occurred.

Extend follow and donation request schemas with optional clip `sourceId`. Validate that the clip exists and belongs to the donated/followed fundraiser before accepting a new action; reject mismatched provenance. Existing calls without that field remain valid. Server-generated `follow_changed` and `donation_completed` receive the validated source inside the existing transaction/outbox. The original completion retains its attribution on retry; do not update it from the retried request. Client `donation_started` retains the same attempt ID and source. Share outcome events carry the initiating clip from the open panel, not a mutable current index. This needs no database migration because event properties already store structured metadata.

Extend the report with these documented calculations within the selected time window:

| Measure                       | Numerator / denominator or counting rule                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qualified exposures and plays | Distinct visitor/session/clip combinations; play rate = exposed combinations with a play / exposed combinations                                   |
| Campaign arrival              | Distinct exposed combinations with a clip-open event followed by a matching fundraiser page view in the same session / qualified exposures        |
| Saved follows                 | Distinct exposed combinations with a source-tagged successful follow / qualified exposures; report unfollows separately                           |
| Sharing                       | Counts by opened/copied/native completed/canceled/failed, plus distinct exposed combinations with copy or native completion / qualified exposures |
| Donation completion           | Matched successful attempts / distinct starts, joined by visitor, campaign, clip, and attempt ID; retain unmatched server completions separately  |

Rates return null for empty denominators. Outcomes lacking a qualified exposure remain visible in separate raw/unmatched counts and do not inflate exposure-based rates. No attribution is inferred for a later donation initiated on the fundraiser page. Preserve normal metrics and test-session exclusions. This measures association with the entry point, not proof that videos caused support.

### 7. Focused verification and release

Extend the existing Playwright journeys with a touch-enabled context, desktop wheel/keyboard paths, panel interruption, Back restoration, finite-feed behavior, broken media, denied autoplay, reduced motion, and storage-disabled behavior. Use at least one real decodable fixture for playback tests. Assert only one video advances, not only that an active CSS class changed. Inspect screenshots and real playback at mobile/desktop sizes, including captions, 200% text zoom, and loading/errors. Exercise Safari/WebKit playback and swipe behavior where available; distinguish emulation from physical-device evidence and document any untested physical iOS behavior.

Add focused action/report tests for valid and mismatched clip attribution, retry preservation, and missing client telemetry. Confirm original Discover/Following and donation journeys still pass. Measure Watch's initial poster/layout under the existing mobile lab profile (target LCP <= 2.5 seconds, CLS <= 0.1); separately record time-to-first-frame and media transfer sizes without inventing a field metric. Inspect the network to prove bounded preloading and zero video requests on ordinary routes.

## Risks / Trade-offs

- Suitable promotional footage is not yet available → Source and review a small usable catalog first; preserve clear demo attribution and recorded permissions.
- Browser gesture/playback policies differ → Verify actual media, touch and wheel interactions, handle play rejection, and disclose the browser/device coverage.
- Fixed viewport controls can obscure captions or enlarged text → Separate caption/action regions and allow layout adaptation at text zoom or short landscape heights.
- Router refresh or late action responses can reset or misattribute a clip → Keep the controller stable, capture action source when opening the panel, and retain existing attempt guards.
- Local videos increase deployment size → Enforce the finite asset budget, optimize delivery, and fetch only the active/adjacent clips; defer infrastructure expansion.
- Client telemetry can be dropped → Preserve server-origin outcomes, expose unmatched counts, and use explicit observed denominators.

## Migration Plan

Implement as a separate change on a `codex/` branch. No database migration or new provider configuration is planned. Run appropriate checks and the existing required CI once the implementation is ready; publish through the established protected-main deployment pipeline. Verify hosted Watch media, one simulated support action, navigation restoration, and matching release readiness, then retain dated evidence and a short updated demo walkthrough. Keep historical milestone artifacts immutable. Revert the application commit to remove Watch if needed; existing saved donation/follow data and historical event properties remain valid. Sync and archive this change after its implementation tasks and acceptance evidence are complete.
