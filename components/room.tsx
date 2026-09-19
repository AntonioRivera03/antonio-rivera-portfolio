"use client";

import { useEffect, useRef, useState } from "react";
import { getSlideFrame, SLIDE_CYCLE, SLIDE_DWELL } from "@/lib/room/slides";
import { LifeView } from "@/components/life-view";
import { captureLifeOrigin, type LifeOrigin } from "@/lib/room/life";

export function Room({ active, animated }: { active: boolean; animated: boolean }) {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slideshowRef = useRef<HTMLDivElement>(null);
  const projectsRef = useRef<HTMLElement>(null);
  const personalRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);
  const [slide, setSlide] = useState(0);
  const [screenOn, setScreenOn] = useState(true);
  const [origin, setOrigin] = useState<LifeOrigin | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    const projects = projectsRef.current;
    const personal = personalRef.current;
    if (!canvas || !root || !projects || !personal || !active) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void import("@/lib/room/renderer").then(({ createRoomRenderer }) => {
      if (!disposed) cleanup = createRoomRenderer(canvas, root, [projects, personal], (loaded) => { if (!disposed) setReady(loaded); });
    }).catch((error) => console.warn("Room preview unavailable:", error));
    return () => { disposed = true; cleanup?.(); };
  }, [active]);

  useEffect(() => {
    const screen = slideshowRef.current;
    const root = rootRef.current;
    if (!screen || !root || !active || origin) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let last = performance.now();
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; last = performance.now(); });
    observer.observe(root);
    const tick = () => {
      const now = performance.now();
      const transitioning = getSlideFrame(elapsedRef.current).phase !== "on";
      if (visible && !document.hidden && (!pausedRef.current || transitioning) && !motion.matches) elapsedRef.current += Math.min(100, now - last);
      last = now;
      const current = getSlideFrame(elapsedRef.current);
      screen.style.setProperty("--screen-height", String(Math.max(0.003, 1 - Math.min(1, current.shutdown / 0.6))));
      screen.style.setProperty("--screen-width", String(1 - Math.max(0, (current.shutdown - 0.6) / 0.4)));
      screen.style.setProperty("--screen-flash", String(current.shutdown * 0.65));
      screen.dataset.power = current.phase;
      setSlide(current.index);
      setScreenOn(current.phase === "on");
    };
    const onMotionChange = () => {
      if (motion.matches) elapsedRef.current = getSlideFrame(elapsedRef.current).index * SLIDE_CYCLE;
      tick();
    };
    onMotionChange();
    motion.addEventListener("change", onMotionChange);
    const timer = setInterval(tick, 32);
    return () => { clearInterval(timer); observer.disconnect(); motion.removeEventListener("change", onMotionChange); };
  }, [active, origin]);

  const selectSlide = (index: number) => {
    const current = getSlideFrame(elapsedRef.current);
    if (current.index === index) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      elapsedRef.current = index * SLIDE_CYCLE;
      setSlide(index);
    } else elapsedRef.current = current.index * SLIDE_CYCLE + SLIDE_DWELL;
  };

  return (
    <section ref={rootRef} className="room" aria-label="Featured projects and about Antonio" data-animated={animated} data-ready={ready} data-life-open={Boolean(origin)}>
      <canvas ref={canvasRef} className="room-canvas" aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="room-still" src="/room/room-still.png" width="1600" height="1000" alt="A person working at a desk beside a twin bed with red flannel sheets." />
      <section ref={projectsRef} className="featured-panels" aria-labelledby="featured-title">
        <h2 id="featured-title" className="chromatic">featured projects</h2>
        <div className="project-panels">
          <a className="project-pane project-aycorn" href="https://github.com/AntonioRivera03/AIcorn" target="_blank" rel="noreferrer">
            <span className="project-window-bar">aycorn</span>
            <span className="project-preview aycorn-preview" aria-hidden="true"><span>aycorn</span><span className="project-code"><b>01</b> planning<br /><b>02</b> development<br /><b>03</b> review</span></span>
            <span className="project-caption">AI integrations for project workflows <span aria-hidden="true">↗</span></span>
          </a>
          <a className="project-pane project-livedmatch" href="https://www.livedmatch.com/" target="_blank" rel="noreferrer">
            <span className="project-window-bar">livedmatch</span>
            <span className="project-preview livedmatch-preview" aria-hidden="true"><span>LivedMatch</span><span className="match-lines"><span>people</span><span>↔</span><span>research</span></span></span>
            <span className="project-caption">Research startup <span aria-hidden="true">↗</span></span>
          </a>
        </div>
      </section>
      <div ref={personalRef} className="personal-pane" onMouseEnter={() => { pausedRef.current = true; }} onMouseLeave={() => { pausedRef.current = false; }} onFocusCapture={() => { pausedRef.current = true; }} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) pausedRef.current = false; }}>
        <div ref={slideshowRef} className="personal-screen" data-slide={slide}>
          <div className="personal-screen-content">
            <div className="profile-slide" data-active={slide === 0} aria-hidden={slide !== 0} inert={slide !== 0 || !screenOn}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/about/antonio.png" alt="Antonio Rivera" width="1184" height="1536" />
              <div className="profile-info">
                <h2>antonio rivera</h2>
                <p>Texas A&amp;M–Central Texas</p>
                <p>3+ years of experience</p>
                <nav aria-label="Antonio’s links"><a href="https://www.linkedin.com/in/antonio-rivera-094438272/" target="_blank" rel="noreferrer">linkedin</a><a href="https://github.com/AntonioRivera03" target="_blank" rel="noreferrer">github</a><a href="mailto:antonio7rivera03@gmail.com">email</a></nav>
              </div>
            </div>
            <button className="cloud-slide" type="button" data-active={slide === 1} aria-hidden={slide !== 1} inert={slide !== 1 || !screenOn} onClick={(event) => { if (personalRef.current && rootRef.current) setOrigin(captureLifeOrigin(event.currentTarget, personalRef.current, rootRef.current)); }}>
              <span>life outside of career</span>
            </button>
          </div>
        </div>
        <div className="slide-controls" aria-label="Personal slides">
          <button type="button" aria-label="About Antonio" aria-pressed={slide === 0} onClick={() => selectSlide(0)} />
          <button type="button" aria-label="Life outside of career" aria-pressed={slide === 1} onClick={() => selectSlide(1)} />
        </div>
      </div>
      {origin && <LifeView origin={origin} onClose={() => setOrigin(null)} />}
    </section>
  );
}
