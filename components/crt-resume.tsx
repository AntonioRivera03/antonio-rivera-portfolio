"use client";

import { useEffect, useRef, useState } from "react";
import { resume } from "@/lib/crt/resume";
import { getCrtTimeline, getScrollProgress } from "@/lib/crt/timeline";
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
              {entry.title && <h4>{entry.title}</h4>}
              {entry.detail && <p>{entry.detail}</p>}
              {entry.date && <p className="resume-date">{entry.date}</p>}
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
    let documentDistance = 0;

    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const progress = getScrollProgress(rect.top, section.offsetHeight, innerHeight);
      section.dataset.phase = getCrtTimeline(progress).phase;
      rendererRef.current?.setProgress(progress);
    };
    const requestUpdate = () => { if (!frame) frame = requestAnimationFrame(update); };
    const updateHeight = () => {
      section.style.setProperty("--crt-track-height", `${Math.max(innerHeight * 6.5, innerHeight * 3.7 + documentDistance * 1.8)}px`);
      requestUpdate();
    };

    const load = async () => {
      if (motion.matches || loading || rendererRef.current || disposed) return;
      loading = true;
      try {
        const { createCrtRenderer } = await import("@/lib/crt/renderer");
        if (disposed || motion.matches) return;
        rendererRef.current = createCrtRenderer(canvas, resume, (ready) => {
          if (!disposed) { setEnhanced(ready); requestUpdate(); }
        }, (distance) => { documentDistance = distance; updateHeight(); });
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
    addEventListener("scroll", requestUpdate, { passive: true });
    addEventListener("resize", updateHeight);
    motion.addEventListener("change", onMotionChange);
    updateHeight();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      intersection.disconnect();
      resize.disconnect();
      removeEventListener("scroll", requestUpdate);
      removeEventListener("resize", updateHeight);
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
      aria-label="Résumé"
    >
      <div className="crt-viewport">
        <canvas ref={canvasRef} className="crt-canvas" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="crt-still" src="/computer/computer-still.png" alt="A white vintage computer." width="1100" height="1100" />
        {enhanced && !documentOpen && (
          <button className="resume-access" type="button" onClick={() => setDocumentOpen(true)}>Read résumé as text</button>
        )}
      </div>
      <div ref={documentRef} className="resume-accessible" tabIndex={-1}><ResumeContent /></div>
    </section>
  );
}
