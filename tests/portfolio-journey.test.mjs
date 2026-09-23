import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createCrtPower } from "../lib/crt/power.ts";
import { createCompanionSequence } from "../lib/crt/companion.ts";
import { createPortfolioSequence, getJourneyTimeline, getSkillOffset, getJourneyDistance, getMergeStart, getChapterStops, getReadingGaze, JOURNEY } from "../lib/crt/journey.ts";
import { skills, skillColumns, skillGroups, splitSkillColumns } from "../lib/skills.ts";
import { getSlideFrame, SLIDE_DWELL, SLIDE_OFF, SLIDE_ON, SLIDE_CYCLE } from "../lib/room/slides.ts";

const create = () => createPortfolioSequence(createCompanionSequence(createCrtPower()));
function run(sequence, resume, passions, journey, start, end) {
  const frames = [];
  for (let now = start; now <= end; now += 16) frames.push(sequence.sample(resume, passions, journey, now));
  return frames;
}

test("skill groups keep every original skill once, with whole groups in two balanced columns", () => {
  const original = ["PHP", "Java", "TypeScript", "JavaScript", "Python", "SQL", "C#", "Go", "Rust", "Dart",
    "Shell", "Kotlin", "HTML", "CSS", ".NET", "React", "Next.js", "Three.js", "Tailwind CSS",
    "FastAPI", "Flask", "Django", "Laminas", "Express", "Prisma", "Pandas", "PHPUnit", "GTK4",
    "ratatui", "shadcn", "Agentic Workflows", "AI Integrations", "MCP (Model Context Protocol)",
    "RAG (Retrieval-Augmented Generation)", "Vector Databases (Qdrant)", "Hybrid Search Retrieval",
    "OCR (RapidOCR)", "Docker", "Kubernetes", "Docker Compose", "AWS", "Google Cloud (GCP)",
    "Cloudflare", "Supabase", "Vercel", "Vite", "Linux", "CI/CD", "Git", "GitHub", "NoSQL",
    "MongoDB", "NeonDB (PostgreSQL)", "SQLite", "JDBC", "Poppler", "Cairo", "Microservices",
    "REST APIs", "API Design", "Database Design", "Responsive Design", "Web Scraping",
    "Unit Testing", "Frontend Test Automation", "Selenium", "Government Compliance", "Payroll Systems"];
  assert.equal(skills.length, original.length);
  assert.equal(new Set(skills).size, skills.length);
  assert.deepEqual([...skills].sort(), [...original].sort());
  assert.deepEqual(skillColumns.flat(), [...skillGroups]);
  assert.ok(skillColumns.every((column) => column.length > 0));
  const height = (column) => column.reduce((sum, group) => sum + group.core.length * 2 + group.more.length + 1.4, 0);
  const [left, right] = skillColumns.map(height);
  assert.ok(Math.abs(left - right) / (left + right) < .08, `columns ${left} and ${right} should balance`);
  assert.deepEqual(splitSkillColumns([skillGroups[0]]), [[skillGroups[0]], []]);
});

test("chapter stops follow the story order and land where each scene reads best", () => {
  for (const viewport of [640, 900, 1318]) for (const listHeight of [1600, 2700, 4500]) {
    const resumeDistance = viewport * 5.5;
    const journeyDistance = getJourneyDistance(viewport, listHeight);
    const stops = getChapterStops({ resumeDistance, viewport, journeyDistance, listHeight, passionsViewports: 3.5, readingStart: .32 });
    assert.ok(stops.resume < stops.passions && stops.passions < stops.skills && stops.skills < stops.projects);
    assert.ok(stops.resume / resumeDistance > .32, "the camera has settled on the résumé");
    assert.ok(stops.passions > resumeDistance + viewport * 3.5 * .6, "the Passions copy is fully visible");
    const journey = (stops.skills - resumeDistance - viewport * 3.5) / journeyDistance;
    const lists = (journey - JOURNEY.listsStart) / (JOURNEY.listsEnd - JOURNEY.listsStart);
    const top = getSkillOffset(lists, listHeight, viewport);
    assert.ok(top > 0 && top < viewport * .5, "the first groups have risen into view");
    assert.equal(stops.projects, resumeDistance + viewport * 3.5 + journeyDistance);
  }
});

test("the companion reads the skills only while they pass", () => {
  assert.equal(getReadingGaze(0).weight, 0);
  assert.equal(getReadingGaze(1).weight, 0);
  assert.ok(getReadingGaze(.5).weight > .99);
  for (let lists = 0; lists <= 1; lists += .01) assert.ok(Math.abs(getReadingGaze(lists).x) <= .11 + 1e-9);
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
  assert.ok(working, "The person has an exported working animation");
  const animated = new Set(working.channels.map((channel) => gltf.nodes[channel.target.node].name));
  for (const name of ["Person / typing left hand", "Person / typing right hand", "Person / head turn", "Person / posture"]) {
    assert.ok(animated.has(name), `${name} moves in the working loop`);
  }
  for (const name of ["Desk_Setup", "Bed_Setup"]) {
    const node = gltf.nodes.find((node) => node.name === name);
    assert.ok(node, `${name} is a named furniture group`);
    const expected = name === "Desk_Setup" ? 1 : -1;
    assert.ok(Math.abs(node.rotation[1] - expected * Math.sin(Math.PI / 8)) < .00001);
    assert.ok(Math.abs(node.rotation[3] - Math.cos(Math.PI / 8)) < .00001);
  }
});
