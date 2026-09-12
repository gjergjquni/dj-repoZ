"use client";

import type { DJPlan } from "@/lib/types";
import { Logo } from "./Logo";

type StatusBarProps = {
  plan: DJPlan | null;
  scanning: boolean;
  onReset?: () => void;
};

export function StatusBar({ plan, scanning, onReset }: StatusBarProps) {
  const word = scanning ? "ANALYZING REPOSITORY" : "AWAITING INPUT";
  const dot = scanning ? "orange" : "faint";

  return (
    <header className="status-bar">
      {plan && onReset ? (
        <button type="button" className="status-logo-btn" onClick={onReset} title="NEW SET">
          <Logo size="sm" />
        </button>
      ) : (
        <Logo size="sm" />
      )}

      {plan ? (
        <>
          <span className="status-crumb">
            <span className="status-owner">{plan.analysis.owner}</span>
            {" / "}
            <span className="status-repo">{plan.analysis.repo}</span>
          </span>
          <span className="status-rule" />
          <span className="status-stars">★ {plan.analysis.stars.toLocaleString()}</span>
        </>
      ) : null}

      <span className="status-spacer" />

      {!plan ? (
        <span className="status-word">
          <span className={`status-dot status-dot-${dot}`} />
          {word}
        </span>
      ) : null}
    </header>
  );
}
