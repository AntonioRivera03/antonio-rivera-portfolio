import {
  ACESFilmicToneMapping, HemisphereLight, DirectionalLight, Group, Material, Mesh,
  PCFShadowMap, PerspectiveCamera, PlaneGeometry, Scene, ShadowMaterial, Texture,
  Vector3, WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createResumeDocument } from "./document";
import { createCrtMaterial } from "./screen-material";
import { getCrtTimeline } from "./timeline";
import { createCrtPower } from "./power";
import type { Resume } from "./resume";

const SCREEN_CENTER = new Vector3(0, 2.99, 0.91);
const START_TARGET = new Vector3(0, 2.7, 0);
const START_POSITION = new Vector3(6.8, 6.3, 25);
const COMPUTER_BASE_Y = 1.62;
const COMPUTER_WIDTH = 1.93;
const COMPUTER_HEIGHT = 2.12;
const SCREEN_WIDTH = 1.4;

export interface CrtRenderer {
  setProgress(progress: number): void;
  dispose(): void;
}

function disposeObject(root: Group) {
  const textures = new Set<Texture>();
  const materials = new Set<Material>();
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.geometry.dispose();
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material);
      Object.values(material).forEach((value) => { if (value instanceof Texture) textures.add(value); });
    }
  });
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

export function createCrtRenderer(
  canvas: HTMLCanvasElement,
  resume: Resume,
  onReady: (ready: boolean) => void,
  onDocumentMeasure: (distance: number) => void,
): CrtRenderer {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0xfafafa, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.add(new HemisphereLight(0xf7f9ff, 0xc6c7c9, 0.95));
  const key = new DirectionalLight(0xffffff, 3.6);
  key.position.set(-4, 8, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 6, bottom: -5, near: 0.1, far: 24 });
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.025;
  const fill = new DirectionalLight(0xeef3ff, 1.2);
  fill.position.set(4, 5, -3);
  scene.add(key, fill);
  const floorGeometry = new PlaneGeometry(200, 200);
  const floorMaterial = new ShadowMaterial({ opacity: 0.13 });
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = COMPUTER_BASE_Y - 0.015;
  floor.receiveShadow = true;
  scene.add(floor);

  const camera = new PerspectiveCamera(35, 1, 0.05, 150);
  const finalPosition = new Vector3();
  const finalTarget = new Vector3(0, 2.7, 0.91);
  const document = createResumeDocument(resume);
  const screenMaterial = createCrtMaterial(document.texture);
  const abort = new AbortController();
  const power = createCrtPower();
  let model: Group | undefined;
  let progress = 0;
  let frame = 0;
  let visible = false;
  let disposed = false;
  let contextLost = false;
  let documentWidth = 0;
  let width = 1;
  let height = 1;

  function updateCamera(approach: number) {
    camera.position.lerpVectors(START_POSITION, finalPosition, approach);
    camera.lookAt(new Vector3().lerpVectors(START_TARGET, finalTarget, approach));
    camera.updateMatrixWorld();
  }

  const draw = (now: number) => {
    frame = 0;
    if (disposed || contextLost || !model || !visible || window.document.hidden) return;
    const timeline = getCrtTimeline(progress);
    updateCamera(timeline.approach);
    document.draw(timeline.reading);
    const powerFrame = power.sample(now);
    screenMaterial.uniforms.shutdown.value = powerFrame.shutdown;
    canvas.dataset.power = powerFrame.phase;
    renderer.render(scene, camera);
    if (powerFrame.animating) requestDraw();
  };

  const requestDraw = () => { if (!frame && !disposed) frame = requestAnimationFrame(draw); };

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // Fill 60% of desktop width, while keeping the whole casing inside short viewports.
    const monitorPixels = Math.min(
      width * (width < 700 ? 0.93 : 0.6),
      height * 0.85 * COMPUTER_WIDTH / COMPUTER_HEIGHT,
    );
    const distance = COMPUTER_WIDTH * height / (2 * Math.tan(camera.fov * Math.PI / 360) * monitorPixels);
    finalPosition.set(0.08, finalTarget.y + 0.06, SCREEN_CENTER.z + distance);
    const screenPixels = monitorPixels * SCREEN_WIDTH / COMPUTER_WIDTH;
    if (Math.abs(screenPixels - documentWidth) > 1) {
      documentWidth = screenPixels;
      document.layout(screenPixels);
      onDocumentMeasure(document.scrollDistance);
    }
    requestDraw();
  };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    requestDraw();
  });
  intersection.observe(canvas);
  window.document.addEventListener("visibilitychange", requestDraw);

  const onContextLost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    onReady(false);
  };
  const onContextRestored = () => {
    contextLost = false;
    resize();
    requestDraw();
    if (model) onReady(true);
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  void fetch("/computer/computer.glb", { signal: abort.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`Computer model request failed: ${response.status}`);
      return response.arrayBuffer();
    })
    .then((buffer) => new GLTFLoader().parseAsync(buffer, ""))
    .then((gltf) => {
      if (disposed) { disposeObject(gltf.scene); return; }
      model = gltf.scene;
      const screen = model.getObjectByName("CRT_Screen");
      if (!(screen instanceof Mesh)) throw new Error("The computer model has no CRT_Screen mesh.");
      const original = screen.material;
      screen.material = screenMaterial;
      (Array.isArray(original) ? original : [original]).forEach((material) => material.dispose());
      model.traverse((node) => {
        if (node instanceof Mesh) { node.castShadow = node !== screen; node.receiveShadow = node !== screen; }
      });
      scene.add(model);
      resize();
      requestDraw();
      onReady(!contextLost);
    })
    .catch((error: unknown) => {
      if (!disposed) { console.warn("Using the accessible résumé view:", error); onReady(false); }
    });

  resize();

  return {
    setProgress(value) {
      if (disposed) return;
      progress = value;
      power.request(value, performance.now());
      requestDraw();
    },
    dispose() {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      window.document.removeEventListener("visibilitychange", requestDraw);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      if (model) disposeObject(model);
      else screenMaterial.dispose();
      document.dispose();
      floorGeometry.dispose();
      floorMaterial.dispose();
      renderer.dispose();
    },
  };
}
