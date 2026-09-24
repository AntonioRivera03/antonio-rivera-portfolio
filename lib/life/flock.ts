/**
 * Where the search's birds hover, and how they get there. Each bird keeps a clear footprint: its
 * own flight plus the room its title needs above it, so any titles shown at once never overlap.
 */

export interface Point { x: number; y: number }
export interface Rect { left: number; top: number; right: number; bottom: number }

export interface FlockItem {
  id: string;
  /** The bird's flight, about its body's center, facing right. */
  bird: Rect;
  /** The title's size when shown. */
  label: { width: number; height: number };
}

/** Space between a bird and its title. */
export const LABEL_GAP = 8;
/** Clear space between footprints, and how far a hovering bird drifts from its place. */
const MARGIN = 6;
export const DRIFT = { x: 6, y: 5 };

/** Landmarks in the life painting, as fractions of its width and height. */
export const PAINTING = {
  aspect: 1672 / 941,
  /** Where the big tree's canopy begins on the right. */
  treeLine: 0.63,
  /** Where the open air over the lake ends, above the lily pads and reeds. */
  water: 0.7,
} as const;

/**
 * The open air the birds hover in: the sky and the far half of the lake, clear of the page's
 * controls and of the big tree on the right. The painting covers the window, so its landmarks are mapped
 * through the crop; tall screens crop the sides away and give the flock the full width.
 */
export function skyFor(width: number, height: number): Rect {
  const narrow = width < 700;
  const paintedWidth = Math.max(width, height * PAINTING.aspect);
  const paintedHeight = Math.max(height, width / PAINTING.aspect);
  const treeLine = (PAINTING.treeLine * paintedWidth - (paintedWidth - width) / 2) / width;
  const water = (PAINTING.water * paintedHeight - (paintedHeight - height) / 2) / height;
  return {
    left: width * (narrow ? 0.04 : 0.05),
    right: width * Math.min(0.96, treeLine - 0.01),
    top: Math.max(70, height * 0.07),
    bottom: height * water,
  };
}

/** A bird's flight turned to face left. */
export const mirror = (r: Rect): Rect => ({ left: -r.right, top: r.top, right: -r.left, bottom: r.bottom });

/** Everything a hovering bird at (x, y) may cover: its flight, its drift, and its title above. */
export function footprint(item: FlockItem, at: Point): Rect {
  // Either way it faces, the flight is covered.
  const reach = Math.max(-item.bird.left, item.bird.right);
  const half = item.label.width / 2;
  return {
    left: at.x - Math.max(reach, half) - DRIFT.x,
    right: at.x + Math.max(reach, half) + DRIFT.x,
    top: at.y + item.bird.top - LABEL_GAP - item.label.height - DRIFT.y,
    bottom: at.y + item.bird.bottom + DRIFT.y,
  };
}

const overlaps = (a: Rect, b: Rect) => a.left < b.right + MARGIN && b.left < a.right + MARGIN && a.top < b.bottom + MARGIN && b.top < a.bottom + MARGIN;
const inside = (r: Rect, sky: Rect) => r.left >= sky.left && r.right <= sky.right && r.top >= sky.top && r.bottom <= sky.bottom;

/**
 * Places each bird in the clear spot nearest the middle of the sky, so the flock gathers in the
 * center. Birds already hovering keep their places when those still fit. `stretch` shapes the
 * flock (above 1, taller; below, wider), and birds are placed in the order given.
 */
function pack(items: FlockItem[], sky: Rect, previous: ReadonlyMap<string, Point>, stretch: number) {
  const placed = new Map<string, Point>();
  const taken: Rect[] = [];
  const tryAt = (item: FlockItem, at: Point) => {
    const box = footprint(item, at);
    if (!inside(box, sky) || taken.some((other) => overlaps(box, other))) return false;
    taken.push(box);
    placed.set(item.id, at);
    return true;
  };
  for (const item of items) {
    const at = previous.get(item.id);
    if (at) tryAt(item, at);
  }
  const cx = (sky.left + sky.right) / 2, cy = sky.top + (sky.bottom - sky.top) * 0.5;
  const rx = (sky.right - sky.left) / 2, ry = ((sky.bottom - sky.top) / 2) * stretch;
  const spots: (Point & { cost: number })[] = [];
  for (let y = Math.ceil(sky.top); y <= sky.bottom; y += 8) {
    for (let x = Math.ceil(sky.left); x <= sky.right; x += 8) spots.push({ x, y, cost: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 });
  }
  spots.sort((a, b) => a.cost - b.cost);
  for (const item of items) {
    if (placed.has(item.id)) continue;
    for (const spot of spots) if (tryAt(item, { x: spot.x, y: spot.y })) break;
  }
  return placed;
}

/**
 * Where each bird hovers. Tries a few packings, tallest birds first and in rank order, and keeps
 * the one that fits the most, favoring the best-ranked results. Birds that don't fit are left out.
 */
export function layoutFlock(items: FlockItem[], sky: Rect, previous: ReadonlyMap<string, Point> = new Map()): Map<string, Point> {
  const rank = new Map(items.map((item, i) => [item.id, i]));
  const tallest = [...items].sort((a, b) => (b.bird.bottom - b.bird.top + b.label.height) - (a.bird.bottom - a.bird.top + a.label.height));
  const score = (placed: Map<string, Point>) => placed.size * 1000 - [...placed.keys()].reduce((sum, id) => sum + (rank.get(id) ?? 0), 0);
  let best: Map<string, Point> | null = null;
  for (const stretch of [1, 0.75, 1.35]) {
    for (const order of [tallest, items]) {
      const placed = pack(order, sky, previous, stretch);
      if (!best || score(placed) > score(best)) best = placed;
      if (best.size === items.length) return best;
    }
  }
  return best ?? new Map();
}

export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number) => t * t * t;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** A bird arrives from off the side behind it, a little high, and faces the way it came in. */
export function arrival(slot: Point, width: number, height: number, seed: number): { from: Point; facing: 1 | -1 } {
  const facing = slot.x < width / 2 ? 1 : -1;
  return { facing, from: { x: facing === 1 ? -140 : width + 140, y: slot.y - height * (0.08 + 0.18 * seed) } };
}

/** It leaves ahead of itself, climbing. */
export function departure(from: Point, facing: 1 | -1, width: number, height: number): Point {
  return { x: facing === 1 ? width + 180 : -180, y: from.y - height * 0.28 };
}

/** A curve from a to b that sweeps in level at the end, as a bird settles. t in 0..1. */
export function glidePath(a: Point, b: Point, t: number, lift = 0): Point {
  const c1 = { x: a.x + (b.x - a.x) * 0.45, y: a.y + (b.y - a.y) * 0.1 - lift };
  const c2 = { x: b.x - (b.x - a.x) * 0.25, y: b.y };
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
  };
}

/** How long a flight between two points takes, so near and far arrivals feel the same speed. */
export function flightTime(a: Point, b: Point, min = 1.2, perPixel = 0.0021, max = 3.4) {
  return Math.min(max, Math.max(min, Math.hypot(b.x - a.x, b.y - a.y) * perPixel));
}

/**
 * How strongly a bird's title shows for a pointer at `p`: fully within `near` of the bird or its
 * title, fading out by `far`.
 */
export function reveal(p: Point | null, bird: Rect, label: Rect, near = 26, far = 115) {
  if (!p) return 0;
  const distance = (r: Rect) => Math.hypot(Math.max(r.left - p.x, 0, p.x - r.right), Math.max(r.top - p.y, 0, p.y - r.bottom));
  const d = Math.min(distance(bird), distance(label));
  const t = Math.min(1, Math.max(0, (d - near) / (far - near)));
  return 1 - t * t * (3 - 2 * t);
}
