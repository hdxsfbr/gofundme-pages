# Spec Delta

## Purpose

Connect fundraising activity to the people behind it through understandable organizer profiles and an isolated demo supporter's personal record of participation.

## ADDED Requirements

### Requirement: Organizer profile context
Organizer profiles SHALL show identity, an authored introduction, interests, featured fundraisers with reasons for supporting them, and associated community links. Fundraiser cards SHALL show current funding information and navigate to the correct campaign. Profile content SHALL not imply credentials or verification that the supplied records do not establish.

#### Scenario: Visit an organizer from a campaign
- **WHEN** a visitor activates a fundraiser's organizer link
- **THEN** the profile identifies that organizer, includes the associated fundraiser, and links to its community

### Requirement: Profile participation timeline
Profiles SHALL distinguish campaign creation, authored campaign updates, and donation activity with dates and linked campaigns. The demo supporter timeline SHALL include only that visitor's completed simulated donations and saved cause features. Seeded public activity SHALL be visibly part of the demo dataset.

#### Scenario: Inspect recent support
- **WHEN** a visitor completes a simulated donation and opens their demo profile
- **THEN** exactly one dated donation activity appears for that completed transaction with a link to its fundraiser

#### Scenario: Empty supporter history
- **WHEN** a new visitor opens their demo profile before taking action
- **THEN** the profile explains the empty activity state and offers a discovery link

### Requirement: Feature a cause with personal context
The demo supporter SHALL be able to feature or unfeature a fundraiser on their own profile and supply an optional plain-text reason of at most 280 characters. Changes SHALL persist for that demo visitor and SHALL not modify the organizer's public profile or campaign story.

#### Scenario: Feature a cause and revisit
- **WHEN** a visitor features a fundraiser with a reason and reloads their demo profile
- **THEN** the fundraiser and reason remain visible once, with a working campaign link

#### Scenario: Reject an oversized reason
- **WHEN** a visitor submits a reason longer than 280 characters
- **THEN** a clear validation message is shown and the existing saved reason remains intact

### Requirement: Profile relationships reflect saved actions
Organizer profiles SHALL expose the current visitor's follow state. The demo supporter profile SHALL show followed communities and fundraisers with working links. A visitor SHALL not be offered a follow action for their own demo identity.

#### Scenario: Follow an organizer from their profile
- **WHEN** a visitor follows an organizer and returns to the community's Following view
- **THEN** that organizer's relevant campaigns are included under the community-discovery rules

### Requirement: Demo profile isolation
The current visitor's demo profile SHALL be private to that demo session and visibly identified as such. Its personalized URL SHALL not be presented as a public shareable identity. Other visitors SHALL not be able to retrieve its activity, notes, or relationships by supplying an identity identifier.

#### Scenario: Separate visitors open their demo profiles
- **WHEN** two isolated browsers open the demo-profile route after one has donated and featured a cause
- **THEN** only the first browser sees its saved actions and notes

### Requirement: Accessible profile layout
Profile identity, featured causes, activity, and relationship actions SHALL remain usable at 390-pixel and 1440-pixel widths. All featured causes SHALL be reachable by keyboard without requiring a carousel gesture, and content SHALL preserve visible focus and meaningful link labels.

#### Scenario: Keyboard access to all featured causes
- **WHEN** a visitor tabs through the featured-cause section
- **THEN** every campaign can be reached and activated, including cards initially outside the visible row
