import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { createCrtPower } from "../lib/crt/power.ts";
import { createCompanionSequence, getCompanionExpression, getCompanionFraming, getStoryScroll, PASSIONS } from "../lib/crt/companion.ts";

function run(sequence, resume, passions, start, end) {
  const frames = [];
  for (let now = start; now <= end; now += 16) frames.push(sequence.sample(resume, passions, now));
  return frames;
}

test("the appended section preserves the résumé scroll distance", () => {
  for (const distance of [5500, 12000]) {
    assert.deepEqual(getStoryScroll(-distance * 0.87, distance, 1000), { resume: 0.87, passions: 0 });
    assert.deepEqual(getStoryScroll(-distance, distance, 1000), { resume: 1, passions: 0 });
    assert.deepEqual(getStoryScroll(-distance - 1000 * PASSIONS.travelViewports, distance, 1000), { resume: 1, passions: 1 });
  }
});

test("an End-key jump overlaps wipe and retreat after shutdown, then starts the eyes", () => {
  const sequence = createCompanionSequence(createCrtPower());
  const frames = run(sequence, 1, 1, 0, 4000);
  let offSeen = false;
  let overlappingMotionSeen = false;
  let eyesSeen = false;
  for (const frame of frames) {
    if (frame.power.phase === "off") offSeen = true;
    if (frame.wipe > 0) assert.ok(offSeen, "The background moved before shutdown completed");
    if (frame.retreat > 0) assert.ok(offSeen, "The camera moved before shutdown completed");
    if (frame.retreat > 0 && frame.wipe < 1) overlappingMotionSeen = true;
    if (frame.display === "eyes") {
      assert.equal(frame.wipe, 1);
      assert.equal(frame.retreat, 1);
      if (!eyesSeen) assert.equal(frame.power.phase, "off", "Content changed while the screen was lit");
      eyesSeen = true;
    }
  }
  const last = frames.at(-1);
  assert.ok(overlappingMotionSeen, "The retreat waited for the full background wipe");
  assert.equal(last.display, "eyes");
  assert.equal(last.power.phase, "on");
  assert.equal(last.copy, 1);
});

test("the computer is already retreating halfway through the wipe", () => {
  const sequence = createCompanionSequence(createCrtPower());
  const last = run(sequence, 1, PASSIONS.wipeEnd / 2, 0, 3000).at(-1);
  assert.equal(last.wipe, 0.5);
  assert.ok(last.retreat > 0 && last.retreat < 1);
  assert.equal(last.power.phase, "off");
  assert.equal(last.display, "resume");
  assert.equal(last.animating, false);
});

test("eyes finish turning on at the final placement without another scroll", () => {
  const sequence = createCompanionSequence(createCrtPower());
  const last = run(sequence, 1, PASSIONS.retreatEnd, 0, 4000).at(-1);
  assert.equal(last.retreat, 1);
  assert.equal(last.display, "eyes");
  assert.equal(last.power.phase, "on");
  assert.ok(last.companionTime > 0);
});

test("reverse scrolling blanks the eyes before moving and restores the résumé", () => {
  const sequence = createCompanionSequence(createCrtPower());
  run(sequence, 1, 1, 0, 4000);
  let offSeen = false;
  for (const frame of run(sequence, 0.7, 0, 4016, 8500)) {
    if (frame.power.phase === "off") offSeen = true;
    if (frame.retreat < 1) {
      assert.ok(offSeen);
      assert.equal(frame.display, "resume");
    }
    if (frame.position > 0) assert.equal(frame.resume, 1);
  }
  const last = sequence.sample(0.7, 0, 8516);
  assert.equal(last.position, 0);
  assert.equal(last.resume, 0.7);
  assert.equal(last.power.phase, "on");
});

test("reversing during eye startup completes power transitions without a document flash", () => {
  const sequence = createCompanionSequence(createCrtPower());
  let now = 0;
  while (sequence.sample(1, 1, now).power.phase !== "turning-on") {
    now += 16;
    assert.ok(now < 4000);
  }
  let offSeen = false;
  const frames = run(sequence, 0, 0, now + 16, now + 5000);
  for (const frame of frames) {
    if (frame.power.phase === "off") offSeen = true;
    if (!offSeen) {
      assert.equal(frame.display, "eyes");
      assert.equal(frame.retreat, 1);
    }
  }
  assert.equal(frames.at(-1).power.phase, "on");
  assert.equal(frames.at(-1).display, "resume");
});

test("a hidden-tab time jump cannot skip the diagonal wipe", () => {
  const sequence = createCompanionSequence(createCrtPower());
  sequence.sample(1, 1, 0);
  const resumed = sequence.sample(1, 1, 100000);
  assert.equal(resumed.power.phase, "off");
  assert.ok(resumed.wipe > 0 && resumed.wipe < 1);
  assert.equal(resumed.retreat, 0);
});

test("the companion looks around, closes its eyes briefly, and hovers slowly", () => {
  const samples = Array.from({ length: 1601 }, (_, i) => getCompanionExpression(i / 100));
  assert.ok(samples.some((sample) => sample.gazeX > 0.09));
  assert.ok(samples.some((sample) => sample.gazeX < -0.09));
  assert.ok(samples.some((sample, i) => i > 0 && Math.abs(sample.gazeX - samples[i - 1].gazeX) > 0.01), "Gaze should dart quickly between resting positions");
  assert.ok(getCompanionExpression(2.4).blink < 0.000001);
  assert.equal(getCompanionExpression(2).blink, 1);
  assert.equal(getCompanionExpression(0).hover, 0);
  assert.ok(samples.some((sample) => sample.hover > 0.06));
  assert.ok(samples.some((sample) => sample.hover < -0.06));
  for (let i = 1; i < samples.length; i++) assert.ok(Math.abs(samples[i].hover - samples[i - 1].hover) < 0.001);
});

// Project bounds from the actual shipped model, including all Blender node transforms.
const glb = readFileSync(new URL("../public/computer/computer.glb", import.meta.url));
const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
const modelCorners = [];
function visitNode(index, parent) {
  const node = gltf.nodes[index];
  const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
    new Vector3(...(node.translation ?? [0, 0, 0])),
    new Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
    new Vector3(...(node.scale ?? [1, 1, 1])),
  );
  const world = parent.clone().multiply(local);
  for (const primitive of gltf.meshes[node.mesh]?.primitives ?? []) {
    const { min, max } = gltf.accessors[primitive.attributes.POSITION];
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
      modelCorners.push(new Vector3(x, y, z).applyMatrix4(world));
    }
  }
  for (const child of node.children ?? []) visitNode(child, world);
}
for (const root of gltf.scenes[gltf.scene ?? 0].nodes) visitNode(root, new Matrix4());

for (const [width, height] of [[1440, 900], [1280, 720], [1920, 1080], [390, 844], [360, 640]]) {
  test(`the actual computer fits its Passions position at ${width}×${height}`, () => {
    const frame = getCompanionFraming(width, height);
    const camera = new PerspectiveCamera(35, width / height, 0.05, 150);
    camera.position.set(frame.x, frame.y, frame.z);
    camera.lookAt(frame.x, frame.y, 0);
    camera.updateMatrixWorld();
    const rotation = new Matrix4().makeRotationY(frame.yaw);
    const points = modelCorners.map((corner) => corner.clone().applyMatrix4(rotation).project(camera));
    const left = (Math.min(...points.map((p) => p.x)) + 1) / 2;
    const right = (Math.max(...points.map((p) => p.x)) + 1) / 2;
    const top = (1 - Math.max(...points.map((p) => p.y))) / 2;
    const bottom = (1 - Math.min(...points.map((p) => p.y))) / 2;
    assert.ok(left > 0 && right < 1 && top > 0 && bottom < 1, `Clipped bounds: ${[left, right, top, bottom]}`);
    if (width > 700) {
      assert.ok(right - left > 0.135 && right - left < 0.18, `Computer width: ${right - left}`);
      assert.ok((left + right) / 2 > 0.22 && (left + right) / 2 < 0.30);
      assert.ok((top + bottom) / 2 > 0.45 && (top + bottom) / 2 < 0.55);
      assert.ok(frame.x > 0 && frame.z > 5);
      assert.ok(frame.yaw - Math.atan2(frame.x, frame.z) > 0.15);
    } else {
      assert.ok(bottom < 0.43, "The computer overlaps the mobile copy");
    }
  });
}
