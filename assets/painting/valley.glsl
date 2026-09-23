#version 300 es
// The life page's valley, after the Hudson River School: a still lake under autumn trees, a
// wooded point and meadows across the water, foothills, and rolling blue ranges beyond.
// Raymarched in meters (x right, y up, z away from the viewer, who stands on the near bank).
// Each layer renders on its own so the descent can raise them at different rates: a layer sees
// only its own geometry and whatever lies behind it, and keeps the pixels its geometry wins.
precision highp float;
precision highp int;

uniform vec2 uRes;
uniform int uLayer;
uniform int uSamples;

layout(location = 0) out vec4 outColor; // display color, premultiplied
layout(location = 1) out vec4 outAux;   // x: distance, which sets the brush size

const int SKY = 0;
const int RANGE = 1;
const int HILLS = 2;
const int NEAR = 3;
const int ALL = 4;

const vec3 CAM = vec3(0.0, 3.0, 0.0);
const float PITCH = 0.05;
const float HFOV = 0.6; // tan of half the horizontal field of view
const vec3 SUN = normalize(vec3(-0.88, 0.40, 0.25));
const vec3 SUN_COLOR = vec3(1.0, 0.8, 0.58) * 2.9;
const vec3 AMBIENT = vec3(0.34, 0.44, 0.62);

float pixelAngle;
float seed;

// ---------- noise ----------
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec3 hash33(vec3 p3) { p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}

float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), u.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), u.x), u.y),
    mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), u.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), u.x), u.y),
    u.z);
}

const mat2 TURN = mat2(0.8, -0.6, 0.6, 0.8);

float fbm(vec2 p, int octaves) {
  float sum = 0.0, amp = 0.5, norm = 0.0;
  for (int i = 0; i < 10; i++) {
    if (i >= octaves) break;
    sum += amp * noise(p);
    norm += amp;
    p = TURN * p * 2.03 + vec2(1.7, 9.2);
    amp *= 0.5;
  }
  return sum / norm;
}

float fbm3(vec3 p, int octaves) {
  float sum = 0.0, amp = 0.5, norm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += amp * noise3(p);
    norm += amp;
    p = p * 2.02 + vec3(3.1, 1.7, 5.3);
    amp *= 0.5;
  }
  return sum / norm;
}

float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }

float cone(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

// Autumn, from summer green (0) through gold and orange to deep red (1).
vec3 autumn(float w) {
  w = clamp(w, 0.0, 1.0) * 5.0;
  vec3 c0 = vec3(0.060, 0.100, 0.030);
  vec3 c1 = vec3(0.170, 0.180, 0.040);
  vec3 c2 = vec3(0.500, 0.300, 0.040);
  vec3 c3 = vec3(0.640, 0.210, 0.025);
  vec3 c4 = vec3(0.440, 0.060, 0.022);
  vec3 c5 = vec3(0.270, 0.035, 0.022);
  if (w < 1.0) return mix(c0, c1, w);
  if (w < 2.0) return mix(c1, c2, w - 1.0);
  if (w < 3.0) return mix(c2, c3, w - 2.0);
  if (w < 4.0) return mix(c3, c4, w - 3.0);
  return mix(c4, c5, w - 4.0);
}

// ---------- ground ----------
// Distance past the right bank's edge: positive on land.
float rightShore(vec2 p) { return p.x - (2.0 + 0.32 * p.y + 4.0 * (noise(vec2(p.y * 0.05, 2.3)) - 0.5)); }

// Rough signed distance to the lake's edge, positive on land.
float shore(vec2 p) {
  float far = p.y - (170.0 + 40.0 * (fbm(vec2(p.x * 0.012, 7.1), 3) - 0.5));
  float point = 22.0 * (1.0 - length((p - vec2(-50.0, 112.0)) / vec2(30.0, 22.0))) + 8.0 * (noise(p * 0.08) - 0.5);
  return max(max(rightShore(p), far), point);
}

// The lake bed, its banks, and the meadows beyond.
float banks(vec2 p) {
  float s = shore(p);
  float rolls = fbm(p * 0.025, 3);
  return mix(-1.5, 0.3 + 1.6 * rolls * smoothstep(0.0, 30.0, s), smoothstep(-4.0, 4.0, s));
}

// Foothills rise beyond the meadows, higher to the sides so the middle opens toward the ranges.
float foothills(vec2 p) {
  if (p.y < 200.0) return 0.0;
  float rise = smoothstep(260.0, 1800.0, p.y);
  float side = 0.45 + 0.8 * smoothstep(0.1, 0.55, abs(p.x / p.y + 0.08));
  float n = fbm(p * vec2(1.0 / 640.0, 1.0 / 380.0) + vec2(4.2, 1.3), 5);
  float h = smoothstep(0.25, 0.8, n);
  return h * h * 260.0 * rise * side * (1.0 - smoothstep(2600.0, 3600.0, p.y));
}

// Rolling ranges: three rounded ridgelines one behind another, each farther one higher so it
// shows over the last, blue with distance.
float range(vec2 p) {
  if (p.y < 2300.0) return 0.0;
  float h = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float axis = 4600.0 + 3600.0 * fk + 900.0 * sin(p.x / 2600.0 + fk * 1.7);
    float crest = (520.0 + 480.0 * fk) * max(0.25, (fbm(vec2(p.x / (1500.0 + 400.0 * fk) + fk * 7.1, fk), 4) - 0.18) * 1.9);
    float across = (p.y - axis) / (1700.0 + 700.0 * fk);
    h = max(h, crest * exp(-across * across * 1.4));
  }
  // Spurs and hollows for the light to model.
  h += (fbm(p / 650.0 + 3.0, 5) - 0.5) * 0.32 * h;
  return h * smoothstep(2400.0, 4800.0, p.y);
}

// Woods across the foothills, open meadow between.
float woods(vec2 p) {
  float hills = smoothstep(0.44, 0.52, fbm(p * 0.0032 + vec2(1.3, 8.1), 4)) * smoothstep(380.0, 520.0, p.y);
  return hills;
}

// One dome per tree across the woods. x: dome height 0..1, y: the tree's own random.
vec2 crowns(vec2 p) {
  vec2 g = p / 6.0;
  vec2 i = floor(g), f = fract(g);
  float best = 9.0, id = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(x, y);
      vec2 d = o + 0.15 + 0.7 * hash22(i + o) - f;
      float dd = dot(d, d);
      if (dd < best) { best = dd; id = hash12(i + o + 17.3); }
    }
  }
  return vec2(sqrt(max(0.0, 1.0 - best * 1.7)), id);
}

// The height the woods add. Far away, where single crowns fall under a pixel, an even roof.
float woodsHeight(vec2 p, float lod) {
  float w = woods(p);
  if (w <= 0.0) return 0.0;
  float roof = w * 10.0;
  if (lod > 3.0) return roof;
  vec2 c = crowns(p);
  return mix(w * (8.0 + 5.0 * c.y) * (0.6 + 0.4 * c.x), roof, smoothstep(1.2, 3.0, lod));
}

// The height of whatever ground a layer sees: the range, then the hills and lake bed, then the
// near bank. `owner` is the layer that raised it.
float ground(vec2 p, int maxL, float lod, out int owner) {
  owner = RANGE;
  float h = range(p);
  if (maxL >= HILLS) {
    float hills = banks(p) + foothills(p) + woodsHeight(p, lod);
    if (hills > h) { h = hills; owner = HILLS; }
  }
  if (maxL >= NEAR && p.y < 120.0 && rightShore(p) > -6.0) {
    float bank = banks(p) + 0.3 + 1.4 * smoothstep(0.0, 10.0, rightShore(p));
    if (bank > h) { h = bank; owner = NEAR; }
  }
  return h;
}

float marchGround(vec3 ro, vec3 rd, float tMax, int maxL, out int owner) {
  float t = 0.5, last = t;
  owner = -1;
  for (int i = 0; i < 420; i++) {
    vec3 p = ro + rd * t;
    float d = p.y - ground(p.xz, maxL, t * pixelAngle, owner);
    if (d < 0.0) {
      float a = last, b = t;
      for (int j = 0; j < 8; j++) {
        float m = 0.5 * (a + b);
        vec3 q = ro + rd * m;
        if (q.y - ground(q.xz, maxL, m * pixelAngle, owner) < 0.0) b = m; else a = m;
      }
      vec3 q = ro + rd * b;
      ground(q.xz, maxL, b * pixelAngle, owner);
      return b;
    }
    if (t > tMax || (rd.y > 0.0 && p.y > 2100.0)) break;
    last = t;
    t += clamp(0.4 * d, 0.02 + 0.0015 * t, 80.0 + 0.02 * t);
  }
  owner = -1;
  return -1.0;
}

vec3 groundNormal(vec2 p, int maxL, float lod) {
  float e = max(0.03, lod * 0.7);
  int o;
  float hx = ground(p + vec2(e, 0.0), maxL, lod, o) - ground(p - vec2(e, 0.0), maxL, lod, o);
  float hz = ground(p + vec2(0.0, e), maxL, lod, o) - ground(p - vec2(0.0, e), maxL, lod, o);
  return normalize(vec3(-hx, 2.0 * e, -hz));
}

// ---------- trees ----------
const int TREES = 46;
// x, z, height, crown radius
const vec4 TREE_SHAPE[TREES] = vec4[TREES](
  // the near bank, framing the right
  vec4(13.2, 27.0, 23.0, 6.8), vec4(21.0, 31.0, 25.0, 7.4), vec4(18.5, 39.0, 20.0, 6.0),
  vec4(19.5, 48.0, 16.0, 5.2), vec4(25.0, 63.0, 15.0, 5.2), vec4(31.0, 82.0, 17.0, 5.6),
  // bushes along it
  vec4(11.8, 24.0, 2.2, 1.8), vec4(13.4, 29.5, 2.6, 2.0), vec4(15.6, 36.0, 2.4, 1.9),
  vec4(17.4, 43.0, 2.8, 2.2), vec4(20.0, 53.0, 2.6, 2.0),
  // the wooded point on the left
  vec4(-33.0, 101.0, 16.0, 6.0), vec4(-41.0, 109.0, 20.0, 7.0), vec4(-50.0, 103.0, 18.0, 6.6),
  vec4(-59.0, 114.0, 21.0, 7.4), vec4(-46.0, 121.0, 17.0, 6.4), vec4(-68.0, 107.0, 19.0, 6.8),
  vec4(-27.0, 111.0, 11.0, 4.6), vec4(-37.0, 118.0, 14.0, 5.6), vec4(-55.0, 125.0, 16.0, 6.0),
  vec4(-75.0, 118.0, 22.0, 7.4), vec4(-64.0, 97.0, 12.0, 5.0),
  vec4(-24.0, 104.0, 3.0, 2.4), vec4(-30.0, 95.0, 3.4, 2.6), vec4(-41.0, 95.0, 3.0, 2.4),
  // scattered across the far shore
  vec4(-18.0, 198.0, 11.0, 5.0), vec4(31.0, 204.0, 14.0, 5.4), vec4(37.0, 209.0, 9.0, 4.4),
  vec4(-24.0, 206.0, 8.0, 4.0), vec4(-45.0, 205.0, 15.0, 6.0), vec4(-54.0, 199.0, 10.0, 5.0),
  vec4(52.0, 222.0, 16.0, 6.0), vec4(60.0, 214.0, 12.0, 5.2), vec4(9.0, 236.0, 7.0, 3.6),
  // undergrowth along the point's edge and the far shore
  vec4(-22.0, 100.0, 2.6, 2.2), vec4(-28.0, 108.0, 2.4, 2.0), vec4(-36.0, 97.0, 2.8, 2.4),
  vec4(-48.0, 93.0, 2.6, 2.2), vec4(-58.0, 95.0, 3.0, 2.6), vec4(-70.0, 99.0, 2.6, 2.2),
  vec4(-8.0, 191.0, 2.4, 2.4), vec4(6.0, 195.0, 2.2, 2.2), vec4(20.0, 199.0, 2.8, 2.6),
  vec4(44.0, 206.0, 2.6, 2.4), vec4(-34.0, 202.0, 2.6, 2.4), vec4(-62.0, 206.0, 2.4, 2.2)
);
// seed, warmth (green 0 .. red 1), crown depth (share of the height in leaf), layer
const vec4 TREE_LOOK[TREES] = vec4[TREES](
  vec4(1.0, 0.26, 0.74, 3.0), vec4(2.0, 0.38, 0.72, 3.0), vec4(3.0, 0.82, 0.72, 3.0),
  vec4(4.0, 0.58, 0.70, 3.0), vec4(5.0, 0.68, 0.68, 3.0), vec4(6.0, 0.46, 0.66, 3.0),
  vec4(41.0, 0.12, 1.0, 3.0), vec4(42.0, 0.30, 1.0, 3.0), vec4(43.0, 0.06, 1.0, 3.0),
  vec4(44.0, 0.40, 1.0, 3.0), vec4(45.0, 0.18, 1.0, 3.0),
  vec4(7.0, 0.58, 0.84, 2.0), vec4(8.0, 0.86, 0.80, 2.0), vec4(9.0, 0.44, 0.86, 2.0),
  vec4(10.0, 0.70, 0.78, 2.0), vec4(11.0, 0.22, 0.88, 2.0), vec4(12.0, 0.52, 0.82, 2.0),
  vec4(13.0, 0.92, 0.9, 2.0), vec4(14.0, 0.62, 0.86, 2.0), vec4(15.0, 0.34, 0.84, 2.0),
  vec4(16.0, 0.48, 0.76, 2.0), vec4(17.0, 0.76, 0.9, 2.0),
  vec4(34.0, 0.40, 1.0, 2.0), vec4(35.0, 0.70, 1.0, 2.0), vec4(36.0, 0.25, 1.0, 2.0),
  vec4(18.0, 0.50, 0.84, 2.0), vec4(19.0, 0.70, 0.84, 2.0), vec4(20.0, 0.16, 0.84, 2.0),
  vec4(21.0, 0.86, 0.84, 2.0), vec4(22.0, 0.60, 0.84, 2.0), vec4(23.0, 0.30, 0.84, 2.0),
  vec4(24.0, 0.76, 0.84, 2.0), vec4(25.0, 0.44, 0.84, 2.0), vec4(26.0, 0.64, 0.84, 2.0),
  vec4(51.0, 0.30, 1.0, 2.0), vec4(52.0, 0.62, 1.0, 2.0), vec4(53.0, 0.14, 1.0, 2.0),
  vec4(54.0, 0.48, 1.0, 2.0), vec4(55.0, 0.22, 1.0, 2.0), vec4(56.0, 0.70, 1.0, 2.0),
  vec4(57.0, 0.36, 1.0, 2.0), vec4(58.0, 0.10, 1.0, 2.0), vec4(59.0, 0.56, 1.0, 2.0),
  vec4(60.0, 0.28, 1.0, 2.0), vec4(61.0, 0.80, 1.0, 2.0), vec4(62.0, 0.18, 1.0, 2.0)
);

const int LIMBS = 5;

// Where limb k of tree i ends: a lobe of the crown gathers there. Limb 0 is the leader, at the top.
vec3 limbEnd(int i, int k) {
  vec4 s = TREE_SHAPE[i];
  float seedT = TREE_LOOK[i].x, depth = TREE_LOOK[i].z;
  vec3 h = hash33(vec3(seedT, float(k), 11.0));
  vec2 lean = (hash22(vec2(seedT, 3.1)) - 0.5) * 0.12 * s.z;
  if (k == 0) return vec3(lean.x, s.z - s.w * 0.5, lean.y);
  float a = (float(k) + 0.7 * h.x) * 6.2832 / float(LIMBS - 1);
  float reach = s.w * (0.5 + 0.35 * h.y);
  float y = s.z * (1.0 - depth * (0.72 - 0.45 * h.z));
  return vec3(cos(a) * reach + lean.x * 0.7, y, sin(a) * reach * 0.85 + lean.y * 0.7);
}


// The crown's envelope: a lobe at the end of each limb, joined. Negative inside.
float crownLobes(vec3 q, int i) {
  vec4 s = TREE_SHAPE[i];
  float d = 1e5;
  for (int k = 0; k < LIMBS; k++) {
    vec3 e = limbEnd(i, k);
    float r = s.w * (0.5 + 0.18 * hash13(vec3(TREE_LOOK[i].x, float(k), 12.0)));
    d = smin(d, length((q - e) / vec3(1.0, 0.82, 1.0)) - r, s.w * 0.35);
  }
  return d;
}

// How big one cluster of leaves is on tree i.
float clusterSize(int i) { return clamp(TREE_SHAPE[i].w * 0.09, 0.34, 0.6); }

// Clusters of leaves fill the crown, one to a cell of a 3D grid: some cells stand empty, and the
// clusters shrink toward the envelope's edge, so a crown is dabs of leaves with sky and shade
// between them. Whether a cluster exists, and its size, depend only on where its center sits, so
// the shape holds still as a ray marches through it. tag: the nearest cluster's own random.
float leafClusters(vec3 q, int i, out float tag) {
  float R = TREE_SHAPE[i].w;
  float size = clusterSize(i);
  vec3 g = q / size + TREE_LOOK[i].x * 7.31;
  vec3 ip = floor(g), f = g - ip;
  float d = 1e5;
  tag = 0.0;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 o = vec3(x, y, z);
        vec3 h = hash33(ip + o);
        if (h.z < 0.1) continue;
        vec3 local = o + 0.15 + 0.7 * h - f;
        float edge = crownLobes(q + local * size, i) + (h.x - 0.5) * R * 0.25;
        if (edge > 0.0) continue;
        float r = size * (0.42 + 0.26 * h.y) * (0.5 + 0.5 * smoothstep(0.0, -R * 0.4, edge));
        float dc = length(local) * size - r;
        if (dc < d) { d = dc; tag = h.y; }
      }
    }
  }
  return d;
}

// Distance to one tree. mat: 1 leaves, 2 bark.
float treeDist(vec3 p, int i, out int mat) {
  vec4 s = TREE_SHAPE[i];
  float seedT = TREE_LOOK[i].x, H = s.z, R = s.w, depth = TREE_LOOK[i].z;
  vec3 q = p - vec3(s.x, 0.0, s.y);
  vec3 bounds = vec3(R * 1.3, H * 0.56, R * 1.3);
  float k = length((q - vec3(0.0, H * 0.5, 0.0)) / bounds);
  mat = 0;
  // Outside its bounds a tree is at least this far off; far enough out that even a small bush's
  // bounds never pass for the bush.
  if (k > 1.6) return (k - 1.1) * min(bounds.x, bounds.y);

  // A trunk that forks into limbs, one to each lobe of the crown; each limb puts out branches
  // toward the crown's edge, and those put out twigs.
  vec2 lean = (hash22(vec2(seedT, 3.1)) - 0.5) * 0.12 * H;
  float forkY = H * (1.0 - depth) * 0.95;
  vec3 fork = vec3(lean.x * 0.4, forkY, lean.y * 0.4);
  float bark = cone(q, vec3(0.0, -2.0, 0.0), fork, H * 0.021, H * 0.012);
  for (int k = 0; k < LIMBS; k++) {
    vec3 to = limbEnd(i, k);
    bark = min(bark, cone(q, fork, to, H * 0.01, H * 0.0035));
    for (int b = 0; b < 3; b++) {
      vec3 h = hash33(vec3(seedT, float(k), 6.0 + float(b)));
      vec3 from = mix(fork, to, 0.35 + 0.5 * h.x);
      vec3 tip = from + normalize(h - 0.5 + vec3(0.0, 0.35, 0.0)) * R * (0.45 + 0.35 * h.y);
      bark = min(bark, cone(q, from, tip, H * 0.005, H * 0.0012));
      vec3 twig = mix(from, tip, 0.6) + normalize(hash33(h * 13.0) - 0.5) * R * 0.25;
      bark = min(bark, cone(q, mix(from, tip, 0.6), twig, H * 0.0022, H * 0.0008));
    }
  }
  // Furrows in the bark.
  if (bark < 0.3) bark += (noise3(q * vec3(11.0, 1.2, 11.0)) - 0.5) * 0.045 + (noise3(q * 30.0) - 0.5) * 0.008;

  float size = clusterSize(i);
  float lobes = crownLobes(q, i);
  float leaves;
  // Well outside the crown its envelope is a safe step, kept far enough out that a distant ray
  // can't mistake it for the leaves.
  if (lobes > R * 0.13 + size * 2.5) {
    leaves = lobes - R * 0.13 - size * 0.8;
  } else {
    float tag;
    leaves = leafClusters(q, i, tag);
    // The leaves themselves, ruffling each cluster's edge.
    leaves += (noise3(q * (7.0 / size)) - 0.5) * size * 0.3 + (noise3(q * (2.4 / size) + 3.0) - 0.5) * size * 0.3;
  }
  mat = leaves < bark ? 1 : 2;
  return min(leaves, bark);
}

// Boulders at the water's edge: x, z, radius, layer.
const int ROCKS = 6;
const vec4 ROCK_AT[ROCKS] = vec4[ROCKS](
  vec4(7.4, 20.5, 1.0, 3.0), vec4(8.9, 25.0, 0.7, 3.0), vec4(10.6, 31.5, 1.25, 3.0),
  vec4(-21.5, 103.0, 1.4, 2.0), vec4(-24.5, 96.5, 0.9, 2.0), vec4(-31.0, 92.5, 1.1, 2.0)
);

float rockDist(vec3 p, int r) {
  vec4 k = ROCK_AT[r];
  vec3 q = p - vec3(k.x, -0.35 * k.z, k.y);
  float d = length(q / vec3(1.25, 0.7, 1.0)) * 0.7 - k.z * 0.7;
  if (d > 0.5) return d;
  return d + (fbm3(q * 1.6 + float(r) * 3.1, 4) - 0.5) * k.z * 0.45;
}

// A tree (ids 0..TREES-1) or a boulder (100 and up).
float objectDist(vec3 p, int id, out int mat) {
  if (id >= 100) { mat = 3; return rockDist(p, id - 100); }
  return treeDist(p, id, mat);
}

float trees(vec3 p, int maxL, out int id, out int mat) {
  float d = 1e5;
  id = -1;
  mat = 0;
  for (int i = 0; i < TREES; i++) {
    if (int(TREE_LOOK[i].w) > maxL) continue;
    int m;
    float di = treeDist(p, i, m);
    if (di < d) { d = di; id = i; mat = m; }
  }
  for (int r = 0; r < ROCKS; r++) {
    if (int(ROCK_AT[r].w) > maxL) continue;
    float dr = rockDist(p, r);
    if (dr < d) { d = dr; id = 100 + r; mat = 3; }
  }
  return d;
}

float marchTrees(vec3 ro, vec3 rd, float tMax, int maxL, out int id, out int mat) {
  float t = 0.0;
  for (int i = 0; i < 260; i++) {
    float d = trees(ro + rd * t, maxL, id, mat);
    if (d < 0.004 + 0.0015 * t) return t;
    t += d * 0.5;
    if (t > tMax) break;
  }
  id = -1;
  return -1.0;
}

vec3 treeNormal(vec3 p, int i) {
  const vec2 e = vec2(0.03, -0.03);
  int m;
  return normalize(e.xyy * objectDist(p + e.xyy, i, m) + e.yyx * objectDist(p + e.yyx, i, m) +
                   e.yxy * objectDist(p + e.yxy, i, m) + e.xxx * objectDist(p + e.xxx, i, m));
}

float treeOcclusion(vec3 p, vec3 n, int i) {
  float occ = 0.0, scale = 1.0;
  for (int k = 1; k <= 5; k++) {
    float h = 0.6 * float(k);
    int m;
    occ += (h - objectDist(p + n * h, i, m)) * scale;
    scale *= 0.75;
  }
  return clamp(1.0 - 0.35 * occ, 0.25, 1.0);
}

// ---------- reeds ----------
// Clumps in the shallows by the right bank: x, z, size.
// The last six are tall grass along the bank's edge.
const int REED_CLUMPS = 11;
const vec3 REEDS[REED_CLUMPS] = vec3[REED_CLUMPS](
  vec3(4.8, 12.0, 1.0), vec3(6.3, 14.5, 0.85), vec3(5.0, 17.0, 0.75), vec3(3.4, 13.6, 0.8), vec3(7.4, 19.0, 0.7),
  vec3(7.0, 12.5, 0.5), vec3(7.9, 15.5, 0.55), vec3(8.8, 18.5, 0.5), vec3(10.4, 23.0, 0.55), vec3(13.2, 33.0, 0.55), vec3(17.6, 47.0, 0.55)
);

// Distance to the reeds. tag.x: the blade's own random; tag.y: 1 on a cattail's head.
float reeds(vec3 p, out vec2 tag) {
  float d = 1e5;
  tag = vec2(0.0);
  for (int c = 0; c < REED_CLUMPS; c++) {
    bool grass = c >= 5;
    vec3 q = p - vec3(REEDS[c].x, grass ? 0.3 : -0.4, REEDS[c].y);
    float bound = length(q.xz) - 1.8;
    if (bound > 0.3 || q.y > 3.6) { d = min(d, max(bound, q.y - 3.4)); continue; }
    for (int j = 0; j < 30; j++) {
      vec3 h = hash33(vec3(float(c), float(j), 7.0));
      vec3 base = vec3((h.x - 0.5) * 1.3, 0.0, (h.y - 0.5) * 0.9);
      float len = (1.4 + 1.4 * h.z) * REEDS[c].z;
      vec3 lean = vec3((h.y - 0.45) * 1.1, 0.0, (h.x - 0.5) * 0.45);
      // Each blade bends more toward its tip.
      vec3 p1 = base + lean * 0.06 + vec3(0.0, len * 0.35, 0.0);
      vec3 p2 = base + lean * 0.35 + vec3(0.0, len * 0.7, 0.0);
      vec3 p3 = base + lean + vec3(0.0, len * 0.96, 0.0);
      float w = grass ? 0.012 : 0.02;
      float blade = min(cone(q, base, p1, w, w * 0.8), min(cone(q, p1, p2, w * 0.8, w * 0.45), cone(q, p2, p3, w * 0.45, 0.002)));
      if (blade < d) { d = blade; tag = vec2(h.z, grass ? 2.0 : 0.0); }
      if (!grass && fract(h.x * 17.3) > 0.8) {
        float head = cone(q, mix(p2, p3, 0.3), mix(p2, p3, 0.58), 0.042, 0.038);
        if (head < d) { d = head; tag = vec2(h.z, 1.0); }
      }
    }
  }
  return d;
}

float marchReeds(vec3 ro, vec3 rd, float t, float tMax) {
  vec2 tag;
  for (int i = 0; i < 140; i++) {
    float d = reeds(ro + rd * t, tag);
    if (d < 0.002) return t;
    t += d * 0.8;
    if (t > tMax) break;
  }
  return -1.0;
}

// ---------- sky ----------
vec3 skyColor(vec3 rd) {
  float y = max(rd.y, 0.0);
  vec3 col = mix(vec3(0.52, 0.63, 0.80), vec3(0.07, 0.17, 0.46), pow(y, 0.5));
  float s = max(dot(rd, SUN), 0.0);
  col += vec3(1.0, 0.72, 0.42) * (0.22 * pow(s, 4.0) + 0.45 * pow(s, 40.0));
  return mix(col, vec3(0.92, 0.84, 0.70), 0.4 * exp(-y * 14.0));
}

const float CLOUD_LO = 1300.0;
const float CLOUD_HI = 3400.0;

// Cumulus, one heap to a cell or none: a flat base, a dome of two or three puffs, billows on top.
float cloudDensity(vec3 p, int octaves) {
  if (p.y <= CLOUD_LO || p.y >= CLOUD_HI) return 0.0;
  // None right overhead: the heaps thin out toward the viewer and sit out over the valley.
  float away = smoothstep(6000.0, 12500.0, length(p.xz));
  if (away <= 0.0) return 0.0;
  const float CELL = 3400.0;
  // Warp the field so no two heaps share a silhouette.
  vec2 w = p.xz + (vec2(fbm(p.xz * 0.0004, 3), fbm(p.xz * 0.0004 + 5.2, 3)) - 0.5) * 1400.0;
  vec2 g = w / CELL;
  vec2 i = floor(g);
  float dome = -1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 c = i + vec2(x, y);
      if (hash12(c + 7.3) > 0.5) continue;
      vec2 h = hash22(c);
      float r = 650.0 + 800.0 * hash12(c + 2.1);
      float tall = r * (0.5 + 0.55 * hash12(c + 5.9));
      vec2 center = (c + 0.2 + 0.6 * h) * CELL;
      float base = CLOUD_LO + 450.0 * hash12(c + 8.8);
      for (int k = 0; k < 3; k++) {
        vec2 o = (hash22(c + float(k) * 3.7) - 0.5) * r * 1.3;
        float s = k == 0 ? 1.0 : 0.55 + 0.25 * hash12(c + float(k));
        vec2 local = (w - center - o) / (r * s);
        float up = (p.y - base) / (tall * s);
        dome = max(dome, up < 0.0 ? -1.0 + up * 40.0 : 1.0 - dot(local, local) - up * up);
      }
    }
  }
  if (dome < -0.4) return 0.0;
  vec3 q = p * 0.0019;
  float billow = 0.0, amp = 0.5, norm = 0.0;
  for (int j = 0; j < 7; j++) {
    if (j >= octaves) break;
    billow += amp * (1.0 - abs(2.0 * noise3(q) - 1.0));
    norm += amp;
    q = q * 2.07 + vec3(1.3, 3.1, 2.7);
    amp *= 0.5;
  }
  billow /= norm;
  float d = dome + (billow - 0.62) * 1.05;
  return smoothstep(0.0, 0.2, d - (1.0 - away) * 0.6);
}

float phase(float mu, float g) { return (1.0 - g * g) / (12.566 * pow(1.0 + g * g - 2.0 * g * mu, 1.5)); }

// Cumulus above: premultiplied light, and what light from behind gets through.
vec4 clouds(vec3 ro, vec3 rd) {
  if (rd.y < 0.015) return vec4(0.0, 0.0, 0.0, 1.0);
  float t0 = (CLOUD_LO - ro.y) / rd.y;
  float t1 = min((CLOUD_HI - ro.y) / rd.y, t0 + 30000.0);
  if (t0 > 90000.0) return vec4(0.0, 0.0, 0.0, 1.0);
  const int STEPS = 110;
  float dt = (t1 - t0) / float(STEPS);
  float mu = dot(rd, SUN);
  float ph = mix(phase(mu, 0.65), phase(mu, -0.15), 0.35) * 12.566;
  float T = 1.0;
  vec3 col = vec3(0.0);
  for (int i = 0; i < STEPS; i++) {
    vec3 p = ro + rd * (t0 + dt * (float(i) + seed));
    float d = cloudDensity(p, 7);
    if (d <= 0.001) continue;
    float optical = 0.0, ls = 70.0;
    for (int j = 0; j < 6; j++) {
      optical += cloudDensity(p + SUN * ls * (float(j) + 0.5), 3) * ls;
      ls *= 1.5;
    }
    float sigma = d * 0.011;
    float h = (p.y - CLOUD_LO) / (CLOUD_HI - CLOUD_LO);
    vec3 sun = SUN_COLOR * exp(-optical * 0.02) * ph * mix(1.0, 1.0 - exp(-optical * 0.04), 0.5);
    vec3 amb = mix(vec3(0.36, 0.40, 0.49), vec3(0.74, 0.8, 0.94), h);
    vec3 S = (sun + amb) * sigma;
    float tr = exp(-sigma * dt);
    col += T * (S - S * tr) / sigma;
    T *= tr;
    if (T < 0.01) break;
  }
  // Far heaps sink into the haze at the horizon.
  float fade = exp(-t0 * 0.000025);
  return vec4(col * fade, 1.0 - (1.0 - T) * fade);
}

// Cirrus far above the heaps: thin, combed out by the wind.
vec3 cirrus(vec3 rd, vec3 base) {
  if (rd.y < 0.02) return base;
  vec2 p = rd.xz / rd.y * 9000.0;
  vec2 q = vec2(p.x * 0.00012 + p.y * 0.00003, p.y * 0.00045);
  float streaks = fbm(q + fbm(q * 3.0, 3) * 0.6, 6);
  float wisp = smoothstep(0.58, 0.8, streaks) * smoothstep(0.02, 0.2, rd.y) * smoothstep(0.35, 0.62, fbm(p * 0.00005 + 4.0, 3));
  vec3 lit = mix(vec3(0.95, 0.93, 0.9), vec3(1.0, 0.86, 0.66), pow(max(dot(rd, SUN), 0.0), 3.0));
  return mix(base, lit * 1.05, wisp * 0.42);
}

vec3 sky(vec3 ro, vec3 rd) {
  vec4 c = clouds(ro, rd);
  return cirrus(rd, skyColor(rd)) * c.a + c.rgb;
}

// ---------- air ----------
vec3 applyAir(vec3 col, vec3 ro, vec3 rd, float t) {
  const float a = 0.0001, b = 0.0009;
  float dy = abs(rd.y) < 1e-4 ? 1e-4 : rd.y;
  float fog = a / b * exp(-ro.y * b) * (1.0 - exp(-t * dy * b)) / dy;
  float amount = 1.0 - exp(-max(fog, 0.0));
  float s = pow(max(dot(rd, SUN), 0.0), 6.0);
  vec3 haze = mix(vec3(0.36, 0.49, 0.76), vec3(1.0, 0.82, 0.58), 0.06 + 0.75 * s);
  return mix(col, haze, amount);
}

// Shadows the heaps cast across the land, looking up the sun's ray to the clouds.
float cloudShadow(vec3 p) {
  float h = CLOUD_LO + 350.0;
  vec3 c = p + SUN * ((h - p.y) / SUN.y);
  return 1.0 - 0.6 * smoothstep(0.0, 0.45, cloudDensity(c, 3));
}

// ---------- shading ----------
float groundShadow(vec3 ro) {
  float res = 1.0, t = 0.5;
  for (int i = 0; i < 80; i++) {
    vec3 p = ro + SUN * t;
    if (p.y > 2100.0) break;
    int o;
    float h = p.y - ground(p.xz, NEAR, t * pixelAngle, o);
    res = min(res, 10.0 * h / t);
    if (res < 0.0) return 0.0;
    t += clamp(0.5 * h, 0.2 + 0.01 * t, 250.0);
  }
  return clamp(res, 0.0, 1.0);
}

float treeShadow(vec3 ro) {
  float res = 1.0, t = 0.3;
  for (int i = 0; i < 72; i++) {
    int id, m;
    float d = trees(ro + SUN * t, NEAR, id, m);
    res = min(res, 5.0 * d / t);
    if (res < 0.01) return 0.0;
    t += clamp(d, 0.15, 8.0);
    if (t > 160.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

vec3 leafColor(vec3 p, int i) {
  vec4 s = TREE_SHAPE[i];
  vec3 q = p - vec3(s.x, 0.0, s.y);
  float tag;
  leafClusters(q, i, tag);
  float size = clusterSize(i);
  // Each cluster its own shade of the tree's color, and a speckle of single leaves across it.
  float w = TREE_LOOK[i].y + (tag - 0.5) * 0.42 + (fbm3(q * (0.9 / s.w) + TREE_LOOK[i].x, 2) - 0.5) * 0.4;
  float leaf = noise3(q * (9.0 / size));
  w += (leaf - 0.5) * 0.18;
  vec3 c = autumn(w);
  c = mix(c, vec3(dot(c, vec3(0.3, 0.55, 0.15))), 0.14);
  return c * (0.62 + 0.62 * leaf);
}

vec3 shadeTree(vec3 p, vec3 rd, int i, int mat) {
  vec3 n = treeNormal(p, i);
  float occ = treeOcclusion(p, n, i);
  float sh = treeShadow(p + n * 0.2);
  if (sh > 0.0) sh *= groundShadow(p + n * 0.2);
  vec3 albedo;
  float diff;
  if (mat == 1) {
    albedo = leafColor(p, i);
    diff = clamp(dot(n, SUN) * 0.75 + 0.25, 0.0, 1.0);
    vec3 q = p - vec3(TREE_SHAPE[i].x, 0.0, TREE_SHAPE[i].y);
    occ *= 0.5 + 0.5 * smoothstep(-TREE_SHAPE[i].w * 0.8, -TREE_SHAPE[i].w * 0.05, crownLobes(q, i));
  } else if (mat == 3) {
    // Granite, lichened on top, dark and wet where it meets the water.
    float grain = fbm3(p * 3.0, 4);
    albedo = mix(vec3(0.09, 0.085, 0.08), vec3(0.22, 0.2, 0.18), grain);
    albedo = mix(albedo, vec3(0.3, 0.3, 0.2), smoothstep(0.55, 0.7, fbm3(p * 1.7 + 5.0, 3)) * smoothstep(0.2, 0.8, n.y) * 0.7);
    albedo *= mix(0.45, 1.0, smoothstep(0.02, 0.25, p.y));
    diff = max(dot(n, SUN), 0.0);
  } else {
    vec3 q = p - vec3(TREE_SHAPE[i].x, 0.0, TREE_SHAPE[i].y);
    float streak = noise3(q * vec3(11.0, 1.2, 11.0)) * 0.7 + noise3(q * 5.0) * 0.3;
    albedo = mix(vec3(0.028, 0.024, 0.02), vec3(0.11, 0.095, 0.08), streak);
    // Lichen and moss in patches, on the shaded side more than the lit.
    float lichen = smoothstep(0.55, 0.75, fbm3(q * 1.3, 3)) * (0.6 - 0.4 * dot(n, SUN));
    albedo = mix(albedo, vec3(0.16, 0.17, 0.12), clamp(lichen, 0.0, 0.8));
    diff = max(dot(n, SUN), 0.0);
  }
  vec3 light = SUN_COLOR * diff * sh + AMBIENT * (0.5 + 0.4 * n.y) * occ + vec3(0.16, 0.12, 0.06) * (0.5 - 0.5 * n.y) * occ;
  vec3 col = albedo * light;
  if (mat == 1) {
    // Sun through the leaves, looking toward it.
    float back = pow(max(dot(rd, SUN), 0.0), 2.0);
    col += albedo * SUN_COLOR * back * sh * 0.55 * occ;
    // Leaves glow a little even in shade: daylight through them.
    col += albedo * (AMBIENT * 0.35 + SUN_COLOR * 0.05) * occ;
  }
  return col;
}

vec3 shadeGround(vec3 p, vec3 rd, float t, int owner) {
  float lod = t * pixelAngle;
  vec3 n = groundNormal(p.xz, owner, lod);
  float sh = groundShadow(p + n * max(0.1, lod));
  if (p.z < 280.0 && sh > 0.0) sh *= treeShadow(p + n * 0.1);
  sh *= cloudShadow(p);
  vec3 albedo;
  bool leafy = false;
  if (owner == RANGE) {
    float rock = smoothstep(0.35, 0.75, 1.0 - n.y);
    vec3 forest = mix(vec3(0.03, 0.05, 0.035), vec3(0.11, 0.075, 0.045), fbm(p.xz * 0.0018, 4));
    // Stands of turned trees, and the grain of single crowns.
    forest = mix(forest, vec3(0.2, 0.09, 0.035), smoothstep(0.58, 0.72, fbm(p.xz * 0.0055 + 2.0, 3)) * 0.8);
    forest *= 0.75 + 0.5 * fbm(p.xz * 0.025, 3);
    albedo = mix(forest, vec3(0.16, 0.15, 0.14), rock * 0.35);
  } else {
    float base = banks(p.xz) + foothills(p.xz);
    float w = woods(p.xz);
    if (w > 0.01 && p.y - base > 1.5) {
      leafy = true;
      vec2 c = crowns(p.xz);
      float stage = fbm(p.xz * 0.0025 + 9.0, 3);
      float warm = mix(c.y, stage, 0.5) * 1.1 - 0.05;
      albedo = autumn(warm) * (0.75 + 0.25 * c.x) * 0.85;
      // Evergreens in dark patches.
      albedo = mix(albedo, vec3(0.03, 0.055, 0.03), smoothstep(0.58, 0.66, fbm(p.xz * 0.004 + 3.0, 3)) * 0.8);
    } else {
      float s = shore(p.xz);
      float g = fbm(p.xz * 0.06, 4) + (fbm(p.xz * vec2(2.2, 0.7), 3) - 0.5) * smoothstep(80.0, 20.0, t) * 0.6;
      albedo = mix(vec3(0.10, 0.11, 0.035), vec3(0.30, 0.22, 0.065), smoothstep(0.3, 0.7, g));
      albedo = mix(albedo, vec3(0.28, 0.14, 0.05), 0.35 * smoothstep(0.55, 0.75, fbm(p.xz * 0.2, 3)));
      if (owner == NEAR) {
        // Tussocks and the grain of the grass, fine enough to read as brushwork up close.
        albedo *= 0.55 + 0.6 * fbm(p.xz * vec2(3.0, 1.2), 4);
        albedo *= 0.7 + 0.6 * noise(p.xz * vec2(16.0, 5.0)) * noise(p.xz * vec2(5.0, 19.0) + 3.0);
        albedo = mix(albedo, vec3(0.3, 0.2, 0.08), 0.3 * smoothstep(0.6, 0.8, fbm(p.xz * 0.9, 3)));
      }
      albedo = mix(vec3(0.06, 0.045, 0.03), albedo, smoothstep(-1.0, 3.0, s));
    }
  }
  float diff = leafy ? clamp(dot(n, SUN) * 0.65 + 0.35, 0.0, 1.0) : max(dot(n, SUN), 0.0);
  vec3 light = SUN_COLOR * diff * sh + AMBIENT * (0.45 + 0.55 * n.y) + vec3(0.12, 0.1, 0.05) * (1.0 - n.y);
  vec3 col = albedo * light;
  if (leafy) col += albedo * SUN_COLOR * pow(max(dot(rd, SUN), 0.0), 2.0) * sh * 0.4;
  return col;
}

vec3 shadeReed(vec3 p, vec3 rd) {
  const vec2 e = vec2(0.01, -0.01);
  vec2 tag;
  vec3 n = normalize(e.xyy * reeds(p + e.xyy, tag) + e.yyx * reeds(p + e.yyx, tag) + e.yxy * reeds(p + e.yxy, tag) + e.xxx * reeds(p + e.xxx, tag));
  reeds(p, tag);
  float sh = treeShadow(p + n * 0.05);
  // Green at the water, straw toward the tips; some blades already turned; cattails brown.
  vec3 green = mix(vec3(0.06, 0.08, 0.03), vec3(0.13, 0.15, 0.05), tag.x);
  vec3 straw = mix(vec3(0.3, 0.23, 0.09), vec3(0.44, 0.33, 0.13), fract(tag.x * 7.1));
  float turned = tag.y > 1.5 ? 0.75 : 0.45;
  vec3 albedo = mix(green, straw, smoothstep(0.2, 2.6, p.y) * (turned + (1.0 - turned) * fract(tag.x * 3.3)));
  albedo *= 0.65 + 0.55 * noise3(p * vec3(3.0, 11.0, 3.0));
  albedo *= mix(0.55, 1.0, smoothstep(0.0, 0.6, p.y));
  if (tag.y > 0.5 && tag.y < 1.5) albedo = vec3(0.11, 0.055, 0.03) * (0.8 + 0.4 * noise3(p * 40.0));
  float diff = clamp(dot(n, SUN) * 0.6 + 0.4, 0.0, 1.0);
  return albedo * (SUN_COLOR * diff * sh + AMBIENT * 0.8);
}

// What the still water mirrors: everything, but no second reflection.
vec3 reflection(vec3 ro, vec3 rd) {
  int owner;
  float tg = marchGround(ro, rd, 40000.0, NEAR, owner);
  int id, mat;
  float tt = marchTrees(ro, rd, tg > 0.0 ? min(tg, 420.0) : 420.0, NEAR, id, mat);
  float tr = ro.z < 58.0 ? marchReeds(ro, rd, 0.02, tt > 0.0 ? min(tt, 8.0) : 8.0) : -1.0;
  vec3 col;
  float t;
  if (tr > 0.0) { t = tr; col = shadeReed(ro + rd * t, rd); }
  else if (tt > 0.0) { t = tt; col = shadeTree(ro + rd * t, rd, id, mat); }
  else if (tg > 0.0) { t = tg; col = shadeGround(ro + rd * t, rd, t, owner); }
  else return sky(ro, rd);
  return applyAir(col, ro, rd, t);
}

// Leaves adrift, thicker under the trees on the right bank. rgb, coverage.
vec4 driftingLeaves(vec2 p, float t) {
  float fade = smoothstep(70.0, 25.0, t);
  if (fade <= 0.0) return vec4(0.0);
  float density = 0.3 * exp(-max(-rightShore(p), 0.0) / 5.0) * smoothstep(90.0, 30.0, p.y);
  vec2 g = p / 0.5;
  vec2 i = floor(g), f = fract(g);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(x, y);
      if (hash12(i + o + 5.1) > density) continue;
      vec2 h = hash22(i + o);
      vec2 d = o + h - f;
      float a = h.x * 6.283;
      d = mat2(cos(a), -sin(a), sin(a), cos(a)) * d;
      if (length(d / vec2(0.26, 0.13)) < 1.0) {
        vec3 c = autumn(0.35 + 0.65 * hash12(i + o + 9.3)) * 1.2;
        return vec4(c, fade);
      }
    }
  }
  return vec4(0.0);
}

// Lily pads in the shallows by the reeds: rgb, coverage. Each a disc with its notch.
vec4 lilyPads(vec2 p) {
  float zone = smoothstep(3.6, 1.2, abs(p.x - 3.8)) * smoothstep(8.0, 11.0, p.y) * smoothstep(27.0, 19.0, p.y);
  if (zone <= 0.0) return vec4(0.0);
  vec2 g = p / 0.75;
  vec2 i = floor(g), f = fract(g);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(x, y);
      vec3 h = hash33(vec3(i + o, 4.2));
      if (h.z > zone * 0.32) continue;
      vec2 d = o + 0.2 + 0.6 * h.xy - f;
      float a = h.x * 6.283;
      d = mat2(cos(a), -sin(a), sin(a), cos(a)) * d;
      float r = length(d), radius = 0.26 + 0.14 * h.y;
      if (r > radius || (d.x > 0.0 && abs(d.y) < d.x * 0.35)) continue;
      vec3 c = mix(vec3(0.05, 0.08, 0.03), vec3(0.14, 0.14, 0.05), h.y);
      c = mix(c, vec3(0.2, 0.08, 0.04), step(0.85, fract(h.y * 9.1)));
      c *= 0.8 + 0.5 * smoothstep(radius * 0.75, radius, r);
      return vec4(c, 1.0);
    }
  }
  return vec4(0.0);
}

vec3 shadeWater(vec3 p, vec3 rd, float t) {
  // Long, low ripples stretch the reflections down the water, calmer with distance.
  vec2 q = p.xz * vec2(0.35, 1.7);
  float e = 0.04;
  float amp = 0.018 / (1.0 + t * 0.03);
  float h0 = fbm(q, 4);
  vec3 n = normalize(vec3(-(fbm(q + vec2(e, 0.0), 4) - h0) / e * amp * 0.35, 1.0, -(fbm(q + vec2(0.0, e), 4) - h0) / e * amp * 1.7));
  vec3 r = reflect(rd, n);
  r.y = abs(r.y);
  vec3 refl = reflection(p + vec3(0.0, 0.02, 0.0), r);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
  vec3 col = mix(vec3(0.02, 0.026, 0.02), refl * 0.92, clamp(0.55 + fres, 0.0, 0.95));
  vec4 pad = lilyPads(p.xz);
  if (pad.a > 0.0) {
    float sh = treeShadow(p + vec3(0.0, 0.05, 0.0));
    return mix(col, pad.rgb * (SUN_COLOR * 0.75 * sh + AMBIENT * 0.9), pad.a);
  }
  vec4 leaf = driftingLeaves(p.xz, t);
  if (leaf.a > 0.0) {
    float sh = treeShadow(p + vec3(0.0, 0.05, 0.0));
    col = mix(col, leaf.rgb * (SUN_COLOR * 0.7 * sh + AMBIENT), leaf.a);
  }
  return col;
}

// ---------- camera ----------
vec3 rayDir(vec2 frag) {
  vec2 uv = (frag - 0.5 * uRes) / (0.5 * uRes.x);
  vec3 d = normalize(vec3(uv * HFOV, 1.0));
  float c = cos(PITCH), s = sin(PITCH);
  return vec3(d.x, d.y * c + d.z * s, -d.y * s + d.z * c);
}

vec4 render(vec3 rd, out float dist) {
  dist = 1e5;
  if (uLayer == SKY) return vec4(sky(CAM, rd), 1.0);
  int maxL = uLayer == ALL ? NEAR : uLayer;
  int owner;
  float t = marchGround(CAM, rd, 40000.0, maxL, owner);
  int kind = t > 0.0 ? 1 : 0; // 1 ground, 2 water, 3 tree, 4 reeds
  if (maxL >= HILLS && rd.y < 0.0) {
    float tw = -CAM.y / rd.y;
    if (t < 0.0 || tw < t) { t = tw; kind = 2; owner = HILLS; }
  }
  int id = -1, mat = 0;
  if (maxL >= HILLS) {
    float tt = marchTrees(CAM, rd, t > 0.0 ? min(t, 420.0) : 420.0, maxL, id, mat);
    if (tt > 0.0) { t = tt; kind = 3; owner = id >= 100 ? int(ROCK_AT[id - 100].w) : int(TREE_LOOK[id].w); }
  }
  if (maxL >= NEAR) {
    float tr = marchReeds(CAM, rd, 8.0, t > 0.0 ? min(t, 62.0) : 62.0);
    if (tr > 0.0) { t = tr; kind = 4; owner = NEAR; }
  }
  if (kind == 0) return uLayer == ALL ? vec4(sky(CAM, rd), 1.0) : vec4(0.0);
  if (uLayer != ALL && owner != uLayer) return vec4(0.0);
  vec3 p = CAM + rd * t;
  vec3 col = kind == 1 ? shadeGround(p, rd, t, owner)
           : kind == 2 ? shadeWater(p, rd, t)
           : kind == 3 ? shadeTree(p, rd, id, mat)
           : shadeReed(p, rd);
  dist = t;
  return vec4(applyAir(col, CAM, rd, t), 1.0);
}

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

// Tone and palette: a warm, varnished glow, shadows toward umber rather than black.
vec3 display(vec3 c) {
  c = aces(c * 0.95);
  c = pow(c, vec3(1.0 / 2.2));
  c = mix(vec3(0.07, 0.05, 0.03), vec3(1.0), c);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.06);
  return c * vec3(1.02, 1.0, 0.95);
}

void main() {
  pixelAngle = 2.0 * HFOV / uRes.x;
  int n = max(uSamples, 1);
  vec4 sum = vec4(0.0);
  float nearest = 1e5;
  for (int sy = 0; sy < 4; sy++) {
    if (sy >= n) break;
    for (int sx = 0; sx < 4; sx++) {
      if (sx >= n) break;
      vec2 o = (vec2(sx, sy) + 0.5) / float(n);
      seed = hash12(gl_FragCoord.xy * 1.7 + o * 13.0);
      float dist;
      vec4 c = render(rayDir(gl_FragCoord.xy - 0.5 + o), dist);
      sum += vec4(display(c.rgb) * c.a, c.a);
      nearest = min(nearest, dist);
    }
  }
  outColor = sum / float(n * n);
  outAux = vec4(clamp(log2(1.0 + nearest) / log2(1.0 + 30000.0), 0.0, 1.0), 0.0, 0.0, 1.0);
}
