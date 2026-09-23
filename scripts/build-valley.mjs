// Paints the life page's valley with headless Chrome and saves its layers to public/life/*.webp.
// Usage: npm run life:valley                       every layer, full size
//        npm run life:valley -- --preview [width]  the whole scene in one image, to assets/painting/generated/
//        npm run life:valley -- --layer near       one layer
// Uses the GPU when Chrome can reach it; set CHROME=/path/to/chrome if it isn't on PATH.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const LAYERS = ["sky", "range", "hills", "near"];
const WIDTH = 2560;
const HEIGHT = 1440;
// Brush radius in pixels at full size, near and far; the far distance paints broader and softer.
const RADIUS = [4.5, 7];
// Passes of the brush: a second one flattens the render further into strokes.
const STROKES = 1;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : undefined; };
const preview = flag("preview");
const width = preview ? Number(value("preview") ?? 1280) : WIDTH;
const height = Math.round(width * HEIGHT / WIDTH);
const layers = preview ? [value("layer") ?? "all"] : value("layer") ? [value("layer")] : LAYERS;
const samples = Number(value("samples") ?? (preview ? 2 : 3));
const strokes = Number(value("strokes") ?? STROKES);
const out = resolve(preview ? "assets/painting/generated" : "public/life");

const read = (file) => readFileSync(resolve("assets/painting", file), "utf8");
const scene = read("valley.glsl");
const brush = read("brush.glsl");

const candidates = [process.env.CHROME, "google-chrome-stable", "google-chrome", "chromium", "chromium-browser"].filter(Boolean);
const chrome = candidates.find((bin) => {
  try { execFileSync("which", [bin], { stdio: "ignore" }); return true; } catch { return existsSync(bin); }
});
if (!chrome) throw new Error("Chrome or Chromium is required. Set CHROME=/path/to/chrome.");

async function paint() {
  const profile = mkdtempSync(join(tmpdir(), "valley-chrome-"));
  const port = 9400 + Math.floor(Math.random() * 400);
  const browser = spawn(chrome, [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run",
    "--use-angle=vulkan", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--disable-gpu-watchdog",
    "about:blank",
  ], { stdio: "ignore" });

  try {
    let target;
    for (let i = 0; i < 100 && !target; i++) {
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch { /* not up yet */ }
      if (!target) await new Promise((r) => setTimeout(r, 100));
    }
    if (!target) throw new Error("Chrome did not start.");
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => socket.addEventListener("open", r, { once: true }));
    let id = 0;
    const waiting = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      waiting.get(message.id)?.(message);
      waiting.delete(message.id);
    });
    const send = (method, params = {}) => new Promise((done, fail) => {
      waiting.set(++id, (message) => (message.error ? fail(new Error(`${method}: ${message.error.message}`)) : done(message.result)));
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
      const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    };

    await evaluate(read("painter.js"));
    console.log(await evaluate(`(() => { const gl = document.createElement("canvas").getContext("webgl2"); const info = gl.getExtension("WEBGL_debug_renderer_info"); return gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER); })()`));
    mkdirSync(out, { recursive: true });
    const scale = width / WIDTH;
    for (const layer of layers) {
      const started = Date.now();
      const format = preview ? "image/png" : "image/webp";
      const options = { scene, brush, width, height, layer, samples, radius: RADIUS.map((r) => Math.max(1.5, r * scale)), strokes, format, quality: 0.86 };
      const data = await evaluate(`paintValley(${JSON.stringify(options)})`);
      const file = join(out, `${preview ? `preview-${layer}` : layer}.${preview ? "png" : "webp"}`);
      writeFileSync(file, Buffer.from(data.split(",")[1], "base64"));
      console.log(`${file.replace(`${process.cwd()}/`, "")}  ${(statSync(file).size / 1024).toFixed(0)} KB  ${((Date.now() - started) / 1000).toFixed(1)}s`);
    }
    socket.close();
  } finally {
    // Chrome keeps writing to its profile as it shuts down; wait for it before clearing up.
    const exited = new Promise((resolve) => browser.once("exit", resolve));
    browser.kill();
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

await paint();
