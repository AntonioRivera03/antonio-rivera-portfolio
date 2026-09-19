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
```

## Skills and room

`lib/crt/journey.ts` extends the same scroll scene after Passions. The 68 skills in `lib/skills.ts` appear once across two perspective columns. Their measured height controls scroll distance. The computer centers, its eyes merge, and the camera enters the circle before returning to the white room. Forward and reverse progress share one controller, including jumps to the page ends.

`components/room.tsx` contains the project links and personal slides. Each fully lit slide stays on for 25 seconds, with a CRT shutdown and startup between slides. Hover, keyboard focus, hidden tabs, and the expanded cloud view pause automatic cycling. The small slide controls also work with reduced motion. The cloud panel opens a full-screen view with Escape and a back button to return.

The furniture is a Blender model in `assets/blender/room/room.blend`; `generator.py` preserves the procedural source. The website loads the self-contained `public/room/room.glb`, with a rendered PNG fallback. Supplied personal photos are in `public/about/`. Profile education follows the public résumé in `AntonioRivera03/portfolio`; the contact links follow the supplied brief.

Room furniture faces inward at 45°. A shared 12° camera projects the floating panels at 30° above their furniture; narrow layouts use readable document flow. The Blender `Working` animation loops while the room is visible and pauses for reduced motion, hidden tabs, and the cloud view. The cloud panel centers for 1.1 seconds, expands for 2.3 seconds, then fades in the subtitle beneath its persistent title.
