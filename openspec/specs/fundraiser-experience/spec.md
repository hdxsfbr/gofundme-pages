# fundraiser-experience Specification

## Purpose

Present a fundraiser's need, people, funding progress, and updates so visitors can understand it and move confidently to related community, profile, and support experiences.

## Requirements

### Requirement: Campaign overview and original information
Each fundraiser SHALL show a title, media, concise need, full story, organizer, beneficiary, community, goal, amount raised, donation count, and dated updates. Intended use of funds SHALL reflect authored campaign information, including an explicit absence when no breakdown is supplied. Demo content SHALL be identifiable as fictional.

#### Scenario: Read a fundraiser with a budget breakdown
- **WHEN** the visitor opens a campaign that supplies an intended-use breakdown
- **THEN** the overview exposes that information with access to the full story and original source section

#### Scenario: Missing budget detail
- **WHEN** the campaign supplies a general purpose but no itemized budget
- **THEN** the page identifies the missing detail without inventing a breakdown or a per-dollar impact claim

### Requirement: Connected campaign identities
Organizer and community links SHALL navigate to the corresponding internal profile and community. Beneficiary identification SHALL distinguish the receiving organization from the organizer and community. Unknown campaign or profile identifiers SHALL produce an explicit not-found state.

#### Scenario: Follow the organizer and community links
- **WHEN** a visitor opens either relationship from a fundraiser
- **THEN** the corresponding profile or community opens and provides a route back to the fundraiser

#### Scenario: Invalid fundraiser URL
- **WHEN** a visitor opens a nonexistent campaign identifier
- **THEN** the application shows a not-found state and a discovery link instead of another campaign's content

### Requirement: Consistent funding totals
Raised amounts and donation counts SHALL be derived from the seeded donation records plus the current visitor's completed simulated donations. Funding percentage SHALL use raised amount divided by the positive goal, rounded to the nearest whole percent consistently across views. It SHALL be labeled as funding progress, not success probability.

#### Scenario: Campaign reaches or exceeds its goal
- **WHEN** recorded donations exceed the goal
- **THEN** the actual raised amount and percentage above 100 are shown
- **AND** the visual progress track remains bounded without hiding the overfunded amount

#### Scenario: Donation appears on connected pages
- **WHEN** the visitor completes a simulated donation and visits the community, fundraiser, and relevant profile
- **THEN** each view uses the same updated campaign total and count

### Requirement: Funding-history ranges and recent activity
The fundraiser SHALL provide 7-day, 30-day, and all-time funding-history views with explicit dates, currency, and time-zone context. Period amounts and donation counts SHALL include only records within the selected period. Charts SHALL identify cumulative funding separately from period changes and SHALL not fabricate activity or predict future outcomes.

#### Scenario: Change the displayed period
- **WHEN** a visitor switches from all-time to the last 7 calendar days
- **THEN** the chart range and period statistics update from the same donation records
- **AND** the cumulative chart includes the balance raised before the period as its opening balance

#### Scenario: No donations during the selected period
- **WHEN** a campaign has historical funding but no donations in the selected period
- **THEN** period activity is zero and the cumulative chart remains flat at the historical balance

### Requirement: Dated updates and readable source links
Campaign story and update sections SHALL have stable deep links. Updates SHALL display their authors and dates in reverse chronological order. Opening an update citation SHALL reveal its referenced text, including when the relevant section was collapsed.

#### Scenario: Open an AI citation to an update
- **WHEN** a visitor activates a valid update citation from the campaign assistant
- **THEN** the assistant yields focus appropriately and the referenced update is revealed, scrolled into view, and identifiable by heading and date

### Requirement: Usable support and detail controls
Donate, Share, Follow, and Ask actions SHALL be discoverable on the fundraiser at desktop and mobile sizes. Sticky controls SHALL not obstruct story content, source destinations, dialog actions, or keyboard focus. Images SHALL have appropriate alternatives and chart information SHALL also be available as readable text or tabular data.

#### Scenario: Navigate the fundraiser with a keyboard
- **WHEN** a visitor opens a support or assistant panel using a keyboard
- **THEN** focus enters the panel, stays within modal content where applicable, and returns to its trigger when closed

#### Scenario: Read the progress without the chart
- **WHEN** a visitor uses a screen reader or the chart cannot render
- **THEN** the selected period, total, period change, and dated funding values remain available

#### Scenario: Mobile viewport
- **WHEN** the fundraiser is displayed at 390 pixels wide
- **THEN** story, progress, and actions remain readable without page-level horizontal overflow
