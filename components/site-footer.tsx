"use client";

import { useEffect, useRef } from "react";
import { isTraveling, RETURN, REVEAL, travelTo } from "@/lib/story-scroll";
import { getFooterReveal } from "@/lib/footer-reveal";
import { profile } from "@/lib/profile";

const LAYERS = ["sky", "far", "mid", "near"] as const;

export function SiteFooter() {
  const drawingRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  // The first time a reader scrolls down to the footer, hold the page and ease it
  // open so the drawing develops on its own. Afterwards the footer scrolls normally.
  useEffect(() => {
    const text = textRef.current;
    if (!text) return;
    let last = scrollY;
    const onScroll = () => {
      const down = scrollY > last;
      last = scrollY;
      if (!down || text.getBoundingClientRect().top > innerHeight * 0.9) return;
      removeEventListener("scroll", onScroll);
      // A section-link trip is already carrying the reader to the bottom.
      if (isTraveling() || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      travelTo(Infinity, { pace: REVEAL, hold: true });
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const drawing = drawingRef.current;
    if (!drawing) return;
    const layers = Array.from(drawing.children) as HTMLElement[];
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = drawing.getBoundingClientRect();
      // 0 as the drawing's top enters from below; 1 once its bottom reaches the screen's bottom.
      const reveal = motion.matches ? 1 : (innerHeight - rect.top) / Math.max(1, rect.height);
      getFooterReveal(reveal).forEach((value, index) => layers[index]?.style.setProperty("--p", value.toFixed(3)));
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) addEventListener("scroll", request, { passive: true });
      else removeEventListener("scroll", request);
      request();
    }, { rootMargin: "50% 0px" });
    observer.observe(drawing);
    addEventListener("resize", request);
    motion.addEventListener("change", request);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      removeEventListener("scroll", request);
      removeEventListener("resize", request);
      motion.removeEventListener("change", request);
    };
  }, []);

  return (
    <footer id="contact" className="site-footer">
      <div ref={textRef} className="footer-text">
        <div>
          <p className="footer-name">antonio rivera</p>
          <p className="footer-role">software engineer · {profile.location.toLowerCase()}</p>
        </div>
        <ul className="footer-links">
          <li><a href={profile.linkedin} target="_blank" rel="noreferrer">linkedin</a></li>
          <li><a href={profile.github} target="_blank" rel="noreferrer">github</a></li>
          <li><a href={`mailto:${profile.email}`}>email</a></li>
          <li><a href={profile.resumePdf} download>résumé</a></li>
        </ul>
        <button className="footer-top" type="button" onClick={() => travelTo(0, { pace: RETURN })}>back to the top ↑</button>
      </div>
      <div ref={drawingRef} className="footer-drawing" aria-hidden="true">
        {LAYERS.map((layer) => <div key={layer} className={`footer-layer footer-${layer}`} />)}
      </div>
    </footer>
  );
}
