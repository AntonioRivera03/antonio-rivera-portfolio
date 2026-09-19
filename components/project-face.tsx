"use client";

import { useEffect, useRef } from "react";

type ProjectFaceProps = { shape: "round" | "square"; active: boolean };

const GLANCES = [[0, 0], [5, -2], [0, 0], [-5, 1], [0, 2]] as const;

export function ProjectFace({ shape, active }: ProjectFaceProps) {
  const faceRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const face = faceRef.current;
    const panel = face?.closest("a");
    if (!face || !panel) return;

    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let tracking = false;
    let glance = shape === "round" ? 0 : 2;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const enabled = () => active && visible && !document.hidden && !motion.matches;
    const look = (x: number, y: number) => {
      face.style.setProperty("--project-gaze-x", `${x}px`);
      face.style.setProperty("--project-gaze-y", `${y}px`);
    };
    const stop = () => { clearTimeout(timer); timer = undefined; };
    const idle = () => {
      stop();
      if (!enabled() || tracking) return;
      timer = setTimeout(() => {
        const [x, y] = GLANCES[glance++ % GLANCES.length];
        look(x, y);
        idle();
      }, shape === "round" ? 2800 : 3400);
    };
    const sync = () => {
      stop();
      tracking = false;
      face.dataset.moving = String(enabled());
      look(0, 0);
      idle();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!enabled() || event.pointerType === "touch") return;
      const matrix = face.getScreenCTM();
      if (!matrix) return;
      // Map the pointer back into the tilted panel's own coordinate system.
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      tracking = true;
      stop();
      look(Math.max(-8, Math.min(8, (point.x - 120) / 10)), Math.max(-5, Math.min(5, (point.y - 58) / 10)));
    };
    const onPointerLeave = () => { tracking = false; look(0, 0); idle(); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(face);
    panel.addEventListener("pointermove", onPointerMove);
    panel.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    sync();

    return () => {
      stop();
      observer.disconnect();
      panel.removeEventListener("pointermove", onPointerMove);
      panel.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
    };
  }, [active, shape]);

  return (
    <svg ref={faceRef} className={`project-face project-face-${shape}`} viewBox="0 0 240 160" aria-hidden="true" focusable="false">
      <g fill={shape === "round" ? "#fbfff9" : "#171b19"}>
        {shape === "round" ? (
          <><circle cx="70" cy="58" r="24" /><circle cx="170" cy="58" r="24" /></>
        ) : (
          <><rect x="44" y="41" width="52" height="34" /><rect x="144" y="41" width="52" height="34" /></>
        )}
      </g>
      <g className="project-pupils">
        {[70, 170].map((x) => (
          <g key={x}>
            <circle cx={x - 1.5} cy="58" r="9" fill="#ff647d" />
            <circle cx={x + 1.5} cy="58" r="9" fill="#48dce2" />
            <circle cx={x} cy="58" r="9" fill={shape === "round" ? "#171b19" : "#fbfff9"} />
          </g>
        ))}
      </g>
      <path d="M88 114 Q120 144 152 114" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
