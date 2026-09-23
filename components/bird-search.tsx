"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { birdBounds, birdScale, drawBird, flockSize, SPECIES, speciesById, type Species } from "@/lib/life/birds";
import { arrival, departure, DRIFT, easeIn, easeInOut, easeOut, flightTime, glidePath, LABEL_GAP, layoutFlock, mirror, reveal, skyFor, type Point, type Rect } from "@/lib/life/flock";
import { indexWriting, searchWriting, writing, type Entry } from "@/lib/life/writing";

const entries = indexWriting(writing, SPECIES.map((species) => species.id));

interface Flier {
  entry: Entry;
  species: Species;
  facing: 1 | -1;
  state: "arriving" | "moving" | "hovering" | "leaving";
  from: Point;
  to: Point;
  start: number;
  duration: number;
  lift: number;
  at: Point;
  /** The wingbeat's running phase. */
  wing: number;
  seed: number;
  /** How much of its title shows, easing toward the pointer's pull. */
  shown: number;
  label: { width: number; height: number };
}

const seedOf = (id: string) => {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100003;
  return h / 100003;
};

/**
 * The life page's search: a soft black pill. Each result flies in as a bird and hovers over the
 * valley; titles surface over the birds near the pointer, or the one in focus.
 */
export function BirdSearch({ active }: { active: boolean }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchWriting(entries, query), [query]);
  const [placed, setPlaced] = useState<ReadonlySet<string>>(() => new Set());
  const [size, setSize] = useState({ width: 0, height: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const links = useRef(new Map<string, HTMLElement>());
  const fliers = useRef(new Map<string, Flier>());
  const pointer = useRef<Point | null>(null);
  const touched = useRef(false);
  const focused = useRef<string | null>(null);
  const reduced = useRef(false);
  const running = useRef(active);
  const sizeRef = useRef(size);
  const frame = useRef(0);
  const tick = useRef<(time: number) => void>(() => {});

  const start = () => {
    if (!frame.current && running.current && fliers.current.size) frame.current = requestAnimationFrame((time) => tick.current(time));
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) }));
    observer.observe(root);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => { reduced.current = motion.matches; };
    onMotion();
    motion.addEventListener("change", onMotion);
    return () => { observer.disconnect(); motion.removeEventListener("change", onMotion); };
  }, []);

  useEffect(() => {
    sizeRef.current = size;
    const canvas = canvasRef.current;
    if (!canvas || !size.width) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
  }, [size]);

  // The flock's frame: move each bird along its flight, draw it, and keep its link and title over it.
  useEffect(() => {
    let last = performance.now() / 1000;
    tick.current = (time) => {
      frame.current = 0;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const t = time / 1000;
      const dt = Math.min(0.05, Math.max(0, t - last));
      last = t;
      const { width, height } = sizeRef.current;
      const still = reduced.current;
      const scale = flockSize(width);
      ctx.setTransform(canvas.width / Math.max(width, 1), 0, 0, canvas.height / Math.max(height, 1), 0, 0);
      ctx.clearRect(0, 0, width, height);
      // Big birds first, so the small ones stay in view over them.
      const flock = [...fliers.current.values()].sort((a, b) => b.species.wingspan - a.species.wingspan);
      for (const f of flock) {
        const k = Math.min(1, Math.max(0, (t - f.start) / f.duration));
        let base = f.to, settled = 1, alpha = 1, vx = 0, vy = 0;
        if (f.state !== "hovering") {
          const eased = f.state === "arriving" ? easeOut(k) : f.state === "leaving" ? easeIn(k) : easeInOut(k);
          if (still) {
            alpha = f.state === "leaving" ? 1 - k : f.state === "arriving" ? k : 1;
          } else {
            base = glidePath(f.from, f.to, eased, f.lift);
            const ahead = glidePath(f.from, f.to, Math.min(1, eased + 0.01), f.lift);
            vx = ahead.x - base.x;
            vy = ahead.y - base.y;
          }
          settled = f.state === "leaving" ? 1 - k : eased;
          if (k >= 1) {
            if (f.state === "leaving") { fliers.current.delete(f.entry.id); continue; }
            f.state = "hovering";
          }
        }
        const hovering = f.state === "hovering";
        const { beat, glide, upright = 0 } = f.species.flight;
        // Hovering, big birds hold their wings out for a while now and then.
        const cycle = 5 + f.seed * 4;
        const gliding = still ? 1 : hovering ? Math.min(1, Math.max(0, (Math.sin(((t + f.seed * 10) * 2 * Math.PI) / cycle) - (1 - 2 * glide)) * 4)) : 0;
        f.wing += dt * beat * (hovering && beat < 20 ? 0.6 : 1);
        const drift = still ? 0 : settled;
        const bob = still ? 0 : -Math.sin(f.wing * Math.PI * 2) * birdScale(f.species, scale) * 0.04 * (1 - gliding);
        f.at = {
          x: base.x + Math.sin(t * 0.37 + f.seed * 6) * DRIFT.x * 0.8 * drift,
          y: base.y + Math.sin(t * 0.53 + f.seed * 9) * DRIFT.y * 0.8 * drift + bob,
        };
        const tilt = upright + (vx || vy ? Math.max(-0.3, Math.min(0.3, (-vy / Math.max(Math.abs(vx), 0.5)) * 0.4)) : 0);
        drawBird(ctx, f.species, f.at.x, f.at.y, f.facing, { phase: f.wing, glide: gliding, tilt }, alpha, scale);

        const link = links.current.get(f.entry.id);
        if (!link) continue;
        const box = f.facing === 1 ? birdBounds(f.species, scale) : mirror(birdBounds(f.species, scale));
        const bird: Rect = { left: f.at.x + box.left, top: f.at.y + box.top, right: f.at.x + box.right, bottom: f.at.y + box.bottom };
        const label: Rect = { left: f.at.x - f.label.width / 2, right: f.at.x + f.label.width / 2, bottom: bird.top - LABEL_GAP, top: bird.top - LABEL_GAP - f.label.height };
        link.style.transform = `translate(${bird.left.toFixed(1)}px, ${bird.top.toFixed(1)}px)`;
        link.style.width = `${(box.right - box.left).toFixed(1)}px`;
        link.style.height = `${(box.bottom - box.top).toFixed(1)}px`;
        link.style.setProperty("--body-x", `${(-box.left).toFixed(1)}px`);
        const target = f.state === "leaving" ? 0 : focused.current === f.entry.id ? 1 : hovering || k > 0.85 ? reveal(pointer.current, bird, label) : 0;
        f.shown += (target - f.shown) * Math.min(1, dt * 9);
        link.style.setProperty("--reveal", f.shown.toFixed(3));
      }
      // A breath of the valley's haze over the flock, so the birds sit in the same air.
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = "rgb(196 206 220 / .14)";
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      start();
    };
  }, []);

  useEffect(() => {
    running.current = active;
    if (active) start();
    else { cancelAnimationFrame(frame.current); frame.current = 0; }
  }, [active]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Place the results that fit, send new birds in, move or dismiss the rest.
  useLayoutEffect(() => {
    const { width, height } = size;
    if (!width) return;
    const still = reduced.current;
    const items = results.map((entry) => {
      const species = speciesById.get(entry.bird) ?? SPECIES[0];
      const label = links.current.get(entry.id)?.querySelector<HTMLElement>(".flock-label");
      return { id: entry.id, entry, species, bird: birdBounds(species, flockSize(width)), label: { width: label?.offsetWidth ?? 180, height: label?.offsetHeight ?? 32 } };
    });
    const previous = new Map([...fliers.current].filter(([, f]) => f.state !== "leaving").map(([id, f]) => [id, f.to]));
    const slots = layoutFlock(items, skyFor(width, height), previous);
    const t = performance.now() / 1000;
    let arrivals = 0;
    for (const item of items) {
      const slot = slots.get(item.id);
      if (!slot) continue;
      const f = fliers.current.get(item.id);
      if (!f) {
        const seed = seedOf(item.id);
        const { from, facing } = arrival(slot, width, height, seed);
        fliers.current.set(item.id, {
          entry: item.entry, species: item.species, facing, state: "arriving",
          from: still ? slot : from, to: slot, at: still ? slot : from,
          start: t + (still ? 0 : arrivals++ * 0.16), duration: still ? 0.4 : flightTime(from, slot, 1.9, 0.0022, 3.4),
          lift: 30 + seed * 70, wing: seed, seed, shown: 0, label: item.label,
        });
      } else {
        f.label = item.label;
        if (f.state === "leaving" || f.to.x !== slot.x || f.to.y !== slot.y) {
          if (Math.abs(slot.x - f.at.x) > 80) f.facing = slot.x > f.at.x ? 1 : -1;
          Object.assign(f, { state: "moving", from: { ...f.at }, to: slot, start: t, duration: still ? 0.01 : flightTime(f.at, slot, 0.9, 0.002, 2.2), lift: 16 });
        }
      }
    }
    for (const [id, f] of fliers.current) {
      if (slots.has(id) || f.state === "leaving") continue;
      Object.assign(f, { state: "leaving", from: { ...f.at }, to: still ? f.at : departure(f.at, f.facing, width, height), start: t, duration: still ? 0.4 : 1.7, lift: 0 });
    }
    setPlaced(new Set(slots.keys()));
    start();
  }, [results, size]);

  // "/" opens the search from anywhere on the page.
  useEffect(() => {
    if (!active) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || event.metaKey || event.ctrlKey || target?.closest("input, textarea, [contenteditable]")) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [active]);

  // Birds in reading order across the sky, for the arrow keys.
  const inSkyOrder = () => [...placed]
    .map((id) => fliers.current.get(id))
    .filter((f) => f !== undefined)
    .sort((a, b) => a.to.x - b.to.x)
    .map((f) => links.current.get(f.entry.id))
    .filter((link) => link !== undefined);

  const onInputKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (query) setQuery("");
      else event.currentTarget.blur();
    } else if ((event.key === "ArrowDown" || event.key === "Enter") && placed.size) {
      event.preventDefault();
      inSkyOrder()[0]?.focus();
    }
  };

  const onListKey = (event: KeyboardEvent<HTMLUListElement>) => {
    const order = inSkyOrder();
    const index = order.indexOf(document.activeElement as HTMLElement);
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (step && index >= 0) {
      event.preventDefault();
      order[(index + step + order.length) % order.length]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      inputRef.current?.focus();
    }
  };

  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointer.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (event.type === "pointerdown") touched.current = event.pointerType !== "mouse";
  };

  // On touch, the first tap on a bird shows its title; the next one opens it.
  const onBirdClick = (event: MouseEvent<HTMLElement>, id: string) => {
    if (touched.current && (fliers.current.get(id)?.shown ?? 0) < 0.6) event.preventDefault();
  };

  const count = placed.size < results.length ? `${placed.size} of ${results.length}` : `${results.length}`;

  return (
    <div ref={rootRef} className="bird-flock" onPointerMove={onPointer} onPointerDown={onPointer} onPointerLeave={(event) => { if (event.pointerType === "mouse") pointer.current = null; }}>
      <canvas ref={canvasRef} className="flock-canvas" aria-hidden="true" />
      <ul className="flock-list" aria-label="Results" onKeyDown={onListKey}>
        {results.map((entry) => {
          const shown = placed.has(entry.id);
          const props = {
            ref: (element: HTMLElement | null) => {
              if (!element) return;
              links.current.set(entry.id, element);
              return () => { links.current.delete(entry.id); };
            },
            className: "flock-bird",
            "data-placed": shown || undefined,
            onFocus: () => { focused.current = entry.id; },
            onBlur: () => { if (focused.current === entry.id) focused.current = null; },
            onClick: (event: MouseEvent<HTMLElement>) => onBirdClick(event, entry.id),
          };
          const content = (
            <>
              <span className="flock-label">{entry.title}</span>
              <span className="sr-only">, {entry.kind}</span>
            </>
          );
          return (
            <li key={entry.id}>
              {entry.href
                ? <a href={entry.href} tabIndex={shown ? undefined : -1} {...props}>{content}</a>
                : <span tabIndex={shown ? 0 : -1} {...props}>{content}</span>}
            </li>
          );
        })}
      </ul>
      <form className="bird-search" role="search" onSubmit={(event) => event.preventDefault()}>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKey}
          placeholder="search"
          aria-label="Search writing"
          aria-keyshortcuts="/"
          autoComplete="off"
          spellCheck={false}
        />
        {query.trim()
          ? <span className="bird-count" aria-hidden="true">{count}</span>
          : <kbd className="bird-key" aria-hidden="true">/</kbd>}
        <span className="sr-only" aria-live="polite">{query.trim() ? `${results.length} found` : ""}</span>
      </form>
    </div>
  );
}
