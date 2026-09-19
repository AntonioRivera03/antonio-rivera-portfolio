import assert from "node:assert/strict";
import { test } from "node:test";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { createPanelLayout, fitRoomCamera, panelCorners, projectPanel, ROOM_PITCH, DESK_CENTER, BED_CENTER } from "../lib/room/layout.ts";

const bounds = new Box3(new Vector3(-4.17, 0, -1.67), new Vector3(3.49, 1.95, 1.59));
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
