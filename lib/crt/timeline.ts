/** Camera and document position follow scroll; CRT power is timed separately. */
export const STAGES = { approachEnd: 0.32, readingEnd: 0.87 } as const;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (value: number) => value * value * (3 - 2 * value);

export function getCrtTimeline(progress: number) {
  const position = clamp(progress);
  const approach = smoothstep(clamp(position / STAGES.approachEnd));
  const reading = clamp((position - STAGES.approachEnd) / (STAGES.readingEnd - STAGES.approachEnd));
  const phase = position < STAGES.approachEnd ? "approach" : position < STAGES.readingEnd ? "reading" : "end";
  return { approach, reading, phase };
}

export function getScrollProgress(top: number, height: number, viewport: number) {
  return clamp(-top / Math.max(1, height - viewport));
}
