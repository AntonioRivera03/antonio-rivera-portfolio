// Pen-and-ink Texas Hill Country for the footer, drawn as four parallax mask layers.
// Every stroke is black; tone comes only from stroke opacity, width and hatch density.
//   node assets/drawing/generator.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "public/footer");
const W = 1600;
const H = 640;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed + 1013, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, seed, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(x * freq, y * freq, seed + i * 31);
    norm += amp; amp *= 0.5; freq *= 2.03;
  }
  return sum / norm;
}

// ---------- geometry ----------
function catmull(points) {
  return (x) => {
    if (x <= points[0][0]) return points[0][1];
    if (x >= points.at(-1)[0]) return points.at(-1)[1];
    let i = 0;
    while (points[i + 1][0] < x) i++;
    const p0 = points[Math.max(0, i - 1)][1], p1 = points[i][1], p2 = points[i + 1][1], p3 = points[Math.min(points.length - 1, i + 2)][1];
    const t = (x - points[i][0]) / (points[i + 1][0] - points[i][0]);
    return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
  };
}

/** A ridge silhouette sampled once so every layer agrees on the same line. */
function ridge(points, amp, scale, seed) {
  const base = catmull(points);
  const table = new Float64Array(W + 401);
  for (let i = 0; i < table.length; i++) {
    const x = i - 200;
    table[i] = base(x) + (fbm(x / scale, seed * 0.37, seed, 4) - 0.5) * 2 * amp;
  }
  return (x) => {
    const f = clamp(x + 200, 0, table.length - 1.001), i = Math.floor(f);
    return table[i] + (table[i + 1] - table[i]) * (f - i);
  };
}
const slopeOf = (fn, x, h = 9) => (fn(x + h) - fn(x - h)) / (2 * h);

// Back to front. `layer` decides which SVG the hill's strokes land in.
const hills = [
  // Flat-topped mesas along the horizon, as along the Balcones Escarpment.
  { id: "far0", layer: "far", top: ridge([[-200, 390], [120, 388], [205, 383], [330, 382], [380, 387], [600, 389], [676, 381], [856, 380], [906, 387], [1150, 387], [1206, 379], [1386, 378], [1440, 385], [1800, 388]], 1.1, 10, 10) },
  { id: "far1", layer: "far", top: ridge([[-200, 402], [80, 397], [260, 400], [430, 392], [610, 398], [770, 389], [930, 395], [1090, 386], [1250, 393], [1420, 388], [1580, 396], [1800, 394]], 2.2, 14, 11) },
  { id: "far1b", layer: "far", top: ridge([[-200, 414], [100, 410], [280, 404], [400, 409], [540, 401], [700, 407], [860, 400], [1020, 405], [1180, 398], [1340, 404], [1500, 399], [1800, 405]], 2.4, 15, 18) },
  { id: "far2", layer: "far", top: ridge([[-200, 436], [120, 424], [300, 413], [470, 419], [630, 408], [790, 416], [950, 404], [1110, 412], [1270, 418], [1430, 409], [1800, 420]], 2.6, 16, 12) },
  { id: "far2b", layer: "far", top: ridge([[-200, 448], [140, 438], [330, 427], [500, 433], [660, 421], [830, 430], [980, 419], [1150, 428], [1330, 432], [1500, 424], [1800, 436]], 2.8, 17, 19) },
  { id: "far3", layer: "far", top: ridge([[-200, 468], [180, 452], [390, 441], [560, 431], [720, 437], [870, 426], [1000, 437], [1120, 446], [1260, 450], [1420, 446], [1800, 458]], 3, 18, 13) },
  { id: "hillB", layer: "mid", top: ridge([[640, 600], [780, 540], [900, 494], [1020, 456], [1140, 428], [1250, 414], [1340, 417], [1440, 428], [1540, 437], [1700, 444], [1800, 446]], 2.4, 22, 14) },
  { id: "hillA", layer: "mid", top: ridge([[260, 600], [380, 530], [480, 478], [580, 452], [660, 444], [740, 450], [830, 470], [930, 500], [1030, 534], [1140, 600]], 2.2, 20, 15) },
  { id: "hillC", layer: "mid", top: ridge([[1150, 600], [1240, 548], [1330, 519], [1430, 503], [1530, 497], [1660, 499], [1800, 502]], 2, 20, 16) },
  { id: "ground", layer: "near", top: ridge([[-200, 408], [40, 416], [170, 426], [300, 442], [420, 463], [540, 486], [680, 510], [820, 528], [960, 540], [1100, 546], [1240, 548], [1380, 544], [1500, 546], [1800, 552]], 2.4, 30, 17) },
];
// Occluder: the highest (smallest y) silhouette among nearer hills.
hills.forEach((hill, i) => {
  const nearer = hills.slice(i + 1).map((h) => h.top);
  hill.occ = (x) => nearer.reduce((m, fn) => Math.min(m, fn(x)), H + 60);
});
const ground = hills.at(-1);
const skyFloor = (x) => hills.reduce((m, h) => Math.min(m, h.top(x)), H);

// ---------- trees ----------
/** A crown built from overlapping foliage clumps with ragged, noisy edges. */
function crown(kind, clumps, seed) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  clumps.forEach((c, k) => {
    c.k = k;
    box[0] = Math.min(box[0], c.x - c.r * 1.2); box[1] = Math.min(box[1], c.y - c.r * 1.2);
    box[2] = Math.max(box[2], c.x + c.r * 1.2); box[3] = Math.max(box[3], c.y + c.r * 1.2);
  });
  return {
    kind, clumps, seed, box,
    shape(x, y) {
      let best = null;
      for (const c of clumps) {
        const dx = x - c.x, dy = y - c.y, dist = Math.hypot(dx, dy);
        if (dist > c.r * 1.25) continue;
        const a = Math.atan2(dy, dx);
        const edge = c.r * (0.84 + 0.32 * fbm(Math.cos(a) * 1.8 + c.k * 5.1, Math.sin(a) * 1.8 + c.k * 2.3, seed, 3));
        const cover = 1 - dist / edge;
        if (cover > 0 && (!best || cover > best.cover)) best = { cover, nx: dx / edge, ny: dy / edge, c };
      }
      return best;
    },
  };
}

/** Ashe juniper: a dense, rounded-irregular evergreen that keeps foliage near the ground. */
function juniper(cx, baseY, width, height, seed) {
  const rand = mulberry32(seed);
  const rx = width / 2, ry = height / 2, cy = baseY - ry;
  const rMax = Math.max(6, Math.min(rx, ry) * 0.42), rMin = rMax * 0.55;
  const clumps = [];
  for (let gy = -1; gy <= 1.001; gy += 0.34) {
    for (let gx = -1; gx <= 1.001; gx += 0.3) {
      const x = gx + (rand() - 0.5) * 0.24, y = gy + (rand() - 0.5) * 0.24;
      const taper = y < 0 ? 1 - 0.28 * (-y) : 1; // slightly narrower toward the top
      if (x * x / (taper * taper) + y * y > 0.92) continue;
      clumps.push({ x: cx + x * rx * 0.78, y: cy + y * ry * (y > 0 ? 0.88 : 0.8), r: lerp(rMin, rMax, rand()) });
    }
  }
  // Ragged tufts that break the outline.
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (1.05 + rand() * 0.9);
    clumps.push({ x: cx + Math.cos(a) * rx * 0.86, y: cy + Math.sin(a) * ry * 0.84, r: rMin * (0.6 + rand() * 0.4) });
  }
  const tree = crown("juniper", clumps, seed);
  Object.assign(tree, { cx, cy, rx, ry, baseY });
  return tree;
}

const oakCenter = [344, 334];
const oak = crown("oak", [
  [-70, -54, 34], [-8, -60, 38], [56, -50, 32],
  [-128, -20, 33], [-66, -22, 41], [0, -18, 45], [66, -20, 40], [122, -16, 33],
  [-150, 18, 27], [-94, 16, 33], [-30, 20, 34], [36, 18, 35], [98, 18, 32], [152, 20, 26],
  [-176, 34, 17], [178, 36, 16], [-60, 36, 22], [70, 38, 22],
].map(([dx, dy, r]) => ({ x: oakCenter[0] + dx, y: oakCenter[1] + dy, r })), 77);
const oakLimbs = [
  { pts: [[344, 456], [342, 436], [339, 418], [334, 404]], w: [26, 20, 18, 16] },
  { pts: [[336, 406], [306, 394], [268, 382], [228, 378], [198, 383]], w: [13, 10, 8, 6, 4] },
  { pts: [[338, 404], [322, 378], [314, 352], [312, 328]], w: [11, 9, 7, 5] },
  { pts: [[342, 406], [372, 388], [414, 370], [458, 366], [488, 372]], w: [13, 10, 8, 6, 4] },
  { pts: [[344, 408], [360, 380], [370, 352], [374, 326]], w: [9, 8, 6, 4] },
  { pts: [[272, 382], [260, 362], [250, 342]], w: [5, 4, 3] },
  { pts: [[418, 369], [432, 352], [440, 334]], w: [5, 4, 3] },
];
function limbHit(x, y, pad = 0) {
  for (const limb of oakLimbs) {
    for (let i = 0; i < limb.pts.length - 1; i++) {
      const [ax, ay] = limb.pts[i], [bx, by] = limb.pts[i + 1];
      const vx = bx - ax, vy = by - ay, len2 = vx * vx + vy * vy;
      const t = clamp(((x - ax) * vx + (y - ay) * vy) / len2);
      const px = ax + vx * t, py = ay + vy * t;
      const r = lerp(limb.w[i], limb.w[i + 1], t) / 2 + pad;
      const d = Math.hypot(x - px, y - py);
      if (d < r) return { limb, i, t, across: ((x - px) * -vy + (y - py) * vx) / Math.sqrt(len2) / r };
    }
  }
  return null;
}

const junipers = [
  juniper(30, 424, 150, 176, 21),
  juniper(118, 434, 112, 124, 22),
  juniper(578, 499, 58, 50, 23),
  juniper(642, 514, 42, 26, 24),
];
const inBox = (b, x, y, pad) => x >= b[0] - pad && x <= b[2] + pad && y >= b[1] - pad && y <= b[3] + pad;
function inTrees(x, y, pad = 0) {
  for (const j of junipers) if (inBox(j.box, x, y, pad) && (j.shape(x, y) || (pad && (j.shape(x - pad, y) || j.shape(x + pad, y) || j.shape(x, y - pad))))) return true;
  if (inBox(oak.box, x, y, pad)) {
    if (oak.shape(x, y) || (pad && (oak.shape(x - pad, y) || oak.shape(x + pad, y) || oak.shape(x, y - pad)))) return true;
  }
  return Boolean(limbHit(x, y, pad));
}

// ---------- trail & figures ----------
const trailPts = [[470, 668], [572, 628], [690, 601], [826, 586], [964, 577], [1092, 572], [1204, 567], [1302, 561], [1382, 555]];
const trailWidth = (s) => lerp(52, 5, Math.pow(s, 0.7));
function trailHit(x, y) {
  let best = null;
  const total = trailPts.length - 1;
  for (let i = 0; i < total; i++) {
    const [ax, ay] = trailPts[i], [bx, by] = trailPts[i + 1];
    const vx = bx - ax, vy = by - ay, t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy));
    const d = Math.hypot(x - (ax + vx * t), y - (ay + vy * t));
    const s = (i + t) / total;
    const half = trailWidth(s) / 2 * (1 + 0.25 * (vnoise(s * 40, 1, 51) - 0.5));
    if (d < half && (!best || d / half < best.edge)) best = { edge: d / half, s };
  }
  return best;
}
function trailAt(s) {
  const total = trailPts.length - 1, f = clamp(s) * total, i = Math.min(total - 1, Math.floor(f)), t = f - i;
  return [lerp(trailPts[i][0], trailPts[i + 1][0], t), lerp(trailPts[i][1], trailPts[i + 1][1], t)];
}
const hikers = [[0.725, 17.4, 0], [0.762, 16.9, 1], [0.812, 16.1, 0]].map(([s, h, phase]) => {
  const [x, y] = trailAt(s);
  return { x, y: y + 1, h, phase, box: [x - 0.25 * h, y - 1.05 * h, x + 0.36 * h, y + 2.5] };
});
const inHikers = (x, y, pad = 0) => hikers.some((f) => inBox(f.box, x, y, pad));

// ---------- stroke collection ----------
const fmt = (tenths) => {
  const s = String(tenths / 10);
  return s.startsWith("0.") ? s.slice(1) : s.startsWith("-0.") ? "-" + s.slice(2) : s;
};
class Layer {
  constructor(name) { this.name = name; this.bins = new Map(); this.strokes = 0; }
  stroke(points, width, opacity, variant = 0) {
    if (points.length < 2) return;
    const w = Math.max(0.3, Math.round(width * 10) / 10);
    const o = Math.round(clamp(opacity, 0.05, 1) * 20) / 20;
    const key = `${w}|${o}|${variant}`;
    let bx = Math.round(points[0][0] * 10), by = Math.round(points[0][1] * 10);
    let d = `M${fmt(bx)} ${fmt(by)}l`;
    let first = true;
    for (let i = 1; i < points.length; i++) {
      const x = Math.round(points[i][0] * 10), y = Math.round(points[i][1] * 10);
      const dx = x - bx, dy = y - by;
      if (!dx && !dy && i < points.length - 1) continue;
      const a = fmt(dx), b = fmt(dy);
      d += (first || a.startsWith("-") ? "" : " ") + a + (b.startsWith("-") ? "" : " ") + b;
      first = false; bx = x; by = y;
    }
    if (first) d += "0 0";
    if (!this.bins.has(key)) this.bins.set(key, []);
    this.bins.get(key).push(d);
    this.strokes++;
  }
  dot(x, y, size, opacity) { this.stroke([[x, y], [x + 0.1, y]], size, opacity); }
  svg() {
    const paths = [...this.bins].sort(([a], [b]) => a.localeCompare(b)).map(([key, parts]) => {
      const [w, o] = key.split("|");
      return `<path stroke-width="${w}"${o === "1" ? "" : ` stroke-opacity="${o}"`} d="${parts.join("")}"/>`;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice"><g fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round">${paths.join("")}</g></svg>\n`;
  }
}

/** Walk a short pen stroke through a direction field, stopping at occlusion. */
function trace(rand, x, y, length, angleAt, inside, { step = 3, wobble = 0.05, jitter = 0.35, bend = 0.012 } = {}) {
  const pts = [[x, y]];
  let a = angleAt(x, y) + (rand() - 0.5) * wobble * 2;
  const curl = (rand() - 0.5) * bend * 2;
  const n = Math.max(2, Math.round(length / step));
  for (let i = 0; i < n; i++) {
    a = lerp(a, angleAt(x, y), 0.35) + curl;
    x += Math.cos(a) * step; y += Math.sin(a) * step;
    if (!inside(x, y)) break;
    pts.push([x + (rand() - 0.5) * jitter, y + (rand() - 0.5) * jitter]);
  }
  if (pts.length > 5) return pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1);
  return pts;
}

/** Scatter strokes over a region; `plan` returns null or the stroke's style at a point. */
function hatch(layer, rand, box, cell, plan) {
  for (let gy = box[1]; gy < box[3]; gy += cell) {
    for (let gx = box[0]; gx < box[2]; gx += cell) {
      const x = gx + rand() * cell, y = gy + rand() * cell;
      const style = plan(x, y);
      if (!style) continue;
      const count = Math.floor(style.tone * (style.per ?? 1) + rand());
      for (let i = 0; i < count; i++) {
        const sx = i ? x + (rand() - 0.5) * cell : x, sy = i ? y + (rand() - 0.5) * cell : y;
        if (!style.inside(sx, sy)) continue;
        const pts = trace(rand, sx, sy, style.length * (0.65 + rand() * 0.7), style.angle, style.inside, style.trace);
        layer.stroke(pts, style.width * (0.85 + rand() * 0.3), style.opacity * (0.8 + rand() * 0.4), Math.floor(rand() * 3));
      }
    }
  }
}

// Shared hill shading: light from the upper left, so right-facing slopes fall into shade.
function hillShade(hill, x) {
  return smoothstep(-0.03, 0.3, slopeOf(hill.top, x, 14));
}
function contourAngle(hill, x, y, flatten, seed) {
  const d = y - hill.top(x);
  const t = clamp(d / flatten);
  const s = slopeOf(hill.top, x, 12) * Math.pow(1 - t, 1.4);
  return Math.atan(s) + (fbm(x / 80, y / 50, seed) - 0.5) * 0.55;
}

// ---------- SKY ----------
function drawSky() {
  const layer = new Layer("sky"), rand = mulberry32(101);
  const inside = (x, y) => x > -30 && x < W + 30 && y < skyFloor(x) - 3 && !inTrees(x, y, 3);
  for (let y = 150; y < 420; y += 2.6) {
    for (let x = -60; x < W + 40; x += 18) {
      const px = x + rand() * 18, py = y + rand() * 2.6;
      if (!inside(px, py)) continue;
      const bank = fbm(px / 330, py / 26, 7, 4);
      const streak = smoothstep(0.45, 0.8, bank);
      const rise = smoothstep(198, 335, py);
      const density = rise * (0.2 + 0.8 * streak) * (0.55 + 0.45 * smoothstep(250, 390, py));
      if (rand() > density * 0.4) continue;
      const len = 40 + rand() * 110 + streak * 90;
      const pts = trace(rand, px, py, len, (ax, ay) => (fbm(ax / 420, ay / 70, 9) - 0.5) * 0.11, inside, { step: 5, wobble: 0.02, jitter: 0.5, bend: 0.0025 });
      const o = 0.1 + 0.22 * density;
      layer.stroke(pts, rand() < 0.2 ? 0.7 : 0.5, o, Math.floor(rand() * 3));
    }
  }
  // A small, distant flock.
  for (const [bx, by, size] of [[1012, 238, 4.2], [1026, 231, 3.4], [1041, 241, 3.8], [1050, 229, 2.8], [1066, 236, 3.1]]) {
    const lift = size * (0.3 + rand() * 0.25);
    layer.stroke([[bx - size, by - lift * 0.4], [bx - size * 0.45, by - lift], [bx, by]], 0.55, 0.62, 0);
    layer.stroke([[bx, by], [bx + size * 0.45, by - lift], [bx + size, by - lift * 0.4]], 0.55, 0.62, 0);
  }
  // A few soft flocks of cirrus, curled slightly, higher up.
  for (const [cx, cy, spread] of [[1190, 266, 160], [440, 290, 130]]) {
    for (let i = 0; i < 26; i++) {
      const x = cx + (rand() - 0.5) * spread * 2, y = cy + (rand() - 0.5) * 18 + (x - cx) * 0.03;
      if (!inside(x, y)) continue;
      const pts = trace(rand, x, y, 40 + rand() * 60, () => -0.06 + Math.sin((x - cx) / spread) * 0.05, inside, { step: 5, wobble: 0.03, bend: 0.006 });
      layer.stroke(pts, 0.5, 0.18 + rand() * 0.14, Math.floor(rand() * 3));
    }
  }
  return layer;
}

// ---------- FAR RIDGES ----------
/** A tiny distant tree: a dark dab of stacked scribbles, lighter on top. */
function farTree(layer, rand, x, y, w, opacity) {
  const rows = w > 2.6 ? 3 : 2, v = Math.floor(rand() * 3);
  for (let k = 0; k < rows; k++) {
    const t = (k + 0.5) / rows, half = w / 2 * Math.sqrt(1 - (1 - 2 * t) ** 2 * 0.6) * (0.8 + rand() * 0.35);
    const yy = y - w * 0.55 * (1 - t);
    layer.stroke([[x - half, yy + (rand() - 0.5) * 0.3], [x + half * (0.6 + rand() * 0.4), yy + (rand() - 0.5) * 0.3]], 0.7 + 0.15 * (w > 2.6), opacity * (0.75 + 0.25 * t), v);
  }
}

function drawFar() {
  const layer = new Layer("far"), rand = mulberry32(202);
  const far = hills.filter((h) => h.layer === "far");
  const visibleDepth = (hill, x) => hill.occ(x) - hill.top(x);
  far.forEach((hill, index) => {
    const nearness = index / (far.length - 1); // 0 on the horizon .. 1 nearest
    const inside = (x, y) => y > hill.top(x) + 0.6 && y < hill.occ(x) - 1 && !inTrees(x, y, 2.5);
    const fields = index >= far.length - 2 ? layFields(hill, rand, index) : [];
    const ranch = index === far.length - 1 ? ranchSite(hill, fields) : null;
    // Keep hatching off the fields and out of the ranch so both stay legible.
    const inField = (x, y) => fields.some((f) => x > f.x0 && x < f.x1 && y > hill.top(x) + f.d0 && y < hill.top(x) + f.d1)
      || Boolean(ranch && x > ranch.x - 30 && x < ranch.x + 32 && y > ranch.y - 28 && y < ranch.y + 4);

    // Contour hatching, heavier on the shaded right-facing slopes, fading into the valley haze.
    hatch(layer, rand, [-20, 370, W + 20, 520], 6 - 1.6 * nearness, (x, y) => {
      if (!inside(x, y) || inField(x, y)) return null;
      const shade = hillShade(hill, x);
      const haze = smoothstep(0, 10 + 6 * nearness, hill.occ(x) - y);
      const crest = Math.exp(-(y - hill.top(x)) / 5) * (0.2 + 0.3 * nearness);
      const tone = (0.36 + 0.5 * shade + 0.24 * nearness + crest) * haze * (0.6 + 0.8 * fbm(x / 55, y / 18, 30 + index));
      return tone < 0.05 ? null : {
        tone, per: 1.6 + 0.6 * nearness, inside, length: 7 + 11 * nearness,
        angle: (ax, ay) => contourAngle(hill, ax, ay, 22, 40 + index),
        width: 0.45 + 0.1 * nearness, opacity: 0.24 + 0.24 * nearness + 0.14 * shade,
        trace: { step: 2.4, wobble: 0.1, jitter: 0.3, bend: 0.03 },
      };
    });
    // Shaded flanks get a second, steeper pass so each ridge reads as a form.
    if (index > 0) {
      hatch(layer, rand, [-20, 370, W + 20, 520], 5.5, (x, y) => {
        if (!inside(x, y) || inField(x, y)) return null;
        const tone = smoothstep(0.5, 1, hillShade(hill, x)) * smoothstep(0, 9, hill.occ(x) - y) * (0.4 + 0.6 * fbm(x / 40, y / 20, 45 + index));
        return tone < 0.12 ? null : {
          tone, per: 0.8, inside, length: 5 + 4 * nearness,
          angle: (ax, ay) => contourAngle(hill, ax, ay, 22, 40 + index) + 0.8,
          width: 0.45, opacity: 0.2 + 0.2 * nearness, trace: { step: 2, wobble: 0.06, jitter: 0.25 },
        };
      });
    }

    // A darker wooded band just under each crest separates one ridge from the next.
    if (index > 0) {
      for (let x = -10; x <= W + 10; x += 2.2) {
        const top = hill.top(x);
        const band = 0.35 + 0.65 * smoothstep(0.35, 0.6, fbm(x / 48, index, 63));
        if (rand() > band * (0.55 + 0.45 * hillShade(hill, x))) continue;
        const y = top + 1 + rand() * (2.5 + 2.5 * nearness);
        if (!inside(x, y) || inField(x, y)) continue;
        const pts = trace(rand, x, y, 3 + rand() * 4, (ax, ay) => contourAngle(hill, ax, ay, 22, 40 + index), inside, { step: 1.6, wobble: 0.1, jitter: 0.25 });
        layer.stroke(pts, 0.7, 0.3 + 0.28 * nearness, Math.floor(rand() * 3));
      }
    }

    // Crest line, broken where groves or haze swallow it.
    let run = [];
    const flush = () => { if (run.length > 2) layer.stroke(run, 0.5 + 0.12 * nearness, 0.36 + 0.34 * nearness, 0); run = []; };
    for (let x = -10; x <= W + 10; x += 3) {
      const y = hill.top(x);
      const visible = y < hill.occ(x) - 1.5 && y < skyFloor(x) + 0.5 && !inTrees(x, y, 2) && fbm(x / 26, index, 60) > 0.27;
      if (visible) run.push([x, y + (rand() - 0.5) * 0.4]); else flush();
    }
    flush();

    // Tree-lined crests: tight groves of tiny rounded crowns.
    if (index > 0) {
      for (let x = -10; x <= W + 10; x += 1.5 + rand() * 1.6) {
        const grove = smoothstep(0.36, 0.62, fbm(x / 34, index + 4, 61));
        if (rand() > grove * 0.95) continue;
        const y = hill.top(x);
        if (y > hill.occ(x) - 3 || y > skyFloor(x) + 1 || inTrees(x, y, 2)) continue;
        farTree(layer, rand, x, y + 0.4, (1.6 + rand() * 2) * (0.6 + 0.7 * nearness), 0.28 + 0.3 * nearness);
      }
    }

    // Wooded flanks below the crest read as soft darker mottling.
    if (index > 0) {
      for (let y = 376; y < 492; y += 3.2) {
        for (let x = -10; x < W + 10; x += 3.2) {
          const px = x + rand() * 3.2, py = y + rand() * 3.2;
          if (!inside(px, py) || inField(px, py) || hill.occ(px) - py < 4) continue;
          const wood = smoothstep(0.52, 0.74, fbm(px / 40, py / 12, 62 + index)) * (0.5 + 0.5 * hillShade(hill, px));
          if (rand() > wood * 0.75) continue;
          layer.stroke([[px, py], [px + 1.4 + rand() * 1.6, py + (rand() - 0.5) * 0.4]], 0.8 + 0.4 * nearness, 0.26 + 0.24 * nearness, Math.floor(rand() * 3));
        }
      }
    }

    // Creeks: tree lines meandering down the draws toward the valley.
    if (index >= 2) {
      const draws = [];
      for (let x = 40; x < W - 40; x += 11) if (visibleDepth(hill, x) > 18 && !inTrees(x, hill.top(x), 6)) draws.push(x);
      for (let k = 0; k < Math.min(2, draws.length); k++) {
        let x = draws[Math.floor(rand() * draws.length)], y = hill.top(x) + 2;
        const heading = (rand() < 0.5 ? -1 : 1) * (1.4 + rand() * 0.8);
        for (let step = 0; step < 90; step++) {
          x += heading * (0.8 + 0.5 * Math.sin(step * 0.3 + k * 2)); y += 0.55 + 0.35 * Math.cos(step * 0.23 + k);
          if (!inside(x, y) || inField(x, y) || hill.occ(x) - y < 2) break;
          if (step % 2 === 0) farTree(layer, rand, x + (rand() - 0.5), y + (rand() - 0.5) * 0.6, 1.8 + rand() * 1.4 * nearness, 0.36 + 0.24 * nearness);
        }
      }
    }

    drawFields(layer, rand, hill, fields, inside, nearness);
    if (ranch) drawRanch(layer, rand, hill, inside, ranch);
  });
  return layer;
}

/** Pasture and plowed ground on the nearer distant slopes, where they show. */
function layFields(hill, rand, index) {
  const fields = [];
  for (let x = 480; x < W - 30; x += 24) {
    const depth = hill.occ(x) - hill.top(x);
    if (depth < 16 || inTrees(x, hill.top(x) + 6, 8)) continue;
    const width = 34 + rand() * 46;
    if (fields.some((f) => x < f.x1 + 10)) continue;
    const d0 = 4 + rand() * 4, d1 = Math.min(depth - 3, d0 + 9 + rand() * 12);
    const ok = [x, x + width / 2, x + width].every((px) => hill.occ(px) - hill.top(px) > d1 + 2);
    if (!ok || d1 - d0 < 6 || rand() < 0.25) continue;
    fields.push({ x0: x, x1: x + width, d0, d1, kind: ["rows", "stipple", "rows", "plain"][Math.floor(rand() * 4)], tilt: (rand() - 0.5) * 0.25, seed: index * 10 + fields.length });
  }
  return fields;
}

function drawFields(layer, rand, hill, fields, inside, nearness) {
  const opacity = 0.26 + 0.2 * nearness;
  for (const f of fields) {
    const at = (x, d) => [x, hill.top(x) + d + (x - f.x0) * f.tilt * 0.1];
    if (f.kind === "rows") {
      for (let d = f.d0 + 1.2; d < f.d1 - 0.6; d += 1.9) {
        const pts = [];
        for (let x = f.x0 + 1; x <= f.x1 - 1; x += 3) { const [px, py] = at(x, d); if (inside(px, py)) pts.push([px, py + (rand() - 0.5) * 0.25]); }
        if (pts.length > 1) layer.stroke(pts, 0.4, opacity * 0.9, Math.floor(rand() * 3));
      }
    } else if (f.kind === "stipple") {
      const count = (f.x1 - f.x0) * (f.d1 - f.d0) * 0.09;
      for (let i = 0; i < count; i++) {
        const [px, py] = at(lerp(f.x0 + 1, f.x1 - 1, rand()), lerp(f.d0 + 0.8, f.d1 - 0.8, rand()));
        if (inside(px, py)) layer.dot(px, py, 0.6, opacity);
      }
    }
    // A hedgerow along the lower edge.
    const hedge = (pts) => pts.forEach(([px, py]) => { if (inside(px, py) && rand() < 0.7) farTree(layer, rand, px, py, 1.5 + rand() * 1.3, opacity + 0.1); });
    hedge(Array.from({ length: Math.ceil((f.x1 - f.x0) / 2.6) }, (_, i) => at(f.x0 + i * 2.6 + (rand() - 0.5), f.d1)));
  }
}

/** The deepest open stretch of the nearest distant ridge, clear of fields and trees. */
function ranchSite(hill, fields) {
  let best = null;
  for (let x = 640; x < W - 60; x += 4) {
    const depth = hill.occ(x) - hill.top(x);
    const clear = !fields.some((f) => x > f.x0 - 30 && x < f.x1 + 30) && !inTrees(x, hill.top(x) + 10, 30);
    if (clear && (!best || depth > best.depth)) best = { x, depth };
  }
  if (!best || best.depth < 16) return null;
  return { x: best.x, y: hill.top(best.x) + Math.min(best.depth - 6, 12 + best.depth * 0.3) };
}

/** A small ranch: farmhouse, barn, an Aermotor windmill, a fence and a two-track road. */
function drawRanch(layer, rand, hill, inside, site) {
  const hx = site.x, hy = site.y;
  const k = 1.4; // the buildings read at footer size without outgrowing the distance
  const at = ([dx, dy]) => [hx + dx * k, hy + dy * k];
  // Buildings may stand against the farther ridge; only nearer hills and trees hide them.
  const shown = (x, y) => y < hill.occ(x) - 1 && !inTrees(x, y, 2);
  const ink = 0.62, line = (pts, w = 0.5, o = ink) => { const q = pts.map(at); if (q.every(([x, y]) => shown(x, y))) layer.stroke(q, w, o, 0); };
  // Farmhouse: lit gable end on the left, shaded side and a porch line.
  line([[-5, 0], [-5, -3.6], [-2.5, -6], [0, -3.6], [0, 0]]);
  line([[-2.5, -6], [5.5, -6.2], [7.5, -3.8], [0, -3.6]]);
  line([[0, 0], [7.5, 0], [7.5, -3.8]]);
  for (let t = 1; t < 7; t += 1.1) line([[t, -3.4], [t + 0.2, -0.3]], 0.45, 0.5);
  line([[-3.8, -1.2], [-3.8, -2.4]], 0.7, 0.7);
  // Barn with a gambrel roof, a little downhill.
  const b = (dx, dy) => [15 + dx, 2 + dy];
  line([b(0, 0), b(0, -4), b(1.2, -6.4), b(4, -7.6), b(6.8, -6.4), b(8, -4), b(8, 0), b(0, 0)]);
  line([b(2.6, 0), b(2.6, -2.8), b(5.4, -2.8), b(5.4, 0)], 0.45, 0.55);
  for (let t = 5.8; t < 8; t += 0.8) line([b(t, -3.8), b(t, -0.3)], 0.45, 0.5);
  // Windmill: a tapering lattice tower, a sixteen-blade wheel and a tail vane.
  const w = (dx, dy) => [-13 + dx, 0.5 + dy], height = 17;
  line([w(-2.2, 0), w(-0.5, -height)], 0.45); line([w(2.2, 0), w(0.5, -height)], 0.45);
  for (let j = 1; j < 4; j++) {
    const y = -height * j / 4, half = lerp(2.2, 0.5, j / 4), prev = -height * (j - 1) / 4, prevHalf = lerp(2.2, 0.5, (j - 1) / 4);
    line([w(-half, y), w(half, y)], 0.35, 0.5);
    line([w(-prevHalf, prev), w(half, y)], 0.3, 0.4);
  }
  for (let j = 0; j < 16; j++) {
    const a = (j / 16) * Math.PI * 2;
    line([w(Math.cos(a) * 0.8, -height + Math.sin(a) * 0.8), w(Math.cos(a) * 3.3, -height + Math.sin(a) * 3.3)], 0.3, 0.55);
  }
  line([w(0, -height), w(5.5, -height + 0.3), w(6.5, -height - 1.4), w(6.8, -height + 1.6), w(5.5, -height + 0.3)], 0.4, 0.6);
  line([w(2.5, 0), w(5.5, 0)], 0.9, 0.55); // stock tank
  // Shade trees by the house.
  for (const [dx, dy, size] of [[-7.5, 0.5, 3.4], [10.5, 0.8, 2.6], [-20, 1.5, 3]]) farTree(layer, rand, hx + dx * k, hy + dy * k, size * 1.2, 0.6);
  // Fence along the pasture, posts every few paces.
  const fence = [];
  for (let x = hx - 70; x <= hx + 80; x += 1.5) {
    const y = hill.top(x) + (hy - hill.top(hx)) + 6 + Math.sin(x / 40) * 1.2;
    if (inside(x, y) && inside(x, y - 2)) fence.push([x, y]);
    else if (fence.length) { if (fence.length > 3) layer.stroke(fence.splice(0), 0.35, 0.45, 1); else fence.length = 0; }
  }
  if (fence.length > 3) layer.stroke(fence, 0.35, 0.45, 1);
  for (let x = hx - 70; x <= hx + 80; x += 4.5) {
    const y = hill.top(x) + (hy - hill.top(hx)) + 6 + Math.sin(x / 40) * 1.2;
    if (inside(x, y) && inside(x, y - 2)) layer.stroke([[x, y + 0.6], [x, y - 1.6]], 0.4, 0.5, 2);
  }
  // A two-track road winding down from the house.
  for (const offset of [-0.9, 0.9]) {
    const road = [];
    for (let t = 0; t < 1; t += 0.04) {
      const x = hx + 4 + t * 55 + Math.sin(t * 5) * 6 + offset * 0.3, y = hy + 1 + t * 26 + offset;
      if (!inside(x, y)) break;
      road.push([x, y]);
    }
    if (road.length > 2) layer.stroke(road, 0.35, 0.4, 2);
  }
}

// ---------- MID HILLS ----------
function bush(layer, rand, x, y, r, opacity, inside) {
  // A small juniper: a dark scribbled mound, lit on the upper left.
  const rows = Math.max(2, Math.round(r * 1.3));
  for (let k = 0; k < rows; k++) {
    const v = ((k + 0.5) / rows) * 2 - 1;
    const half = r * Math.sqrt(1 - v * v) * (0.85 + rand() * 0.3);
    const yy = y + v * r * 0.62;
    const x0 = x - half + (v < 0 ? half * 0.45 * rand() : 0), x1 = x + half;
    if (!inside(x0, yy) || !inside(x1, yy)) continue;
    layer.stroke([[x0, yy + (rand() - 0.5) * 0.4], [(x0 + x1) / 2, yy - 0.35 + (rand() - 0.5) * 0.5], [x1, yy + (rand() - 0.5) * 0.4]], 0.75, opacity, k % 3);
  }
  // Cast shadow to the lower right.
  const shadow = [[x + r * 0.2, y + r * 0.8], [x + r * 1.5, y + r * 0.9]];
  if (inside(...shadow[1])) layer.stroke(shadow, 0.55, opacity * 0.6, 1);
}

function drawMid() {
  const layer = new Layer("mid"), rand = mulberry32(303);
  hills.filter((h) => h.layer === "mid").forEach((hill, index) => {
    const seed = 70 + index * 7;
    const inside = (x, y) => y > hill.top(x) + 0.6 && y < hill.occ(x) - 1 && !inTrees(x, y, 2.5);
    hatch(layer, rand, [-20, 395, W + 20, 610], 4.6, (x, y) => {
      if (!inside(x, y)) return null;
      const shade = hillShade(hill, x);
      const d = y - hill.top(x);
      const haze = 0.45 + 0.55 * smoothstep(0, 14, hill.occ(x) - y);
      const rim = shade > 0.5 ? 0.22 * Math.exp(-d / 7) : -0.18 * Math.exp(-d / 10);
      const patch = (fbm(x / 70, y / 26, seed) - 0.5) * 0.45;
      const tone = clamp(0.28 + 0.52 * shade + rim + patch) * haze;
      return tone < 0.04 ? null : {
        tone, per: 1.2, inside, length: 10 + rand() * 8,
        angle: (ax, ay) => contourAngle(hill, ax, ay, 55, seed),
        width: 0.6, opacity: 0.42 + 0.22 * shade,
        trace: { step: 2.6, wobble: 0.1, jitter: 0.35, bend: 0.035 },
      };
    });
    // Cross-hatching deepens the shaded flanks.
    hatch(layer, rand, [-20, 395, W + 20, 610], 5.2, (x, y) => {
      if (!inside(x, y)) return null;
      const shade = hillShade(hill, x);
      const tone = smoothstep(0.45, 1, shade) * (0.4 + 0.6 * fbm(x / 50, y / 30, seed + 2)) * smoothstep(0, 12, hill.occ(x) - y);
      return tone < 0.1 ? null : {
        tone, per: 0.9, inside, length: 7 + rand() * 5,
        angle: (ax, ay) => contourAngle(hill, ax, ay, 55, seed) + 0.75,
        width: 0.55, opacity: 0.4, trace: { step: 2.2, wobble: 0.06, jitter: 0.25 },
      };
    });
    // Limestone ledges: broken contour terraces on the lit slopes.
    for (let k = 1; k <= 7; k++) {
      const depth = k * 10.5 + (k > 3 ? (k - 3) * 3 : 0);
      let run = [];
      const flush = () => {
        if (run.length > 3) {
          layer.stroke(run, 0.65, 0.62, k % 3);
          layer.stroke(run.map(([x, y]) => [x + 0.8, y + 1.7]), 0.5, 0.38, (k + 1) % 3);
        }
        run = [];
      };
      for (let x = 0; x <= W; x += 3) {
        const y = hill.top(x) + depth * (1 + 0.25 * (fbm(x / 90, k, seed + 5) - 0.5));
        const ok = inside(x, y) && hillShade(hill, x) < 0.7 && fbm(x / 34, k * 3.1, seed + 9) > 0.52 && hill.occ(x) - y > 4;
        if (ok) run.push([x, y + (rand() - 0.5) * 0.4]); else flush();
      }
      flush();
    }
    // Crest line.
    let run = [];
    const flush = () => { if (run.length > 2) layer.stroke(run, 0.8, 0.72, 0); run = []; };
    for (let x = -10; x <= W + 10; x += 2.5) {
      const y = hill.top(x);
      const visible = y < hill.occ(x) - 1.5 && !inTrees(x, y, 2) && fbm(x / 30, index, seed + 11) > 0.24;
      if (visible) run.push([x, y + (rand() - 0.5) * 0.35]); else flush();
    }
    flush();
    // Juniper mottling: dark patches thickest on shaded slopes and along crests.
    const bushInside = (x, y) => y < hill.occ(x) - 1 && y > hill.top(x) - 5 && !inTrees(x, y, 2);
    for (let y = 400; y < 600; y += 5.5) {
      for (let x = -10; x < W + 10; x += 5.5) {
        const px = x + rand() * 5.5, py = y + rand() * 5.5;
        const d = py - hill.top(px);
        if (d < -1 || py > hill.occ(px) - 3 || inTrees(px, py, 3)) continue;
        const patch = smoothstep(0.52, 0.74, fbm(px / 62, py / 20, seed + 20));
        const crest = d < 6 ? 0.45 * smoothstep(0.45, 0.62, fbm(px / 60, 3, seed + 21)) : 0;
        const lone = 0.04;
        const p = (patch * (0.6 + 0.4 * hillShade(hill, px)) + crest) * 0.8 + lone;
        if (rand() > p) continue;
        const r = 1.3 + rand() * 1.6 + patch * rand() * 3.2 + d * 0.012;
        bush(layer, rand, px, py, r, 0.6 + rand() * 0.25, bushInside);
      }
    }
  });
  return layer;
}

// ---------- NEAR: ground, trail, rocks, trees, hikers ----------
function drawNear() {
  const layer = new Layer("near"), rand = mulberry32(404);
  const rocks = [];
  for (let i = 0; i < 44; i++) {
    const x = rand() * W, t = Math.pow(rand(), 0.7);
    const y = lerp(ground.top(x) + 6, H - 4, t);
    const size = 3 + (y - ground.top(x)) / (H - ground.top(x)) * 18 * (0.4 + rand());
    if (inTrees(x, y - size, 4) || trailHit(x, y) || inHikers(x, y, 10)) continue;
    if (rocks.some((r) => Math.hypot(r.x - x, r.y - y) < r.w + size + 6)) continue;
    const n = 7, pts = [];
    for (let k = 0; k < n; k++) {
      const a = Math.PI + (k / (n - 1)) * Math.PI; // upper half outline, left to right
      const rr = size * (0.62 + rand() * 0.6);
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * (0.32 + rand() * 0.2)]);
    }
    rocks.push({ x, y, w: size, pts });
  }
  const inRock = (x, y, pad = 0) => rocks.some((r) => Math.abs(x - r.x) < r.w + pad && y > r.y - r.w * 0.55 - pad && y < r.y + 1 + pad);

  const shadows = [
    { x: 116, y: 440, rx: 100, ry: 14 }, { x: 440, y: 466, rx: 150, ry: 17 }, { x: 606, y: 502, rx: 38, ry: 6 }, { x: 662, y: 515, rx: 22, ry: 4 },
  ];
  const shadowAt = (x, y) => shadows.reduce((m, s) => Math.max(m, 1 - Math.hypot((x - s.x) / s.rx, (y - s.y) / s.ry)), 0);

  const groundInside = (x, y) => y > ground.top(x) + 0.6 && y < H + 4 && x > -20 && x < W + 20 && !inTrees(x, y, 1.5) && !inRock(x, y, 1) && !inHikers(x, y, 1.5);
  hatch(layer, rand, [-20, 400, W + 20, H + 4], 5.7, (x, y) => {
    if (!groundInside(x, y)) return null;
    const top = ground.top(x);
    const t = clamp((y - top) / (H - top));
    const trail = trailHit(x, y);
    const shadow = smoothstep(0, 0.35, shadowAt(x, y));
    let tone = 0.17 + 0.24 * fbm(x / 110, y / 40, 90) + 0.05 * t;
    tone += 0.12 * Math.exp(-(y - top) / 5) * smoothstep(0.02, 0.2, slopeOf(ground.top, x, 20));
    if (trail) tone *= 0.04 + 0.5 * smoothstep(0.8, 1, trail.edge);
    tone = clamp(tone + shadow * 0.75);
    return {
      tone, per: 0.9, inside: groundInside, length: 11 + 28 * t,
      angle: (ax, ay) => {
        const tt = clamp((ay - ground.top(ax)) / (H - ground.top(ax)));
        return Math.atan(slopeOf(ground.top, ax, 30) * (1 - tt * 0.55) + 0.05 * tt) + (fbm(ax / 70, ay / 40, 91) - 0.5) * 0.6;
      },
      width: 0.62 + 0.3 * t, opacity: 0.45 + 0.25 * t + 0.1 * shadow,
      trace: { step: 3, wobble: 0.12, jitter: 0.4, bend: 0.04 },
    };
  });
  // Shadow cross-hatch under the trees.
  hatch(layer, rand, [0, 420, 700, 530], 4, (x, y) => {
    const s = shadowAt(x, y);
    if (s <= 0 || !groundInside(x, y)) return null;
    return { tone: smoothstep(0, 0.4, s), per: 1.2, inside: (ax, ay) => groundInside(ax, ay) && shadowAt(ax, ay) > 0, length: 9, angle: () => -0.5, width: 0.6, opacity: 0.6, trace: { step: 2.2, wobble: 0.05 } };
  });
  // Crest of the near slope, where it meets the distance.
  let run = [];
  const flush = () => { if (run.length > 2) layer.stroke(run, 0.95, 0.8, 0); run = []; };
  for (let x = -10; x <= W + 10; x += 2.5) {
    const y = ground.top(x);
    if (!inTrees(x, y, 2) && fbm(x / 36, 2, 95) > 0.22) run.push([x, y + (rand() - 0.5) * 0.35]); else flush();
  }
  flush();

  // Trail: faint worn edges and a few pebbles.
  for (const side of [-1, 1]) {
    let edge = [];
    const flushEdge = () => { if (edge.length > 2) layer.stroke(edge, 0.7, 0.6, 2); edge = []; };
    for (let s = 0; s <= 1; s += 0.004) {
      const [x, y] = trailAt(s), [x2, y2] = trailAt(Math.min(1, s + 0.004));
      const nx = -(y2 - y), ny = x2 - x, l = Math.hypot(nx, ny) || 1;
      const half = trailWidth(s) / 2;
      const ex = x + (nx / l) * half * side, ey = y + (ny / l) * half * side;
      if (fbm(s * 30, side, 97) > 0.3 && groundInside(ex, ey) && !inHikers(ex, ey, 4)) edge.push([ex + (rand() - 0.5) * 0.6, ey + (rand() - 0.5) * 0.6]); else flushEdge();
    }
    flushEdge();
  }
  for (let i = 0; i < 34; i++) {
    const s = rand() * 0.7, [x, y] = trailAt(s), half = trailWidth(s) / 2;
    const px = x + (rand() - 0.5) * half * 1.6, py = y + (rand() - 0.5) * half * 0.5;
    if (groundInside(px, py)) layer.dot(px, py, 0.7 + (1 - s) * 0.9, 0.45);
  }

  // Limestone rocks: pale tops, hatched shaded faces, shadows to the right.
  for (const r of rocks) {
    layer.stroke(r.pts, 0.75, 0.8, 0);
    layer.stroke([r.pts[0], [r.x - r.w * 0.2, r.y + 0.6], [r.pts.at(-1)[0], r.y + 0.4]], 0.8, 0.8, 1);
    for (let k = 0; k < r.w * 0.8; k++) {
      const x = lerp(r.x - r.w * 0.1, r.x + r.w * 0.9, rand());
      const topY = r.y - r.w * 0.45 * Math.sqrt(1 - Math.min(1, Math.abs(x - r.x) / r.w));
      layer.stroke([[x, lerp(topY, r.y, 0.35)], [x + 0.4, r.y - 0.3]], 0.55, 0.6, k % 3);
    }
    layer.stroke([[r.x + r.w * 0.3, r.y + 1.3], [r.x + r.w * 1.9, r.y + 1.6]], 0.6, 0.55, 2);
  }

  // Grass tufts and a few seed heads, larger toward the viewer.
  for (let i = 0; i < 520; i++) {
    const x = rand() * W, top = ground.top(x), t = Math.pow(rand(), 0.8);
    const y = lerp(top + 3, H + 2, t);
    if (!groundInside(x, y) || trailHit(x, y) || rand() > smoothstep(0.4, 0.65, fbm(x / 70, y / 30, 93))) continue;
    const size = 2.5 + t * 9 * (0.4 + rand() * 0.8);
    const blades = 2 + Math.floor(rand() * 5);
    const lean = (rand() - 0.5) * 0.7;
    for (let b = 0; b < blades; b++) {
      const a = -Math.PI / 2 + lean + (b / (blades - 1) - 0.5) * (0.8 + rand() * 0.7) + (rand() - 0.5) * 0.35;
      const l = size * (0.6 + rand() * 0.5), bend = (rand() - 0.3) * 0.5;
      const mx = x + Math.cos(a) * l * 0.5, my = y + Math.sin(a) * l * 0.5;
      layer.stroke([[x + (b - blades / 2) * 0.6, y], [mx, my], [mx + Math.cos(a + bend) * l * 0.5, my + Math.sin(a + bend) * l * 0.5]], 0.55 + t * 0.2, 0.65, b % 3);
    }
  }

  // Scattered cedar clumps far down the slope.
  const farBush = (x, y) => y > ground.top(x) - 5 && !inTrees(x, y, 2) && !inHikers(x, y, 4);
  for (let i = 0; i < 46; i++) {
    const x = 700 + rand() * 900, y = ground.top(x) + rand() * 18;
    if (trailHit(x, y) || inHikers(x, y, 8) || fbm(x / 80, 5, 98) < 0.45) continue;
    bush(layer, rand, x, y, 2.4 + rand() * 2.4, 0.72, farBush);
  }

  // Live oak limbs: outlined bark, shaded on the right.
  const canopyGap = (x, y) => {
    const hit = oak.shape(x, y);
    return !hit || (hit.ny > 0.25 && fbm(x / 13, y / 13, 99) > 0.6);
  };
  for (const limb of oakLimbs) {
    for (const side of [-1, 1]) {
      const edge = [];
      for (let i = 0; i < limb.pts.length - 1; i++) {
        const [ax, ay] = limb.pts[i], [bx, by] = limb.pts[i + 1];
        const len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len;
        for (let t = 0; t < 1; t += 0.2) {
          const r = lerp(limb.w[i], limb.w[i + 1], t) / 2 * (1 + 0.12 * (vnoise(i * 5 + t * 5, side, 100) - 0.5));
          const x = lerp(ax, bx, t) + nx * r * side, y = lerp(ay, by, t) + ny * r * side;
          if (canopyGap(x, y)) edge.push([x, y]);
        }
      }
      if (edge.length > 1) layer.stroke(edge, 0.9, 0.85, side > 0 ? 0 : 1);
    }
  }
  hatch(layer, rand, [160, 300, 480, 456], 2, (x, y) => {
    const hit = limbHit(x, y);
    if (!hit || !canopyGap(x, y)) return null;
    const tone = 0.3 + 0.7 * smoothstep(-0.4, 0.9, hit.across * (hit.limb === oakLimbs[0] ? 1 : -1));
    const [ax, ay] = hit.limb.pts[hit.i], [bx, by] = hit.limb.pts[hit.i + 1];
    const dir = Math.atan2(by - ay, bx - ax);
    return { tone, per: 1, inside: (px, py) => Boolean(limbHit(px, py)) && canopyGap(px, py), length: 5 + rand() * 6, angle: () => dir + (rand() - 0.5) * 0.2, width: 0.6, opacity: 0.75, trace: { step: 1.6, wobble: 0.04, jitter: 0.2 } };
  });
  // Root flare.
  for (const [dx, len] of [[-16, 14], [-8, 8], [10, 10], [17, 16]]) {
    layer.stroke([[344 + dx * 0.6, 450], [344 + dx, 456], [344 + dx + Math.sign(dx) * len, 459]], 0.8, 0.8, 0);
  }

  // Foliage: scribbled leaf texture per clump, lit upper left, heavy undersides.
  const drawCrown = (tree, { cell, base, weight, under, holes, curl = 3, hidden = () => false }) => {
    const [top, bottom] = [tree.box[1], tree.box[3]];
    const within = (px, py) => Boolean(tree.shape(px, py)) && !hidden(px, py);
    hatch(layer, rand, tree.box, cell, (x, y) => {
      const hit = tree.shape(x, y);
      if (!hit || hidden(x, y)) return null;
      if (holes && hit.ny > 0.25 && fbm(x / 13, y / 13, 99) > 0.6) return null; // sky holes show the limbs
      const light = hit.nx * 0.62 + hit.ny * 0.78; // + faces away from the upper-left sun
      const low = smoothstep(lerp(top, bottom, 0.35), bottom, y);
      let tone = base + weight * smoothstep(-0.6, 0.8, light) + under * low + (fbm(x / 16, y / 16, tree.seed + 101) - 0.5) * 0.5;
      if (hit.cover < 0.12 && hit.nx < 0 && hit.ny < 0) tone *= 0.55;
      tone = clamp(tone);
      return { tone, per: 1, inside: within, length: curl * (1 + rand()), angle: () => rand() * Math.PI * 2, width: 0.6, opacity: 0.55 + 0.4 * tone, trace: { step: 1.2, wobble: 0.5, jitter: 0.4, bend: 0.35 } };
    });
    // Scalloped undersides where one clump overhangs the next.
    for (const c of tree.clumps) {
      let arc = [];
      const flush = () => { if (arc.length > 2) layer.stroke(arc, 0.7, 0.65, c.k % 3); arc = []; };
      for (let a = 0.3; a <= Math.PI - 0.3; a += 0.16) {
        const x = c.x + Math.cos(a) * c.r * 0.92, y = c.y + Math.sin(a) * c.r * 0.92;
        const hit = tree.shape(x, y + 2.5);
        if ((!hit || hit.c === c) && !hidden(x, y)) arc.push([x, y]); else flush();
      }
      flush();
    }
  };
  drawCrown(oak, { cell: 2.6, base: 0.3, weight: 0.47, under: 0.37, holes: true, curl: 3.2 });

  // Ashe junipers: denser and darker than the oak, foliage down to the ground.
  junipers.forEach((tree, i) => {
    const front = junipers.slice(i + 1);
    const hidden = (px, py) => front.some((t) => inBox(t.box, px, py, 0) && t.shape(px, py));
    drawCrown(tree, { cell: 2.25, base: 0.6, weight: 0.5, under: 0.3, holes: false, curl: 2.7, hidden });
  });

  // Hikers heading up the trail, lower right.
  for (const f of hikers) {
    const s = f.h / 16, x = f.x, y = f.y, stride = 2.5 * s * (f.phase ? 1 : -1);
    const hip = [x - 0.2 * s, y - 7 * s], shoulder = [x + 0.7 * s, y - 12.2 * s];
    layer.stroke([hip, [hip[0] + stride * 0.55 + 0.4 * s, y - 3.6 * s], [x + stride, y]], 1.7 * s, 0.9, 0);
    layer.stroke([hip, [hip[0] - stride * 0.35 - 0.2 * s, y - 3.4 * s], [x - stride * 0.8, y]], 1.7 * s, 0.9, 0);
    layer.stroke([hip, shoulder], 3.3 * s, 0.9, 0);
    layer.stroke([[x - 1.1 * s, y - 11.4 * s], [x - 1.2 * s, y - 7.8 * s]], 3.4 * s, 0.9, 0); // pack
    layer.dot(x + 1.3 * s, y - 14.3 * s, 3.1 * s, 0.9);
    layer.stroke([shoulder, [x + 2.6 * s, y - 8.6 * s]], 1.2 * s, 0.9, 0);
    layer.stroke([[x + 2.6 * s, y - 9.6 * s], [x + 4.3 * s, y + 0.2]], 0.6, 0.85, 0); // walking stick
    layer.stroke([[x - 2.5 * s, y + 0.8], [x + 6 * s, y + 1.1]], 0.7, 0.5, 1);
  }
  return layer;
}

// ---------- write ----------
mkdirSync(OUT, { recursive: true });
const layers = [drawSky(), drawFar(), drawMid(), drawNear()];
let total = 0;
for (const layer of layers) {
  const svg = layer.svg();
  writeFileSync(join(OUT, `${layer.name}.svg`), svg);
  total += svg.length;
  console.log(`${layer.name}.svg  ${layer.strokes} strokes  ${(svg.length / 1024).toFixed(1)} KB`);
}
console.log(`total ${(total / 1024).toFixed(1)} KB`);
