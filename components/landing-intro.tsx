"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AppleAscii } from "@/components/apple-ascii";
import { getIntroFrame, INTRO_NAME } from "@/lib/landing-intro";

export function LandingIntro({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLElement>(null);
  const appleRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const apple = appleRef.current;
    const name = nameRef.current;
    const cursor = cursorRef.current;
    const content = contentRef.current;
    if (!root || !apple || !name || !cursor || !content) return;
    const characters = Array.from(name.children) as HTMLElement[];

    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let elapsed = 0;
    let lastTime = 0;
    let centerX = 0;
    let centerY = 0;
    let complete = false;
    let lastCharacters = -1;
    let release = () => {};

    const finish = () => {
      complete = true;
      cancelAnimationFrame(frame);
      // The variables' defaults are the finished look, so clearing them changes nothing on screen.
      for (const property of ["--intro-apple-opacity", "--intro-apple-x", "--intro-apple-y", "--intro-cursor", "--intro-role-opacity", "--intro-role-width"]) {
        root.style.removeProperty(property);
      }
      characters.forEach((character) => { character.style.visibility = ""; });
      root.dataset.intro = "complete";
      root.dataset.introPhase = "complete";
      apple.inert = false;
      content.inert = false;
      release();
    };
    const draw = () => {
      const state = getIntroFrame(elapsed);
      root.dataset.introPhase = state.phase;
      root.style.setProperty("--intro-apple-opacity", String(state.appleOpacity));
      root.style.setProperty("--intro-apple-x", `${centerX * state.appleOffset}px`);
      root.style.setProperty("--intro-apple-y", `${centerY * state.appleOffset}px`);
      root.style.setProperty("--intro-cursor", state.cursor ? "visible" : "hidden");
      root.style.setProperty("--intro-role-opacity", String(state.role));
      root.style.setProperty("--intro-role-width", `${state.role * 160}%`);
      if (state.characters !== lastCharacters) {
        characters.forEach((character, index) => { character.style.visibility = index < state.characters ? "" : "hidden"; });
        placeCursor(state.characters);
        lastCharacters = state.characters;
      }
      if (state.complete) finish();
    };
    // The block sits just after the last typed character, as the inline cursor did.
    const placeCursor = (count: number) => {
      const anchor = characters[Math.max(0, count - 1)];
      const size = parseFloat(getComputedStyle(anchor).fontSize);
      const x = count > 0 ? anchor.offsetLeft + anchor.offsetWidth + size * 0.055 : anchor.offsetLeft;
      cursor.style.transform = `translate(${x}px, ${anchor.offsetTop + size * 0.04}px)`;
    };
    const measure = () => {
      if (complete) return;
      lastCharacters = -1;
      // The wrapper stays in the final grid slot; only its child is translated.
      const rect = apple.getBoundingClientRect();
      centerX = document.documentElement.clientWidth / 2 - (rect.left + rect.width / 2);
      centerY = innerHeight / 2 - (rect.top + rect.height / 2);
      draw();
    };
    const tick = (now: number) => {
      if (complete) return;
      // Keep every stage visible after a background-tab pause or a long frame.
      if (!document.hidden && lastTime) elapsed += Math.min(now - lastTime, 64);
      lastTime = now;
      draw();
      if (!complete) frame = requestAnimationFrame(tick);
    };
    const keepAtTop = () => {
      if (!complete && (scrollX || scrollY)) scrollTo({ top: 0, left: 0, behavior: "instant" });
    };
    const preventScroll = (event: Event) => { if (!complete) event.preventDefault(); };
    const preventScrollKey = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) preventScroll(event);
    };
    const onMotionChange = () => { if (motion.matches) finish(); };
    const onVisibilityChange = () => { lastTime = 0; };

    if (motion.matches) {
      finish();
      return;
    }

    root.dataset.intro = "running";
    apple.inert = true;
    content.inert = true;
    keepAtTop();
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(apple);
    resize.observe(root.querySelector(".composition")!);
    addEventListener("resize", measure);
    addEventListener("scroll", keepAtTop, { passive: true });
    addEventListener("wheel", preventScroll, { passive: false });
    addEventListener("touchmove", preventScroll, { passive: false });
    addEventListener("keydown", preventScrollKey);
    addEventListener("pagehide", finish);
    motion.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    release = () => {
      resize.disconnect();
      removeEventListener("resize", measure);
      removeEventListener("scroll", keepAtTop);
      removeEventListener("wheel", preventScroll);
      removeEventListener("touchmove", preventScroll);
      removeEventListener("keydown", preventScrollKey);
      removeEventListener("pagehide", finish);
      motion.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    frame = requestAnimationFrame(tick);

    return finish;
  }, []);

  return (
    <main ref={rootRef} className="portfolio" data-intro="pending">
      <section className="landing">
        <div className="composition">
          <div className="intro-apple" ref={appleRef}><AppleAscii /></div>
          <section className="identity" aria-label="Introduction">
            <h1 aria-label={INTRO_NAME}>
              <span ref={nameRef} className="intro-name" aria-hidden="true">
                {Array.from(INTRO_NAME, (character, index) => <span key={index}>{character}</span>)}
              </span>
              <span ref={cursorRef} className="intro-cursor" aria-hidden="true" />
            </h1>
            <p className="role">software engineer</p>
          </section>
        </div>
      </section>
      <div ref={contentRef}>{children}</div>
    </main>
  );
}
