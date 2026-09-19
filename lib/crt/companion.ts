import type { createCrtPower } from "./power";

export const PASSIONS = { wipeEnd: 0.34, retreatStart: 0.16, retreatEnd: 0.60, travelViewports: 3.5 } as const;
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function getPassionsTimeline(position: number) {
  const wipe = smooth(position / PASSIONS.wipeEnd);
  const retreat = smooth((position - PASSIONS.retreatStart) / (PASSIONS.retreatEnd - PASSIONS.retreatStart));
  return { wipe, retreat, copy: smooth((retreat - 0.7) / 0.3) };
}

/** Keep the original reading distance; the new scene gets its own scroll segment. */
export function getStoryScroll(top: number, resumeDistance: number, viewport: number) {
  const travelled = Math.max(0, -top);
  return {
    resume: clamp(travelled / Math.max(1, resumeDistance)),
    passions: clamp((travelled - resumeDistance) / Math.max(1, viewport * PASSIONS.travelViewports)),
  };
}

export function getCompanionFraming(width: number, height: number, fov = 35) {
  const mobile = width <= 700;
  const projectedWidth = 2.45;
  const pixels = Math.min(width * (mobile ? 0.36 : 0.165), height * (mobile ? 0.216 : 0.312) * projectedWidth / 2.12);
  const distance = projectedWidth * height / (2 * Math.tan(fov * Math.PI / 360) * pixels);
  const viewHeight = 2 * Math.tan(fov * Math.PI / 360) * distance;
  const x = mobile ? 0 : viewHeight * width / height * 0.24;
  const y = 2.68 + (mobile ? -0.25 * viewHeight : 0);
  return { x, y, z: distance + 0.25, yaw: Math.atan2(x, distance) + 0.22 };
}

/** Shutdown precedes the overlapping wipe and retreat; startup waits for placement. */
export function createCompanionSequence(power: ReturnType<typeof createCrtPower>) {
  let position = 0;
  let display: "resume" | "eyes" = "resume";
  let previousTime: number | undefined;
  let arrivedAt = 0;

  return {
    sample(resume: number, target: number, now: number) {
      const elapsed = previousTime === undefined ? 0 : Math.min(50, Math.max(0, now - previousTime));
      previousTime = now;
      const destination = clamp(target);
      let powerFrame = power.sample(now);

      // Blank the eyes before reversing the camera or restoring the document.
      if (display === "eyes" && destination < PASSIONS.retreatEnd) {
        power.request(1, now);
        powerFrame = power.sample(now);
        if (powerFrame.phase === "off") display = "resume";
      }

      if (display === "resume") {
        power.request(destination > 0 || position > 0 ? 1 : resume, now);
        powerFrame = power.sample(now);
      }

      const canMove = powerFrame.phase === "off" || (display === "eyes" && destination >= PASSIONS.retreatEnd);
      if (canMove) {
        const step = elapsed / 1500;
        position += Math.sign(destination - position) * Math.min(Math.abs(destination - position), step);
      }

      const timeline = getPassionsTimeline(position);
      if (display === "resume" && timeline.retreat === 1 && destination >= PASSIONS.retreatEnd && powerFrame.phase === "off") {
        display = "eyes";
        arrivedAt = now;
      }
      if (display === "eyes" && destination >= PASSIONS.retreatEnd) power.request(0, now);
      else if (position === 0 && destination === 0) power.request(resume, now);
      powerFrame = power.sample(now);

      return {
        ...timeline,
        position,
        display,
        power: powerFrame,
        resume: position > 0 || display === "eyes" ? 1 : resume,
        companionTime: display === "eyes" ? Math.max(0, now - arrivedAt) / 1000 : 0,
        animating: position !== destination || powerFrame.animating || display === "eyes",
      };
    },
  };
}

/** Quick gaze darts with short rests, natural blinks, and a six-second hover. */
export function getCompanionExpression(seconds: number) {
  const cycle = ((seconds % 16) + 16) % 16;
  const gazeCycle = ((seconds % 6.5) + 6.5) % 6.5;
  const looks = [[0, 0], [0.12, 0.025], [-0.10, -0.035], [0.08, 0.065], [-0.05, 0], [0, 0]];
  const segment = Math.min(4, Math.floor(gazeCycle / 1.3));
  const blend = smooth((gazeCycle - segment * 1.3) / 0.16);
  const gazeX = looks[segment][0] + (looks[segment + 1][0] - looks[segment][0]) * blend;
  const gazeY = looks[segment][1] + (looks[segment + 1][1] - looks[segment][1]) * blend;
  let blink = 1;
  for (const at of [2.4, 7.1, 11.8, 12.15]) {
    const distance = Math.abs(cycle - at);
    blink = Math.min(blink, smooth(distance / 0.11));
  }
  const entrance = smooth(seconds / 1.2);
  return { gazeX, gazeY, blink, hover: Math.sin(seconds * Math.PI / 3) * 0.065 * entrance };
}
