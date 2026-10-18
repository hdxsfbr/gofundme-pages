## ADDED Requirements

### Requirement: Illustrative live donation preview
The fundraiser SHALL offer a clearly labeled client-only Live demo with a continuously moving chart and rolling donation total. It SHALL use fictional activity, disclose that it is unsaved, and SHALL NOT alter recorded contributions, campaign totals, analytics, or AI funding facts. Recorded funding history SHALL remain available separately.

#### Scenario: Watch simulated donations
- **WHEN** the visible Live demo is running
- **THEN** its chart moves smoothly and periodic illustrative donations increase its rolling total
- **AND** the same demonstration sequence is available for every campaign without network writes

#### Scenario: Pause or reduce motion
- **WHEN** the visitor pauses the demo or enables reduced motion
- **THEN** the chart and illustrative total stop advancing
- **AND** a hidden or offscreen demo does not accumulate simulated donations

#### Scenario: Read recorded funding
- **WHEN** the visitor selects a history range or follows a funding-source link
- **THEN** recorded funding data is shown instead of the illustrative animation

## MODIFIED Requirements

### Requirement: Funding-history ranges and recent activity
The fundraiser SHALL provide 7-day, 30-day, and all-time funding-history views with explicit dates, currency, and time-zone context. Period amounts and donation counts SHALL include only records within the selected period. Recorded funding-history charts SHALL identify cumulative funding separately from period changes and SHALL not fabricate activity or predict future outcomes.

#### Scenario: Change the displayed period
- **WHEN** a visitor switches from all-time to the last 7 calendar days
- **THEN** the chart range and period statistics update from the same donation records
- **AND** the cumulative chart includes the balance raised before the period as its opening balance

#### Scenario: No donations during the selected period
- **WHEN** a campaign has historical funding but no donations in the selected period
- **THEN** period activity is zero and the cumulative chart remains flat at the historical balance

