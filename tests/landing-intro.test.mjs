import assert from "node:assert/strict";
import { test } from "node:test";
import { getIntroFrame, INTRO, INTRO_NAME, INTRO_TYPING_END, INTRO_END } from "../lib/landing-intro.ts";

test("the apple fully fades in at center before moving; typing waits for its arrival", () => {
  let previous = getIntroFrame(0);
  for (let time = 0; time <= INTRO_END + 100; time += 10) {
    const frame = getIntroFrame(time);
    assert.ok(frame.appleOpacity >= previous.appleOpacity);
    assert.ok(frame.appleOffset <= previous.appleOffset);
    assert.ok(frame.characters >= previous.characters);
    assert.ok(frame.role >= previous.role);
    if (frame.appleOpacity < 1) assert.equal(frame.appleOffset, 1);
    if (frame.appleOffset > 0) {
      assert.equal(frame.characters, 0);
      assert.equal(frame.cursor, false);
    }
    if (frame.characters < INTRO_NAME.length) assert.equal(frame.role, 0);
    if (frame.role < 1) assert.equal(frame.complete, false);
    previous = frame;
  }
  assert.equal(getIntroFrame(INTRO.fadeEnd).appleOpacity, 1);
  assert.equal(getIntroFrame(INTRO.slideStart).appleOffset, 1);
  assert.equal(getIntroFrame(INTRO.slideEnd).appleOffset, 0);
});

test("a blinking block leads the name, each character is typed, and the block vanishes on the last character", () => {
  assert.equal(getIntroFrame(INTRO.slideEnd).cursor, true);
  assert.equal(getIntroFrame(INTRO.slideEnd).characters, 0);
  for (let count = 0; count < INTRO_NAME.length; count++) {
    const frame = getIntroFrame(INTRO.typingStart + count * INTRO.characterDuration);
    assert.equal(frame.characters, count);
    assert.equal(frame.cursor, true);
    assert.equal(frame.role, 0);
  }
  const typed = getIntroFrame(INTRO_TYPING_END);
  assert.equal(typed.characters, INTRO_NAME.length);
  assert.equal(typed.cursor, false);
  assert.equal(typed.role, 0);
  assert.equal(typed.complete, false);
});

test("scroll unlock waits for the entire role reveal and the finished frame stays stable", () => {
  const midpoint = getIntroFrame(INTRO_TYPING_END + INTRO.roleDuration / 2);
  assert.equal(midpoint.role, 0.5);
  assert.equal(midpoint.complete, false);
  assert.deepEqual(getIntroFrame(INTRO_END), {
    phase: "complete", appleOpacity: 1, appleOffset: 0,
    characters: INTRO_NAME.length, cursor: false, role: 1, complete: true,
  });
  assert.deepEqual(getIntroFrame(INTRO_END + 60000), getIntroFrame(INTRO_END));
});
