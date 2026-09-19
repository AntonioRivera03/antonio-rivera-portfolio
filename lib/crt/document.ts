import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";
import type { Resume } from "./resume";

const WIDTH = 1024;
const HEIGHT = 768;
const CHROME = 110;
const MARGIN = 70;

/** Draw the résumé into a clipped document pane; window chrome never scrolls. */
export function createResumeDocument(resume: Resume) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  const page = document.createElement("canvas");
  const pageContext = page.getContext("2d");
  if (!pageContext) throw new Error("Canvas is unavailable.");
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  let logicalScale = 3;
  let pageHeight = HEIGHT;
  let previousProgress = -1;

  function layout(screenWidth: number) {
    logicalScale = WIDTH / Math.max(250, screenWidth);
    const fontSize = Math.round(16 * logicalScale);
    const lineHeight = Math.round(fontSize * 1.5);
    const bodyWidth = WIDTH - MARGIN * 2 - 20;
    type Line = { text: string; y: number; font: string; color: string };
    const lines: Line[] = [];
    let y = MARGIN;
    const add = (text: string, size = fontSize, bold = false, color = "#292b28") => {
      const font = `${bold ? "bold " : ""}${size}px Georgia, serif`;
      pageContext!.font = font;
      let line = "";
      for (const word of text.split(/\s+/)) {
        if (pageContext!.measureText(word).width > bodyWidth) {
          if (line) { lines.push({ text: line, y, font, color }); y += size * 1.45; line = ""; }
          for (const character of word) {
            if (pageContext!.measureText(line + character).width > bodyWidth) {
              lines.push({ text: line, y, font, color }); y += size * 1.45; line = "";
            }
            line += character;
          }
          continue;
        }
        const candidate = line ? `${line} ${word}` : word;
        if (line && pageContext!.measureText(candidate).width > bodyWidth) {
          lines.push({ text: line, y, font, color });
          y += size * 1.45;
          line = word;
        } else line = candidate;
      }
      if (line) { lines.push({ text: line, y, font, color }); y += size * 1.45; }
    };

    add(resume.name, Math.round(fontSize * 1.65), true);
    add(resume.role, fontSize, false, "#55594f");
    y += lineHeight * 0.35;
    resume.contact.forEach((line) => add(line, fontSize * 0.82, false, "#55594f"));
    for (const section of resume.sections) {
      y += lineHeight * 0.9;
      add(section.title, fontSize * 1.1, true);
      y += lineHeight * 0.15;
      for (const entry of section.entries) {
        if (entry.title) add(entry.title, fontSize, true);
        if (entry.detail) add(entry.detail, fontSize * 0.9);
        if (entry.date) add(entry.date, fontSize * 0.82, false, "#62665c");
        entry.paragraphs?.forEach((paragraph) => { y += lineHeight * 0.25; add(paragraph); });
        y += lineHeight * 0.5;
      }
    }
    pageHeight = Math.max(HEIGHT - CHROME - 26, Math.ceil(y + MARGIN));
    page.width = WIDTH - 30;
    page.height = pageHeight;
    pageContext!.fillStyle = "#e9e9dc";
    pageContext!.fillRect(0, 0, page.width, page.height);
    pageContext!.textBaseline = "top";
    for (const line of lines) {
      pageContext!.font = line.font;
      pageContext!.fillStyle = line.color;
      pageContext!.fillText(line.text, MARGIN, line.y);
    }
    previousProgress = -1;
  }

  function draw(progress: number) {
    if (previousProgress === progress) return;
    previousProgress = progress;
    const ctx = context!;
    const paneHeight = HEIGHT - CHROME - 22;
    const offset = Math.max(0, pageHeight - paneHeight) * progress;
    ctx.fillStyle = "#b4b9ac";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#d3d6c7";
    ctx.fillRect(18, 15, WIDTH - 36, CHROME - 19);
    ctx.strokeStyle = "#555d50";
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 15, WIDTH - 36, HEIGHT - 30);
    ctx.beginPath(); ctx.moveTo(18, 64); ctx.lineTo(WIDTH - 18, 64); ctx.stroke();
    // The striped title bar and square close box echo early desktop document readers.
    ctx.lineWidth = 2;
    for (let y = 27; y < 57; y += 6) {
      ctx.beginPath(); ctx.moveTo(70, y); ctx.lineTo(WIDTH - 40, y); ctx.stroke();
    }
    ctx.fillStyle = "#d3d6c7";
    ctx.fillRect(320, 20, 384, 41);
    ctx.strokeRect(32, 28, 23, 23);
    ctx.fillStyle = "#293327";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 29px 'Courier New', monospace";
    ctx.fillText("resume — antonio rivera", WIDTH / 2, 42);
    ctx.textAlign = "left";
    ctx.font = "27px 'Courier New', monospace";
    ctx.fillText("File   Edit   View", 40, 85);
    ctx.save();
    ctx.beginPath(); ctx.rect(20, CHROME, WIDTH - 50, paneHeight); ctx.clip();
    ctx.drawImage(page, 20, CHROME - offset);
    ctx.restore();
    ctx.fillStyle = "#a3aa9b";
    ctx.fillRect(WIDTH - 28, CHROME, 10, paneHeight);
    const thumbHeight = Math.max(40, paneHeight * Math.min(1, paneHeight / pageHeight));
    ctx.fillStyle = "#596451";
    ctx.fillRect(WIDTH - 28, CHROME + (paneHeight - thumbHeight) * progress, 10, thumbHeight);
    texture.needsUpdate = true;
  }

  layout(350);
  draw(0);
  return {
    texture, draw, layout,
    get scrollDistance() { return Math.max(0, pageHeight - (HEIGHT - CHROME - 22)) / logicalScale; },
    dispose() { texture.dispose(); canvas.width = 1; canvas.height = 1; page.width = 1; page.height = 1; },
  };
}
