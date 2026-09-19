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
