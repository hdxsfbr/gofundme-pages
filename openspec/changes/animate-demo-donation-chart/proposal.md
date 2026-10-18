# Animate the fundraiser donation chart

## Why
The user requested a more lively demonstration of incoming donations: a continuously moving chart and an odometer total. This is explicitly illustrative, client-only activity, identical across demo campaigns; it is not a claim of live donors or measured engagement.

## What Changes
- Default the funding section to a labeled Live demo with a scrolling chart, rolling digits, and periodic illustrative donation amounts.
- Preserve recorded 7-day, 30-day, and all-time history and funding-source links.
- Provide pause/resume, honor reduced motion, and suspend updates offscreen/backgrounded.
- Keep animation state separate from persistence, analytics, campaign totals, and AI funding sources.

## Capabilities
### Modified Capabilities
- `fundraiser-experience`: explicitly separated illustrative live funding preview.

## Impact
Fundraiser chart presentation only; no database, payment, event contract, or AI changes. Existing campaign history remains authoritative for the demo's recorded contributions.
