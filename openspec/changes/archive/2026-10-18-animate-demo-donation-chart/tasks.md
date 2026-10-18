## Implementation
- [x] Add isolated animated chart and rolling digits with fictional activity disclosure.
- [x] Preserve recorded history and source-link behavior.
- [x] Add pause, reduced motion, and visibility handling.

## Validation
- [x] Verify desktop/mobile animation, state isolation, pause, reduced motion, historical ranges, and source navigation.
- [x] Run lint, typecheck, production build, and relevant automated checks.
- [x] Record results and update technical and AI usage documentation.

Evidence: `docs/evidence/live-chart-20261018/validation.md`; 187 unit/integration tests, 3 focused browser checks, 3 existing history/hydration checks, build, lint, typecheck, format, and strict OpenSpec validation passed. Desktop/mobile captures reviewed. Production publication completed in merged MR !4. The animated chart is present in the hosted audit and narrated demo linked from `docs/submission.md`. Final accessibility review also corrects the total's ARIA role and reduced-motion button label, with coverage from the existing axe journeys.
