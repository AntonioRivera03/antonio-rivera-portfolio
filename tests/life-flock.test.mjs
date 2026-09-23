import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { test } from "node:test";
import { birdBounds, flockSize, SPECIES, speciesById } from "../lib/life/birds.ts";
import { footprint, glidePath, layoutFlock, mirror, reveal, skyFor } from "../lib/life/flock.ts";
import { indexWriting, searchWriting, writing } from "../lib/life/writing.ts";

const entries = indexWriting(writing, SPECIES.map((species) => species.id));

test("every piece gets a unique id and a real bird, and neighbors fly as different species", () => {
  assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
  for (const entry of entries) assert.ok(speciesById.has(entry.bird), entry.bird);
  for (let i = 1; i < entries.length; i++) assert.notEqual(entries[i].bird, entries[i - 1].bird);
  const twice = indexWriting([{ title: "Same", kind: "post", about: [] }, { title: "Same", kind: "post", about: [] }], ["heron"]);
  assert.deepEqual(twice.map((entry) => entry.id), ["same", "same-2"]);
  assert.equal(indexWriting([{ title: "Mine", kind: "post", about: [], bird: "owl" }], ["heron"])[0].bird, "owl");
});

test("search matches every word across titles and subjects, ignoring case and accents, titles first", () => {
  assert.deepEqual(searchWriting(entries, "   "), []);
  const japanese = searchWriting(entries, "Japanese");
  assert.ok(japanese.length >= 6);
  assert.ok(japanese.every((entry) => entry.terms.includes("japanese")));
  assert.deepEqual(searchWriting(entries, "japanese cooking").map((entry) => entry.title).sort(), ["Dashi from scratch, and from a packet", "Onigiri for the road"]);
  assert.deepEqual(searchWriting(entries, "KÉIGO").map((entry) => entry.title), ["Keigo, in the order you actually need it"]);
  assert.equal(searchWriting(entries, "敬語").length, 1);
  // A title word outranks a subject: "evals" is in two titles and a subject elsewhere.
  const evals = searchWriting(entries, "evals");
  assert.equal(evals[0].title, "Evals before prompts");
  assert.deepEqual(searchWriting(entries, "zzz"), []);
});

test("every species' flight has a sensible box, the same both ways", () => {
  assert.equal(new Set(SPECIES.map((species) => species.id)).size, SPECIES.length);
  for (const species of SPECIES) {
    const box = birdBounds(species);
    const width = box.right - box.left, height = box.bottom - box.top;
    assert.ok(Number.isFinite(width) && Number.isFinite(height), species.id);
    assert.ok(width > 20 && width < 260 && height > 14 && height < 200, `${species.id}: ${width}×${height}`);
    assert.ok(box.left < 0 && box.right > 0 && box.top < 0 && box.bottom > 0, species.id);
    const flipped = mirror(box);
    assert.equal(flipped.right - flipped.left, width);
  }
  // Bigger birds look bigger.
  const width = (id) => { const box = birdBounds(speciesById.get(id)); return box.right - box.left; };
  assert.ok(width("heron") > width("mallard") && width("mallard") > width("goldfinch"));
});

// Titles measured roughly as the page sets them: up to 220px (or 44% of a phone) wide, wrapping.
const itemsFor = (list, width = 1440) => list.map((entry) => {
  const max = Math.min(220, width * 0.44), text = entry.title.length * 6.6;
  const bird = birdBounds(speciesById.get(entry.bird), flockSize(width));
  return { id: entry.id, bird, label: { width: Math.min(max, text + 28), height: 12 + 17 * Math.ceil(text / (max - 28)) } };
});
const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

test("the flock hovers inside the open sky, and no bird or title can cover another", () => {
  for (const [width, height] of [[1440, 900], [1024, 768], [390, 844]]) {
    const sky = skyFor(width, height);
    const items = itemsFor(searchWriting(entries, "japanese"), width);
    const slots = layoutFlock(items, sky);
    assert.ok(slots.size >= (width < 700 ? 3 : 6), `${width}×${height} placed ${slots.size}`);
    const boxes = items.filter((item) => slots.has(item.id)).map((item) => footprint(item, slots.get(item.id)));
    for (const box of boxes) assert.ok(box.left >= sky.left && box.right <= sky.right && box.top >= sky.top && box.bottom <= sky.bottom);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!overlaps(boxes[i], boxes[j]));
  }
});

test("birds already hovering keep their places as the search changes, and the flock stays centered", () => {
  const sky = skyFor(1440, 900);
  const first = layoutFlock(itemsFor(searchWriting(entries, "llms")), sky);
  const kept = searchWriting(entries, "evals");
  const second = layoutFlock(itemsFor(kept), sky, first);
  for (const entry of kept) assert.deepEqual(second.get(entry.id), first.get(entry.id));
  const lone = layoutFlock(itemsFor(searchWriting(entries, "kimchi")), sky).values().next().value;
  assert.ok(Math.abs(lone.x - (sky.left + sky.right) / 2) < 12 && Math.abs(lone.y - (sky.top + sky.bottom) / 2) < 12);
});

test("more birds than the sky holds are left out rather than crowded", () => {
  const sky = skyFor(700, 500);
  const many = itemsFor(entries, 700).concat(itemsFor(entries, 700).map((item) => ({ ...item, id: `${item.id}-again` })));
  const slots = layoutFlock(many, sky);
  assert.ok(slots.size < many.length && slots.size > 0);
  // The best-ranked results are the ones kept.
  assert.ok(slots.has(many[0].id));
});

test("titles surface near the pointer and fade with distance; flights begin and end where asked", () => {
  const bird = { left: 100, top: 100, right: 160, bottom: 140 };
  const label = { left: 60, top: 60, right: 200, bottom: 92 };
  assert.equal(reveal(null, bird, label), 0);
  assert.equal(reveal({ x: 130, y: 120 }, bird, label), 1);
  assert.ok(reveal({ x: 130, y: 220 }, bird, label) > 0 && reveal({ x: 130, y: 220 }, bird, label) < 1);
  assert.equal(reveal({ x: 600, y: 600 }, bird, label), 0);
  const a = { x: -140, y: 80 }, b = { x: 500, y: 300 };
  assert.deepEqual(glidePath(a, b, 0, 50), a);
  assert.deepEqual(glidePath(a, b, 1, 50), b);
});

// Canvas size of a WebP, from its VP8X, VP8L, or VP8 header.
function webpSize(file) {
  const data = readFileSync(file);
  assert.equal(data.toString("ascii", 0, 4), "RIFF");
  assert.equal(data.toString("ascii", 8, 12), "WEBP");
  const chunk = data.toString("ascii", 12, 16);
  if (chunk === "VP8X") return [1 + data.readUIntLE(24, 3), 1 + data.readUIntLE(27, 3)];
  if (chunk === "VP8L") { const bits = data.readUInt32LE(21); return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)]; }
  return [data.readUInt16LE(26) & 0x3fff, data.readUInt16LE(28) & 0x3fff];
}

test("the valley's layers share one frame and stay light to load", () => {
  let total = 0;
  for (const layer of ["sky", "range", "hills", "near"]) {
    const file = new URL(`../public/life/${layer}.webp`, import.meta.url);
    assert.deepEqual(webpSize(file), [2560, 1440], layer);
    total += statSync(file).size;
  }
  assert.ok(total < 1800 * 1024, `${Math.round(total / 1024)} KB`);
});
