import {
  ACESFilmicToneMapping, AnimationMixer, Box3, DirectionalLight, HemisphereLight, Material, Mesh,
  PCFShadowMap, PerspectiveCamera, PlaneGeometry, Scene, ShadowMaterial, Texture, Vector3, WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createPanelLayout, cssMatrix, fitRoomCamera, projectPanel } from "./layout";

export function createRoomRenderer(canvas: HTMLCanvasElement, root: HTMLElement, panels: HTMLElement[], onReady: (ready: boolean) => void) {
  onReady(false);
  // Keep the last frame when scrolling, offscreen, or showing reduced motion.
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0xfafafa, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 100);
  let bounds = new Box3(new Vector3(-4.17, 0, -1.67), new Vector3(3.49, 1.95, 1.59));
  scene.add(new HemisphereLight(0xffffff, 0xc6c4c0, 2.3));
  const key = new DirectionalLight(0xfff7ee, 3.2);
  key.position.set(-4, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.1, far: 30 });
  key.shadow.normalBias = 0.02;
  key.shadow.bias = -0.0001;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new DirectionalLight(0xe6efff, 1.4);
  fill.position.set(5, 4, -3);
  scene.add(fill);
  const floor = new Mesh(new PlaneGeometry(100, 100), new ShadowMaterial({ opacity: 0.14 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.012;
  floor.receiveShadow = true;
  scene.add(floor);
  const abort = new AbortController();
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const narrow = matchMedia("(max-width: 700px)");
  let disposed = false;
  let loaded = false;
  let visible = false;
  let contextLost = false;
  let readyReported = false;
  let mixer: AnimationMixer | undefined;
  let frame = 0;
  let last = 0;

  const draw = (now = performance.now()) => {
    frame = 0;
    if (disposed || contextLost || !loaded || !visible || document.hidden || root.dataset.lifeOpen === "true") { last = 0; return; }
    if (mixer && !motion.matches && last) mixer.update(Math.min((now - last) / 1000, 0.05));
    last = now;
    renderer.render(scene, camera);
    if (!readyReported) { readyReported = true; onReady(true); }
    if (mixer && !motion.matches) frame = requestAnimationFrame(draw);
  };
  const requestDraw = () => { if (!frame && !disposed) frame = requestAnimationFrame(draw); };
  const resize = () => {
    if (disposed) return;
    if (!loaded || contextLost) {
      root.dataset.projected = "false";
      panels.forEach((panel) => { panel.style.transform = ""; });
      return;
    }
    root.dataset.projected = String(!narrow.matches);
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const layouts = narrow.matches ? [] : panels.map((panel, index) => createPanelLayout(panel.offsetWidth, panel.offsetHeight, index === 1));
    fitRoomCamera(camera, bounds, layouts);
    panels.forEach((panel, index) => {
      panel.style.transform = layouts[index] ? cssMatrix(projectPanel(camera, layouts[index], width, height)) : "";
    });
    requestDraw();
  };
  const dialogObserver = new MutationObserver(requestDraw);
  dialogObserver.observe(root, { attributes: true, attributeFilter: ["data-life-open"] });
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  panels.forEach((panel) => resizeObserver.observe(panel));
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; requestDraw(); });
  intersection.observe(canvas);
  const onLost = (event: Event) => { event.preventDefault(); contextLost = true; readyReported = false; resize(); onReady(false); };
  const onRestored = () => { contextLost = false; resize(); };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  document.addEventListener("visibilitychange", requestDraw);
  motion.addEventListener("change", requestDraw);
  narrow.addEventListener("change", resize);

  void fetch("/room/room.glb", { signal: abort.signal }).then((response) => {
    if (!response.ok) throw new Error(`Room model request failed: ${response.status}`);
    return response.arrayBuffer();
  }).then((buffer) => new GLTFLoader().parseAsync(buffer, "")).then((gltf) => {
    scene.add(gltf.scene);
    gltf.scene.traverse((node) => {
      if (node instanceof Mesh) { node.castShadow = true; node.receiveShadow = true; }
    });
    if (disposed) { release(); return; }
    bounds = new Box3().setFromObject(gltf.scene);
    const working = gltf.animations.find((clip) => clip.name === "Working");
    if (working) { mixer = new AnimationMixer(gltf.scene); mixer.clipAction(working).play(); }
    loaded = true;
    resize();
  }).catch((error) => { if (!disposed) { console.warn("Using the room still:", error); onReady(false); } });

  function release() {
    const materials = new Set<Material>();
    const textures = new Set<Texture>();
    scene.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.geometry.dispose();
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
      }
    });
    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
  }

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    abort.abort();
    mixer?.stopAllAction();
    if (mixer) mixer.uncacheRoot(mixer.getRoot());
    dialogObserver.disconnect();
    resizeObserver.disconnect();
    intersection.disconnect();
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.removeEventListener("webglcontextrestored", onRestored);
    document.removeEventListener("visibilitychange", requestDraw);
    motion.removeEventListener("change", requestDraw);
    narrow.removeEventListener("change", resize);
    root.dataset.projected = "false";
    panels.forEach((panel) => { panel.style.transform = ""; });
    release();
    key.shadow.dispose();
    renderer.dispose();
  };
}
