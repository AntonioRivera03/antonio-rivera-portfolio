"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { LifeSearch } from "@/components/life-search";
import { LifeLandscape } from "@/components/life-landscape";

/** The lake below the sky: the painting frames the view, and the search sits in its middle. */
export function LifeField({ active, onMount, onAscend }: { active: boolean; onMount: () => void; onAscend: () => void }) {
  const mounted = useEffectEvent(onMount);
  useEffect(() => mounted(), []);
  // While there's a search, the way back up steps aside; it returns once the search is cleared.
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const onSearching = (next: boolean) => {
    setSearching(next);
    if (next) setSearched(true);
  };
  return (
    <>
      <LifeLandscape />
      <LifeSearch active={active} onSearching={onSearching} />
      <button className="life-ascend" type="button" aria-label="Back up to the sky" onClick={onAscend}
        data-hidden={searching || undefined} data-searched={searched || undefined} inert={searching}>
        <svg viewBox="0 0 30 18" aria-hidden="true">
          <path d="M3.5 14.6C7.6 11.2 11.4 7.6 15 3.4C18.4 7.4 22.4 11.1 26.6 14.2" />
        </svg>
      </button>
    </>
  );
}
