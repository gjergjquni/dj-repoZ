"use client";

import { useEffect, useState } from "react";

type ScanProgressProps = {
  complete: boolean;
};

const STEPS = [
  "FETCHING TREE",
  "READING LANGUAGES",
  "SCORING MESSINESS",
  "DETECTING PROJECT TYPE",
  "MAPPING INSTRUMENTS",
  "COMPUTING BPM",
  "BUILDING SET",
] as const;

const LOG = [
  "connecting to github...",
  "fetching git tree...",
  "reading language bytes...",
  "scoring messiness...",
  "mapping instruments...",
  "building the set...",
] as const;

const BLOCKS = 28;

export function ScanProgress({ complete }: ScanProgressProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (complete) {
      setStep(STEPS.length);
      return;
    }
    setStep(0);
    let s = 0;
    const id = window.setInterval(() => {
      s += 1;
      if (s >= STEPS.length - 1) {
        window.clearInterval(id);
        setStep(STEPS.length - 1);
      } else {
        setStep(s);
      }
    }, 280);
    return () => window.clearInterval(id);
  }, [complete]);

  const done = complete || step >= STEPS.length;
  const active = done ? STEPS.length : step;
  const filled = done ? BLOCKS : Math.max(1, Math.round((active / STEPS.length) * (BLOCKS - 4)));
  const pct = done ? 100 : Math.min(92, Math.round((active / (STEPS.length - 1)) * 84));

  return (
    <div className="scan-progress">
      <div className="scan-head">
        <span>REPODJ // ANALYZING REPOSITORY</span>
        <span className="scan-pct">{pct}%</span>
      </div>
      <div className="scan-blocks" aria-hidden="true">
        {Array.from({ length: BLOCKS }, (_, i) => (
          <span
            key={i}
            className={`scan-block${i < filled ? " is-on" : ""}${i === filled - 1 && !done ? " is-lead" : ""}`}
          />
        ))}
      </div>
      <div className="scan-list">
        {STEPS.map((label, i) => {
          const ok = done || i < active;
          const current = !done && i === active;
          return (
            <div key={label} className={`scan-row${current ? " is-current" : ""}`}>
              <span className="scan-row-label">{label}</span>
              <span className="scan-dots" />
              {ok ? (
                <span className="scan-ok">OK</span>
              ) : current ? (
                <span className="scan-cursor" />
              ) : (
                <span className="scan-wait" />
              )}
            </div>
          );
        })}
      </div>
      <div className="scan-log">
        {LOG.slice(0, Math.min(LOG.length, active + 1)).map((line) => (
          <div key={line}>
            <span className="scan-dollar">$</span> {line}
          </div>
        ))}
      </div>
    </div>
  );
}
