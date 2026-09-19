import assert from "node:assert/strict";
import { test } from "node:test";
import { createCrtPower, POWER } from "../lib/crt/power.ts";
import { getCrtTimeline, getScrollProgress } from "../lib/crt/timeline.ts";

const offEnd = POWER.settleMs + POWER.offDurationMs;

test("a threshold crossing completes shutoff without another scroll event", () => {
  const power = createCrtPower();
  power.request(0.88, 0);
  assert.equal(power.sample(POWER.settleMs - 1).phase, "on");
  assert.equal(power.sample(POWER.settleMs + 450).shutdown, 0.5);
  assert.deepEqual(power.sample(offEnd), { shutdown: 1, phase: "off", animating: false });
});

test("progress beyond the threshold cannot scrub or restart the animation", () => {
  const power = createCrtPower();
  power.request(0.88, 0);
  power.request(1, 300);
  power.request(0.875, 500);
  assert.equal(power.sample(POWER.settleMs + 450).shutdown, 0.5);
  assert.equal(power.sample(offEnd).phase, "off");
});

test("a buffered return crossing starts a complete timed startup", () => {
  const power = createCrtPower();
  power.request(0.90, 0);
  power.sample(offEnd);
  power.request(0.86, 1500);
  assert.equal(power.sample(1700).phase, "off");
  power.request(0.84, 1800);
  assert.equal(power.sample(1800 + POWER.settleMs + 350).shutdown, 0.5);
  assert.equal(power.sample(1800 + POWER.settleMs + POWER.onDurationMs).phase, "on");
});

test("jitter around the shutoff point does not spam on and off", () => {
  const power = createCrtPower();
  power.request(0.871, 0);
  for (let time = 30; time < 1800; time += 30) power.request(time % 60 ? 0.869 : 0.871, time);
  assert.deepEqual(power.sample(1800), { shutdown: 1, phase: "off", animating: false });
});

test("brief large crossings are filtered by the settling buffer", () => {
  const power = createCrtPower();
  for (let time = 0; time < 1000; time += 40) power.request(time % 80 ? 0.84 : 0.90, time);
  power.request(0.84, 1000);
  assert.deepEqual(power.sample(2000), { shutdown: 0, phase: "on", animating: false });
});

test("an opposite request waits for full shutoff and a hold before startup", () => {
  const power = createCrtPower();
  power.request(0.90, 0);
  power.request(0.80, 450);
  assert.equal(power.sample(offEnd - 1).phase, "turning-off");
  assert.equal(power.sample(offEnd).shutdown, 1);
  assert.equal(power.sample(offEnd + POWER.holdMs - 1).phase, "off");
  assert.equal(power.sample(offEnd + POWER.holdMs + 350).shutdown, 0.5);
  assert.equal(power.sample(offEnd + POWER.holdMs + POWER.onDurationMs).phase, "on");
});

test("only the latest queued endpoint survives repeated requests", () => {
  const power = createCrtPower();
  power.request(0.90, 0);
  power.request(0.80, 300);
  power.request(0.90, 550);
  assert.deepEqual(power.sample(3000), { shutdown: 1, phase: "off", animating: false });
});

test("startup also finishes before a queued shutoff", () => {
  const power = createCrtPower();
  power.request(0.90, 0);
  power.sample(offEnd);
  power.request(0.80, 1600);
  const onStart = 1600 + POWER.settleMs;
  const onEnd = onStart + POWER.onDurationMs;
  power.request(0.90, onStart + 200);
  assert.equal(power.sample(onEnd - 1).phase, "turning-on");
  assert.equal(power.sample(onEnd).shutdown, 0);
  assert.equal(power.sample(onEnd + POWER.holdMs + POWER.offDurationMs).phase, "off");
});

test("hidden-tab time jumps settle before accepting new input", () => {
  const power = createCrtPower();
  power.request(0.90, 0);
  power.request(0.80, 350);
  assert.deepEqual(power.sample(10000), { shutdown: 0, phase: "on", animating: false });
  power.request(0.90, 11000);
  assert.equal(power.sample(11000 + POWER.settleMs + 450).shutdown, 0.5);
});

test("hero exit and complete résumé still precede the power threshold", () => {
  assert.equal(getScrollProgress(100, 6500, 1000), 0);
  assert.equal(getScrollProgress(0, 6500, 1000), 0);
  assert.equal(getCrtTimeline(POWER.offThreshold).reading, 1);
  assert.equal(getCrtTimeline(POWER.offThreshold).approach, 1);
});
