import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createCrtPower } from "../lib/crt/power.ts";
import { createCompanionSequence } from "../lib/crt/companion.ts";
import { createPortfolioSequence, getJourneyTimeline, getSkillOffset, getJourneyDistance, getMergeStart, JOURNEY } from "../lib/crt/journey.ts";
import { skills, skillColumns } from "../lib/skills.ts";
import { getSlideFrame, SLIDE_DWELL, SLIDE_OFF, SLIDE_ON, SLIDE_CYCLE } from "../lib/room/slides.ts";

const create = () => createPortfolioSequence(createCompanionSequence(createCrtPower()));
function run(sequence, resume, passions, journey, start, end) {
  const frames = [];
  for (let now = start; now <= end; now += 16) frames.push(sequence.sample(resume, passions, journey, now));
  return frames;
}

test("both skills columns exactly partition all 68 requested items", () => {
  assert.equal(skills.length, 68);
  assert.equal(new Set(skills).size, 68);
  assert.deepEqual(skillColumns.map((list) => list.length), [34, 34]);
  assert.deepEqual(skillColumns.flat(), skills);
  assert.equal(skillColumns[0].at(-1), "RAG (Retrieval-Augmented Generation)");
  assert.equal(skillColumns[1].at(-1), "Payroll Systems");
});

test("eyes begin merging with the last skills halfway offscreen, before the faster dive", () => {
  for (const viewport of [240, 640, 900, 1318]) for (const height of [1600, 2700, 4500]) {
    const mergeStart = getMergeStart(height, viewport);
    const timeline = getJourneyTimeline(mergeStart, mergeStart);
    assert.ok(getSkillOffset(0, height, viewport) > viewport);
    assert.ok(Math.abs(getSkillOffset(timeline.lists, height, viewport) + height - viewport / 2) < .001);
    const overlapping = getJourneyTimeline(mergeStart + .001, mergeStart);
    assert.ok(overlapping.merge > 0 && overlapping.lists < 1);
    assert.ok(getSkillOffset(getJourneyTimeline(JOURNEY.zoomStart).lists, height, viewport) + height < 0);
    const previousDistance = Math.max(viewport * 8, (height + viewport + 144) * 1.5 / (.68 - .025));
    assert.ok(getJourneyDistance(viewport, height) < previousDistance * .6);
  }
  assert.equal(getJourneyTimeline(JOURNEY.mergeEnd).zoom, 0);
  assert.equal(getJourneyTimeline(JOURNEY.zoomEnd).white, 0, "White fade must wait for full camera coverage");
  assert.equal(getJourneyTimeline(JOURNEY.roomStart).white, 1);
});

test("End jump waits for fully lit eyes, then completes every stage without more scroll", () => {
  const frames = run(create(), 1, 1, 1, 0, 8500);
  for (const frame of frames) if (frame.journey.position > 0) {
    assert.equal(frame.display, "eyes");
    assert.equal(frame.power.phase, "on");
    assert.equal(frame.retreat, 1);
  }
  for (const phase of ["skills", "merge", "portal", "room"]) assert.ok(frames.some((frame) => frame.journey.position > 0 && frame.journey.phase === phase));
  assert.equal(frames.at(-1).journey.room, 1);
  assert.equal(frames.at(-1).journeyAnimating, false);
});

test("Home jump returns the new chapter before the original computer reverses", () => {
  const sequence = create();
  run(sequence, 1, 1, 1, 0, 8500);
  const frames = run(sequence, 0, 0, 0, 8516, 17000);
  for (const frame of frames) if (frame.journey.position > 0) {
    assert.equal(frame.position, 1);
    assert.equal(frame.display, "eyes");
    assert.equal(frame.power.phase, "on");
  }
  assert.equal(frames.at(-1).journey.position, 0);
  assert.equal(frames.at(-1).position, 0);
  assert.equal(frames.at(-1).display, "resume");
});

test("mid-merge reversal and hidden-tab gaps do not jump to another phase", () => {
  const sequence = create();
  run(sequence, 1, 1, .66, 0, 8000);
  const resumed = sequence.sample(1, 1, 1, 100000);
  assert.ok(resumed.journey.position < JOURNEY.zoomStart);
  const reverse = sequence.sample(1, 1, .35, 100016);
  assert.ok(reverse.journey.position < resumed.journey.position);
  assert.equal(run(sequence, 1, 1, .35, 100032, 104000).at(-1).journey.position, .35);
});

test("slides dwell for 25 seconds and switch only while the CRT is fully black", () => {
  assert.deepEqual(getSlideFrame(SLIDE_DWELL - 1), { index: 0, phase: "on", shutdown: 0 });
  assert.equal(getSlideFrame(SLIDE_DWELL + SLIDE_OFF - .001).index, 0);
  assert.deepEqual(getSlideFrame(SLIDE_DWELL + SLIDE_OFF), { index: 1, phase: "turning-on", shutdown: 1 });
  assert.deepEqual(getSlideFrame(SLIDE_CYCLE), { index: 1, phase: "on", shutdown: 0 });
  assert.equal(getSlideFrame(SLIDE_CYCLE + SLIDE_DWELL - 1).shutdown, 0);
  assert.equal(getSlideFrame(SLIDE_CYCLE * 2).index, 0);
  assert.equal(SLIDE_CYCLE, SLIDE_DWELL + SLIDE_OFF + SLIDE_ON);
});

test("Blender room ships as a self-contained mesh asset with no external textures", () => {
  const bytes = readFileSync(new URL("../public/room/room.glb", import.meta.url));
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  assert.ok(gltf.meshes.length > 100);
  assert.ok(gltf.images.length > 0);
  assert.ok(gltf.images.every((image) => image.bufferView !== undefined && !image.uri));
  assert.ok(gltf.buffers.every((buffer) => !buffer.uri));
  const working = gltf.animations.find((animation) => animation.name === "Working");
  assert.ok(working && working.channels.length >= 10, "The person has an exported working animation");
  for (const name of ["Desk_Setup", "Bed_Setup"]) {
    const node = gltf.nodes.find((node) => node.name === name);
    assert.ok(node, `${name} is a named furniture group`);
    const expected = name === "Desk_Setup" ? 1 : -1;
    assert.ok(Math.abs(node.rotation[1] - expected * Math.sin(Math.PI / 8)) < .00001);
    assert.ok(Math.abs(node.rotation[3] - Math.cos(Math.PI / 8)) < .00001);
  }
});
