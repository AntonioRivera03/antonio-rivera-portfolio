/**
 * The birds of the life page's search. Each result flies in as one, drawn in profile from a
 * little below: the body is a side view, the wings are 3D planforms that beat around the body's
 * axis, so the near wing sweeps down across the body and the far wing shows above it.
 * All body and wing measures are in semispans (the length of one wing).
 */

export type WingTip = "rounded" | "pointed" | "fingered";

export interface Species {
  id: string;
  /** Wingspan in centimeters; sets the size on screen. */
  wingspan: number;
  body: {
    length: number;
    depth: number;
    head: number;
    /** Neck length, and its angle above the body's axis (a heron tucks its neck steeply). */
    neck: number;
    neckAngle: number;
    /** Length, depth at the base, droop at the tip. */
    bill: [number, number, number];
    /** Length, spread, and how deep the fork is (0 square .. 1 streamers). */
    tail: [number, number, number];
    /** Legs trailing past the tail. */
    legs: number;
    crest: number;
  };
  wing: { chord: number; tip: WingTip };
  /** beat: wingbeats a second; sweep and rest: the stroke's half-angle and middle (radians); glide: share of a hover spent gliding. */
  flight: { beat: number; sweep: number; rest: number; glide: number; upright?: number };
  color: {
    back: string; belly: string; head: string; bill: string; wing: string; under: string; tips: string; tail: string;
    neck?: string; face?: string; throat?: string; crown?: string; chest?: string; collar?: string; legs?: string;
  };
}

export const SPECIES: Species[] = [
  {
    id: "heron", wingspan: 180,
    body: { length: 0.62, depth: 0.2, head: 0.07, neck: 0.13, neckAngle: 1.15, bill: [0.2, 0.045, 0.012], tail: [0.12, 0.08, 0], legs: 0.42, crest: 0.05 },
    wing: { chord: 0.44, tip: "fingered" },
    flight: { beat: 2.3, sweep: 0.55, rest: 0.05, glide: 0.35 },
    color: { back: "#6f7c8a", belly: "#9aa3ab", head: "#e4e3dc", neck: "#a3abb2", crown: "#23262c", bill: "#d4ae55", legs: "#4f4230", wing: "#5d6a79", under: "#7f8a95", tips: "#262b33", tail: "#5f6a76" },
  },
  {
    id: "egret", wingspan: 135,
    body: { length: 0.56, depth: 0.17, head: 0.06, neck: 0.12, neckAngle: 1.2, bill: [0.18, 0.035, 0.01], tail: [0.1, 0.07, 0], legs: 0.46, crest: 0 },
    wing: { chord: 0.44, tip: "rounded" },
    flight: { beat: 2.6, sweep: 0.6, rest: 0.05, glide: 0.3 },
    color: { back: "#f1efe8", belly: "#faf8f3", head: "#f6f4ee", bill: "#e0b43a", legs: "#1d1d1d", wing: "#eeebe3", under: "#dcd8ce", tips: "#e2ded4", tail: "#ebe8e0" },
  },
  {
    id: "crane", wingspan: 190,
    body: { length: 0.5, depth: 0.2, head: 0.06, neck: 0.46, neckAngle: 0.08, bill: [0.14, 0.035, 0.01], tail: [0.1, 0.08, 0], legs: 0.5, crest: 0 },
    wing: { chord: 0.44, tip: "fingered" },
    flight: { beat: 2.1, sweep: 0.6, rest: 0.08, glide: 0.3 },
    color: { back: "#8c8f93", belly: "#a7a9ab", head: "#b8b9b7", neck: "#a2a4a6", face: "#ebe9e3", crown: "#b1382c", bill: "#2e2b28", legs: "#2a2a2a", wing: "#808387", under: "#9a9c9f", tips: "#35363a", tail: "#77797d" },
  },
  {
    id: "goose", wingspan: 160,
    body: { length: 0.56, depth: 0.24, head: 0.07, neck: 0.38, neckAngle: 0.12, bill: [0.1, 0.04, 0.01], tail: [0.12, 0.1, 0], legs: 0, crest: 0 },
    wing: { chord: 0.36, tip: "pointed" },
    flight: { beat: 3.4, sweep: 0.6, rest: 0.1, glide: 0.12 },
    color: { back: "#6b5a48", belly: "#cbbfa9", head: "#171513", neck: "#171513", face: "#f2efe8", bill: "#1a1816", wing: "#5d4e3f", under: "#7a6b5b", tips: "#2a241e", tail: "#1b1917" },
  },
  {
    id: "mallard", wingspan: 90,
    body: { length: 0.56, depth: 0.25, head: 0.085, neck: 0.2, neckAngle: 0.18, bill: [0.12, 0.045, 0.02], tail: [0.1, 0.1, 0], legs: 0, crest: 0 },
    wing: { chord: 0.32, tip: "pointed" },
    flight: { beat: 4.6, sweep: 0.72, rest: 0.1, glide: 0 },
    color: { back: "#7d7468", belly: "#bdb6aa", head: "#1d5638", neck: "#1d5638", chest: "#6a3b2a", collar: "#f3f1ea", bill: "#d6be48", wing: "#6e665c", under: "#d8d5ce", tips: "#48423b", tail: "#2b2b2b" },
  },
  {
    id: "hawk", wingspan: 125,
    body: { length: 0.46, depth: 0.22, head: 0.09, neck: 0.06, neckAngle: 0.3, bill: [0.05, 0.05, 0.03], tail: [0.32, 0.15, 0], legs: 0, crest: 0 },
    wing: { chord: 0.52, tip: "fingered" },
    flight: { beat: 2.6, sweep: 0.45, rest: 0.14, glide: 0.6 },
    color: { back: "#6a4c35", belly: "#e8dcc6", head: "#6b4d36", throat: "#ebe1ce", bill: "#3a3a3a", wing: "#5f4631", under: "#e3d7c3", tips: "#3a2e26", tail: "#b5532c" },
  },
  {
    id: "kestrel", wingspan: 58,
    body: { length: 0.42, depth: 0.2, head: 0.09, neck: 0.05, neckAngle: 0.3, bill: [0.04, 0.04, 0.025], tail: [0.4, 0.12, 0], legs: 0, crest: 0 },
    wing: { chord: 0.34, tip: "pointed" },
    flight: { beat: 6.5, sweep: 0.8, rest: 0.15, glide: 0.1 },
    color: { back: "#b0643a", belly: "#f0dabf", head: "#8a9bb0", face: "#f3ece0", bill: "#6e7280", wing: "#8d9bb0", under: "#f1e7d9", tips: "#2f2d33", tail: "#b36a3f" },
  },
  {
    id: "swallow", wingspan: 32,
    body: { length: 0.42, depth: 0.16, head: 0.09, neck: 0.03, neckAngle: 0.2, bill: [0.03, 0.03, 0.005], tail: [0.55, 0.1, 0.72], legs: 0, crest: 0 },
    wing: { chord: 0.26, tip: "pointed" },
    flight: { beat: 7, sweep: 0.8, rest: 0.2, glide: 0.35 },
    color: { back: "#1f2f55", belly: "#f0dcc3", head: "#1f2f55", throat: "#a44a2c", bill: "#1a1a1a", wing: "#1b2748", under: "#e7ddd0", tips: "#141c33", tail: "#1b2748" },
  },
  {
    id: "goldfinch", wingspan: 21,
    body: { length: 0.62, depth: 0.3, head: 0.13, neck: 0, neckAngle: 0, bill: [0.06, 0.05, 0.01], tail: [0.4, 0.12, 0.25], legs: 0, crest: 0 },
    wing: { chord: 0.42, tip: "rounded" },
    flight: { beat: 9, sweep: 1, rest: 0.1, glide: 0.3 },
    color: { back: "#e3bd1c", belly: "#f2d63c", head: "#e8c21e", crown: "#1a1a1a", bill: "#e0a05a", wing: "#1c1c1c", under: "#d9d4c8", tips: "#141414", tail: "#222222" },
  },
  {
    id: "cardinal", wingspan: 28,
    body: { length: 0.62, depth: 0.3, head: 0.13, neck: 0, neckAngle: 0, bill: [0.08, 0.07, 0.015], tail: [0.62, 0.14, 0], legs: 0, crest: 0.12 },
    wing: { chord: 0.44, tip: "rounded" },
    flight: { beat: 8.5, sweep: 0.95, rest: 0.1, glide: 0.25 },
    color: { back: "#a8241c", belly: "#c23a2b", head: "#b3261e", face: "#1a1414", bill: "#e05a3a", wing: "#94201a", under: "#b85a4e", tips: "#7e1a15", tail: "#8f1f18" },
  },
  {
    id: "jay", wingspan: 40,
    body: { length: 0.6, depth: 0.28, head: 0.12, neck: 0, neckAngle: 0, bill: [0.09, 0.05, 0.01], tail: [0.65, 0.14, 0], legs: 0, crest: 0.14 },
    wing: { chord: 0.46, tip: "rounded" },
    flight: { beat: 6, sweep: 0.9, rest: 0.1, glide: 0.25 },
    color: { back: "#4a7bb7", belly: "#eef0f2", head: "#4a7bb7", throat: "#f2f2ef", collar: "#1f2430", bill: "#1a1a1a", wing: "#3d6fb0", under: "#d7dce2", tips: "#1d2c46", tail: "#3f73b3" },
  },
  {
    id: "kingfisher", wingspan: 50,
    body: { length: 0.52, depth: 0.26, head: 0.14, neck: 0, neckAngle: 0, bill: [0.17, 0.06, 0.005], tail: [0.3, 0.12, 0], legs: 0, crest: 0.1 },
    wing: { chord: 0.4, tip: "rounded" },
    flight: { beat: 8, sweep: 0.9, rest: 0.12, glide: 0.1 },
    color: { back: "#4f6f8c", belly: "#f2efe8", head: "#4f6f8c", collar: "#f4f2ec", bill: "#222222", wing: "#48667f", under: "#dcdcd6", tips: "#1f2a36", tail: "#4b6983" },
  },
  {
    id: "robin", wingspan: 36,
    body: { length: 0.62, depth: 0.3, head: 0.12, neck: 0, neckAngle: 0, bill: [0.07, 0.035, 0.01], tail: [0.55, 0.13, 0], legs: 0, crest: 0 },
    wing: { chord: 0.44, tip: "rounded" },
    flight: { beat: 7.5, sweep: 0.95, rest: 0.1, glide: 0.25 },
    color: { back: "#5a534c", belly: "#c8612e", head: "#2d2926", bill: "#d7a12d", wing: "#4d4640", under: "#b7aa9c", tips: "#2f2a26", tail: "#2f2a26" },
  },
  {
    id: "owl", wingspan: 100,
    body: { length: 0.5, depth: 0.3, head: 0.16, neck: 0, neckAngle: 0, bill: [0.03, 0.03, 0.02], tail: [0.18, 0.12, 0], legs: 0, crest: 0 },
    wing: { chord: 0.5, tip: "rounded" },
    flight: { beat: 3, sweep: 0.6, rest: 0.08, glide: 0.4 },
    color: { back: "#c89a5b", belly: "#f4efe6", head: "#c89a5b", face: "#f6f2ea", bill: "#d8c9b0", wing: "#c29254", under: "#f3eee5", tips: "#b98a4f", tail: "#c29254" },
  },
  {
    id: "hummingbird", wingspan: 11,
    body: { length: 0.9, depth: 0.34, head: 0.17, neck: 0, neckAngle: 0, bill: [0.5, 0.04, 0.01], tail: [0.45, 0.14, 0.15], legs: 0, crest: 0 },
    wing: { chord: 0.3, tip: "pointed" },
    flight: { beat: 40, sweep: 1.05, rest: 0, glide: 0, upright: 0.65 },
    color: { back: "#3b7a4a", belly: "#e7e3d6", head: "#3b7a4a", throat: "#b3122a", bill: "#1b1b1b", wing: "#6a7272", under: "#7e8686", tips: "#4a5252", tail: "#2f4f3a" },
  },
];

export const speciesById = new Map(SPECIES.map((s) => [s.id, s]));

/**
 * Pixels per semispan: small birds are still findable, big ones don't crowd the sky. `size`
 * shrinks the whole flock on small screens.
 */
export function birdScale(species: Species, size = 1) {
  return ((32 + 88 * Math.pow(species.wingspan / 190, 0.6)) / 2) * size;
}

/** How large the flock flies on a screen this wide. */
export const flockSize = (width: number) => Math.min(1, Math.max(0.72, width / 1200));

// Wing outlines: u along the body (chords, forward positive), s along the wing (0 root .. 1 tip).
const PLANFORMS: Record<WingTip, [number, number][]> = {
  rounded: [[0.2, 0], [0.34, 0.25], [0.36, 0.5], [0.26, 0.78], [0.08, 0.97], [-0.12, 1], [-0.36, 0.9], [-0.58, 0.68], [-0.76, 0.4], [-0.82, 0.12], [-0.78, 0]],
  pointed: [[0.18, 0], [0.34, 0.22], [0.32, 0.45], [0.12, 0.7], [-0.28, 0.92], [-0.72, 1.02], [-0.62, 0.88], [-0.5, 0.62], [-0.56, 0.36], [-0.68, 0.12], [-0.66, 0]],
  fingered: [
    [0.24, 0], [0.4, 0.3], [0.4, 0.6], [0.3, 0.8], [0.2, 0.86], [0.14, 1], [0.06, 0.88], [-0.02, 0.99], [-0.1, 0.86], [-0.2, 0.95],
    [-0.26, 0.83], [-0.4, 0.88], [-0.42, 0.76], [-0.62, 0.6], [-0.82, 0.35], [-0.86, 0.1], [-0.8, 0],
  ],
};
const WRIST = 0.42;
// Seen from below and a little from the front, so wings held level still show their undersides.
const YAW = -0.4;
const PITCH = -0.62;

export interface Pose {
  /** Where the wing is in its beat, 0..1. */
  phase: number;
  /** 0 flapping .. 1 gliding with the wings held out. */
  glide: number;
  /** Nose up (positive) or down, radians. */
  tilt: number;
}

interface WingPose { arm: number; hand: number; fold: number }

/** The downstroke is quick and the wing is fully out; the upstroke is slower and folds the hand. */
function wingPose(species: Species, pose: Pose): WingPose {
  const { sweep, rest } = species.flight;
  const down = 0.42;
  const p = pose.phase - Math.floor(pose.phase);
  let arm: number, hand: number, fold: number;
  if (p < down) {
    const w = p / down;
    arm = rest + sweep * Math.cos(Math.PI * w);
    hand = arm + 0.35 * sweep * Math.sin(Math.PI * w);
    fold = 1;
  } else {
    const w = (p - down) / (1 - down);
    arm = rest - sweep * Math.cos(Math.PI * w);
    hand = arm - 0.3 * sweep * Math.sin(Math.PI * w);
    fold = 1 - 0.35 * Math.sin(Math.PI * w);
  }
  const g = pose.glide;
  return { arm: arm + (rest - arm) * g, hand: hand + (rest + 0.06 - hand) * g, fold: fold + (1 - fold) * g };
}

type Vec3 = [number, number, number];

function viewOf(tilt: number) {
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const cy = Math.cos(YAW), sy = Math.sin(YAW);
  const cp = Math.cos(PITCH), sp = Math.sin(PITCH);
  // Body tilt in its own plane, then turn toward the viewer, then look up from below.
  return ([x, y, z]: Vec3): Vec3 => {
    const x0 = x * ct - y * st, y0 = x * st + y * ct;
    const x1 = x0 * cy + z * sy, z1 = -x0 * sy + z * cy;
    return [x1, -(y0 * cp + z1 * sp), -y0 * sp + z1 * cp];
  };
}

function wingPoints(species: Species, w: WingPose, side: 1 | -1, root: Vec3): Vec3[] {
  const chord = species.wing.chord;
  const wrist: Vec3 = [root[0], root[1] + WRIST * Math.sin(w.arm), root[2] + side * WRIST * Math.cos(w.arm)];
  return PLANFORMS[species.wing.tip].map(([u, s]) => {
    if (s <= WRIST) return [root[0] + u * chord, root[1] + s * Math.sin(w.arm), root[2] + side * s * Math.cos(w.arm)];
    const r = (s - WRIST) * w.fold;
    return [wrist[0] + u * chord - (s - WRIST) * (1 - w.fold) * 0.9, wrist[1] + r * Math.sin(w.hand), wrist[2] + side * r * Math.cos(w.hand)];
  });
}

interface Shapes {
  far: Vec3[]; near: Vec3[]; farUp: boolean; nearUp: boolean;
  torso: Vec3[]; neck: Vec3[]; head: Vec3; headR: number; bill: Vec3[]; tail: Vec3[]; crest: Vec3[] | null; legs: [Vec3, Vec3] | null;
}

function shapes(species: Species, pose: Pose): Shapes {
  const b = species.body;
  const L = b.length, D = b.depth;
  const w = wingPose(species, pose);
  const root: Vec3 = [L * 0.12, D * 0.22, 0];
  const torso: Vec3[] = [];
  for (let i = 0; i < 20; i++) {
    const t = (i / 20) * Math.PI * 2;
    // Seen from below the body looks fuller than its profile.
    torso.push([(L / 2) * Math.cos(t), (D / 2) * Math.sin(t) * (1 + 0.16 * Math.cos(t)) * 1.25, 0]);
  }
  const base: Vec3 = [L * 0.36, D * 0.12, 0];
  const head: Vec3 = [base[0] + b.neck * Math.cos(b.neckAngle) + b.head * 0.4, base[1] + b.neck * Math.sin(b.neckAngle) + b.head * 0.2, 0];
  const nx = -(head[1] - base[1]), ny = head[0] - base[0];
  const nl = Math.hypot(nx, ny) || 1;
  const nb = D * 0.3, nh = b.head * 0.75;
  const neck: Vec3[] = [
    [base[0] + (nx / nl) * nb, base[1] + (ny / nl) * nb, 0], [head[0] + (nx / nl) * nh, head[1] + (ny / nl) * nh, 0],
    [head[0] - (nx / nl) * nh, head[1] - (ny / nl) * nh, 0], [base[0] - (nx / nl) * nb, base[1] - (ny / nl) * nb, 0],
  ];
  const [bl, bd, droop] = b.bill;
  const bill: Vec3[] = [[head[0] + b.head * 0.55, head[1] + bd / 2, 0], [head[0] + b.head + bl, head[1] - droop, 0], [head[0] + b.head * 0.55, head[1] - bd / 2, 0]];
  const [tl, spread, fork] = b.tail;
  const back = -L / 2 - tl;
  const tail: Vec3[] = fork > 0
    ? [[-L * 0.4, D * 0.16, 0], [back, spread * 0.55, 0], [back + tl * fork, 0, 0], [back, -spread * 0.55, 0], [-L * 0.4, -D * 0.22, 0]]
    : [[-L * 0.4, D * 0.16, 0], [back, spread * 0.5, 0], [back - tl * 0.08, 0, 0], [back, -spread * 0.5, 0], [-L * 0.4, -D * 0.22, 0]];
  const crest: Vec3[] | null = b.crest > 0
    ? [[head[0] + b.head * 0.1, head[1] + b.head * 0.9, 0], [head[0] - b.head * 0.8 - b.crest, head[1] + b.head * 0.55 + b.crest * 0.7, 0], [head[0] - b.head * 0.8, head[1] + b.head * 0.1, 0]]
    : null;
  const legs: [Vec3, Vec3] | null = b.legs > 0 ? [[-L * 0.12, -D * 0.34, 0], [back - b.legs, -D * 0.12, 0]] : null;
  const upper = (angle: number, side: 1 | -1) => {
    // The upper surface's normal, turned with the view: facing us means we see the top of the wing.
    const view = viewOf(pose.tilt);
    const n = view([0, Math.cos(angle), -side * Math.sin(angle)]);
    return n[2] > 0;
  };
  return {
    far: wingPoints(species, w, -1, root), near: wingPoints(species, w, 1, root),
    farUp: upper((w.arm + w.hand) / 2, -1), nearUp: upper((w.arm + w.hand) / 2, 1),
    torso, neck, head, headR: b.head, bill, tail, crest, legs,
  };
}

function trace(ctx: CanvasRenderingContext2D, points: [number, number][], closed = true) {
  const n = points.length;
  ctx.beginPath();
  if (!closed) {
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(points[i][0], points[i][1]);
    return;
  }
  // Smooth through the midpoints so outlines read as feathers, not polygons.
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(points[n - 1], points[0]);
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(points[i], points[(i + 1) % n]);
    ctx.quadraticCurveTo(points[i][0], points[i][1], m[0], m[1]);
  }
  ctx.closePath();
}

export interface BirdBounds { left: number; top: number; right: number; bottom: number }

const boundsCache = new Map<string, BirdBounds>();

/** The box a species' flight stays within, in pixels about its body's center, facing right. */
export function birdBounds(species: Species, size = 1): BirdBounds {
  const key = `${species.id}@${size.toFixed(3)}`;
  const cached = boundsCache.get(key);
  if (cached) return cached;
  const scale = birdScale(species, size);
  const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (let i = 0; i < 16; i++) {
    const pose = { phase: i / 16, glide: 0, tilt: species.flight.upright ?? 0 };
    const view = viewOf(pose.tilt);
    const s = shapes(species, pose);
    for (const p of [...s.far, ...s.near, ...s.torso, ...s.tail, ...s.bill, ...(s.legs ?? [])]) {
      const [x, y] = view(p);
      box.left = Math.min(box.left, x * scale);
      box.right = Math.max(box.right, x * scale);
      box.top = Math.min(box.top, y * scale);
      box.bottom = Math.max(box.bottom, y * scale);
    }
  }
  boundsCache.set(key, box);
  return box;
}

/**
 * Draws a bird with its body's center at (x, y). facing: 1 flies right, -1 left.
 * alpha fades it as it arrives or leaves; size is the flock's, from flockSize.
 */
export function drawBird(ctx: CanvasRenderingContext2D, species: Species, x: number, y: number, facing: 1 | -1, pose: Pose, alpha = 1, size = 1) {
  const scale = birdScale(species, size);
  const view = viewOf(pose.tilt);
  const s = shapes(species, pose);
  const flat = (points: Vec3[]) => points.map((p) => { const v = view(p); return [v[0], v[1]] as [number, number]; });
  const c = species.color;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * scale, scale);
  ctx.globalAlpha = alpha;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const wing = (points: Vec3[], up: boolean) => {
    const flatPoints = flat(points);
    const root = view(points[0]), tip = view(points[Math.floor(points.length / 2)]);
    const gradient = ctx.createLinearGradient(root[0], root[1], tip[0], tip[1]);
    gradient.addColorStop(0, up ? c.wing : c.under);
    gradient.addColorStop(0.55, up ? c.wing : c.under);
    gradient.addColorStop(1, c.tips);
    ctx.fillStyle = gradient;
    trace(ctx, flatPoints);
    ctx.fill();
  };
  // A very fast wing is a blur: several beats at once, faint.
  const blurred = species.flight.beat > 20;
  const wings = (side: "far" | "near") => {
    if (!blurred) { wing(s[side], side === "far" ? s.farUp : s.nearUp); return; }
    ctx.save();
    ctx.globalAlpha = alpha * 0.28;
    for (let k = 0; k < 5; k++) {
      const ghost = shapes(species, { ...pose, phase: pose.phase + k / 5 });
      wing(ghost[side], side === "far" ? ghost.farUp : ghost.nearUp);
    }
    ctx.restore();
  };

  wings("far");
  if (s.legs) {
    const [a, b] = flat(s.legs);
    ctx.strokeStyle = c.legs ?? c.bill;
    ctx.lineWidth = species.body.depth * 0.09;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.fillStyle = c.tail;
  trace(ctx, flat(s.tail));
  ctx.fill();

  // Torso, darker along the back, lighter underneath; a chest color in front where there is one.
  const torso = flat(s.torso);
  const top = view([0, species.body.depth / 2, 0])[1], bottom = view([0, -species.body.depth / 2, 0])[1];
  const shade = ctx.createLinearGradient(0, top, 0, bottom);
  shade.addColorStop(0, c.back);
  shade.addColorStop(0.45, c.back);
  shade.addColorStop(0.75, c.belly);
  ctx.fillStyle = shade;
  trace(ctx, torso);
  ctx.fill();
  if (c.chest) {
    const front = view([species.body.length / 2, 0, 0])[0];
    const chest = ctx.createLinearGradient(front, 0, 0, 0);
    chest.addColorStop(0, c.chest);
    chest.addColorStop(0.55, c.chest);
    chest.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    trace(ctx, torso);
    ctx.clip();
    ctx.fillStyle = chest;
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  }

  ctx.fillStyle = c.neck ?? c.head;
  trace(ctx, flat(s.neck));
  ctx.fill();
  const [hx, hy] = view(s.head);
  const r = s.headR;
  ctx.fillStyle = c.head;
  ctx.beginPath();
  ctx.ellipse(hx, hy, r, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  if (c.collar) {
    const [bx, by] = view(s.neck[0]), [ex, ey] = view(s.neck[3]);
    ctx.strokeStyle = c.collar;
    ctx.lineWidth = r * 0.45;
    ctx.beginPath();
    ctx.moveTo(bx + (hx - bx) * 0.25, by + (hy - by) * 0.25);
    ctx.lineTo(ex + (hx - ex) * 0.25, ey + (hy - ey) * 0.25);
    ctx.stroke();
  }
  if (s.crest) {
    ctx.fillStyle = c.head;
    trace(ctx, flat(s.crest));
    ctx.fill();
  }
  if (c.crown) {
    ctx.fillStyle = c.crown;
    ctx.beginPath();
    ctx.ellipse(hx + r * 0.1, hy - r * 0.55, r * 0.7, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (c.face) {
    ctx.fillStyle = c.face;
    ctx.beginPath();
    ctx.ellipse(hx - r * 0.05, hy + r * 0.3, r * 0.62, r * 0.42, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (c.throat) {
    ctx.fillStyle = c.throat;
    ctx.beginPath();
    ctx.ellipse(hx + r * 0.35, hy + r * 0.65, r * 0.55, r * 0.4, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = c.bill;
  trace(ctx, flat(s.bill), false);
  ctx.closePath();
  ctx.fill();
  if (r * scale > 3.2) {
    ctx.fillStyle = "#15130f";
    ctx.beginPath();
    ctx.arc(hx + r * 0.38, hy - r * 0.12, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  wings("near");
  ctx.restore();
}
