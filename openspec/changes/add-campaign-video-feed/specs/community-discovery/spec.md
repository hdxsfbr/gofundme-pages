# Spec Delta

## ADDED Requirements

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
