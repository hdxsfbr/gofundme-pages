# Build GoFundMe Profile, Fundraiser and Community Pages

## Source

- **Project:** GoFundMe
- **Project brief:** [Gauntlet project portal](https://portal.gauntletai.com/projects/mr1DR9R5XpgQLUHK9MhC)
- **Version:** 1
- **Labels:** AI-accelerated; Silver
- **Last updated:** 10/12/2026 (as displayed)
- **Transcribed from:** User-provided screenshot, `Screenshot 2026-10-15 at 5.30.11 PM.png`.

This document transcribes the supplied brief with Markdown formatting and minor punctuation cleanup. Transcription uncertainties and scope ambiguities are recorded separately below; they are not additional requirements.

## PRD

The brief provides examples of a GoFundMe fundraiser page, community page, and profile:

- **Fundraiser:** A GoFundMe URL beginning `https://www.gofundme.com/f/realtime-alerts-for-wildfire-safety-` (the final suffix needs confirmation from the original page).
- **Community:** [Watch Duty](https://www.gofundme.com/communities/watch-duty)
- **Profile:** A GoFundMe profile URL (the exact username needs confirmation from the original page).

Think outside of the box and use AI to build your own version of Profile, Fundraiser and Community pages. Tie them together to make an engaging experience.

## Problem & Context

### Business context

We are looking to reimagine ways that a GoFundMe can be a more engaging destination, where like-minded people can not only support their loved ones but also unite around causes they care about.

- You are free to think outside the box and come up with ideas that would be creative and engaging.
- Would make people want to come back.
- You can build all three of them or focus on just one or two.

### Impact metrics

Repeat visits, meaning actions (Donate, Share, Follow).

## Requirements & Success Criteria

### Functional requirements

- Pages successfully load, fast response times.
- The three pages (profile, fundraiser, community) are seamlessly integrated and intuitive.
- Well instrumented; explain what metrics you'll capture and why.

### Performance benchmarks

Page load times.

### Code quality expectations

Be able to explain the tradeoffs you made.

### Time constraints

1 week.

### Technical contact

No.

## Technology

### Required languages

Up to you.

### Dev tools

React / Next.js preferred, but you are welcome to roll your own.

### Cloud platforms

AWS preferred, but you decide what works for you.

### Off-limits tech

None.

## Submission & AI Policy

### AI usage documentation

Required.

### Required deliverables

- Source code
- Technical documentation
- Demo video
- AI usage log

## Attachments

No attachments available.

## Links

No links available in the brief's separate Links section. Example links appear in the PRD above.

## Clarifications to Resolve During Planning

These notes are observations about the brief, not requirements added by the project sponsor.

- **Page scope:** The business context allows one, two, or all three page types, while the functional requirements describe all three as integrated. Confirm the chosen scope explicitly in the implementation proposal.
- **Performance targets:** Page load times and fast responses are requested, but no numeric targets or measurement conditions are specified.
- **Interactions:** Donate, Share, and Follow are named as impact metrics; the brief does not specify whether donations must involve real payments or which interactions require persistence.
- **Reference URLs:** Confirm the fundraiser URL suffix and profile username before using those examples as references.
- **Impact metric wording:** The screenshot appears to say “Meaning Actions”; the intended meaning should be clarified when defining analytics.


## Dated planning resolution — 2026-10-15

This section records later planning and research decisions; it does not rewrite the sponsor brief transcribed above. The original fundraiser suffix and profile username uncertainties remain part of the transcription history. The reference review subsequently inspected the exact [fundraiser](https://www.gofundme.com/f/realtime-alerts-for-wildfire-safety-r5jkk) and [Janahan profile](https://www.gofundme.com/u/janahan), alongside the [Watch Duty community](https://www.gofundme.com/communities/watch-duty), while signed out at desktop and mobile sizes. The observations and captures are documented in the [OpenSpec design](../openspec/changes/archive/2026-10-16-modernize-gofundme-experience/design.md) and [research evidence](../openspec/changes/archive/2026-10-16-modernize-gofundme-experience/evidence/).

The implementation proposal chose to build all three integrated page types, plus a private demo supporter profile. It chose persistent but visitor-isolated demo actions and simulated donations without payment collection, campaign-grounded AI when configured, and funding-history charts. Creator publishing is deferred. These are project scope decisions, not additional sponsor requirements.

The brief requests page-load performance benchmarks but supplies no numeric thresholds or test conditions. The OpenSpec design later proposed a lab acceptance budget of median LCP at or below 2.5 seconds and CLS at or below 0.1 for each representative route over three Lighthouse mobile runs. These are project-selected validation targets, not sponsor-specified requirements. See [performance results](performance.md) for the recorded measurements and limits.
