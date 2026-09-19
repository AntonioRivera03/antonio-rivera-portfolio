"use client";

import { useEffect, useRef } from "react";
import type { LifeOrigin } from "@/lib/room/life";

export function LifeView({ origin, onClose }: { origin: LifeOrigin; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const title = titleRef.current;
    if (!dialog || !title) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
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
    animation.finished.then(() => { dialog.dataset.settled = "true"; }).catch(() => {});
    return () => {
      animation.cancel();
      heading.cancel();
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, [origin]);
  return (
    <dialog ref={dialogRef} className="life-view" aria-labelledby="life-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <button className="life-back" type="button" onClick={onClose} aria-label="Back to the room">← back</button>
      <header className="life-intro">
        <h1 ref={titleRef} id="life-title">life outside of career</h1>
        <p className="life-motto role">engineering is a passion, not my life</p>
      </header>
    </dialog>
  );
}
