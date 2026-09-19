import assert from "node:assert/strict";
import { test } from "node:test";
import { createResumeDocument } from "../lib/crt/document.ts";
import { resume } from "../lib/crt/resume.ts";
import { getCrtTimeline } from "../lib/crt/timeline.ts";
import { POWER } from "../lib/crt/power.ts";

// Deterministic Canvas metrics exercise layout without a browser or GPU.
function recordingCanvas() {
  const context = {
    font: "10px serif",
    text: [],
    image: null,
    measureText(text) {
      const size = Number(this.font.match(/([\d.]+)px/)[1]);
      return { width: text.length * size * (this.font.startsWith("bold") ? 0.60 : 0.52) };
    },
    fillText(text, x, y) {
      this.text.push({ text, x, y, width: this.measureText(text).width, height: Number(this.font.match(/([\d.]+)px/)[1]) });
    },
    drawImage(source, x, y) { this.image = { source, x, y }; },
    fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, save() {}, rect() {}, clip() {}, restore() {},
  };
  let width = 0;
  return {
    height: 0,
    get width() { return width; },
    set width(value) { width = value; context.text = []; },
    getContext() { return context; },
    context,
  };
}

function withDocument(width, check) {
  const original = globalThis.document;
  const canvases = [];
  globalThis.document = { createElement() { const canvas = recordingCanvas(); canvases.push(canvas); return canvas; } };
  let document;
  try {
    document = createResumeDocument(resume);
    document.layout(width);
    document.draw(0);
    check(document, canvases[0], canvases[1]);
  } finally {
    document?.dispose();
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  }
}

for (const width of [250, 350, 650]) {
  test(`résumé text stays within the page and never overlaps at ${width}px`, () => {
    withDocument(width, (_document, _screen, page) => {
      const lines = page.context.text;
      for (const line of lines) {
        assert.ok(line.x >= 70 - 0.01 && line.x + line.width <= 934.01, `Out of bounds: ${line.text}`);
      }
      for (let i = 0; i < lines.length; i++) {
        for (const other of lines.slice(i + 1)) {
          const line = lines[i];
          const overlaps = line.x < other.x + other.width && line.x + line.width > other.x
            && line.y < other.y + other.height && line.y + line.height > other.y;
          assert.equal(overlaps, false, `Overlapping text: ${line.text} / ${other.text}`);
        }
      }
      for (const entry of resume.sections[0].entries) {
        const date = lines.find((line) => line.text === entry.date);
        assert.ok(date, `Missing date: ${entry.date}`);
        assert.ok(Math.abs(date.x + date.width - 934) < 0.01);
        const heading = lines.find((line) => entry.title.startsWith(line.text));
        if (width === 650) assert.equal(date.y, heading.y);
        if (width === 250) assert.ok(date.y > heading.y);
      }
    });
  });
}

for (const width of [250, 350, 650]) {
  test(`the final résumé entry is readable before shutdown at ${width}px`, () => {
    withDocument(width, (document, screen, page) => {
      assert.ok(document.scrollDistance > 0);
      document.draw(getCrtTimeline(POWER.offThreshold).reading);
      const lastLine = page.context.text.at(-1);
      const visibleTop = screen.context.image.y + lastLine.y;
      assert.ok(visibleTop >= 110);
      assert.ok(visibleTop + lastLine.height <= screen.height - 22);
    });
  });
}
