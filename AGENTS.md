# Project Working Standards

## Understand the project before proposing changes

- Read `docs/project-requirements.md`, relevant OpenSpec artifacts, and the existing implementation before recommending scope or architecture.
- For a redesign, inspect the actual reference product first. Render the relevant pages, capture and view desktop and mobile screenshots, scroll below the fold, and exercise the relevant navigation and interactions.
- HTML, extracted text, and search results are useful supporting evidence; they do not replace reviewing the rendered interface.
- Distinguish observed behavior, suspected problems, proposed improvements, and agreed decisions. A feature missing from extracted text is not evidence that the product lacks it.
- Support design recommendations with a specific observation and an intended user outcome. Treat claims about younger audiences or engagement as hypotheses until supported by research or testing.

## Own routine discovery and tool recovery

- Proactively perform the research, inspection, and verification needed for the requested outcome. Do not make the user supervise these steps.
- When a tool fails, investigate available alternatives before declaring a blocker or asking the user to collect information.
- Missing embedded-browser tools do not establish that browser inspection is impossible. Check for local Chrome/Chromium and Playwright or equivalent tooling. Local Chrome and cached Playwright successfully rendered this project's public references during initial research.
- Prefer isolated browser contexts for public-site research. Do not assume they share the user's embedded-browser login.
- Ask the user about consequential product decisions, genuinely missing information, or required authorization. Resolve routine research methods and reversible implementation choices independently.
- Report a blocker precisely: what was attempted, what failed, and what is still possible. Do not generalize one unavailable tool into a broader capability claim.

## Keep planning grounded and coherent

- Use OpenSpec to connect requirements, design decisions, implementation tasks, and validation.
- Preserve the distinction between the sponsor's requirements, research findings, and our proposed scope. Do not silently turn a suggestion into a requirement.
- Keep the one-week time limit and all submission deliverables in scope: source code, technical documentation, demo video, and AI usage log.
- Identify the baseline experience to preserve, the specific changes to demonstrate, and what is deferred.
- Retain useful research evidence with source URLs, inspection date, viewport, and authentication state when capturing research artifacts. Do not present temporary files as durable project documentation.

## Verify the experience, not just the code

- Review the implementation at desktop and mobile sizes and test complete user journeys, including cross-page navigation and relevant loading, empty, and error states.
- Pair appropriate automated checks with visual inspection and interaction testing. Passing a build alone does not establish that the product works.
- Verify analytics against actual interactions and explain what each metric measures. Do not claim engagement improvements without evidence.
- Report what was implemented, what was tested, and any material limitations. Clearly identify simulations, mocked data, and untested authenticated behavior.

## Reference pages

- Brief: `docs/project-requirements.md`
- Community: https://www.gofundme.com/communities/watch-duty
- Fundraiser: https://www.gofundme.com/f/realtime-alerts-for-wildfire-safety-r5jkk
- Profile: https://www.gofundme.com/u/janahan

These three public pages were inspected with local Chrome/Playwright on 2026-10-15 at 1440 x 1000 and 390 x 844 viewports while signed out. The live fundraiser has working links to both the community and the standalone organizer profile. Following, activity feeds, featured causes, and leaderboards already exist; do not pitch these as new features without explaining the actual change.

## Agent delegation

Use subagents for bounded tasks when useful. Use Luna for straightforward tasks and Sol for harder tasks when necessary, as requested by the user. Keep integration and final verification with the primary agent.
