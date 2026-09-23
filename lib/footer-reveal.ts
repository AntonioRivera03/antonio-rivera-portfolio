const smooth = (value: number) => { const t = Math.min(1, Math.max(0, value)); return t * t * (3 - 2 * t); };

/** Sky, far hills, near hills, then the foreground develop in turn, like ink settling. */
export const FOOTER_STAGGER = [[0, 0.55], [0.12, 0.68], [0.24, 0.82], [0.36, 0.96]] as const;

export function getFooterReveal(reveal: number) {
  return FOOTER_STAGGER.map(([start, end]) => smooth((reveal - start) / (end - start)));
}
