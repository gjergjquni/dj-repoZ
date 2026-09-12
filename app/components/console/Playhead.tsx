type PlayheadProps = {
  playhead: number;
  duration: number;
  playing: boolean;
};

export function Playhead({ playhead, duration, playing }: PlayheadProps) {
  const pct = duration > 0 ? (playhead / duration) * 100 : 0;
  return (
    <div
      className={`playhead-rail${playing ? " is-playing" : ""}`}
      style={{ transform: `translateX(${pct}%)` }}
      aria-hidden="true"
    >
      <div className="playhead-line" />
    </div>
  );
}
