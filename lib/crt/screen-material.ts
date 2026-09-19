import { DoubleSide, ShaderMaterial, type Texture } from "three";

export function createCrtMaterial(document: Texture) {
  return new ShaderMaterial({
    side: DoubleSide,
    uniforms: { document: { value: document }, shutdown: { value: 0 } },
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
      varying vec2 vUv;

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        // Convex geometry supplies the glass bulge; barrel distortion bends its image.
        vec2 curved = p * (1.0 + 0.045 * dot(p, p));
        vec2 uv = curved * 0.5 + 0.5;
        float edge = (1.0 - smoothstep(0.97, 1.0, abs(curved.x)))
                   * (1.0 - smoothstep(0.97, 1.0, abs(curved.y)));
        vec3 glass = vec3(0.014, 0.023, 0.020);
        vec3 color = texture2D(document, clamp(uv, 0.0, 1.0)).rgb;
        float scanline = 0.97 + 0.03 * cos(vUv.y * 768.0 * 3.14159);
        float vignette = 1.0 - 0.19 * dot(p, p);
        color *= vec3(0.94, 1.0, 0.89) * scanline * vignette;
        float reflection = pow(max(0.0, 1.0 - length((p - vec2(-0.65, 0.9)) * vec2(0.7, 1.5))), 5.0) * 0.12;
        color += reflection;

        float collapse = smoothstep(0.0, 0.55, shutdown);
        float height = max(0.008, 1.0 - collapse);
        float band = 1.0 - smoothstep(height, height + 0.018, abs(p.y));
        float width = 1.0 - smoothstep(0.52, 0.89, shutdown);
        float horizontal = 1.0 - smoothstep(max(0.006, width), max(0.006, width) + 0.025, abs(p.x));
        float glow = exp(-abs(p.y) * 95.0) * smoothstep(0.08, 0.50, shutdown);
        color = mix(color, vec3(0.88, 1.0, 0.87), collapse * 0.90);
        color = mix(glass, color + glow * 0.35, band * horizontal * edge);
        float extinction = smoothstep(0.86, 1.0, shutdown);
        color = mix(color, glass, extinction);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}
