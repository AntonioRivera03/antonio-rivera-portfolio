/* eslint-disable @next/next/no-img-element -- prerendered painting layers stacked for parallax */

/** The autumn valley, painted by assets/painting (`npm run life:valley`), back to front. */
export const VALLEY_LAYERS = ["sky", "range", "hills", "near"] as const;
export const valleyLayer = (layer: (typeof VALLEY_LAYERS)[number]) => `/life/${layer}.webp`;

export function LifeLandscape() {
  return (
    <div className="life-land" aria-hidden="true">
      {VALLEY_LAYERS.map((layer) => (
        <img key={layer} className={`land-layer land-${layer}`} src={valleyLayer(layer)} width="2560" height="1440" alt="" decoding="async" draggable={false} />
      ))}
    </div>
  );
}
