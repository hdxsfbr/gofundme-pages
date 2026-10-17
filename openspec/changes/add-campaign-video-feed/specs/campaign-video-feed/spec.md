# Spec Delta

## Purpose

Help visitors discover campaigns through curated short videos and take support actions while preserving a continuous, accessible viewing experience.

## ADDED Requirements

### Requirement: Curated campaign-linked videos

The feed SHALL be finite and editorially ordered. Each catalog entry SHALL record campaign/profile IDs, role, title, date, source, and use permission. Each clip SHALL include a poster, captions, accessible text alternative, visible campaign/profile relationship, and fictional-demo/illustrative-stock disclosure. Silent clips SHALL label text as editorial copy without implying identity or endorsement.

#### Scenario: Inspect a silent illustrative clip

- **WHEN** a visitor opens a published clip
- **THEN** its video, publishing profile, relationship to the linked campaign, and demo context are identifiable
- **AND** caption/story text agrees with the fictional campaign information and is identified as editorial copy rather than speech or testimony
- **AND** the media source and permitted use can be verified from the catalog/media documentation

#### Scenario: Editorial content is prepared for release

- **WHEN** the initial catalog is validated
- **THEN** it contains at least four and at most ten distinct playable clips of 15–45 seconds, including one per existing campaign, with valid campaign/profile links and documented permission or license for the intended use
- **AND** broken references, missing accessibility assets, or unestablished permission prevent that clip being released

### Requirement: One-clip vertical browsing

Watch SHALL fill its available viewing area with one active clip at rest. An upward swipe SHALL advance to the adjacent clip and a downward swipe SHALL return to the previous clip, with decisive snapping and no unintended multi-clip advance from a single tested gesture. Desktop scrolling and explicit previous/next controls SHALL navigate the same order. Interacting with an action control SHALL not also advance the feed.

#### Scenario: Swipe between clips

- **WHEN** a mobile visitor performs one upward swipe from a settled middle clip and then one downward swipe
- **THEN** the feed settles on the adjacent next clip and then returns to the original clip without leaving partially settled cards or advancing several clips

#### Scenario: Scroll or press a navigation control

- **WHEN** a desktop visitor scrolls through Watch or activates Next or Previous
- **THEN** the feed settles on a single clip and the visible campaign information and controls belong to that clip

### Requirement: Controlled playback lifecycle

Only the active visible clip SHALL play inline, initially muted. The player SHALL expose play/pause and caption controls, pause when hidden, covered, or left, preserve preferences within the current visit, and honor explicit pause and reduced-motion intent. A rejected play request SHALL leave a usable Play control. Sound controls SHALL reflect whether a clip has an audio stream.

#### Scenario: Handle clips with and without audio

- **WHEN** a visitor enables sound and advances to another clip
- **THEN** the previous clip stops and only the active clip can play
- **AND** the sound preference remains available for clips that contain an audible track
- **AND** a silent demo clip clearly reports that sound is unavailable

#### Scenario: Autoplay is unavailable or motion is reduced

- **WHEN** playback permission is denied or the visitor requests reduced motion
- **THEN** the poster and Play control remain available, no automatic playback is required, and all navigation and campaign actions work

#### Scenario: Background and return

- **WHEN** a playing clip's tab is hidden and later becomes visible
- **THEN** playback pauses while hidden and resumes from the retained position only if it was previously playing and browser permission allows
- **AND** a clip manually paused before hiding remains paused

### Requirement: Visible campaign context and support

Each active clip SHALL expose its campaign title, current visitor-scoped funding progress, a prominent Donate now button, campaign and publishing-profile links, fundraiser follow state, and campaign sharing. Values and saved actions SHALL agree with the existing fundraiser and profile views. A video play or swipe SHALL never initiate a donation.

#### Scenario: Inspect and support the active campaign

- **WHEN** a visitor moves to a clip associated with a different campaign
- **THEN** all visible funding, links, follow state, and donation actions refer to the new campaign
- **AND** sharing uses that campaign's canonical public URL with the existing native-share and copy fallback behavior

#### Scenario: Follow from Watch

- **WHEN** a visitor follows a campaign in Watch and opens Following
- **THEN** the saved campaign appears under the established following rules and remains followed after reload

### Requirement: Donation panels preserve viewing context

Donate now SHALL open the existing simulated-donation flow over Watch. Opening a donation or share panel SHALL pause the video and suspend feed navigation. Closing it SHALL restore the same clip, playback position, and trigger focus, resuming only when previously playing and permitted. Donation validation, pending/error states, durable completion, and retry idempotency SHALL match the existing support-actions contract.

#### Scenario: Donate and continue watching

- **WHEN** a visitor opens Donate now partway through a clip, confirms $12.50 of simulated support, and closes the panel
- **THEN** no money is charged, funding reflects one saved contribution, and Watch returns to the same clip and retained playback position
- **AND** the video remains paused throughout the panel and navigation inputs cannot move the background feed

#### Scenario: Retry or close during a pending donation

- **WHEN** a donation response is delayed or lost and the visitor closes, reopens, or retries the flow
- **THEN** existing pending-attempt protections and idempotency prevent duplicate contributions or stale confirmations
- **AND** a storage failure preserves the entered amount for retry without claiming success

### Requirement: Navigation restores the viewing session

Watch SHALL have a public community-scoped URL and addressable clip selection. Visiting a campaign or profile and using browser Back SHALL restore the originating clip and playback position within the same tab. Selection changes SHALL not create one browser-history entry per swipe. An unavailable selected clip SHALL show an understandable recovery path; a missing community SHALL produce the existing not-found behavior.

#### Scenario: Read a campaign and return

- **WHEN** a visitor pauses a clip at a nonzero position, opens its campaign or publishing profile, and uses Back
- **THEN** the same clip and position return, the user's paused state remains intact, and the prior discovery page remains reachable without reversing every swipe

#### Scenario: Direct link without prior session state

- **WHEN** a visitor opens a valid clip URL in a new tab
- **THEN** that clip starts from the beginning with muted playback or a Play fallback and a working route to community discovery
- **AND** private playback state is not exposed in the public URL

### Requirement: Honest finite-feed boundaries

The feed SHALL have an explicit ending after the final curated clip, with replay and discovery actions. It SHALL NOT silently recycle the catalog, claim endless new content, or change clips merely because a video's playback ended. An empty catalog SHALL provide an explanation and an exit to discovery.

#### Scenario: Reach the end

- **WHEN** a visitor advances beyond the final clip
- **THEN** playback stops and an ending state offers Replay and Explore campaigns
- **AND** returning to the first clip requires an explicit replay action

### Requirement: Accessible responsive viewing

Watch SHALL remain usable at 390 × 844 mobile and 1440 × 1000 desktop sizes, including safe-area insets and 200% text zoom. Captions and critical actions SHALL not overlap. Keyboard users SHALL reach playback, navigation, campaign, and exit controls with visible focus; inactive clips SHALL not add hidden focus stops. Feed shortcuts SHALL not intercept text entry, dialog input, or ordinary control activation.

#### Scenario: Use Watch without gestures

- **WHEN** a keyboard user enters Watch and navigates clips, opens Donate now, closes it, and exits
- **THEN** each action is reachable with meaningful labels and visible focus, the dialog contains focus, and closing restores the activating control

#### Scenario: Narrow or enlarged layout

- **WHEN** captions and campaign controls are displayed on a narrow viewport or at 200% text zoom
- **THEN** text remains readable, necessary controls remain reachable, and content can adapt or scroll without clipping essential information or horizontal page overflow

### Requirement: Bounded resilient media delivery

Video assets SHALL load only within Watch, with loading limited to the active clip and at most one adjacent clip at a time. Remaining clips SHALL retain lightweight placeholders until needed. A media load or decode failure SHALL retain campaign context and offer Retry, Next when available, and discovery navigation. Media or analytics failure SHALL not disable an otherwise usable support action.

#### Scenario: Enter Watch on a slow connection

- **WHEN** the active video is still loading
- **THEN** a stable poster, visible loading state, and campaign controls remain available without eagerly downloading the entire collection

#### Scenario: Clip fails to load

- **WHEN** a clip is unavailable or cannot be decoded
- **THEN** Watch displays a recoverable error, offers the relevant navigation and retry controls, and never falsely presents it as playing

#### Scenario: Browse ordinary discovery

- **WHEN** a visitor opens Discover, Following, a profile, or a fundraiser without opening Watch
- **THEN** no video media is fetched and the established core-page loading budgets remain applicable
