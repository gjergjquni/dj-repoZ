import type { Side } from "./types";

type KeyboardHintsProps = {
  emphasis: "none" | Side;
};

export function KeyboardHints({ emphasis }: KeyboardHintsProps) {
  return (
    <p className="keyboard-hints">
      <span>SPACE // PLAY</span>
      <span className={emphasis === "hype" ? "is-hype" : undefined}>R // RHYTHM</span>
      <span className={emphasis === "diss" ? "is-diss" : undefined}>M // MELODY</span>
    </p>
  );
}
