import { Color, DoubleSide, ShaderMaterial, Vector2, type Texture } from "three";

export const CRT_GLASS_COLOR = 0x242625;

export function createCrtMaterial(document: Texture, faceBackground: string) {
  return new ShaderMaterial({
    side: DoubleSide,
    toneMapped: false,
    uniforms: {
      document: { value: document },
      shutdown: { value: 0 },
      glassColor: { value: new Color(CRT_GLASS_COLOR) },
      eyes: { value: 0 },
      gaze: { value: new Vector2() },
      blink: { value: 1 },
      faceBackground: { value: new Color(faceBackground) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D document;
      uniform float shutdown;
      uniform vec3 glassColor;
      uniform float eyes;
      uniform vec2 gaze;
      uniform float blink;
      uniform vec3 faceBackground;
      varying vec2 vUv;

      float roundedRect(vec2 point, vec2 halfSize, float radius) {
        vec2 q = abs(point) - halfSize + radius;
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        // Match the Blender glass in physical units, independently of image distortion.
        vec2 glassPoint = p * vec2(0.7, 0.525);
        if (roundedRect(glassPoint, vec2(0.7, 0.525), 0.055) > 0.0) discard;
        float aperture = roundedRect(glassPoint, vec2(0.695, 0.520), 0.050);
        float edge = 1.0 - smoothstep(-0.004, 0.004, aperture);
        // Convex geometry supplies the glass bulge; barrel distortion bends its image.
        vec2 curved = p * (1.0 + 0.045 * dot(p, p));
        vec2 uv = curved * 0.5 + 0.5;
        vec3 color = texture2D(document, clamp(uv, 0.0, 1.0)).rgb;
        float scanline = 0.97 + 0.03 * cos(vUv.y * 768.0 * 3.14159);
        float vignette = 1.0 - 0.14 * dot(p, p);
        color *= scanline * vignette;
        float reflection = pow(max(0.0, 1.0 - length((p - vec2(-0.65, 0.9)) * vec2(0.7, 1.5))), 5.0) * 0.12;
        color += reflection;

        // The same curved glass becomes a dark LED-like face after the retreat.
        vec2 eyePoint = curved - gaze;
        eyePoint.x = abs(eyePoint.x) - 0.31;
        float eyeHeight = max(0.012, 0.225 * blink);
        vec2 eyeRadii = vec2(0.105, eyeHeight);
        float eyeDistance = (length(eyePoint / eyeRadii) - 1.0) * min(eyeRadii.x, eyeRadii.y);
        float eyeMask = 1.0 - smoothstep(-0.006, 0.006, eyeDistance);
        float eyeGlow = exp(-max(0.0, eyeDistance) * 45.0) * 0.025;
        vec3 face = mix(faceBackground, vec3(0.96, 0.98, 0.97), eyeMask) + eyeGlow;
        color = mix(color, face, eyes);
        vec3 screenBase = mix(glassColor, faceBackground, eyes);

        float collapse = smoothstep(0.0, 0.55, shutdown);
        float height = max(0.008, 1.0 - collapse);
        float band = 1.0 - smoothstep(height, height + 0.018, abs(p.y));
        float width = 1.0 - smoothstep(0.52, 0.89, shutdown);
        float horizontal = 1.0 - smoothstep(max(0.006, width), max(0.006, width) + 0.025, abs(p.x));
        float glow = exp(-abs(p.y) * 95.0) * smoothstep(0.08, 0.50, shutdown);
        color = mix(color, vec3(0.96, 0.98, 0.95), collapse * 0.90);
        color = mix(screenBase, color + glow * 0.35, band * horizontal * edge);
        float extinction = smoothstep(0.86, 1.0, shutdown);
        color = mix(color, screenBase, extinction);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}
