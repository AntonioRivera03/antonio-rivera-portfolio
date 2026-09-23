// Prints the /resume page to public/antonio-rivera-resume.pdf with headless Chrome.
// Usage: npm run dev, then `npm run resume:pdf [-- http://localhost:5173/resume]`.
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const url = process.argv[2] ?? "http://localhost:5173/resume";
const out = resolve("public/antonio-rivera-resume.pdf");
const candidates = [process.env.CHROME, "google-chrome-stable", "google-chrome", "chromium", "chromium-browser"].filter(Boolean);
const chrome = candidates.find((bin) => {
  try { execFileSync("which", [bin], { stdio: "ignore" }); return true; } catch { return existsSync(bin); }
});
if (!chrome) throw new Error("Chrome or Chromium is required. Set CHROME=/path/to/chrome.");

execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=4000", `--print-to-pdf=${out}`, url], { stdio: "inherit" });
console.log(`Wrote ${out} (${statSync(out).size} bytes) from ${url}`);
