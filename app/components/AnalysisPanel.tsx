"use client";

import { useState } from "react";
import type { DJPlan } from "@/lib/types";

const BREAKDOWN_LABELS: Record<string, string> = {
  issuePressure: "open issue pressure",
  churn: "commit churn",
  treeDepth: "directory depth",
  testGap: "missing tests",
};

type AnalysisPanelProps = {
  plan: DJPlan;
  liveKey?: string | null;
};

export function AnalysisPanel({ plan, liveKey }: AnalysisPanelProps) {
  const [open, setOpen] = useState(false);
  const { analysis, spec } = plan;
  const entries = Object.entries(analysis.breakdown);

  return (
    <aside className={`blame-panel${open ? "" : " is-shut"}`}>
      <div className="panel-head">
        <button
          type="button"
          className={`analysis-cd${open ? " is-open" : ""}`}
          aria-expanded={open}
          aria-controls="analysis-drawer"
          title={open ? "Close analysis" : "Open analysis"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="analysis-cd-spin" aria-hidden="true">
            <span className="analysis-cd-iris" />
            <span className="analysis-cd-grooves" />
            <span className="analysis-cd-rim" />
          </span>
          <span className="analysis-cd-label" aria-hidden="true" />
          <span className="analysis-cd-hole" aria-hidden="true" />
          <span className="sr-only">{open ? "Close analysis" : "Open analysis"}</span>
        </button>
        {open ? <span className="panel-head-title">ANALYSIS // WHY IT SOUNDS LIKE THIS</span> : null}
      </div>
      <div id="analysis-drawer" className="blame-scroll" hidden={!open}>
        <div className="blame-section">MESSINESS BREAKDOWN</div>
        {entries.map(([k, v], i) => {
          const id = `break:${k}`;
          const firing = liveKey === id;
          return (
            <div key={k}>
              <div
                className={`commit-row${firing ? " commit-row-firing-hype" : ""}`}
              >
                <span className="commit-idx">{(i + 1).toString().padStart(2, "0")}</span>
                <span className="commit-sha">{k.slice(0, 5).toUpperCase()}</span>
                <span className="commit-msg">{BREAKDOWN_LABELS[k] ?? k}</span>
                <span className="commit-author">{(v * 100).toFixed(0)}%</span>
              </div>
              <div className="analysis-meter-row">
                <div className="mixer-track">
                  <div
                    className="mixer-fill mixer-fill-messy"
                    style={{ width: `${Math.min(v, 1) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        <div className="blame-section">PROJECT SIGNALS</div>
        {analysis.project_signals.length === 0 ? (
          <div className="commit-row">
            <span className="commit-idx">01</span>
            <span className="commit-sha">TYPE</span>
            <span className="commit-msg">no strong signals → library</span>
            <span />
          </div>
        ) : (
          analysis.project_signals.map((s, i) => (
            <div key={s} className="commit-row">
              <span className="commit-idx">{(i + 1).toString().padStart(2, "0")}</span>
              <span className="commit-sha">SIG</span>
              <span className="commit-msg">{s}</span>
              <span />
            </div>
          ))
        )}

        <div className="blame-section">MOOD</div>
        <div className={`commit-row${liveKey === "mood" ? " commit-row-firing-diss" : ""}`}>
          <span className="commit-idx">01</span>
          <span className="commit-sha">MOOD</span>
          <span className="commit-msg">{spec.mood}</span>
          <span />
        </div>

        {analysis.description ? (
          <>
            <div className="blame-section">ABOUT</div>
            <div className="commit-row">
              <span className="commit-idx">01</span>
              <span className="commit-sha">REPO</span>
              <span className="commit-msg wrap">{analysis.description}</span>
              <span />
            </div>
          </>
        ) : null}

        <div className="blame-section">INSTRUMENTS</div>
        <div className="chip-row">
          {spec.primary_instruments.map((i) => (
            <span className="chip" key={i}>
              {i}
            </span>
          ))}
        </div>
        <div className="blame-section">SFX</div>
        <div className="chip-row">
          {spec.sfx_elements.map((s) => (
            <span className="chip chip-sfx" key={s}>
              {s}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}
