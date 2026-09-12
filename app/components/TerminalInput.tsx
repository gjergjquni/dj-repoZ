"use client";

import type { FormEvent } from "react";

type TerminalInputProps = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e?: FormEvent) => void;
  disabled: boolean;
};

export function TerminalInput({ value, onChange, onSubmit, disabled }: TerminalInputProps) {
  return (
    <form className="terminal-input" onSubmit={onSubmit}>
      <span className="terminal-prompt">$ repodj spin</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="github.com/owner/repo"
        autoFocus
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
      />
      <button type="submit" disabled={disabled || value.trim().length === 0}>
        EXECUTE →
      </button>
    </form>
  );
}
