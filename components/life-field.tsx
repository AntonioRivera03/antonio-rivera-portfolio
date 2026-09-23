"use client";

import { useEffect, useEffectEvent } from "react";
import { BirdSearch } from "@/components/bird-search";
import { LifeLandscape } from "@/components/life-landscape";

/** The valley below the sky: the painting frames the view, and the search's birds hover in its open middle. */
export function LifeField({ active, onMount, onAscend }: { active: boolean; onMount: () => void; onAscend: () => void }) {
  const mounted = useEffectEvent(onMount);
  useEffect(() => mounted(), []);
  return (
    <>
      <LifeLandscape />
      <BirdSearch active={active} />
      <button className="life-ascend" type="button" aria-label="Back up to the sky" onClick={onAscend}>
        <svg viewBox="0 0 30 18" aria-hidden="true">
          <path d="M3.5 14.6C7.6 11.2 11.4 7.6 15 3.4C18.4 7.4 22.4 11.1 26.6 14.2" />
        </svg>
      </button>
    </>
  );
}
