export const POWER = {
  offThreshold: 0.87,
  onThreshold: 0.85,
  settleMs: 160,
  offDurationMs: 900,
  onDurationMs: 700,
  holdMs: 240,
} as const;

export type PowerPhase = "on" | "turning-off" | "off" | "turning-on";

/** Scroll requests an endpoint; time drives each complete, non-interruptible transition. */
export function createCrtPower() {
  let shutdown: 0 | 1 = 0;
  let requested: 0 | 1 = 0;
  let requestedAt = 0;
  let holdUntil = 0;
  let transition: { from: 0 | 1; to: 0 | 1; startedAt: number; duration: number } | null = null;

  function advance(now: number) {
    // Reconcile elapsed time, including frames skipped while the tab was hidden.
    while (true) {
      if (transition) {
        const endsAt = transition.startedAt + transition.duration;
        if (now < endsAt) return;
        shutdown = transition.to;
        transition = null;
        holdUntil = endsAt + POWER.holdMs;
      }
      if (requested === shutdown) return;
      const startedAt = Math.max(requestedAt + POWER.settleMs, holdUntil);
      if (now < startedAt) return;
      transition = {
        from: shutdown,
        to: requested,
        startedAt,
        duration: requested ? POWER.offDurationMs : POWER.onDurationMs,
      };
    }
  }

  return {
    request(progress: number, now: number) {
      // Apply old requests up to this timestamp before accepting a new one.
      advance(now);
      const next = progress >= POWER.offThreshold ? 1 : progress <= POWER.onThreshold ? 0 : requested;
      if (next !== requested) { requested = next; requestedAt = now; }
    },
    sample(now: number) {
      advance(now);
      const elapsed = transition ? Math.min(1, Math.max(0, (now - transition.startedAt) / transition.duration)) : 0;
      const value = transition ? transition.from + (transition.to - transition.from) * elapsed : shutdown;
      const phase: PowerPhase = transition ? (transition.to ? "turning-off" : "turning-on") : (shutdown ? "off" : "on");
      return { shutdown: value, phase, animating: transition !== null || requested !== shutdown };
    },
  };
}
