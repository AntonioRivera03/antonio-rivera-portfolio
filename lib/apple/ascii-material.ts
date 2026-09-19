import { CanvasTexture, LinearFilter, ShaderMaterial, Vector2 } from "three";

const CHARACTERS = ".,:;+=ox%#@";
const TILE = 32;

/** A glyph atlas lets the entire ASCII frame render in one GPU pass. */
export function createAsciiMaterial() {
  const atlas = document.createElement("canvas");
  atlas.width = TILE * CHARACTERS.length;
  atlas.height = TILE;
  const context = atlas.getContext("2d");
  if (!context) throw new Error("A 2D canvas is required for the ASCII atlas.");
  context.fillStyle = "white";
  context.font = "bold 28px 'Courier New', monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  [...CHARACTERS].forEach((character, index) => {
    context.fillText(character, (index + 0.5) * TILE, TILE * 0.52);
  });

  const texture = new CanvasTexture(atlas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;

  const material = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      sceneTexture: { value: null },
      glyphTexture: { value: texture },
      grid: { value: new Vector2(120, 80) },
      glyphCount: { value: CHARACTERS.length },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D sceneTexture;
      uniform sampler2D glyphTexture;
      uniform vec2 grid;
      uniform float glyphCount;
      varying vec2 vUv;

      void main() {
        vec2 cell = floor(vUv * grid);
        vec4 surface = texture2D(sceneTexture, (cell + 0.5) / grid);
        float luminance = dot(surface.rgb, vec3(0.2126, 0.7152, 0.0722));
        float brightness = pow(max(luminance, 0.0), 0.4545);
        float density = clamp(1.0 - brightness, 0.10, 0.99);
        float glyph = floor(density * (glyphCount - 1.0));
        vec2 local = fract(vUv * grid);
        vec2 atlasUv = vec2((glyph + local.x) / glyphCount, local.y);
        float ink = texture2D(glyphTexture, atlasUv).a;
        ink *= smoothstep(0.05, 0.6, surface.a);
        vec3 background = vec3(0.980392);
        gl_FragColor = vec4(mix(background, vec3(0.12), ink), 1.0);
      }
    `,
  });

  return { material, dispose: () => { material.dispose(); texture.dispose(); } };
}
