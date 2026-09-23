export const INTRO_NAME = "antonio rivera";

export const INTRO = {
  fadeEnd: 850,
  slideStart: 1100,
  slideEnd: 2100,
  typingStart: 2400,
  characterDuration: 85,
  roleDuration: 2000,
} as const;

export const INTRO_TYPING_END = INTRO.typingStart + INTRO_NAME.length * INTRO.characterDuration;
export const INTRO_END = INTRO_TYPING_END + INTRO.roleDuration;

const progress = (time: number, start: number, end: number) => Math.max(0, Math.min(1, (time - start) / (end - start)));
const smooth = (value: number) => value * value * (3 - 2 * value);

export function getIntroFrame(time: number) {
  const characters = Math.max(0, Math.min(INTRO_NAME.length, Math.floor((time - INTRO.typingStart) / INTRO.characterDuration)));
  return {
    phase: time < INTRO.slideStart ? "fade" : time < INTRO.slideEnd ? "slide" : time < INTRO_TYPING_END ? "typing" : time < INTRO_END ? "role" : "complete",
    appleOpacity: smooth(progress(time, 0, INTRO.fadeEnd)),
    appleOffset: (1 - progress(time, INTRO.slideStart, INTRO.slideEnd)) ** 3,
    characters,
    cursor: time >= INTRO.slideEnd && time < INTRO_TYPING_END,
    role: smooth(progress(time, INTRO_TYPING_END, INTRO_END)),
    complete: time >= INTRO_END,
  };
}
