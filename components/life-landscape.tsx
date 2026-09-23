/* eslint-disable @next/next/no-img-element -- prerendered painting layers stacked for parallax */

/** The autumn valley, painted by assets/painting (`npm run life:valley`), back to front. */
export const VALLEY_LAYERS = ["sky", "range", "hills", "near"] as const;
type Layer = (typeof VALLEY_LAYERS)[number];
/** Each layer at half size (1920 wide) and full (3840); the browser picks for the screen. */
export const valleyLayerSet = (layer: Layer) => `/life/${layer}-1920.webp 1920w, /life/${layer}.webp 3840w`;

export function LifeLandscape() {
  return (
    <div className="life-land" aria-hidden="true">
      {VALLEY_LAYERS.map((layer) => (
        <img key={layer} className={`land-layer land-${layer}`} src={`/life/${layer}-1920.webp`} srcSet={valleyLayerSet(layer)} sizes="100vw" width="3840" height="2160" alt="" decoding="async" draggable={false} />
      ))}
    </div>
  );
}
