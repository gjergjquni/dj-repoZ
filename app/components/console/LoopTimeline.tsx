import { LOOP_BARS } from "@/lib/performer";
import { Playhead } from "./Playhead";

type LoopTimelineProps = {
  currentBar: number;
  playhead: number;
  duration: number;
  playing: boolean;
};

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function LoopTimeline({ currentBar, playhead, duration, playing }: LoopTimelineProps) {
  return (
    <div className="battle-timeline">
      <div className="timeline-grid">
        {Array.from({ length: LOOP_BARS }, (_, i) => {
          const fired = i < currentBar;
          const active = playing && i === currentBar;
          const side = i % 2 === 0 ? "hype" : "diss";
          return (
            <div
              key={i}
              className={`timeline-cell timeline-cell-${side}${fired ? " is-fired" : ""}${active ? " is-active" : ""}`}
            >
              {(i + 1).toString().padStart(2, "0")}
            </div>
          );
        })}
        <Playhead playhead={playhead} duration={duration} playing={playing} />
      </div>
      <div className="timeline-ruler">
        <span>{fmt(0)}</span>
        <span>{fmt(duration / 2)}</span>
        <span>{fmt(duration)}</span>
      </div>
    </div>
  );
}
