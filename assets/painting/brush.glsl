// Brushes a render into paint with an anisotropic Kuwahara filter (Kyprianidis et al.): each
// pixel takes the calmest of eight sectors of an ellipse stretched along the local grain, so
// flat areas become strokes that follow the forms. Passes are split by the `//// name` lines.

//// tensor
#version 300 es
// The structure tensor, from Sobel gradients of the color.
precision highp float;
uniform sampler2D uSrc;
out vec4 outColor;

vec3 at(ivec2 p) { return texelFetch(uSrc, clamp(p, ivec2(0), textureSize(uSrc, 0) - 1), 0).rgb; }

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 gx = (at(p + ivec2(1, -1)) + 2.0 * at(p + ivec2(1, 0)) + at(p + ivec2(1, 1))
           - at(p + ivec2(-1, -1)) - 2.0 * at(p + ivec2(-1, 0)) - at(p + ivec2(-1, 1))) * 0.25;
  vec3 gy = (at(p + ivec2(-1, 1)) + 2.0 * at(p + ivec2(0, 1)) + at(p + ivec2(1, 1))
           - at(p + ivec2(-1, -1)) - 2.0 * at(p + ivec2(0, -1)) - at(p + ivec2(1, -1))) * 0.25;
  outColor = vec4(dot(gx, gx), dot(gy, gy), dot(gx, gy), 1.0);
}

//// blur
#version 300 es
// One direction of a Gaussian, to smooth the tensor into a steady grain.
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uDir;
uniform float uSigma;
out vec4 outColor;

void main() {
  ivec2 size = textureSize(uSrc, 0);
  ivec2 p = ivec2(gl_FragCoord.xy);
  int r = int(ceil(uSigma * 2.5));
  vec4 sum = vec4(0.0);
  float norm = 0.0;
  for (int i = -r; i <= r; i++) {
    float w = exp(-0.5 * float(i * i) / (uSigma * uSigma));
    sum += w * texelFetch(uSrc, clamp(p + ivec2(uDir) * i, ivec2(0), size - 1), 0);
    norm += w;
  }
  outColor = sum / norm;
}

//// kuwahara
#version 300 es
precision highp float;
uniform sampler2D uSrc; // premultiplied color
uniform sampler2D uTfm; // smoothed structure tensor
uniform sampler2D uAux; // x: distance
uniform vec2 uRadius;   // brush radius in pixels, near and far
uniform float uSharp;
out vec4 outColor;

void main() {
  ivec2 size = textureSize(uSrc, 0);
  ivec2 pix = ivec2(gl_FragCoord.xy);
  vec3 g = texelFetch(uTfm, pix, 0).xyz;
  float E = g.x, G = g.y, F = g.z;
  float disc = sqrt((E - G) * (E - G) + 4.0 * F * F);
  float l1 = 0.5 * (E + G + disc), l2 = 0.5 * (E + G - disc);
  vec2 v0 = vec2(l1 - E, -F);
  vec2 t = length(v0) > 0.0 ? normalize(v0) : vec2(0.0, 1.0);
  float phi = -atan(t.y, t.x);
  float A = l1 + l2 > 0.0 ? (l1 - l2) / (l1 + l2) : 0.0;

  float radius = mix(uRadius.x, uRadius.y, smoothstep(0.3, 0.85, texelFetch(uAux, pix, 0).x));
  float a = radius * clamp(1.0 + A, 0.1, 2.0);
  float b = radius * clamp(1.0 / (1.0 + A), 0.1, 2.0);
  float c = cos(phi), s = sin(phi);
  mat2 SR = mat2(1.0 / a, 0.0, 0.0, 1.0 / b) * mat2(c, -s, s, c);
  int mx = int(sqrt(a * a * c * c + b * b * s * s));
  int my = int(sqrt(a * a * s * s + b * b * c * c));

  // Polynomial sector weights: overlap near the center, envelope of 3π/16 either side.
  float zeta = 2.0 / radius;
  float env = 3.0 * 3.14159265 / 16.0;
  float eta = (zeta + cos(env)) / (sin(env) * sin(env));

  vec4 m[8];
  vec3 sq[8];
  for (int k = 0; k < 8; k++) { m[k] = vec4(0.0); sq[k] = vec3(0.0); }
  float al[8];
  for (int k = 0; k < 8; k++) al[k] = 0.0;

  for (int j = -my; j <= my; j++) {
    for (int i = -mx; i <= mx; i++) {
      vec2 v = SR * vec2(i, j);
      float dd = dot(v, v);
      if (dd > 1.0) continue;
      vec4 col = texelFetch(uSrc, clamp(pix + ivec2(i, j), ivec2(0), size - 1), 0);
      float w[8];
      float z, vxx, vyy, sum = 0.0;
      vxx = zeta - eta * v.x * v.x;
      vyy = zeta - eta * v.y * v.y;
      z = max(0.0, v.y + vxx); w[0] = z * z; sum += w[0];
      z = max(0.0, -v.x + vyy); w[2] = z * z; sum += w[2];
      z = max(0.0, -v.y + vxx); w[4] = z * z; sum += w[4];
      z = max(0.0, v.x + vyy); w[6] = z * z; sum += w[6];
      vec2 u = 0.70710678 * vec2(v.x - v.y, v.x + v.y);
      vxx = zeta - eta * u.x * u.x;
      vyy = zeta - eta * u.y * u.y;
      z = max(0.0, u.y + vxx); w[1] = z * z; sum += w[1];
      z = max(0.0, -u.x + vyy); w[3] = z * z; sum += w[3];
      z = max(0.0, -u.y + vxx); w[5] = z * z; sum += w[5];
      z = max(0.0, u.x + vyy); w[7] = z * z; sum += w[7];
      float gw = exp(-0.78 * dd) / max(sum, 1e-6);
      for (int k = 0; k < 8; k++) {
        float wk = w[k] * gw;
        m[k] += vec4(col.rgb * wk, wk);
        sq[k] += col.rgb * col.rgb * wk;
        al[k] += col.a * wk;
      }
    }
  }

  vec3 outRgb = vec3(0.0);
  float outA = 0.0, total = 0.0;
  for (int k = 0; k < 8; k++) {
    if (m[k].w <= 0.0) continue;
    vec3 mean = m[k].rgb / m[k].w;
    vec3 variance = abs(sq[k] / m[k].w - mean * mean);
    float w = 1.0 / (1.0 + pow(255.0 * (variance.r + variance.g + variance.b), 0.5 * uSharp));
    outRgb += mean * w;
    outA += al[k] / m[k].w * w;
    total += w;
  }
  outColor = total > 0.0 ? vec4(outRgb / total, outA / total) : texelFetch(uSrc, pix, 0);
}

//// output
#version 300 es
// Straight alpha for saving, under a soft vignette like a varnished canvas's darker edges.
precision highp float;
uniform sampler2D uSrc;
uniform float uVignette;
out vec4 outColor;

void main() {
  vec4 c = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0);
  vec3 rgb = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
  vec2 uv = gl_FragCoord.xy / vec2(textureSize(uSrc, 0));
  float edge = length((uv - 0.5) * vec2(1.0, 0.75)) * 1.45;
  rgb *= 1.0 - uVignette * smoothstep(0.35, 1.0, edge);
  outColor = vec4(clamp(rgb, 0.0, 1.0), clamp(c.a, 0.0, 1.0));
}
