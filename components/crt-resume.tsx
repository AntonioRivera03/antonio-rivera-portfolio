"use client";

import { useEffect, useRef, useState } from "react";
import { resume } from "@/lib/crt/resume";
import { getStoryScroll, PASSIONS } from "@/lib/crt/companion";
import { Passions } from "@/components/passions";
import { Room } from "@/components/room";
import { skillColumns, skills } from "@/lib/skills";
import { clamp, getJourneyDistance, getSkillOffset } from "@/lib/crt/journey";
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
  const skillsRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<CrtRenderer | null>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [roomActive, setRoomActive] = useState(false);
  const [roomInteractive, setRoomInteractive] = useState(false);

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
    let journeyDistance = innerHeight * 8;
    let listHeight = 0;

    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const progress = getStoryScroll(rect.top, resumeDistance, innerHeight);
      const journeyTravel = -rect.top - resumeDistance - innerHeight * PASSIONS.travelViewports;
      // Layout rounds fractional track pixels; the physical page bottom is still complete.
      const journey = journeyTravel >= journeyDistance - 1 ? 1 : clamp(journeyTravel / journeyDistance);
      rendererRef.current?.setProgress(progress.resume, progress.passions, journey, listHeight);
    };
    const requestUpdate = () => { if (!frame) frame = requestAnimationFrame(update); };
    const updateHeight = () => {
      heightFrame = 0;
      resumeDistance = Math.max(innerHeight * 5.5, innerHeight * 2.7 + documentDistance * 1.8);
      const copyHeight = passionsRef.current?.scrollHeight ?? 0;
      const mobile = innerWidth <= 700;
      const copyTop = innerHeight <= 650 ? 0.43 : 0.51;
      listHeight = Math.max(...Array.from(skillsRef.current?.querySelectorAll("ul") ?? [], (list) => list.scrollHeight), 0);
      journeyDistance = getJourneyDistance(innerHeight, listHeight);
      const roomHeight = roomRef.current?.scrollHeight ?? 0;
      const viewportHeight = Math.ceil(Math.max(innerHeight, roomHeight, mobile ? (copyHeight + 48) / (1 - copyTop) : copyHeight + 96));
      section.style.setProperty("--crt-window-height", `${innerHeight}px`);
      section.style.setProperty("--crt-viewport-height", `${viewportHeight}px`);
      section.style.setProperty("--crt-track-height", `${resumeDistance + innerHeight * PASSIONS.travelViewports + journeyDistance + viewportHeight}px`);
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
        }, (distance) => { documentDistance = distance; requestHeightUpdate(); }, (wipe, copy, journey) => {
          const viewport = viewportRef.current;
          if (!viewport) return;
          viewport.style.setProperty("--passions-wipe", `${(1 - wipe) * 110}%`);
          viewport.style.setProperty("--passions-copy", String(copy * (1 - journey.center)));
          viewport.style.setProperty("--passions-copy-offset", `${(1 - copy) * 24 - journey.center * innerHeight}px`);
          viewport.style.setProperty("--skills-y", `${getSkillOffset(journey.lists, listHeight, innerHeight)}px`);
          viewport.style.setProperty("--skills-opacity", journey.position > 0 && journey.lists < 1 ? "1" : "0");
          viewport.style.setProperty("--journey-white", String(journey.white));
          viewport.style.setProperty("--room-opacity", String(journey.room));
          viewport.style.setProperty("--room-y", `${(1 - journey.room) * innerHeight * 0.8}px`);
          setRoomInteractive(journey.room === 1);
          setRoomActive(journey.room > 0);
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
    if (skillsRef.current) copyResize.observe(skillsRef.current);
    if (roomRef.current) copyResize.observe(roomRef.current);
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
      aria-label="Résumé, passions, skills, and projects"
    >
      <div ref={documentRef} className="resume-accessible" tabIndex={-1}><ResumeContent /></div>
      <div className="passions-static"><Passions /></div>
      <section className="skills-static" aria-label="Skills"><h2>skills</h2><ul>{skills.map((skill) => <li key={skill}>{skill}</li>)}</ul></section>
      <div ref={viewportRef} className="crt-viewport">
        <div className="passions-wipe" aria-hidden="true" />
        <canvas ref={canvasRef} className="crt-canvas" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="crt-still" src="/computer/computer-still.png" alt="A white vintage computer." width="1100" height="1100" />
        <div ref={passionsRef} className="passions-overlay" aria-hidden="true"><Passions /></div>
        <div ref={skillsRef} className="skills-columns" aria-hidden="true">
          {skillColumns.map((column, side) => <div className={`skills-side skills-side-${side}`} key={side}><ul>{column.map((skill) => <li key={skill}>{skill}</li>)}</ul></div>)}
        </div>
        <div className="journey-white" aria-hidden="true" />
        <div ref={roomRef} className="room-overlay" inert={enhanced && !documentOpen && !roomInteractive} aria-hidden={!roomActive && enhanced && !documentOpen}>
          <Room active={roomActive || !enhanced || documentOpen} animated={enhanced && !documentOpen} />
        </div>
        {enhanced && !documentOpen && (
          <button className="resume-access" type="button" onClick={() => setDocumentOpen(true)}>Read résumé as text</button>
        )}
      </div>
    </section>
  );
}
