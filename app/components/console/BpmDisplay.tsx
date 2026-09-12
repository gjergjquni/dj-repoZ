import { LOOP_BARS } from "@/lib/performer";

type BpmDisplayProps = {
  bpm: number;
  pulse: number;
  duration: number;
};

export function BpmDisplay({ bpm, pulse, duration }: BpmDisplayProps) {
  return (
    <div className="bpm-display">
      <div className="bpm-readout" style={{ opacity: 1 - pulse * 0.28 }}>
        {bpm.toFixed(1)}
      </div>
      <div className="bpm-label">BPM</div>
      <div className="bpm-meta">
        <span>{duration.toFixed(1)} SEC LOOP</span>
        <span>{LOOP_BARS} BARS</span>
      </div>
    </div>
  );
}
