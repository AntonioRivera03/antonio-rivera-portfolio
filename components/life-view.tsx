"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { LifeJourney } from "@/components/life-journey";
import { LIFE_PATH, LIFE_TITLE, type LifeOrigin } from "@/lib/room/life";

export function LifeView({ origin, onClose }: { origin: LifeOrigin; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const leavingRef = useRef(false);
  // Once it has taken the /life address, leaving goes back through history so the room's entry returns.
  const close = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    if (location.pathname === LIFE_PATH) history.back();
    else onClose();
  };
  const onHistory = useEffectEvent(() => { if (location.pathname !== LIFE_PATH) onClose(); });
  useEffect(() => {
    const dialog = dialogRef.current;
    const title = titleRef.current;
    if (!dialog || !title) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const gutter = document.documentElement.style.scrollbarGutter;
    const pageTitle = document.title;
    const onPopState = () => onHistory();
    addEventListener("popstate", onPopState);
    document.body.style.overflow = "hidden";
    dialog.showModal();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const center = new DOMMatrix()
      .translate((innerWidth - origin.visibleWidth) / 2, (innerHeight - origin.visibleHeight) / 2)
      .scale(origin.visibleWidth / origin.width, origin.visibleHeight / origin.height).toString();
    const centeredAt = 1100 / 3400;
    const timing = { duration: reduced ? 0 : 3400, fill: "both" as const };
    const animation = dialog.animate([
      { width: `${origin.width}px`, height: `${origin.height}px`, borderRadius: "3px", transform: origin.transform, easing: "cubic-bezier(.4,0,.2,1)" },
      { offset: centeredAt, width: `${origin.width}px`, height: `${origin.height}px`, borderRadius: "3px", transform: center, easing: "cubic-bezier(.55,0,.2,1)" },
      { width: "100vw", height: "100dvh", borderRadius: "0px", transform: "none" },
    ], timing);
    const heading = title.animate([
      { fontSize: origin.fontSize },
      { offset: centeredAt, fontSize: origin.fontSize, easing: "cubic-bezier(.55,0,.2,1)" },
      { fontSize: "clamp(1.75rem, 5vw, 4.5rem)" },
    ], timing);
    animation.finished.then(() => {
      dialog.dataset.settled = "true";
      // Full screen, this is the life page: take its address without unmounting the room behind it.
      document.title = LIFE_TITLE;
      history.pushState(null, "", LIFE_PATH);
      // Now that the room is covered, give the view the scrollbar's reserved strip too.
      document.documentElement.style.scrollbarGutter = "auto";
    }).catch(() => {});
    return () => {
      removeEventListener("popstate", onPopState);
      animation.cancel();
      heading.cancel();
      dialog.close();
      document.title = pageTitle;
      document.documentElement.style.scrollbarGutter = gutter;
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, [origin]);
  return (
    <dialog ref={dialogRef} className="life-view" aria-labelledby="life-title" onCancel={(event) => { event.preventDefault(); close(); }}>
      <button className="life-back" type="button" onClick={close} aria-label="Back to the room">← back</button>
      <LifeJourney titleRef={titleRef} />
    </dialog>
  );
}
