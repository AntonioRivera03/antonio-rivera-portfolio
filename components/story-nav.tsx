"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { CHAPTERS, chapterTop, currentChapter, travelTo, type Chapter } from "@/lib/story-scroll";

export function StoryNav() {
  const [current, setCurrent] = useState<Chapter | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const stops = CHAPTERS.flatMap(({ id }) => {
        const top = chapterTop(id);
        return top == null ? [] : [[id, top] as [Chapter, number]];
      });
      const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
      setCurrent(atBottom ? "contact" : currentChapter(stops, scrollY, innerHeight));
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(update); };
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", request);
    request();
    return () => { cancelAnimationFrame(frame); removeEventListener("scroll", request); removeEventListener("resize", request); };
  }, []);

  const go = (event: MouseEvent<HTMLAnchorElement>, chapter: Chapter) => {
    // Contact means the very bottom, where the footer drawing has fully developed.
    const top = chapter === "contact" ? Infinity : chapterTop(chapter);
    if (top == null) return;
    event.preventDefault();
    travelTo(top, { onDone: () => history.replaceState(null, "", `#${chapter}`) });
  };

  return (
    <nav className="story-nav" aria-label="Sections">
      <ul>
        {CHAPTERS.map(({ id, label }) => (
          <li key={id}>
            <a href={`#${id}`} aria-current={current === id ? "location" : undefined} onClick={(event) => go(event, id)}>{label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
