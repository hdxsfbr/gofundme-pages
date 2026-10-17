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

## Watch demo footage

The curated Watch feed contains four edited, locally served portrait MP4s, one for each fictional campaign. Each clip shows actual moving people at work or outdoors; campaign text is an editorial demo narrative, not dialogue from the pictured people. Every video carries the visible label “Illustrative stock footage | Fictional demo,” and the catalog provenance states that the performers are not the fictional organizers and do not endorse the campaigns. The MP4s have no audio stream. The matching WebVTT cues provide the editorial story copy as captions; that text is not a transcript of speech. Cue line breaks are authored for narrow screens. The source audio was omitted to avoid implying that unrelated stock audio is campaign narration.

The source videos were downloaded from Pexels on 2026-10-16. The final clips were re-encoded to 360 × 640 H.264 at 25 fps with a fast-start MP4 layout; source audio was removed, so the files contain no audio stream. The [Pexels License](https://www.pexels.com/license/) checked that day permits free download, modification, and use in websites/apps, and prohibits implying endorsement by pictured people. Attribution is not required; source page, creator, and modification details are retained below and in `src/lib/video-content.ts`.

| Campaign / local file | Source footage | Creator | Length / size |
| --- | --- | --- | --- |
| Garden — `public/media/watch/garden.mp4` | [People Planting Plants Together](https://www.pexels.com/video/people-planting-plant-together-9723220/) | cottonbro studio | 18 s / 0.59 MB |
| Trees — `public/media/watch/trees.mp4` | [Man Planting Tree](https://www.pexels.com/video/man-planting-tree-8544140/) | Mikhail Nilov | 15.2 s / 0.45 MB |
| Solar — `public/media/watch/solar.mp4` | [Two Men Carrying Up a Solar Panel](https://www.pexels.com/video/two-men-carrying-up-a-solar-panel-8853459/) | Los Muertos Crew | 20 s / 0.34 MB |
| Trail access — `public/media/watch/trail.mp4` | [Woman Talking to Partner in Wheelchair](https://www.pexels.com/video/a-woman-talking-to-her-partner-riding-on-wheelchair-8400732/) and [Woman Assisting Partner in Wheelchair](https://www.pexels.com/video/a-woman-assisting-her-partner-riding-on-wheelchair-while-in-the-park-8400826/) | SHVETS production | 16 s / 0.34 MB |

The four final videos total 1.71 MB, down from 3.86 MB before re-encoding; each is below the 8 MB per-clip budget and the set is well below the 80 MB total budget. The four 360 × 640 WebP posters total 71 KB (14–22 KB each), down from 198 KB as JPEGs. Posters are generated from each edited video, not unrelated photos. The two trail source excerpts are cut together. The text is editorially written for fictional demo campaigns and is not presented as a quote or testimony from a performer. People-led stock footage gives the feed real motion while campaign-specific spoken creator updates remain deferred until permissioned recordings are available.

The final files were fully decoded with FFmpeg and visually reviewed at representative frames and during browser playback. All are portrait H.264 without an audio stream, play for 15–20 seconds, and have a poster, WebVTT caption track, and separate written story-text alternative. There is no speech transcript because the clips have no speech. Local delivery and playback were verified in production-mode Chrome; hosted delivery and Safari/WebKit remain unverified.
