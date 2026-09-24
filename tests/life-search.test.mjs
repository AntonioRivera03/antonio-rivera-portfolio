import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { test } from "node:test";
import { DROP, dropletAt, dropletShape, PANEL_TOP, panelRect, PILL_GAP, pillTop } from "../lib/life/droplet.ts";
import { indexWriting, searchWriting, TOPICS, writing } from "../lib/life/writing.ts";

const entries = indexWriting(writing);

test("every piece gets a unique id and a topic with its own color", () => {
  assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
  for (const entry of entries) assert.ok(TOPICS[entry.topic], entry.title);
  const colors = Object.values(TOPICS).map((topic) => topic.color);
  assert.equal(new Set(colors).size, colors.length);
  const twice = indexWriting([{ title: "Same", kind: "post", topic: "ai", about: [] }, { title: "Same", kind: "post", topic: "ai", about: [] }]);
  assert.deepEqual(twice.map((entry) => entry.id), ["same", "same-2"]);
});

test("search matches every word across titles, topics and subjects, ignoring case and accents, titles first", () => {
  assert.deepEqual(searchWriting(entries, "   "), []);
  const japanese = searchWriting(entries, "Japanese");
  assert.ok(japanese.length >= 6);
  assert.ok(japanese.every((entry) => entry.terms.includes("japanese")));
  assert.deepEqual(searchWriting(entries, "japanese cooking").map((entry) => entry.title).sort(), ["Dashi from scratch, and from a packet", "Onigiri for the road"]);
  assert.deepEqual(searchWriting(entries, "KÉIGO").map((entry) => entry.title), ["Keigo, in the order you actually need it"]);
  assert.equal(searchWriting(entries, "敬語").length, 1);
  // A title word outranks a subject: "evals" is in two titles and a subject elsewhere.
  assert.equal(searchWriting(entries, "evals")[0].title, "Evals before prompts");
  assert.ok(searchWriting(entries, "ai").every((entry) => entry.topic === "ai" || entry.terms.includes("ai")));
  assert.deepEqual(searchWriting(entries, "zzz"), []);
});

test("the droplet swells, rises and pinches off, then hangs free and round", () => {
  let previous = dropletAt(0);
  assert.ok(previous.lift < previous.r, "it begins inside the pill");
  for (let s = 0.02; s <= 1.0001; s += 0.02) {
    const drop = dropletAt(s);
    assert.ok(drop.r >= previous.r && drop.lift >= previous.lift);
    if (s < DROP.snap) assert.ok(drop.waist > 0);
    else assert.equal(drop.waist, 0);
    previous = drop;
  }
  // The neck thins as it nears the pinch.
  assert.ok(dropletAt(DROP.snap * 0.9).waist < dropletAt(DROP.snap * 0.4).waist / 2);
  const free = dropletAt(1);
  assert.equal(free.r, DROP.endRadius);
  assert.equal(free.lift, DROP.lift);
  assert.ok(Math.abs(free.stretch) < 1e-9, "it settles round before it grows into the panel");
});

test("the droplet and its neck are one closed shape that rests on the pill's edge", () => {
  const x = 700, edge = 426;
  for (let s = 0; s < DROP.snap; s += 0.05) {
    const drop = dropletAt(s);
    const shape = dropletShape(x, edge, drop);
    assert.ok(shape.path && !shape.path.includes("NaN") && shape.path.endsWith("Z"), `s=${s}`);
    assert.ok(Math.abs(shape.top + shape.height - edge) < 1e-9, "the neck meets the pill's top edge");
    assert.ok(Math.abs(shape.left + shape.width / 2 - x) < 1e-9, "centred over the pill");
  }
  const free = dropletShape(x, edge, dropletAt(1));
  assert.equal(free.path, null);
  assert.equal(free.width, 2 * DROP.endRadius);
  assert.ok(free.top + free.height < edge, "once free it hangs clear of the pill");
});

test("the panel fits its results, scrolls past the room it has, and stays clear of the pill and controls", () => {
  for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [1920, 600]]) {
    const view = { width, height }, pill = 48;
    const bottom = pillTop(height, pill, true);
    assert.equal(bottom, height - PILL_GAP - pill);
    for (const content of [80, 300, 5000]) {
      const rect = panelRect(view, pill, content);
      assert.ok(rect.top >= PANEL_TOP - 1e-9 && rect.top + rect.height <= bottom, `${width}×${height} ${content}`);
      assert.ok(Math.abs(rect.left + rect.width / 2 - width / 2) < 1e-9 && rect.width <= 560 && rect.width <= width - 32);
      if (content < 300) assert.equal(rect.height, Math.max(64, content));
    }
    const tall = panelRect(view, pill, 5000);
    assert.ok(tall.height < 5000, "long result lists scroll inside the panel");
  }
  // The panel rests right above the lowered pill, where its droplet came from, and grows upward.
  const short = panelRect({ width: 1440, height: 900 }, 48, 200), long = panelRect({ width: 1440, height: 900 }, 48, 400);
  assert.equal(short.top + short.height, long.top + long.height);
  assert.ok(pillTop(900, 48, true) - (short.top + short.height) < DROP.lift);
  assert.ok(long.top < short.top);
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

test("the painting and its upscale share one frame, and stay light enough for a backdrop", () => {
  const native = new URL("../public/life/painting.webp", import.meta.url);
  const large = new URL("../public/life/painting-2560.webp", import.meta.url);
  const [w, h] = webpSize(native), [lw, lh] = webpSize(large);
  assert.deepEqual([w, h], [1672, 941]);
  assert.equal(lw, 2560);
  assert.ok(Math.abs(lw / lh - w / h) < 0.002, "same aspect at both sizes");
  assert.ok(statSync(native).size < 400 * 1024 && statSync(large).size < 700 * 1024);
});
