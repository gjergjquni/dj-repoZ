import type { Side } from "../types";

type EqArcProps = {
  label: string;
  value: number;
  active: boolean;
  side: Side;
  title: string;
};

export function EqArc({ label, value, active, side, title }: EqArcProps) {
  const clamped = Math.min(Math.max(value, 0), 1);
  const angle = -135 + clamped * 270;
  return (
    <div className={`eq-arc${active ? ` is-${side}` : ""}`} title={title}>
      <span className="eq-knob">
        <span className="eq-knob-tick" style={{ transform: `rotate(${angle}deg)` }} />
      </span>
      <span className="eq-arc-label">{label}</span>
    </div>
  );
}
