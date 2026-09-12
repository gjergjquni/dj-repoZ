"use client";

import { LOOP_BARS } from "@/lib/performer";

type TransportProps = {
  playing: boolean;
  disabled: boolean;
  playhead: number;
  duration: number;
  onPlay: () => void;
  onStop: () => void;
  onRestart: () => void;
};

export function Transport({
  playing,
  disabled,
  playhead,
  duration,
  onPlay,
  onStop,
  onRestart,
}: TransportProps) {
  return (
    <div className="transport">
      <button
        type="button"
        className="transport-btn"
        onClick={onRestart}
        disabled={disabled}
        aria-label="restart"
        title="RESTART"
      >
        ◀◀
      </button>
      <button
        type="button"
        className="transport-btn is-play"
        onClick={onPlay}
        disabled={disabled}
        aria-label={playing ? "pause" : "play"}
      >
        {playing ? "⏸" : "▶"}
      </button>
      <button
        type="button"
        className="transport-btn"
        onClick={onStop}
        disabled={disabled || !playing}
        aria-label="stop"
        title="STOP"
      >
        ■
      </button>
      <button
        type="button"
        className="transport-btn"
        disabled
        aria-label="loop"
        title={`the set loops ${LOOP_BARS} bars`}
      >
        ▶▶
      </button>
      <span className="transport-time">
        {(playing ? playhead : 0).toFixed(1)} / {duration.toFixed(1)}s
      </span>
    </div>
  );
}
