"use client";

import { useEffect, useRef, useState } from "react";
import type { AppleRenderer } from "@/lib/apple/renderer";

export function AppleAscii() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<AppleRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let disposed = false;
    void import("@/lib/apple/renderer").then(({ createAppleRenderer }) => {
      if (disposed || !canvasRef.current) return;
      try {
        rendererRef.current = createAppleRenderer(canvasRef.current, setReady);
      } catch (error) {
        // Keep the Blender-derived ASCII still when WebGL is unavailable.
        console.warn("Apple animation is unavailable:", error);
      }
    }).catch((error: unknown) => {
      if (!disposed) console.warn("Apple animation could not load:", error);
    });
    return () => {
      disposed = true;
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => { rendererRef.current?.setPaused(paused); }, [paused, ready]);

  return (
    <button
      className="apple"
      data-ready={ready}
      type="button"
      aria-label={paused ? "Resume apple rotation" : "Pause apple rotation"}
      aria-pressed={paused}
      onClick={() => setPaused((value) => !value)}
    >
      {/* The still also keeps the composition intact before the model loads. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/apple/ascii-still.png" alt="" width="720" height="720" />
      <canvas ref={canvasRef} aria-hidden="true" />
    </button>
  );
}
