"use client";

import { LOOP_BARS } from "@/lib/performer";
import type { Mixer } from "@/lib/mixer";
import type { DJPlan } from "@/lib/types";
import type { Side } from "../types";
import { KeyboardHints } from "../KeyboardHints";
import { BpmDisplay } from "./BpmDisplay";
import { Crossfader } from "./Crossfader";
import { Deck } from "./Deck";
import { LoopTimeline } from "./LoopTimeline";
import { MasterWaveform } from "./MasterWaveform";
import { Transport } from "./Transport";

type DJConsoleProps = {
  plan: DJPlan;
  mixer: Mixer;
  playing: boolean;
  currentBar: number;
  playhead: number;
  duration: number;
  pulse: number;
  rotation: number;
  crossfade: number;
  onCrossfade: (v: number) => void;
  onPlay: () => void;
  onStop: () => void;
  onRestart: () => void;
  rhythmBoost: number;
  melodyBoost: number;
  reduceMotion: boolean;
  emphasis: "none" | Side;
};

export function DJConsole({
  plan,
  mixer,
  playing,
  currentBar,
  playhead,
  duration,
  pulse,
  rotation,
  crossfade,
  onCrossfade,
  onPlay,
  onStop,
  onRestart,
  rhythmBoost,
  melodyBoost,
  reduceMotion,
  emphasis,
}: DJConsoleProps) {
  const chaos = plan.analysis.messiness_score / 100;
  const seed = plan.analysis.seed;
  const final = playing && currentBar === LOOP_BARS - 1;
  const breath = reduceMotion ? 0 : 0.06 + pulse * 0.1;
  const rhythmActive = playing && (emphasis === "hype" || emphasis === "none");
  const melodyActive = playing && (emphasis === "diss" || emphasis === "none");

  return (
    <div className={`dj-console${final ? " is-final" : ""}`}>
      <Deck
        side="hype"
        currentBar={currentBar}
        playhead={playhead}
        duration={duration}
        mixer={mixer}
        active={rhythmActive}
        pulse={pulse}
        rotation={rotation}
        seed={seed}
        chaos={chaos}
        playing={playing}
      />
      <div className="dj-center">
        <BpmDisplay bpm={plan.spec.bpm} pulse={pulse} duration={duration} />
        <div className="dj-wave">
          <MasterWaveform
            seed={seed}
            chaos={chaos}
            playhead={playhead}
            duration={duration}
            playing={playing}
            height={56}
          />
        </div>
        <Crossfader value={crossfade} onChange={onCrossfade} />
        <Transport
          playing={playing}
          disabled={false}
          playhead={playhead}
          duration={duration}
          onPlay={onPlay}
          onStop={onStop}
          onRestart={onRestart}
        />
        <LoopTimeline
          currentBar={currentBar}
          playhead={playhead}
          duration={duration}
          playing={playing}
        />
        <KeyboardHints emphasis={emphasis} />
      </div>
      <Deck
        side="diss"
        currentBar={currentBar}
        playhead={playhead}
        duration={duration}
        mixer={mixer}
        active={melodyActive}
        pulse={pulse}
        rotation={rotation}
        seed={seed ^ 0xa5a5a5a5}
        chaos={chaos}
        playing={playing}
      />
      <div className="dj-breath" style={{ opacity: breath * Math.max(rhythmBoost, melodyBoost) }} aria-hidden="true" />
    </div>
  );
}
