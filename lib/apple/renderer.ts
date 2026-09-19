import {
  Box3, DirectionalLight, Group, HemisphereLight, Material, Mesh,
  OrthographicCamera, PlaneGeometry, Scene, Texture, Vector3,
  WebGLRenderer, WebGLRenderTarget,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createAsciiMaterial } from "./ascii-material";

const REVOLUTION_SECONDS = 40;
const FRAME_INTERVAL = 1000 / 30;

export interface AppleRenderer {
  setPaused(paused: boolean): void;
  dispose(): void;
}

function disposeModel(model: Group) {
  const textures = new Set<Texture>();
  const materials = new Set<Material>();
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const entries = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of entries) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof Texture) textures.add(value);
      }
    }
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
}

export function createAppleRenderer(canvas: HTMLCanvasElement, onReady: (ready: boolean) => void): AppleRenderer {
  onReady(false);
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new Scene();
  const apple = new Group();
  scene.add(apple, new HemisphereLight(0xffffff, 0x444444, 0.65));
  const key = new DirectionalLight(0xffffff, 3.2);
  key.position.set(-3, 4, 5);
  const fill = new DirectionalLight(0xffffff, 0.7);
  fill.position.set(3, 0, -2);
  scene.add(key, fill);

  const camera = new OrthographicCamera(-1.85, 1.85, 1.85, -1.85, 0.1, 20);
  camera.position.set(0, 0.45, 6);
  camera.lookAt(0, 0, 0);

  const target = new WebGLRenderTarget(120, 80, { depthBuffer: true });
  const ascii = createAsciiMaterial();
  ascii.material.uniforms.sceneTexture.value = target.texture;
  const plane = new PlaneGeometry(2, 2);
  const output = new Scene();
  output.add(new Mesh(plane, ascii.material));
  const outputCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const abort = new AbortController();
  let model: Group | undefined;
  let frame = 0;
  let lastTime = 0;
  let paused = false;
  let visible = true;
  let disposed = false;
  let contextLost = false;

  const draw = () => {
    if (!model || disposed || contextLost) return;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(output, outputCamera);
  };

  const canAnimate = () => model && !disposed && !contextLost && !paused && !reducedMotion.matches && visible && !document.hidden;

  const tick = (now: number) => {
    frame = 0;
    if (!canAnimate()) return;
    if (now - lastTime >= FRAME_INTERVAL) {
      const elapsed = lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 0;
      apple.rotation.y += elapsed * Math.PI * 2 / REVOLUTION_SECONDS;
      lastTime = now;
      draw();
    }
    frame = requestAnimationFrame(tick);
  };

  const syncAnimation = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (canAnimate()) frame = requestAnimationFrame(tick);
    else draw();
  };

  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    const columns = Math.min(160, Math.max(64, Math.round(width / 4.2)));
    const rows = Math.round(columns * height / width * 0.66);
    target.setSize(columns, rows);
    ascii.material.uniforms.grid.value.set(columns, rows);
    camera.left = -1.85 * width / height;
    camera.right = 1.85 * width / height;
    camera.updateProjectionMatrix();
    draw();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncAnimation();
  });
  intersectionObserver.observe(canvas);
  document.addEventListener("visibilitychange", syncAnimation);
  reducedMotion.addEventListener("change", syncAnimation);

  const onContextLost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    onReady(false);
    syncAnimation();
  };
  const onContextRestored = () => {
    contextLost = false;
    resize();
    if (model) onReady(true);
    syncAnimation();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  void fetch("/apple/apple.glb", { signal: abort.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`Apple model request failed: ${response.status}`);
      return response.arrayBuffer();
    })
    .then((buffer) => new GLTFLoader().parseAsync(buffer, ""))
    .then((gltf) => {
      if (disposed) { disposeModel(gltf.scene); return; }
      model = gltf.scene;
      // Lift the red skin into monochrome while retaining Blender's freckles.
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const colors = object.geometry.getAttribute("color");
        if (!colors) return;
        for (let index = 0; index < colors.count; index++) {
          const gray = Math.min(0.85, (colors.getX(index) * 0.2126 + colors.getY(index) * 0.7152 + colors.getZ(index) * 0.0722) * 2.7);
          colors.setXYZ(index, gray, gray, gray);
        }
        colors.needsUpdate = true;
      });
      const bounds = new Box3().setFromObject(model);
      const center = bounds.getCenter(new Vector3());
      const scale = 2.85 / bounds.getSize(new Vector3()).y;
      model.position.sub(center);
      apple.add(model);
      apple.scale.setScalar(scale);
      apple.rotation.y = -0.35;
      resize();
      onReady(true);
      syncAnimation();
    })
    .catch((error: unknown) => {
      if (!disposed) console.warn("Using the apple still:", error);
    });

  resize();

  return {
    setPaused(value) { paused = value; syncAnimation(); },
    dispose() {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", syncAnimation);
      reducedMotion.removeEventListener("change", syncAnimation);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      if (model) disposeModel(model);
      target.dispose();
      plane.dispose();
      ascii.dispose();
      renderer.dispose();
    },
  };
}
