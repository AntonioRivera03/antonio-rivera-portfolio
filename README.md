# antonio rivera

A minimal React portfolio. A Blender apple turns slowly as ASCII beside the name and role.

## Development

Node.js 22.13 or newer.

```sh
npm ci
npm run dev
```

```sh
npx tsc --noEmit
npm run build
```

## Source

- `app/page.tsx` — name, role, and layout.
- `app/globals.css` — typography and responsive composition.
- `components/apple-ascii.tsx` — React lifecycle and pause control.
- `lib/apple/renderer.ts` — model loading, lighting, rotation, and cleanup.
- `lib/apple/ascii-material.ts` — a glyph atlas and one GPU ASCII pass.
- `public/apple/` — self-contained GLB and static ASCII fallback.
- `assets/blender/` — editable Blender project, source renders, and generators.

The apple completes a revolution every 40 seconds, at up to 30 frames per second. Click it or use Enter/Space to pause. Reduced-motion preferences stop rotation; hidden tabs and offscreen instances suspend it. The static ASCII render remains available while loading or if WebGL fails.

## Apple source

Open `assets/blender/apple.blend` in Blender to edit the model. To rebuild its procedural geometry in Blender 5.2:

```sh
blender --background --python assets/blender/create_apple.py
```

This creates a separate generated scene and writes to `assets/blender/generated/`. The generator accepts `-- --output PATH` after the script argument. Copy the resulting `apple.glb` into `public/apple/` after inspecting it.

To reproduce the still from the included grayscale Blender render (requires Pillow and a monospace font):

```sh
python assets/blender/create_ascii_still.py assets/blender/apple-shaded.png public/apple/ascii-still.png
```

The site uses the Sites React/Vinext runtime. Hosting configuration is in `.openai/hosting.json`; the remaining framework helpers and bundled UI primitives support that runtime.

## Scroll résumé

`components/crt-resume.tsx` adds a sticky computer scene after the landing section. `lib/crt/timeline.ts` maps native page scrolling to camera approach and document scrolling. `lib/crt/power.ts` triggers complete timed power animations at the end of the résumé; a return buffer, settling delay, and minimum hold prevent rapid toggling. Scrolling backward restores the document; no wheel or touch events are intercepted.

The computer was modeled in Blender. Its editable source is `assets/blender/computer/computer.blend`. The rounded, tapered white housing has recessed vents and a drive slot; packed color, roughness, and normal maps provide a fine molded ABS texture. `CRT_Screen` is a rounded, convex surface with UVs derived from its physical position. Its material is replaced with the document renderer at runtime. The résumé fills a matching rounded aperture with a fixed title/menu bar, mild barrel distortion and scanlines; the glass edge and surround share one charcoal color.

To regenerate the computer and inspection renders:

```sh
blender --background --python assets/blender/computer/generator.py -- --render-previews
```

This writes to `assets/blender/computer/generated/`. Inspect the result before replacing the public GLB and still image.

Set the résumé content in `lib/crt/resume.ts`. Each job has a company/title heading, dates aligned right, and one short paragraph. On narrow displays, dates move below the heading to keep the text readable. The same content feeds the readable HTML fallback for reduced motion, printing, assistive technology, and WebGL failure. Keyboard users can focus “Read résumé as text” to leave the scroll presentation.

Document-layout and power-transition regression checks (Node 22.13+):

```sh
node --experimental-strip-types tests/crt-power.test.mjs
node --experimental-strip-types tests/crt-document.test.mjs
node --experimental-strip-types tests/crt-companion.test.mjs
node --experimental-strip-types tests/portfolio-journey.test.mjs
node --experimental-strip-types tests/room-layout.test.mjs
node --experimental-strip-types tests/life-flock.test.mjs
```

## Skills and room

`lib/crt/journey.ts` extends the same scroll scene after Passions. The skills in `lib/skills.ts` are grouped (languages, ai, data, frameworks, infrastructure…); each group lists its daily `core` tools first, rendered larger, then the rest quieter. Whole groups are balanced across two perspective columns, and the companion's eyes drift between the columns as they pass. Their measured height controls scroll distance. The computer centers, its eyes merge, and the camera enters the circle before returning to the white room. Forward and reverse progress share one controller, including jumps to the page ends.

`components/room.tsx` contains the project links and personal slides. Each fully lit slide stays on for 25 seconds, with a CRT shutdown and startup between slides. Hover, keyboard focus, hidden tabs, and the expanded cloud view pause automatic cycling. The small slide controls also work with reduced motion. The cloud panel opens a full-screen view with Escape and a back button to return.

The furniture is a Blender model in `assets/blender/room/room.blend`. `generator.py` builds it from `shapes.py` (shared modelling helpers), `avatar.py` (the seated, typing portrait; voxel-fused body, parametric hair and beard) and `bed.py` (oak frame, channel-tufted headboard, and a cloth-simulated pillow and flannel duvet). The person and desk share one proportion system (1.55 units per metre); the bed uses 1.5. Rebuild with `blender --background --python assets/blender/room/generator.py -- --output assets/blender/room/generated`, then copy `room.glb` to `public/room/` and `preview-front.png` to `public/room/room-still.png`. The generator also runs inside an open Blender session (it clears the scene in place and skips renders). The website loads the self-contained `public/room/room.glb`, with a rendered PNG fallback. Supplied personal photos are in `public/about/`. Profile education follows the public résumé in `AntonioRivera03/portfolio`; the contact links follow the supplied brief.

Room furniture faces inward at 45°. A shared 12° camera projects the floating panels at 30° above their furniture; narrow layouts use readable document flow. The Blender `Working` animation loops while the room is visible and pauses for reduced motion, hidden tabs, and the cloud view. The cloud panel centers for 1.1 seconds, expands for 2.3 seconds, then fades in the subtitle beneath its persistent title.

Once full screen, the view takes the `/life` address (`history.pushState`) without leaving the page, so the room stays mounted behind it. Browser back, Escape, and the view's back button all return through history to the same scroll position. `app/life/page.tsx` renders the same view for direct visits and refreshes; both use `components/life-journey.tsx`. The path is `LIFE_PATH` in `lib/room/life.ts`.

## Life: the valley and the flock

The life page opens on the sky. The arrow at the bottom tilts the view down (`/life#valley`) to an autumn valley after the Hudson River School: a still lake under turning trees, a wooded point, meadows and foothills across the water, and rolling blue ranges beyond. Its four layers rise at different rates on the way down. The up arrow returns to the sky; a link or refresh at `/life#valley` lands there directly.

The painting is rendered, not drawn: `assets/painting/valley.glsl` raymarches the scene (terrain, trees, reeds, volumetric cumulus, the lake's reflections, aerial haze), and `assets/painting/brush.glsl` brushes each layer with an anisotropic Kuwahara filter so the render reads as paint, with broader strokes in the distance. Each layer renders alone, seeing only its own geometry and what lies behind it, so the back layers are whole when the front ones rise past. `npm run life:valley` runs both in headless Chrome (on the GPU when it can reach one) and writes 2560×1440 WebP layers to `public/life/` (about 800 KB together); `-- --preview [width]` renders the whole scene to `assets/painting/generated/` instead.

`components/bird-search.tsx` is the search: a soft black pill at the bottom. Each result flies in as a bird and hovers in the open sky; moving the pointer over the flock surfaces the titles of the birds nearby. The pieces live in `lib/life/writing.ts` (title, kind, subjects, and an optional link and species); every word of a search must match, and title matches rank first. `lib/life/birds.ts` draws fifteen species in profile with 3D wings that beat, fold and glide; `lib/life/flock.ts` places them so each bird keeps room for its title above it, so titles shown together never overlap, and birds already hovering keep their places as the search changes. What doesn't fit is left out, and the pill says how many of how many are showing. `/` opens the search; arrow keys move between birds; Escape returns to the pill, then clears it. On touch, the first tap shows a title and the second opens it. With reduced motion, birds appear in place with their wings held out. The entries are examples for now, without links.

## Navigation, footer, and résumé PDF

`components/story-nav.tsx` links to each chapter. Chapters inside the scroll story report their settled positions through `registerChapterResolver` in `lib/story-scroll.ts`; the nav travels there at a steady pace (about 2.6 screens a second, with eased ends) so every scene animates on the way. Any wheel, touch, key, or pointer input cancels the trip. Reduced motion jumps directly.

`components/site-footer.tsx` holds contact links and a ballpoint landscape of the Texas Hill Country. `assets/drawing/generator.mjs` draws it as four SVG layers (`public/footer/`), used as CSS masks over the `--ink` color.

`app/resume/page.tsx` renders a printable résumé from the same data. With the dev server running, `npm run resume:pdf` prints it to `public/antonio-rivera-resume.pdf`, which the footer links to. Shared contact details are in `lib/profile.ts`.
