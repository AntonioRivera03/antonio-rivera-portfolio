/**
 * The search's liquid: a droplet swells from the pill's top, necks, pinches off, and grows into
 * the results panel. Everything here is geometry in page pixels, so it can be tested alone.
 */

export const TIMING = {
  /** The droplet rising and pinching off the pill. */
  separateMs: 420,
  /** The free droplet growing up into the panel. */
  expandMs: 580,
  /** The panel drawing back down into a droplet. */
  shrinkMs: 480,
} as const;

export const DROP = {
  /** Radius as it first bulges from the pill, and once free. */
  startRadius: 6,
  endRadius: 15,
  /** How far its centre rises above the pill's top edge. */
  lift: 44,
  /** The share of the separation at which the neck pinches through. */
  snap: 0.72,
} as const;

/** Space kept under the pill once it has moved down, and above the panel for the page's controls. */
export const PILL_GAP = 24;
export const PANEL_TOP = 76;
const PANEL_GAP = 20;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

export interface Droplet {
  /** Radius. */
  r: number;
  /** Centre height above the pill's top edge; below `r`, part of it is still in the pill. */
  lift: number;
  /** Half-width of the neck at its narrowest; zero once it has pinched through. */
  waist: number;
  /** A brief vertical stretch as the neck lets go. */
  stretch: number;
}

/** The droplet at separation progress `s` (0 in the pill .. 1 free and round). */
export function dropletAt(s: number): Droplet {
  const t = clamp(s), e = easeOut(t);
  const r = lerp(DROP.startRadius, DROP.endRadius, e);
  const waist = t < DROP.snap ? r * 0.9 * (1 - t / DROP.snap) ** 1.2 : 0;
  const after = (t - DROP.snap) / (1 - DROP.snap);
  const stretch = t < DROP.snap ? 0.08 * (t / DROP.snap) ** 2 : 0.08 * Math.cos(after * Math.PI * 1.5) * (1 - after);
  return { r, lift: DROP.lift * e, waist, stretch };
}

export interface Shape {
  /** The element's box, in page pixels. */
  left: number; top: number; width: number; height: number;
  /** A clip path in the box's own pixels, or null for a plain circle. */
  path: string | null;
}

const f = (n: number) => n.toFixed(2);

/**
 * The glass shape for a droplet over a pill whose top edge is at `edge`, centred at `x`: the
 * circle and its neck as one path, so the page's blur runs through the neck without a seam.
 */
export function dropletShape(x: number, edge: number, drop: Droplet): Shape {
  const { r, lift, waist } = drop;
  const cy = edge - lift;
  const top = cy - r;
  if (waist <= 0) return { left: x - r, top, width: 2 * r, height: 2 * r, path: null };
  const base = r * 1.9 + waist * 0.5;
  const h = edge - top;
  // Where the neck meets the droplet: 50° either side of its lowest point.
  const ax = r * Math.sin((50 * Math.PI) / 180), ay = r + r * Math.cos((50 * Math.PI) / 180);
  if (ay >= h - 0.5) {
    // Still bulging out of the pill: the part of the circle above its edge.
    const width = 2 * base, cx = base;
    const cut = Math.max(0, cy + r - edge);
    const chord = Math.sqrt(Math.max(0, r * r - (r - cut) ** 2));
    const path = `M${f(cx - base)} ${f(h)}C${f(cx - base * 0.4)} ${f(h)} ${f(cx - chord)} ${f(h - 0.1)} ${f(cx - chord)} ${f(h)}`
      + `A${f(r)} ${f(r)} 0 ${cut < r ? 1 : 0} 1 ${f(cx + chord)} ${f(h)}C${f(cx + chord)} ${f(h - 0.1)} ${f(cx + base * 0.4)} ${f(h)} ${f(cx + base)} ${f(h)}Z`;
    return { left: x - base, top, width, height: h, path };
  }
  const cx = base, ym = (ay + h) / 2, w = Math.min(waist, base * 0.9);
  const path = [
    `M0 ${f(h)}`,
    // A concave meniscus: it leaves the pill almost flat and steepens into the neck.
    `C${f(base * 0.72)} ${f(h)} ${f(cx - w)} ${f(ym + (h - ym) * 0.72)} ${f(cx - w)} ${f(ym)}`,
    `C${f(cx - w)} ${f(ym - (ym - ay) * 0.55)} ${f(cx - ax * 1.05)} ${f(ay + 1)} ${f(cx - ax)} ${f(ay)}`,
    `A${f(r)} ${f(r)} 0 1 1 ${f(cx + ax)} ${f(ay)}`,
    `C${f(cx + ax * 1.05)} ${f(ay + 1)} ${f(cx + w)} ${f(ym - (ym - ay) * 0.55)} ${f(cx + w)} ${f(ym)}`,
    `C${f(cx + w)} ${f(ym + (h - ym) * 0.72)} ${f(2 * base - base * 0.72)} ${f(h)} ${f(2 * base)} ${f(h)}Z`,
  ].join("");
  return { left: x - base, top, width: 2 * base, height: h, path };
}

export interface Rect { left: number; top: number; width: number; height: number }

/** Where the pill's top edge sits: centred on the screen at rest, near the bottom once open. */
export function pillTop(viewportHeight: number, pillHeight: number, open: boolean) {
  return open ? viewportHeight - PILL_GAP - pillHeight : (viewportHeight - pillHeight) / 2;
}

/**
 * The results panel: it rests just above the lowered pill, where its droplet came from, and is as
 * tall as its results, up to the room below the page's controls.
 */
export function panelRect(viewport: { width: number; height: number }, pillHeight: number, content: number): Rect {
  const width = Math.min(560, viewport.width - 32);
  const top = Math.max(PANEL_TOP, viewport.height * 0.1);
  const bottom = pillTop(viewport.height, pillHeight, true) - PANEL_GAP;
  const height = Math.max(64, Math.min(bottom - top, content));
  return { left: (viewport.width - width) / 2, top: bottom - height, width, height };
}
