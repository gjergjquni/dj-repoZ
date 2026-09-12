"use client";

import { ScanProgress } from "./ScanProgress";

type FilmGateProps = {
  mode: "off" | "scan" | "lock";
  scanComplete: boolean;
  lockLine?: string;
};

export function FilmGate({ mode, scanComplete, lockLine }: FilmGateProps) {
  return (
    <div
      className={`film-gate${mode !== "off" ? " is-on" : ""} film-gate-${mode}`}
      aria-hidden={mode === "off"}
      aria-live="polite"
    >
      <div className="letterbox letterbox-top" />
      <div className="letterbox letterbox-bot" />
      <div className="film-center">
        {mode === "scan" ? <ScanProgress complete={scanComplete} /> : null}
        {mode === "lock" ? (
          <div className="title-card">
            <div className="title-card-kicker">REPODJ</div>
            <div className="title-card-title">SOURCE LOCKED</div>
            {lockLine ? <div className="title-card-sub">{lockLine}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
