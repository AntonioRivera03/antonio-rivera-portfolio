import assert from "node:assert/strict";
import { test } from "node:test";
import { Box3, Matrix4, PerspectiveCamera, Vector3 } from "three";
import { createPanelLayout, fitRoomCamera, panelCorners, projectPanel, ROOM_PITCH, DESK_CENTER, BED_CENTER } from "../lib/room/layout.ts";
import { flattenScreenProjection } from "../lib/room/life.ts";

const bounds = new Box3(new Vector3(-4.17, 0, -1.67), new Vector3(3.77, 2.23, 2.31));
const panels = [createPanelLayout(720, 440, false), createPanelLayout(620, 380, true)];
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≠ ${expected}`);

test("panels pivot above their furniture, with the project gap at the desk midpoint", () => {
  panels.forEach((panel, index) => {
    const center = new Vector3(panel.width / 2, panel.height / 2, 0).applyMatrix4(panel.matrix);
    close(center.x, index ? BED_CENTER : DESK_CENTER);
    close(center.z, 0);
    const across = new Vector3(1, 0, 0).transformDirection(panel.matrix);
    close(Math.atan2(-across.z, across.x), (index ? -1 : 1) * Math.PI / 6);
    panelCorners(panel).forEach((corner) => assert.ok(corner.y >= 2.4 - 1e-6));
  });
});

test("furniture and panel corners fit the same 12 degree camera on landscape and portrait screens", () => {
  for (const [width, height] of [[701, 900], [1440, 900], [2560, 1318], [1920, 600]]) {
    const camera = new PerspectiveCamera(34, width / height, .1, 100);
    fitRoomCamera(camera, bounds, panels);
    const direction = camera.getWorldDirection(new Vector3());
    close(Math.asin(-direction.y), ROOM_PITCH);
    const points = panels.flatMap(panelCorners);
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) points.push(new Vector3(x, y, z));
    for (const point of points) {
      const ndc = point.clone().project(camera);
      assert.ok(Math.abs(ndc.x) < .95 && Math.abs(ndc.y) < .95 && ndc.z < 1);
    }
  }
});

test("DOM projective matrices exactly match WebGL pixels at every panel corner", () => {
  const camera = new PerspectiveCamera(34, 1440 / 900, .1, 100);
  fitRoomCamera(camera, bounds, panels);
  for (const panel of panels) {
    const dom = projectPanel(camera, panel, 1440, 900);
    assert.ok(Math.abs(dom.determinant()) > 0, "CSS transforms must remain invertible");
    for (const [x, y] of [[0, 0], [panel.width, 0], [panel.width / 2, panel.height / 2], [0, panel.height], [panel.width, panel.height]]) {
      const webgl = new Vector3(x, y, 0).applyMatrix4(panel.matrix).project(camera);
      const css = new Vector3(x, y, 0).applyMatrix4(dom);
      close(css.x, (webgl.x + 1) * 720);
      close(css.y, (1 - webgl.y) * 450);
    }
  }
});

test("life screen keeps its projected position without a reflected axis that flips during centering", () => {
  for (const [width, height] of [[701, 900], [1440, 900], [2560, 1318], [1920, 600]]) {
    const camera = new PerspectiveCamera(34, width / height, .1, 100);
    fitRoomCamera(camera, bounds, panels);
    // Include the room's viewport position and the inset inside the screen frame.
    const origin = new Matrix4().makeTranslation(12, -80, 0)
      .multiply(projectPanel(camera, panels[1], width, height))
      .multiply(new Matrix4().makeTranslation(8, 8, 0));
    const flat = new Matrix4().fromArray(flattenScreenProjection(origin.elements));
    assert.ok(origin.determinant() < 0, "The camera projection reproduces the reflected depth axis");
    assert.ok(flat.determinant() > 0, "The opening transform must not reflect any axis");
    const m = flat.elements;
    assert.ok(m[0] * m[5] - m[1] * m[4] > 0, "The CSS affine decomposition must stay upright");
    assert.deepEqual([m[2], m[6], m[8], m[9], m[11], m[14]], [0, 0, 0, 0, 0, 0]);
    assert.equal(m[10], 1);
    assert.equal(m[15], 1);
    for (const [x, y] of [[0, 0], [604, 0], [302, 165], [0, 330], [604, 330]]) {
      const before = new Vector3(x, y, 0).applyMatrix4(origin);
      const after = new Vector3(x, y, 0).applyMatrix4(flat);
      close(after.x, before.x);
      close(after.y, before.y);
      close(after.z, 0);
    }
  }
});
