# Submission index

## Start here

- **Live app:** [A greener tomorrow](https://web-production-7e5023.up.railway.app/communities/a-greener-tomorrow)
- **Demo video:** [I Reimagined GoFundMe with AI — YouTube](https://youtu.be/ObE-w7e5Pv8), 3 minutes 29 seconds. A downloadable [MP4](evidence/submission-20261018/demo/demo.mp4), [captions](evidence/submission-20261018/demo/captions.srt), [narration](evidence/submission-20261018/demo/narration.txt), and [thumbnail](evidence/submission-20261018/demo/thumbnail.jpg) are retained in this repository.
- **Source code:** [GitLab repository](https://labs.gauntletai.com/andrebatista/gofundme-pages), with [local setup](../README.md).
- **Sponsor brief:** [project requirements](project-requirements.md). Later implementation decisions are explicitly separated from the transcribed brief.
- **Final review:** [requirement-by-requirement submission review](submission-review.md).

## Technical documentation

[Architecture and tradeoffs](technical.md) · [analytics and metric definitions](analytics.md) · [performance measurements](performance.md) · [validation](validation.md) · [deployment and rollback](deployment.md) · [media provenance and licenses](media.md) · [AI usage log](ai-usage-log.md) · [AI evaluation](ai-evaluation.md)

The main [OpenSpec specifications](../openspec/specs/) describe delivered behavior. Completed planning artifacts and acceptance tasks are retained in the [change archive](../openspec/changes/archive/).

## What the demo demonstrates

One connected fictional community, four campaigns, public organizer profiles, and a private browser-specific supporter profile. Visitors can search/filter, follow, feature a cause, copy public links, and save simulated donations. Discover's AI concierge recommends catalog campaigns; campaign chat answers questions using supplied sources. Fundraisers include recorded funding history and a separate animated donation illustration. Watch provides four captioned, campaign-linked clips with support actions and return navigation.

The final recording uses the deployed site and two actual AI requests, with no intercepted answers. It shows discovery, campaign and profile journeys, the new floating assistant button, simulated support, and Watch. Its ending explains the architecture and instrumented behavior. The [verification record](evidence/submission-20261018/demo/verification.json) records the file hash, full-stream decode check, scene timing, and review limits. The recording is edited for pacing, not a latency benchmark. Narration uses the author's authorized voice with standard Chatterbox, not Turbo.

## Scope and honest limits

All people/campaigns and seeded activity are fictional. Donations do not move money, and saved actions affect only the current anonymous browser visitor. The live-chart animation is invented and never changes recorded funding or AI facts. Stock photos and videos are illustrative, not organizer testimony. Neither AI assistant establishes legitimacy or independently verifies impact.

There is no production login, cross-device identity, payment processing, campaign publishing, or user-uploaded video. Watch is a finite editorial catalog. Browser verification uses Chromium emulation; physical iOS/Safari coverage is not established. Local lab performance is not field performance, and no increased retention, engagement, or conversion is claimed. Automated checks and agent review do not constitute independent human accessibility certification.

## Historical evidence

The [October 16 milestone closeout](milestone-closeout.md), [original silent demo](evidence/milestone/demo.webm), and [Watch follow-on validation](evidence/watch-20261016/validation.md) remain historical snapshots. The [October 17 Watch performance follow-up](evidence/watch-20261017/validation.md), [hosted Watch release](evidence/watch-hosted-20261017/README.md), [animated-chart acceptance](evidence/live-chart-20261018/validation.md), [concierge acceptance](evidence/concierge-20261018/validation.md), and [floating-launcher review](evidence/campaign-launcher-20261018/validation.md) explain how the final experience evolved. Earlier build identifiers, test counts, and pending-work statements in dated evidence are not claims about the latest release; use the final review and deployment runbook for submission status.
