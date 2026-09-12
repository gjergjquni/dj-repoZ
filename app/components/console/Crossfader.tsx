"use client";

type CrossfaderProps = {
  value: number;
  onChange: (v: number) => void;
};

export function boostsFromCrossfade(value: number): { rhythm: number; melody: number } {
  const rhythm = Math.max(value <= 0 ? 1 : 1 - value * 0.75, 0.05);
  const melody = Math.max(value >= 0 ? 1 : 1 + value * 0.75, 0.05);
  return { rhythm, melody };
}

export function Crossfader({ value, onChange }: CrossfaderProps) {
  const { rhythm, melody } = boostsFromCrossfade(value);
  const rhythmAlpha = 0.6 + 0.4 * Math.max(0, -value);
  const melodyAlpha = 0.6 + 0.4 * Math.max(0, value);

  return (
    <div className="crossfader-wrap">
      <div className="crossfader-title">CROSSFADER</div>
      <div className="crossfader">
        <span className="crossfader-label is-hype" style={{ opacity: rhythmAlpha }}>
          RHYTHM
        </span>
        <div className="crossfader-body">
          <div className="crossfader-track">
            <span className="crossfader-half is-hype" style={{ opacity: rhythm }} />
            <span className="crossfader-half is-diss" style={{ opacity: melody }} />
          </div>
          <input
            className="crossfader-range"
            type="range"
            min={-1}
            max={1}
            step={0.02}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label="crossfader, rhythm to melody"
          />
        </div>
        <span className="crossfader-label is-diss" style={{ opacity: melodyAlpha }}>
          MELODY
        </span>
      </div>
    </div>
  );
}
