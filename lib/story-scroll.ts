export const CHAPTERS = [
  { id: "resume", label: "résumé" },
  { id: "passions", label: "passions" },
  { id: "skills", label: "skills" },
  { id: "projects", label: "projects" },
  { id: "contact", label: "contact" },
] as const;

export type Chapter = (typeof CHAPTERS)[number]["id"];

type Resolver = (chapter: Chapter) => number | null;
let resolver: Resolver | null = null;

/** The scroll story knows where its chapters settle; everything else falls back to the element. */
export function registerChapterResolver(next: Resolver) {
  resolver = next;
  return () => { if (resolver === next) resolver = null; };
}

export function chapterTop(chapter: Chapter) {
  const resolved = resolver?.(chapter);
  if (resolved != null) return resolved;
  const element = document.getElementById(chapter);
  return element ? element.getBoundingClientRect().top + scrollY : null;
}

export interface Pace { viewportsPerSecond: number; rampMs: number; minMs: number; maxMs: number }

/** Section links travel at a readable, steady pace so each scene's animation still plays along the way. */
export const TRAVEL: Pace = { viewportsPerSecond: 2.6, rampMs: 650, minMs: 700, maxMs: 9000 };
/** Back to the top is a quick return; the scenes rewind behind it. */
export const RETURN: Pace = { viewportsPerSecond: 9, rampMs: 450, minMs: 600, maxMs: 2600 };

export function getTravelDuration(distance: number, viewport: number, pace: Pace = TRAVEL) {
  const cruise = Math.abs(distance) / Math.max(1, viewport) / pace.viewportsPerSecond * 1000;
  return Math.round(Math.min(pace.maxMs, Math.max(pace.minMs, cruise + pace.rampMs)));
}

/**
 * Position (0–1) along a trip with gentle acceleration, a constant cruise, and
 * a gentle landing. `ramp` is each end's share of the trip.
 */
export function cruise(t: number, ramp: number): number {
  const x = Math.min(1, Math.max(0, t));
  const r = Math.min(0.5, Math.max(0.001, ramp));
  // Velocity rises as (1 - cos) over the ramp, holds, then falls symmetrically.
  const rampArea = r / 2;
  const total = 2 * rampArea + (1 - 2 * r);
  if (x < r) return (x / 2 - (r / (2 * Math.PI)) * Math.sin((Math.PI * x) / r)) / total;
  if (x > 1 - r) return 1 - cruise(1 - x, r);
  return (rampArea + (x - r)) / total;
}

let active: (() => void) | null = null;

/** Scroll to `target` at the given pace; any reader input cancels the trip. */
export function travelTo(target: number, { pace = TRAVEL, onDone }: { pace?: Pace; onDone?: () => void } = {}) {
  active?.();
  const start = scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  const end = Math.max(0, Math.min(max, target));
  const distance = end - start;
  if (Math.abs(distance) < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    scrollTo({ top: end, behavior: "instant" });
    onDone?.();
    return () => {};
  }
  const duration = getTravelDuration(distance, innerHeight, pace);
  const ramp = Math.min(0.5, pace.rampMs / duration);
  let frame = 0;
  let began = 0;
  const html = document.documentElement;
  const previousBehavior = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";
  const cancelOnKey = (event: KeyboardEvent) => { if (!["Shift", "Control", "Alt", "Meta", "Tab"].includes(event.key)) stop(); };
  const stop = () => {
    cancelAnimationFrame(frame);
    html.style.scrollBehavior = previousBehavior;
    removeEventListener("wheel", stop);
    removeEventListener("touchstart", stop);
    removeEventListener("keydown", cancelOnKey);
    removeEventListener("pointerdown", stop);
    if (active === stop) active = null;
  };
  const step = (now: number) => {
    if (!began) began = now;
    const t = (now - began) / duration;
    scrollTo({ top: start + distance * cruise(t, ramp), behavior: "instant" });
    if (t < 1) frame = requestAnimationFrame(step);
    else { stop(); onDone?.(); }
  };
  addEventListener("wheel", stop, { passive: true });
  addEventListener("touchstart", stop, { passive: true });
  addEventListener("keydown", cancelOnKey);
  addEventListener("pointerdown", stop);
  frame = requestAnimationFrame(step);
  active = stop;
  return stop;
}
/** The chapter whose settled position the reader has most recently passed. */
export function currentChapter(stops: [Chapter, number][], scroll: number, viewport: number): Chapter | null {
  let current: Chapter | null = null;
  for (const [chapter, top] of [...stops].sort((a, b) => a[1] - b[1])) {
    if (scroll + viewport * 0.5 >= top) current = chapter;
  }
  return current;
}
