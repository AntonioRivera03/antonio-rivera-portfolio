export const SLIDE_DWELL = 25_000;
export const SLIDE_OFF = 340;
export const SLIDE_ON = 560;
export const SLIDE_CYCLE = SLIDE_DWELL + SLIDE_OFF + SLIDE_ON;

/** Change the slide only at the fully black frame between shutdown and startup. */
export function getSlideFrame(elapsed: number) {
  const completed = Math.floor(Math.max(0, elapsed) / SLIDE_CYCLE);
  const at = Math.max(0, elapsed) % SLIDE_CYCLE;
  if (at < SLIDE_DWELL) return { index: completed % 2, phase: "on", shutdown: 0 };
  if (at < SLIDE_DWELL + SLIDE_OFF) {
    return { index: completed % 2, phase: "turning-off", shutdown: (at - SLIDE_DWELL) / SLIDE_OFF };
  }
  return { index: (completed + 1) % 2, phase: "turning-on", shutdown: 1 - (at - SLIDE_DWELL - SLIDE_OFF) / SLIDE_ON };
}
