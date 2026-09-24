/* eslint-disable @next/next/no-img-element -- one painted backdrop that rises into view */

/** The autumn lake: the native painting, and a finer upscale for large and dense screens. */
export const PAINTING_SRCSET = "/life/painting.webp 1672w, /life/painting-2560.webp 2560w";
/** The painting covers the window, so tall windows show it wider than the viewport. */
export const PAINTING_SIZES = "max(100vw, 177.7vh)";

export function LifeLandscape() {
  return (
    <div className="life-land" aria-hidden="true">
      <img className="life-painting" src="/life/painting.webp" srcSet={PAINTING_SRCSET} sizes={PAINTING_SIZES} width="1672" height="941" alt="" decoding="async" draggable={false} />
    </div>
  );
}
