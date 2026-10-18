# community-discovery Specification

## Purpose

Help visitors discover relevant fundraising stories and return to updates from the causes and people they follow, while keeping navigation understandable across devices.

## Requirements

### Requirement: Community overview and discovery hierarchy
The community page SHALL identify the cause, describe its purpose, show aggregate fundraising totals, and provide Discover and Following views. Relevant stories and updates SHALL precede any fundraising rankings. It SHALL expose a clear follow action and access to fundraiser and profile pages.

#### Scenario: First visit to the community
- **WHEN** a visitor opens the seeded community's public URL
- **THEN** the page displays its identity, purpose, aggregate totals, follow control, and visual discovery content
- **AND** no leaderboard must be passed to reach the discovery controls

### Requirement: Visual campaign browsing
Discover SHALL present curated campaign cards with an image, title, concise need, organizer attribution, and funding progress. Cards SHALL open the corresponding fundraiser through a normal link. Mobile browsing SHALL support touch scrolling without requiring gestures to access content or actions.

#### Scenario: Open a story on mobile
- **WHEN** a visitor activates a campaign card at a 390-pixel viewport
- **THEN** the correct fundraiser opens with its organizer and community relationships intact
- **AND** its story and support actions remain available without a swipe-only interaction

#### Scenario: Browse without a mouse
- **WHEN** a visitor navigates the discovery cards with a keyboard
- **THEN** each campaign link has a meaningful name, visible focus, and can be opened without using a carousel gesture

### Requirement: Search and topic filtering
Discover SHALL support case-insensitive search over campaign title, organizer name, and concise need, plus topic selection. Search and topic filters SHALL combine, have a visible reset action, and preserve a deterministic curated order among matching campaigns.

#### Scenario: Search within a topic
- **WHEN** a visitor selects a topic and enters a search term
- **THEN** only campaigns matching both conditions appear

#### Scenario: No matching campaigns
- **WHEN** no campaign matches the active filters
- **THEN** an empty state explains that there are no matches and offers a reset without clearing the community context

### Requirement: Following view reflects saved relationships
Following SHALL include campaigns and updates related to followed fundraisers, communities, and organizer profiles. Repeated relationships SHALL not duplicate an item. Following a community SHALL include its campaigns; following an organizer SHALL include that organizer's campaigns. The view SHALL explain an empty following list and provide a path to Discover.

#### Scenario: Follow a community and one of its fundraisers
- **WHEN** the same visitor follows a community and a fundraiser in that community
- **THEN** the fundraiser appears once in Following
- **AND** removing the direct fundraiser follow does not hide it while the community follow remains

#### Scenario: No saved relationships
- **WHEN** a new demo visitor opens Following
- **THEN** an empty state explains how following works and links to Discover

### Requirement: Update provenance and freshness
Update cards SHALL distinguish community-authored updates from fundraiser updates and identify the author, publication date, and related cause. A freshness label SHALL use persisted viewing history and publication timestamps; it SHALL not imply new activity when none occurred.

#### Scenario: Return after an update is published
- **WHEN** an update for a followed fundraiser is newer than the visitor's recorded update-view time
- **THEN** it is identified as new until the visitor opens that fundraiser's updates

#### Scenario: First visit without viewing history
- **WHEN** no previous update-view time exists
- **THEN** the feed presents the latest updates without claiming that they appeared since an earlier visit

### Requirement: Navigation preserves discovery context
Opening a fundraiser and returning through browser Back SHALL restore the selected view, search, topic, and previously viewed card position for the current tab. Directly loaded fundraiser links SHALL still provide a working route to their community without requiring prior browsing state.

#### Scenario: Return to a filtered feed
- **WHEN** a visitor filters Discover, scrolls to a campaign, opens it, and uses browser Back
- **THEN** the prior filters and browsing position are restored

### Requirement: Resilient discovery rendering
Community discovery SHALL expose distinct loading, empty, not-found, and recoverable failure states. Core content and controls SHALL fit 390-pixel and 1440-pixel viewports without page-level horizontal overflow. Decorative motion SHALL respect reduced-motion preferences.

#### Scenario: Community content fails to load
- **WHEN** a recoverable content request fails
- **THEN** the page shows an understandable error and retry action rather than a blank feed or fabricated campaign data

#### Scenario: Narrow viewport with reduced motion
- **WHEN** the page is opened at 390 pixels with reduced motion enabled
- **THEN** navigation and content remain usable without horizontal page scrolling or required animation

### Requirement: Connected Watch entry
The shared primary navigation and community discovery controls SHALL expose a clearly named Watch link beside Discover and Following. Watch SHALL open the current community's video feed and provide a visible route back to discovery. Adding Watch SHALL preserve existing search, filters, Following semantics, and discovery-return behavior, with accurate active navigation state.

#### Scenario: Open Watch from discovery
- **WHEN** a visitor activates Watch from the community page at mobile or desktop size
- **THEN** the community's video feed opens without requiring prior fundraiser navigation
- **AND** Watch is identified as the active destination while Discover and Following remain reachable

#### Scenario: Return to the filtered community
- **WHEN** a visitor selects a topic or search, scrolls discovery, opens Watch, and uses browser Back
- **THEN** the prior community view, query, topic, and scroll position are restored
- **AND** viewing clips alone does not alter saved follows or update-view timestamps

#### Scenario: Preserve existing discovery access
- **WHEN** a visitor uses Discover or Following without opening Watch
- **THEN** the existing image cards, filtering, empty states, relationship rules, and cross-page links continue to work without loading video media
