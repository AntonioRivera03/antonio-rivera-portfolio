"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { dropletAt, dropletShape, panelRect, pillTop, TIMING, type Rect, type Shape } from "@/lib/life/droplet";
import { indexWriting, searchWriting, TOPICS, writing } from "@/lib/life/writing";

const entries = indexWriting(writing);

type Mode = "rest" | "lowering" | "separating" | "expanding" | "open" | "shrinking" | "merging" | "raising";

interface Liquid {
  open(): void;
  close(): void;
  /** Refit the open panel to its results and the window. */
  sync(): void;
}

/** A four-pointed star whose points hook slightly, like claws. */
function ClawStar() {
  return (
    <svg className="topic-star" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 .6Q8.7 6.1 15.4 8Q9.9 8.7 8 15.4Q7.3 9.9 .6 8Q6.1 7.3 8 .6Z" />
    </svg>
  );
}

/**
 * The life page's search: a glass pill in the middle of the page. Typing sends the pill to the
 * bottom, pulls a droplet off its top, and grows the droplet up into a glass panel of results.
 * Clearing the search runs it all back: the panel draws down into a droplet that sinks into the
 * pill, and the pill returns to the middle.
 */
export function LifeSearch({ active, onSearching }: { active: boolean; onSearching?: (searching: boolean) => void }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchWriting(entries, query), [query]);
  const typed = query.trim().length > 0;
  const [shown, setShown] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLFormElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const liquid = useRef<Liquid | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current, pill = pillRef.current, panel = panelRef.current, list = listRef.current;
    if (!root || !pill || !panel || !list) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let mode: Mode = "rest";
    let separation = 0;
    let frame = 0;
    let motion: Animation | null = null;

    const view = () => ({ width: root.clientWidth, height: root.clientHeight });
    const pillHeight = () => pill.offsetHeight;
    // The droplet always leaves from, and returns to, the lowered pill.
    const edge = () => pillTop(view().height, pillHeight(), true);
    const place = () => {
      const { height } = view();
      root.style.setProperty("--pill-drop", `${pillTop(height, pillHeight(), true) - pillTop(height, pillHeight(), false)}px`);
    };
    // The panel's size once open: its results laid out at the panel's width, capped by the room.
    const target = (): Rect => {
      const v = view();
      const width = panelRect(v, pillHeight(), 0).width;
      root.style.setProperty("--panel-width", `${width}px`);
      const rect = panelRect(v, pillHeight(), list.offsetHeight);
      root.style.setProperty("--panel-height", `${rect.height}px`);
      return rect;
    };
    const setBox = (box: Rect, radius: string) => {
      panel.style.left = `${box.left}px`;
      panel.style.top = `${box.top}px`;
      panel.style.width = `${box.width}px`;
      panel.style.height = `${box.height}px`;
      panel.style.borderRadius = radius;
    };
    const setShape = (shape: Shape, stretch = 0) => {
      setBox(shape, shape.path ? "0" : "50%");
      panel.style.clipPath = shape.path ? `path("${shape.path}")` : "";
      panel.style.transform = stretch ? `scale(${1 - stretch * 0.5}, ${1 + stretch})` : "";
    };
    const current = (): Rect => {
      const outer = root.getBoundingClientRect(), box = panel.getBoundingClientRect();
      return { left: box.left - outer.left, top: box.top - outer.top, width: box.width, height: box.height };
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      motion?.cancel();
      motion = null;
    };
    const settle = (settled: boolean) => {
      panel.toggleAttribute("data-settled", settled);
      setShown(settled);
    };

    // Wait, frame by frame, for the pill to arrive where its transition is taking it.
    const whenPill = (open: boolean, done: () => void) => {
      const step = () => {
        const top = pill.getBoundingClientRect().top - root.getBoundingClientRect().top;
        if (Math.abs(top - pillTop(view().height, pillHeight(), open)) < 0.5) { frame = 0; done(); }
        else frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    // Rise from (or sink back into) the lowered pill, the neck thinning to a pinch.
    const separate = (to: 0 | 1, done: () => void) => {
      const from = separation, duration = TIMING.separateMs * Math.abs(to - from);
      const x = view().width / 2;
      const began = performance.now();
      const step = (now: number) => {
        const k = duration ? Math.min(1, (now - began) / duration) : 1;
        separation = from + (to - from) * k;
        const drop = dropletAt(separation);
        setShape(dropletShape(x, edge(), drop), drop.stretch);
        if (k < 1) frame = requestAnimationFrame(step);
        else { frame = 0; done(); }
      };
      frame = requestAnimationFrame(step);
    };

    const expand = () => {
      mode = "expanding";
      const from = current(), fromRadius = getComputedStyle(panel).borderRadius;
      stop();
      panel.style.clipPath = "";
      panel.style.transform = "";
      const to = target();
      setBox(to, "26px");
      // A liquid overshoot that swells upward, keeping the panel's foot just above the pill.
      const swell = { left: to.left - to.width * 0.01, top: to.top - to.height * 0.035, width: to.width * 1.02, height: to.height * 1.035 };
      const px = (box: Rect) => ({ left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
      motion = panel.animate([
        { ...px(from), borderRadius: fromRadius },
        { ...px(swell), borderRadius: "30px", offset: 0.62 },
        { ...px(to), borderRadius: "26px" },
      ], { duration: TIMING.expandMs, easing: "cubic-bezier(.3, .7, .25, 1)" });
      motion.onfinish = () => { motion = null; mode = "open"; settle(true); sync(); };
    };

    const shrink = () => {
      mode = "shrinking";
      settle(false);
      const from = current();
      stop();
      const drop = dropletAt(1);
      const circle = dropletShape(view().width / 2, edge(), drop);
      setBox(circle, `${drop.r}px`);
      const px = (box: Rect) => ({ left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
      motion = panel.animate([{ ...px(from), borderRadius: "26px" }, { ...px(circle), borderRadius: `${drop.r}px` }],
        { duration: TIMING.shrinkMs, delay: 110, easing: "cubic-bezier(.55, 0, .35, 1)", fill: "backwards" });
      motion.onfinish = () => { motion = null; mode = "merging"; separate(0, raise); };
    };

    // Once the droplet is back in the pill, the pill returns to the middle of the page.
    const raise = () => {
      mode = "raising";
      separation = 0;
      panel.style.visibility = "hidden";
      root.toggleAttribute("data-open", false);
      whenPill(false, () => { mode = "rest"; });
    };

    const sync = () => {
      if (mode !== "open") return;
      setBox(target(), "26px");
    };

    const open = () => {
      if (reduced.matches) {
        stop();
        root.toggleAttribute("data-open", true);
        panel.style.visibility = "visible";
        panel.style.clipPath = ""; panel.style.transform = "";
        setBox(target(), "26px");
        mode = "open"; separation = 1; settle(true);
        return;
      }
      if (mode === "rest" || mode === "raising") {
        // First the pill drops to the bottom; only then does the droplet leave it.
        stop();
        mode = "lowering";
        root.toggleAttribute("data-open", true);
        whenPill(true, () => { panel.style.visibility = "visible"; mode = "separating"; separate(1, expand); });
      } else if (mode === "merging") {
        stop();
        mode = "separating";
        separate(1, expand);
      } else if (mode === "shrinking") {
        expand();
      }
    };

    const close = () => {
      if (reduced.matches) {
        stop();
        settle(false);
        separation = 0;
        panel.style.visibility = "hidden";
        root.toggleAttribute("data-open", false);
        mode = "rest";
        return;
      }
      if (mode === "lowering") {
        stop();
        raise();
      } else if (mode === "separating") {
        stop();
        mode = "merging";
        separate(0, raise);
      } else if (mode === "expanding" || mode === "open") {
        shrink();
      }
    };

    liquid.current = { open, close, sync };
    place();
    const observer = new ResizeObserver(() => { place(); sync(); });
    observer.observe(root);
    return () => { observer.disconnect(); stop(); liquid.current = null; };
  }, []);

  useLayoutEffect(() => {
    if (typed) liquid.current?.open();
    else liquid.current?.close();
  }, [typed]);

  const report = useEffectEvent((searching: boolean) => onSearching?.(searching));
  useEffect(() => { report(typed); }, [typed]);

  useLayoutEffect(() => { liquid.current?.sync(); }, [results]);

  // "/" opens the search from anywhere on the page.
  useEffect(() => {
    if (!active) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || event.metaKey || event.ctrlKey || target?.closest("input, textarea, [contenteditable]")) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [active]);

  const links = () => Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>("a.search-result") ?? []);

  const onInputKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (query) setQuery("");
      else event.currentTarget.blur();
    } else if ((event.key === "ArrowDown" || event.key === "Enter") && shown && links().length) {
      event.preventDefault();
      links()[0].focus();
    }
  };

  const onListKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const order = links(), index = order.indexOf(document.activeElement as HTMLAnchorElement);
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step && index >= 0) {
      event.preventDefault();
      if (index + step < 0) inputRef.current?.focus();
      else order[Math.min(order.length - 1, index + step)]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      inputRef.current?.focus();
    }
  };

  return (
    <div ref={rootRef} className="life-search" data-shown={shown || undefined}>
      <div ref={panelRef} className="search-panel life-glass" inert={!shown} style={{ visibility: "hidden" }}>
        <div className="search-scroll" onKeyDown={onListKey}>
          <ul ref={listRef} className="search-results" aria-label="Results">
            {results.map((entry) => {
              const topic = TOPICS[entry.topic];
              const body = (
                <>
                  <span className="result-title">{entry.title}</span>
                  <span className="result-topic" style={{ "--topic": topic.color } as CSSProperties}><ClawStar />{topic.label}</span>
                </>
              );
              return (
                <li key={entry.id}>
                  {entry.href ? <a className="search-result" href={entry.href}>{body}</a> : <div className="search-result">{body}</div>}
                </li>
              );
            })}
            {typed && !results.length && <li className="search-empty">no matches</li>}
          </ul>
        </div>
      </div>
      <form ref={pillRef} className="search-pill life-glass" role="search" onSubmit={(event) => event.preventDefault()}>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKey}
          placeholder="search"
          aria-label="Search writing"
          aria-keyshortcuts="/"
          autoComplete="off"
          spellCheck={false}
        />
        {typed
          ? <span className="search-count" aria-hidden="true">{results.length}</span>
          : <kbd className="search-key" aria-hidden="true">/</kbd>}
        <span className="sr-only" aria-live="polite">{typed ? `${results.length} found` : ""}</span>
      </form>
    </div>
  );
}
