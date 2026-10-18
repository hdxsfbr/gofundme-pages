# Hosted submission browser audit

Run date: 2026-10-18. Target: https://web-production-7e5023.up.railway.app. Deployment ID: `4197c321-5b2e-496d-a54e-85396162675f`. Exact timestamps, browser version, viewport records, checks, AI outputs and funding table are in [audit.json](audit.json).

Nine functional check groups passed using local Google Chrome/Playwright in an isolated visitor context with `x-demo-test: true`; no response interception. Desktop was 1440 × 900 and mobile was 390 × 844. No browser runtime errors or failed application requests remained after correcting an erroneous audit-only `/profiles/me` URL to `/me`. All recorded pages had zero horizontal overflow. The audit corrections are disclosed in JSON.

Desktop checks covered Discover search/category/no-match, actual concierge recommendation and campaign navigation, campaign story and funding presentation, animated simulated funding with pause, three recorded date ranges and dated table, actual campaign assistant response and source navigation to `#budget`, simulated $12.50 donation, clipboard share, feature note, organizer follow, Following list, and saved donation/feature/follow after reload. Exactly two actual AI requests returned HTTP 200: `/api/concierge` and `/api/ask`. No AI requests were repeated during selector and screenshot rechecks.

Both sizes covered actual Watch video playback, next-clip navigation, donation dialog open/close with originating clip restoration, and navigation to the fundraiser. Watch donations were not confirmed. Mobile community, campaign, organizer and private profile renderings were captured; the full filtering/AI/supporter action sequence was exercised on desktop.

Reviewed screenshots include desktop Discover, concierge and private profile, mobile campaign, and mobile Watch. Final non-modal screenshots scroll to request lazy images, decode them, then restore the original scroll position before capture. Initial AI-dialog screenshots retain background lazy-image placeholders; their foreground conversation is loaded.

These results establish functional behavior for this deployment, not overall accessibility conformance or engagement improvement. The primary agent separately identified launcher accessible-name mismatches and is correcting them after this deployment. Campaigns are fictional; donation/support data and the live chart are simulated. No real payment or external authenticated flow was tested.

Reproduce with `node scripts/final-hosted-audit.mjs` (makes two real AI requests). `AUDIT_RECHECK=1` retains AI results and skips their requests; `AUDIT_ONLY=...` optionally limits non-AI checks. Rechecks use a fresh visitor context, so run support-actions with follow-and-persistence when validating saved contribution/feature state.
