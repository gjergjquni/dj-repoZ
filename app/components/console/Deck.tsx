import type { Mixer } from "@/lib/mixer";
import { LOOP_BARS } from "@/lib/performer";
import type { Side } from "../types";
import { DECK_LABEL } from "../types";
import { EqArc } from "./EqArc";
import { MasterWaveform } from "./MasterWaveform";
import { Platter } from "./Platter";

type DeckProps = {
  side: Side;
  currentBar: number;
  playhead: number;
  duration: number;
  mixer: Mixer;
  active: boolean;
  pulse: number;
  rotation: number;
  seed: number;
  chaos: number;
  playing: boolean;
};

export function Deck({
  side,
  currentBar,
  playhead,
  duration,
  mixer,
  active,
  pulse,
  rotation,
  seed,
  chaos,
  playing,
}: DeckProps) {
  const barLabel = currentBar >= 0 ? currentBar + 1 : 0;
  const { header, name } = DECK_LABEL[side];

  const low = side === "hype" ? mixer.kick : mixer.bass;
  const mid = side === "hype" ? mixer.pad : mixer.lead;
  const high = mixer.hats;

  const lowTitle =
    side === "hype"
      ? `mixer.kick = ${mixer.kick.toFixed(2)} (js/ts byte share)`
      : `mixer.bass = ${mixer.bass.toFixed(2)} (python byte share)`;
  const midTitle =
    side === "hype"
      ? `mixer.pad = ${mixer.pad.toFixed(2)} (remaining languages)`
      : `mixer.lead = ${mixer.lead.toFixed(2)} (rust/go/c/c++)`;
  const highTitle = `mixer.hats = ${mixer.hats.toFixed(2)} (js/ts byte share)`;

  return (
    <div className={`deck deck-${side}${active ? " is-active" : ""}`}>
      <div className="deck-head">
        <span>
          <span className="deck-head-muted">{header}</span>
          <span className={`deck-head-side deck-head-side-${side}`}>{name}</span>
        </span>
        <span className="deck-count">
          BAR {barLabel.toString().padStart(2, "0")} / {LOOP_BARS.toString().padStart(2, "0")}
        </span>
      </div>
      <Platter side={side} active={active} rotation={rotation} pulse={pulse} />
      <div className="deck-eq">
        <EqArc label="LOW" value={low} active={active} side={side} title={lowTitle} />
        <EqArc label="MID" value={mid} active={active} side={side} title={midTitle} />
        <EqArc label="HIGH" value={high} active={active} side={side} title={highTitle} />
      </div>
      <div className="deck-wave">
        <MasterWaveform
          seed={seed}
          chaos={chaos}
          playhead={playhead}
          duration={duration}
          playing={playing}
          accent={side}
          height={36}
        />
      </div>
    </div>
  );
}
