import {
  ACESFilmicToneMapping, HemisphereLight, DirectionalLight, Group, Material, Mesh, MeshBasicMaterial,
  PCFShadowMap, PerspectiveCamera, PlaneGeometry, Scene, ShadowMaterial, Texture,
  Vector3, WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createResumeDocument } from "./document";
import { createCrtMaterial, CRT_GLASS_COLOR } from "./screen-material";
import { getCrtTimeline } from "./timeline";
import { createCompanionSequence, getCompanionExpression, getCompanionFraming } from "./companion";
import { createCrtPower } from "./power";
import { createPortfolioSequence, getMergeStart, getReadingGaze, type getJourneyTimeline } from "./journey";
import type { Resume } from "./resume";

const SCREEN_CENTER = new Vector3(0, 2.99, 0.91);
const START_TARGET = new Vector3(0, 2.7, 0);
const START_POSITION = new Vector3(6.8, 6.3, 25);
const COMPUTER_BASE_Y = 1.62;
const COMPUTER_WIDTH = 1.93;
const COMPUTER_HEIGHT = 2.12;
const SCREEN_WIDTH = 1.4;

export interface CrtRenderer {
  setProgress(progress: number, passions: number, journey: number, listHeight: number): void;
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
  onPresentation: (wipe: number, copy: number, journey: ReturnType<typeof getJourneyTimeline>) => void,
): CrtRenderer {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0xfafafa, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  const ambient = new HemisphereLight(0xf7f9ff, 0xc6c7c9, 0.95);
  scene.add(ambient);
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
  const finalTarget = new Vector3(0, 2.76, 0.91);
  const companionPosition = new Vector3();
  const companionTarget = new Vector3();
  const cameraTarget = new Vector3();
  const document = createResumeDocument(resume);
  const screenMaterial = createCrtMaterial(document.texture, getComputedStyle(canvas).getPropertyValue("--passions-background").trim());
  const abort = new AbortController();
  const sequence = createPortfolioSequence(createCompanionSequence(createCrtPower()));
  let model: Group | undefined;
  let progress = 0;
  let passions = 0;
  let journey = 0;
  let listHeight = 0;
  let companionYaw = 0;
  let frame = 0;
  let visible = false;
  let canvasVisible = false;
  let disposed = false;
  let contextLost = false;
  let documentWidth = 0;
  let width = 1;
  let height = 1;
  const centeredPosition = new Vector3();
  const centeredTarget = new Vector3(0, 2.68, 0);
  const portalPosition = new Vector3();

  function updateCamera(approach: number, retreat: number) {
    camera.position.lerpVectors(START_POSITION, finalPosition, approach);
    camera.position.lerp(companionPosition, retreat);
    cameraTarget.lerpVectors(START_TARGET, finalTarget, approach).lerp(companionTarget, retreat);
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld();
  }

  const draw = (now: number) => {
    frame = 0;
    if (disposed || contextLost || !model || !visible || window.document.hidden) return;
    const presentation = sequence.sample(progress, passions, journey, now, getMergeStart(listHeight, height));
    const next = presentation.journey;
    const timeline = getCrtTimeline(presentation.resume);
    updateCamera(timeline.approach, presentation.retreat);
    camera.position.lerp(centeredPosition, next.center).lerp(portalPosition, next.zoom);
    cameraTarget.lerp(centeredTarget, next.center).lerp(SCREEN_CENTER, next.zoom);
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld();
    document.draw(timeline.reading);
    const expression = getCompanionExpression(presentation.companionTime);
    screenMaterial.uniforms.shutdown.value = presentation.power.shutdown;
    screenMaterial.uniforms.eyes.value = presentation.display === "eyes" ? 1 : 0;
    const reading = getReadingGaze(next.lists);
    const gazeX = expression.gazeX + (reading.x - expression.gazeX) * reading.weight;
    const gazeY = expression.gazeY + (reading.y - expression.gazeY) * reading.weight;
    screenMaterial.uniforms.gaze.value.set(gazeX * (1 - next.merge), gazeY * (1 - next.merge));
    screenMaterial.uniforms.blink.value = expression.blink + (1 - expression.blink) * next.merge;
    screenMaterial.uniforms.merge.value = next.merge;
    model.rotation.y = companionYaw * presentation.retreat * (1 - next.center);
    model.position.y = expression.hover * (1 - next.merge);
    floorMaterial.opacity = 0.13 * (1 - presentation.retreat);
    ambient.intensity = 0.95 - presentation.retreat * 0.2;
    key.intensity = 3.6 - presentation.retreat * 0.8;
    canvas.dataset.power = presentation.power.phase;
    canvas.dataset.display = presentation.display;
    canvas.dataset.phase = next.position > 0 ? next.phase : presentation.retreat === 1 ? "passions" : presentation.retreat > 0 ? "retreat" : presentation.wipe > 0 ? "wipe" : timeline.phase;
    onPresentation(presentation.wipe, presentation.copy, next);
    if (canvasVisible && next.white < 1) renderer.render(scene, camera);
    // A tall text pane can outlive the canvas on short screens. Finish its reveal
    // even off-canvas, then pause the companion until the computer is visible again.
    if (presentation.journeyAnimating || (presentation.animating && next.position < 1 && (canvasVisible || presentation.position !== passions || presentation.power.animating))) requestDraw();
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

    // Move closer to the display, leaving room for the casing in shorter viewports.
    const monitorPixels = Math.min(
      width * (width < 700 ? 0.96 : 0.68),
      height * 0.90 * COMPUTER_WIDTH / COMPUTER_HEIGHT,
    );
    const distance = COMPUTER_WIDTH * height / (2 * Math.tan(camera.fov * Math.PI / 360) * monitorPixels);
    finalPosition.set(0.08, finalTarget.y + 0.06, SCREEN_CENTER.z + distance);
    const framing = getCompanionFraming(width, height, camera.fov);
    companionPosition.set(framing.x, framing.y, framing.z);
    companionTarget.set(framing.x, framing.y, 0);
    companionYaw = framing.yaw;
    centeredPosition.set(0, centeredTarget.y, framing.z);
    // The camera enters the white circle until even the viewport corners lie inside it.
    const portalDistance = 0.15 / (Math.tan(camera.fov * Math.PI / 360) * Math.hypot(camera.aspect, 1));
    portalPosition.set(0, SCREEN_CENTER.y, SCREEN_CENTER.z + Math.max(0.10, portalDistance));
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
  const viewport = canvas.parentElement ?? canvas;
  const intersection = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === viewport) visible = entry.isIntersecting;
      if (entry.target === canvas) canvasVisible = entry.isIntersecting;
    }
    requestDraw();
  });
  intersection.observe(viewport);
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
        if (!(node instanceof Mesh)) return;
        node.castShadow = node !== screen;
        node.receiveShadow = node !== screen;
        // The narrow glass surround and the unlit screen share one output color.
        const matchGlass = (material: Material) => {
          if (material.name.replace(/\.\d+$/, "") !== "CRT · graphite inner bezel") return material;
          const glass = new MeshBasicMaterial({ color: CRT_GLASS_COLOR, toneMapped: false });
          glass.name = material.name;
          material.dispose();
          return glass;
        };
        node.material = Array.isArray(node.material) ? node.material.map(matchGlass) : matchGlass(node.material);
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
    setProgress(value, nextPassions, nextJourney, nextListHeight) {
      if (disposed) return;
      progress = value;
      passions = nextPassions;
      journey = nextJourney;
      listHeight = nextListHeight;
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
      key.shadow.dispose();
      renderer.dispose();
    },
  };
}
