import { Box3, Matrix4, PerspectiveCamera, Vector3 } from "three";

export const ROOM_PITCH = 12 * Math.PI / 180;
export const PANEL_YAW = 30 * Math.PI / 180;
export const DESK_CENTER = -2.5;
export const BED_CENTER = 2.35;
const target = new Vector3(0, 2.25, 0);

export type PanelLayout = { matrix: Matrix4; width: number; height: number };

export function createPanelLayout(width: number, height: number, personal: boolean): PanelLayout {
  const scale = (personal ? 4.5 : 4.8) / width;
  // The lower edge stays above the furniture as the content's measured height changes.
  const matrix = new Matrix4().makeTranslation(personal ? BED_CENTER : DESK_CENTER, 2.4 + height * scale / 2, 0)
    .multiply(new Matrix4().makeRotationY(personal ? -PANEL_YAW : PANEL_YAW))
    .multiply(new Matrix4().makeScale(scale, -scale, scale))
    .multiply(new Matrix4().makeTranslation(-width / 2, -height / 2, 0));
  return { matrix, width, height };
}

export function panelCorners(panel: PanelLayout) {
  return [[0, 0], [panel.width, 0], [0, panel.height], [panel.width, panel.height]]
    .map(([x, y]) => new Vector3(x, y, 0).applyMatrix4(panel.matrix));
}

export function fitRoomCamera(camera: PerspectiveCamera, bounds: Box3, panels: PanelLayout[] = []) {
  const points = panels.flatMap(panelCorners);
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) points.push(new Vector3(x, y, z));
  const focus = panels.length ? target : bounds.getCenter(new Vector3());
  const tan = Math.tan(camera.fov * Math.PI / 360);
  let distance = 5;
  for (const point of points) {
    const relative = point.clone().sub(focus);
    const y = relative.y * Math.cos(ROOM_PITCH) - relative.z * Math.sin(ROOM_PITCH);
    const z = relative.y * Math.sin(ROOM_PITCH) + relative.z * Math.cos(ROOM_PITCH);
    distance = Math.max(distance, z + Math.abs(relative.x) / (tan * camera.aspect) * 1.12, z + Math.abs(y) / tan * 1.12);
  }
  camera.position.copy(focus).add(new Vector3(0, Math.sin(ROOM_PITCH), Math.cos(ROOM_PITCH)).multiplyScalar(distance));
  camera.lookAt(focus);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

/** The DOM and WebGL share this exact camera projection, including perspective divide. */
export function projectPanel(camera: PerspectiveCamera, panel: PanelLayout, width: number, height: number) {
  const viewport = new Matrix4().set(
    width / 2, 0, 0, width / 2,
    0, -height / 2, 0, height / 2,
    0, 0, 1, 0,
    0, 0, 0, 1,
  );
  const matrix = viewport.multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse).multiply(panel.matrix);
  const divisor = matrix.elements[15];
  matrix.multiplyScalar(1 / divisor);
  return matrix;
}

export function cssMatrix(matrix: Matrix4) { return `matrix3d(${matrix.elements.join(",")})`; }
