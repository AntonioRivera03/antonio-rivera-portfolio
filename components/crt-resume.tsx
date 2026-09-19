"use client";

import { useEffect, useRef, useState } from "react";
import { resume } from "@/lib/crt/resume";
import { getStoryScroll, PASSIONS } from "@/lib/crt/companion";
import { Passions } from "@/components/passions";
import type { CrtRenderer } from "@/lib/crt/renderer";

function ResumeContent() {
  return (
    <article className="resume-document" aria-label="Antonio Rivera’s résumé">
      <header>
        <h2>{resume.name}</h2>
        <p>{resume.role}</p>
        {resume.contact.map((line) => <p key={line}>{line}</p>)}
      </header>
      {resume.sections.map((section) => (
        <section key={section.title}>
          <h3>{section.title}</h3>
          {section.entries.map((entry, index) => (
            <div className="resume-entry" key={`${entry.title}-${index}`}>
              <div className="resume-entry-heading">
                {entry.title && <h4>{entry.title}</h4>}
                {entry.date && <p className="resume-date">{entry.date}</p>}
              </div>
              {entry.detail && <p>{entry.detail}</p>}
              {entry.paragraphs?.map((text, paragraph) => <p key={paragraph}>{text}</p>)}
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}

export function CrtResume() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const passionsRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<CrtRenderer | null>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);

  useEffect(() => {
    if (!documentOpen) return;
    documentRef.current?.focus({ preventScroll: true });
    documentRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [documentOpen]);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let loading = false;
    let frame = 0;
    let heightFrame = 0;
    let documentDistance = 0;
    let resumeDistance = innerHeight * 5.5;

    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const progress = getStoryScroll(rect.top, resumeDistance, innerHeight);
      rendererRef.current?.setProgress(progress.resume, progress.passions);
    };
    const requestUpdate = () => { if (!frame) frame = requestAnimationFrame(update); };
    const updateHeight = () => {
      heightFrame = 0;
      resumeDistance = Math.max(innerHeight * 5.5, innerHeight * 2.7 + documentDistance * 1.8);
      const copyHeight = passionsRef.current?.scrollHeight ?? 0;
      const mobile = innerWidth <= 700;
      const copyTop = innerHeight <= 650 ? 0.43 : 0.51;
      const viewportHeight = Math.ceil(Math.max(innerHeight, mobile ? (copyHeight + 48) / (1 - copyTop) : copyHeight + 96));
      section.style.setProperty("--crt-window-height", `${innerHeight}px`);
      section.style.setProperty("--crt-viewport-height", `${viewportHeight}px`);
      section.style.setProperty("--crt-track-height", `${resumeDistance + innerHeight * PASSIONS.travelViewports + viewportHeight}px`);
      requestUpdate();
    };
    // Measure on the next frame so observer callbacks never resize their own targets.
    const requestHeightUpdate = () => { if (!heightFrame) heightFrame = requestAnimationFrame(updateHeight); };

    const load = async () => {
      if (motion.matches || loading || rendererRef.current || disposed) return;
      loading = true;
      try {
        const { createCrtRenderer } = await import("@/lib/crt/renderer");
        if (disposed || motion.matches) return;
        rendererRef.current = createCrtRenderer(canvas, resume, (ready) => {
          if (!disposed) { setEnhanced(ready); requestUpdate(); }
        }, (distance) => { documentDistance = distance; requestHeightUpdate(); }, (wipe, copy) => {
          const viewport = viewportRef.current;
          if (!viewport) return;
          viewport.style.setProperty("--passions-wipe", `${(1 - wipe) * 110}%`);
          viewport.style.setProperty("--passions-copy", String(copy));
          viewport.style.setProperty("--passions-copy-offset", `${(1 - copy) * 24}px`);
        });
        requestUpdate();
      } catch (error) {
        if (!disposed) console.warn("The animated résumé is unavailable:", error);
      } finally { loading = false; }
    };

    const onMotionChange = () => {
      if (motion.matches) {
        rendererRef.current?.dispose();
        rendererRef.current = null;
        setEnhanced(false);
      } else void load();
    };
    const intersection = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void load();
    }, { rootMargin: "100% 0px" });
    intersection.observe(section);
    const resize = new ResizeObserver(requestUpdate);
    resize.observe(section);
    const copyResize = new ResizeObserver(requestHeightUpdate);
    if (passionsRef.current) copyResize.observe(passionsRef.current);
    addEventListener("scroll", requestUpdate, { passive: true });
    addEventListener("resize", requestHeightUpdate);
    motion.addEventListener("change", onMotionChange);
    requestHeightUpdate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(heightFrame);
      intersection.disconnect();
      resize.disconnect();
      copyResize.disconnect();
      removeEventListener("scroll", requestUpdate);
      removeEventListener("resize", requestHeightUpdate);
      motion.removeEventListener("change", onMotionChange);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="crt-story"
      data-enhanced={enhanced && !documentOpen}
      aria-label="Résumé and passions"
    >
      <div ref={viewportRef} className="crt-viewport">
        <div className="passions-wipe" aria-hidden="true" />
        <canvas ref={canvasRef} className="crt-canvas" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="crt-still" src="/computer/computer-still.png" alt="A white vintage computer." width="1100" height="1100" />
        <div ref={passionsRef} className="passions-overlay" aria-hidden="true"><Passions /></div>
        {enhanced && !documentOpen && (
          <button className="resume-access" type="button" onClick={() => setDocumentOpen(true)}>Read résumé as text</button>
        )}
      </div>
      <div ref={documentRef} className="resume-accessible" tabIndex={-1}><ResumeContent /></div>
      <div className="passions-static"><Passions /></div>
    </section>
  );
}
