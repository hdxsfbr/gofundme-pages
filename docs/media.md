# Media and content notes

## Fictional fixtures

The single community, four fundraisers, organizer biographies, beneficiaries, authored reasons, updates, and seed contribution records in `src/lib/content.ts` are fictional demonstration material. Stable IDs identify the community, campaign, organizer, and update fixtures. Fixture timestamps are fixed in source and do not change when the app restarts. Campaign goals and budgets are sample statements inside those fictional stories; they are not independently verified estimates.

The four campaign images are illustrative stock photos stored locally. They are not campaign evidence, do not represent the fictional beneficiaries, and do not prove project progress. Their alt text describes the pictured subject without assigning a real identity or outcome.

## Stock photo sources

The files were downloaded from Unsplash using the following source image IDs and parameters (`?w=1000&q=82&fit=crop&auto=format`):

| Local file | Unsplash source |
| --- | --- |
| `public/media/garden.jpg` | [photo-1416879595882-3373a0480b5b](https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1000&q=82&fit=crop&auto=format) |
| `public/media/forest.jpg` | [photo-1448375240586-882707db888b](https://images.unsplash.com/photo-1448375240586-882707db888b?w=1000&q=82&fit=crop&auto=format) |
| `public/media/solar.jpg` | [photo-1509391366360-2e959784a276](https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1000&q=82&fit=crop&auto=format) |
| `public/media/trail.jpg` | [photo-1441974231531-c6227db76b6e](https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1000&q=82&fit=crop&auto=format) |

The Unsplash License was checked on 2026-10-15: <https://unsplash.com/license>. The license permits downloading and use under its terms. Photographer names are not recorded in the project and are intentionally not guessed here. Check current license terms and any attribution needs before reuse outside this prototype.

## Fonts

The application bundles the Manrope variable font from `@fontsource-variable/manrope`. This font is distributed under the SIL Open Font License. Exact package versions and notices are recorded in `package.json`, `package-lock.json`, and the installed package license files.
