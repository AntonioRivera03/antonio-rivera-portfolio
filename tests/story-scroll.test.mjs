import assert from "node:assert/strict";
import { test } from "node:test";
import { CHAPTERS, cruise, currentChapter, getTravelDuration, RETURN, TRAVEL } from "../lib/story-scroll.ts";

test("travel starts and ends at rest, never overshoots, and holds a steady cruise", () => {
  for (const ramp of [.05, .2, .5]) {
    assert.equal(cruise(0, ramp), 0);
    assert.ok(Math.abs(cruise(1, ramp) - 1) < 1e-12);
    let previous = 0;
    for (let t = 0; t <= 1.0001; t += .005) {
      const position = cruise(t, ramp);
      assert.ok(position >= previous - 1e-12 && position <= 1 + 1e-12);
      previous = position;
    }
    // Gentle departure and landing: the first and last steps move less than the middle.
    const step = .01;
    const middle = cruise(.5 + step, ramp) - cruise(.5, ramp);
    assert.ok(cruise(step, ramp) < middle && 1 - cruise(1 - step, ramp) < middle);
  }
  const ramp = .2;
  const a = cruise(.4, ramp) - cruise(.35, ramp);
  const b = cruise(.7, ramp) - cruise(.65, ramp);
  assert.ok(Math.abs(a - b) < 1e-12, "cruise speed is constant between the ramps");
});

test("longer trips take longer, within sensible bounds, at a pace the scenes can keep", () => {
  const viewport = 900;
  assert.equal(getTravelDuration(0, viewport), TRAVEL.minMs);
  assert.ok(getTravelDuration(viewport * 3, viewport) < getTravelDuration(viewport * 12, viewport));
  assert.equal(getTravelDuration(viewport * 400, viewport), TRAVEL.maxMs);
  assert.equal(getTravelDuration(-viewport * 6, viewport), getTravelDuration(viewport * 6, viewport));
  // A full top-to-projects trip (~15 screens) plays for several seconds.
  const full = getTravelDuration(viewport * 15, viewport);
  assert.ok(full > 5000 && full < TRAVEL.maxMs);
});

test("back to the top is quick", () => {
  const viewport = 900;
  const page = viewport * 16;
  assert.ok(getTravelDuration(page, viewport, RETURN) < getTravelDuration(page, viewport, TRAVEL) / 2);
  assert.ok(getTravelDuration(page, viewport, RETURN) <= 2600);
});

test("the current chapter is the last one whose stop has reached mid-screen", () => {
  const stops = [["passions", 5000], ["resume", 1000], ["skills", 9000]];
  assert.equal(currentChapter(stops, 0, 1000), null);
  assert.equal(currentChapter(stops, 600, 1000), "resume");
  assert.equal(currentChapter(stops, 4600, 1000), "passions");
  assert.equal(currentChapter(stops, 20000, 1000), "skills");
  assert.deepEqual(CHAPTERS.map((chapter) => chapter.id), ["resume", "passions", "skills", "projects", "contact"]);
});
