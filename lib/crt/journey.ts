import type { createCompanionSequence } from "./companion";

export const JOURNEY = {
  centerEnd: 0.13,
  listsStart: 0.025,
  listsEnd: 0.70,
  mergeStart: 0.60,
  mergeEnd: 0.72,
  zoomStart: 0.73,
  zoomEnd: 0.84,
  roomStart: 0.90,
} as const;

export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const between = (n: number, start: number, end: number) => clamp((n - start) / (end - start));

export function getMergeStart(listHeight: number, viewport: number) {
  const halfway = (listHeight + viewport * 0.5 + 48) / (listHeight + viewport + 144);
  return JOURNEY.listsStart + halfway * (JOURNEY.listsEnd - JOURNEY.listsStart);
}

export function getJourneyTimeline(position: number, mergeStart: number = JOURNEY.mergeStart) {
  return {
    position,
    center: smooth(position / JOURNEY.centerEnd),
    lists: between(position, JOURNEY.listsStart, JOURNEY.listsEnd),
    merge: smooth(between(position, mergeStart, JOURNEY.mergeEnd)),
    zoom: smooth(between(position, JOURNEY.zoomStart, JOURNEY.zoomEnd)),
    white: smooth(between(position, 0.845, 0.88)),
    room: smooth(between(position, JOURNEY.roomStart, 1)),
    phase: position >= JOURNEY.roomStart ? "room" : position >= JOURNEY.zoomStart ? "portal" : position >= mergeStart ? "merge" : "skills",
  };
}

export function getSkillOffset(progress: number, height: number, viewport: number) {
  return viewport + 48 - progress * (viewport + height + 144);
}

export function getJourneyDistance(viewport: number, listHeight: number) {
  // Long labels may wrap on phones. Scroll distance follows the rendered content.
  return Math.max(viewport * 4.5, (viewport + listHeight + 144) * 0.85 / (JOURNEY.listsEnd - JOURNEY.listsStart));
}

/** Scroll offsets, from the top of the story, where each chapter reads best. */
export function getChapterStops(story: {
  resumeDistance: number; viewport: number; journeyDistance: number; listHeight: number;
  /** PASSIONS.travelViewports and STAGES.approachEnd, passed in to keep this module dependency-free. */
  passionsViewports: number; readingStart: number;
}) {
  const { resumeDistance, viewport, journeyDistance, listHeight } = story;
  const passionsTravel = viewport * story.passionsViewports;
  const journeyStart = resumeDistance + passionsTravel;
  // Stop once the first skill groups have risen into the lower half of the screen.
  const lists = clamp((viewport * 0.72 + 48) / (viewport + listHeight + 144));
  return {
    resume: resumeDistance * (story.readingStart + 0.03),
    passions: resumeDistance + passionsTravel * 0.8,
    skills: journeyStart + journeyDistance * (JOURNEY.listsStart + lists * (JOURNEY.listsEnd - JOURNEY.listsStart)),
    projects: journeyStart + journeyDistance,
  };
}

/** While the skills pass, the companion's eyes drift between the two columns as if reading. */
export function getReadingGaze(lists: number) {
  const weight = lists > 0 && lists < 1 ? Math.sin(Math.PI * lists) ** 0.6 : 0;
  return { x: 0.11 * Math.sin(lists * Math.PI * 7), y: 0.03, weight };
}

/** All visual channels use this displayed position, including fast scroll jumps. */
export function createPortfolioSequence(companion: ReturnType<typeof createCompanionSequence>) {
  let position = 0;
  let previousTime: number | undefined;
  return {
    sample(resume: number, passions: number, journey: number, now: number, mergeStart: number = JOURNEY.mergeStart) {
      const elapsed = previousTime === undefined ? 0 : Math.min(50, Math.max(0, now - previousTime));
      previousTime = now;
      const target = clamp(journey);
      const presentation = companion.sample(resume, position > 0 || target > 0 ? 1 : passions, now);
      if (target < position || (presentation.position === 1 && presentation.power.phase === "on")) {
        const step = elapsed / 1000;
        position += Math.sign(target - position) * Math.min(Math.abs(target - position), step);
      }
      return { ...presentation, journey: getJourneyTimeline(position, mergeStart), journeyAnimating: position !== target };
    },
  };
}
