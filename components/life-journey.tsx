"use client";

import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore, type Ref } from "react";
import { LifeIntro } from "@/components/life-intro";
import { VALLEY_LAYERS, valleyLayerSet } from "@/components/life-landscape";
import { LIFE_PATH } from "@/lib/room/life";

const loadField = () => import("@/components/life-field");
const LifeField = lazy(() => loadField().then(({ LifeField }) => ({ default: LifeField })));

type Scene = "sky" | "field";
const FIELD_HASH = "#valley";

const subscribeToHash = (onChange: () => void) => {
  addEventListener("hashchange", onChange);
  return () => removeEventListener("hashchange", onChange);
};
const linkedToField = () => location.pathname === LIFE_PATH && location.hash === FIELD_HASH;

/** The life page: it opens on the sky, and the arrow tilts down to the valley where the search lives. */
export function LifeJourney({ titleRef }: { titleRef?: Ref<HTMLHeadingElement> }) {
  // A link or refresh straight to the valley lands there, without replaying the descent.
  const linked = useSyncExternalStore(subscribeToHash, linkedToField, () => false);
  const [chosen, setChosen] = useState<Scene | null>(null);
  // The field waits below the fold, so the descent has something to rise into.
  const [staged, setStaged] = useState(false);
  const scene = chosen ?? (linked ? "field" : "sky");
  const descendRef = useRef<HTMLButtonElement>(null);
  const pending = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Fetch the painting and the search early; mount them once the view has finished opening.
    const fetch = setTimeout(() => {
      void loadField();
      for (const layer of VALLEY_LAYERS) {
        const image = new Image();
        image.sizes = "100vw";
        image.srcset = valleyLayerSet(layer);
      }
    }, 1200);
    const stage = setTimeout(() => setStaged(true), 3800);
    return () => { clearTimeout(fetch); clearTimeout(stage); };
  }, []);

  useEffect(() => {
    if (chosen === "sky") descendRef.current?.focus({ preventScroll: true });
  }, [chosen]);

  const go = (next: Scene) => {
    const move = () => {
      setChosen(next);
      if (location.pathname === LIFE_PATH) history.replaceState(history.state, "", next === "field" ? `${LIFE_PATH}${FIELD_HASH}` : LIFE_PATH);
    };
    if (staged || linked) move();
    else {
      // Arrived early: set the field in place first, then descend into it.
      pending.current = move;
      setStaged(true);
    }
  };

  const onFieldMount = () => {
    const move = pending.current;
    pending.current = null;
    if (move) requestAnimationFrame(() => requestAnimationFrame(move));
  };

  return (
    <div className="life-journey" data-scene={scene} data-instant={(linked && !chosen) || undefined}>
      <div className="life-sky" aria-hidden="true" />
      <div className="life-haze" aria-hidden="true" />
      <div className="life-sky-scene" inert={scene !== "sky"}>
        <LifeIntro titleRef={titleRef} />
        <button ref={descendRef} className="life-descend" type="button" aria-label="Down to the valley" onClick={() => go("field")}>
          <svg viewBox="0 0 24 44" aria-hidden="true">
            <path d="M12.2 2.5C11.3 12 13 21.5 12 37.2" />
            <path d="M5.4 29.4C8.1 31.5 10.2 34.2 12 37.6C13.7 34.4 15.9 31.8 18.8 29.8" />
          </svg>
        </button>
      </div>
      <div className="life-field-scene" inert={scene !== "field"}>
        {(staged || linked || chosen) && (
          <Suspense fallback={null}>
            <LifeField active={scene === "field"} onMount={onFieldMount} onAscend={() => go("sky")} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
