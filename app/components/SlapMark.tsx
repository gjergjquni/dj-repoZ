"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

const SHARDS = [
  { g: "♫", a: -88, d: 118, delay: "0ms", size: 22, color: "var(--orange)" },
  { g: "♪", a: -52, d: 96, delay: "18ms", size: 16, color: "var(--purple)" },
  { g: "♩", a: -18, d: 124, delay: "8ms", size: 18, color: "var(--text)" },
  { g: "♫", a: 16, d: 90, delay: "28ms", size: 14, color: "var(--hype)" },
  { g: "✦", a: 48, d: 108, delay: "12ms", size: 11, color: "var(--orange)" },
  { g: "♪", a: 82, d: 86, delay: "24ms", size: 17, color: "var(--pink)" },
  { g: "♫", a: 118, d: 130, delay: "6ms", size: 20, color: "var(--orange)" },
  { g: "♩", a: 152, d: 92, delay: "32ms", size: 13, color: "var(--purple)" },
  { g: "♪", a: 178, d: 114, delay: "14ms", size: 15, color: "var(--text)" },
  { g: "✦", a: -148, d: 88, delay: "22ms", size: 10, color: "var(--hype)" },
  { g: "♫", a: -120, d: 136, delay: "4ms", size: 19, color: "var(--pink)" },
  { g: "♪", a: 210, d: 102, delay: "20ms", size: 14, color: "var(--orange)" },
  { g: "♩", a: 248, d: 78, delay: "36ms", size: 12, color: "var(--text-dim)" },
  { g: "✦", a: 280, d: 122, delay: "10ms", size: 11, color: "var(--purple)" },
  { g: "♫", a: 318, d: 94, delay: "26ms", size: 16, color: "var(--orange)" },
  { g: "♪", a: 70, d: 148, delay: "16ms", size: 13, color: "var(--hype)" },
  { g: "·", a: -70, d: 64, delay: "0ms", size: 18, color: "var(--orange)" },
  { g: "·", a: 140, d: 70, delay: "8ms", size: 16, color: "var(--text)" },
  { g: "·", a: 250, d: 58, delay: "12ms", size: 14, color: "var(--purple)" },
  { g: "·", a: 10, d: 74, delay: "20ms", size: 15, color: "var(--hype)" },
] as const;

type SlapMarkProps = {
  exploding: boolean;
};

export function SlapMark({ exploding }: SlapMarkProps) {
  const noteRef = useRef<HTMLSpanElement>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!exploding) {
      setOrigin(null);
      return;
    }
    const node = noteRef.current;
    if (!node) return;
    const r = node.getBoundingClientRect();
    setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }, [exploding]);

  return (
    <span className="slap-mark">
      <span
        ref={noteRef}
        className={`slap-note${exploding ? " is-exploding" : ""}`}
        aria-hidden="true"
      >
        ♫
      </span>
      {origin
        ? createPortal(
            <span
              className="slap-burst"
              style={{ left: origin.x, top: origin.y }}
              aria-hidden="true"
            >
              <span className="slap-shock" />
              {SHARDS.map((s, i) => {
                const rad = (s.a * Math.PI) / 180;
                return (
                  <span
                    key={i}
                    className="slap-shard"
                    style={
                      {
                        color: s.color,
                        fontSize: s.size,
                        animationDelay: s.delay,
                        "--dx": `${Math.cos(rad) * s.d}px`,
                        "--dy": `${Math.sin(rad) * s.d}px`,
                        "--rot": `${s.a * 1.8}deg`,
                      } as CSSProperties
                    }
                  >
                    {s.g}
                  </span>
                );
              })}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}
