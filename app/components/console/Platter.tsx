import type { Side } from "../types";

type PlatterProps = {
  side: Side;
  active: boolean;
  rotation: number;
  pulse: number;
};

export function Platter({ side, active, rotation, pulse }: PlatterProps) {
  const ringOpacity = active ? 0.7 + pulse * 0.3 : 1;
  return (
    <div className={`platter platter-${side}${active ? " is-active" : ""}`}>
      <div className="platter-face" />
      <div className="platter-ring" style={{ opacity: ringOpacity }} />
      <div className="platter-rotor" style={{ transform: `rotate(${rotation}deg)` }}>
        <div className="platter-grooves" />
        <div className="platter-marker" />
      </div>
      <div className="platter-hub" />
    </div>
  );
}
