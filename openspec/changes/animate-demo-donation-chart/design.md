# Design

Use a small dedicated client component with a deterministic donation sequence and a fixed illustrative opening total. Animate a sliding SVG window at approximately 30 frames per second only while visible; total digits roll with CSS when each simulated donation arrives. Use scoped styling and no additional package. Each campaign starts the same illustration independently.

Show Live demo, Illustrative total, and an explicit unsaved-activity disclosure. Existing history range buttons switch back to recorded data. Direct #funding links and focused funding citations select recorded history, avoiding presentation of fabricated numbers as AI evidence.

Pause/resume freezes the simulation clock. Reduced-motion preference displays a static illustration, including when the preference changes at runtime. IntersectionObserver and document visibility prevent hidden animation progress. No live-region announcements on every tick.

Validation: focused browser checks for animation, pause, reduced motion, isolation, historical ranges, source links, desktop/mobile layout; lint, typecheck, build, and existing unit checks. Actual production donation streaming is out of scope.
