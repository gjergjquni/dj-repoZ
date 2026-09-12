"use client";

import * as Tone from "tone";
import { mulberry32 } from "./hash";
import type { DJPlan } from "./types";

export type PerformerEvents = {
  onStep?: (step: number) => void; // 0..63 (4 bars × 16 steps)
  onTick?: (seconds: number, loopSeconds: number) => void;
  onEnd?: () => void;
};

export type DeckBus = "rhythm" | "melody";

export const LOOP_BARS = 4;
export const STEPS_PER_BAR = 16;
export const STEPS = LOOP_BARS * STEPS_PER_BAR;

/** 4 bars of 4/4 at the given BPM. */
export function loopSecondsFor(bpm: number): number {
  return (60 / bpm) * LOOP_BARS * 4;
}

/**
 * Pure instrumental DJ engine.
 * Everything is synthesized live with Tone.js from the AudioPromptSpec —
 * no samples, no voice, no lyrics. Deterministic from the repo seed:
 * the same repo state always plays the same set.
 */
export class Performer {
  private plan: DJPlan;
  private events: PerformerEvents;
  private disposables: { dispose(): void }[] = [];
  private tickRaf = 0;
  playing = false;
  rhythmGainBoost = 1;
  melodyGainBoost = 1;
  private rhythmVol: Tone.Volume | null = null;
  private melodyVol: Tone.Volume | null = null;

  constructor(plan: DJPlan, events: PerformerEvents = {}) {
    this.plan = plan;
    this.events = events;
  }

  async start() {
    if (this.playing) return;
    await Tone.start();
    this.playing = true;

    const { analysis, spec } = this.plan;
    const rand = mulberry32(analysis.seed);
    const tier = spec.tier;
    const inst = spec.primary_instruments.join(" ");
    const has = (kw: string) => inst.includes(kw);

    const t = Tone.getTransport();
    t.bpm.value = spec.bpm;
    t.loop = true;
    t.loopStart = 0;
    t.loopEnd = "4m";

    const master = new Tone.Gain(0.85).toDestination();
    const comp = new Tone.Compressor(-18, 3).connect(master);
    const rhythmVol = new Tone.Volume(0).connect(comp);
    const melodyVol = new Tone.Volume(0).connect(comp);
    this.rhythmVol = rhythmVol;
    this.melodyVol = melodyVol;
    rhythmVol.volume.value = Tone.gainToDb(Math.max(this.rhythmGainBoost, 0.001));
    melodyVol.volume.value = Tone.gainToDb(Math.max(this.melodyGainBoost, 0.001));
    this.disposables.push(master, comp, rhythmVol, melodyVol);

    // ---------- chords per tier (one chord per bar) ----------
    const PROGRESSIONS: Record<string, string[][]> = {
      clean: [
        ["C4", "E4", "G4", "B4"],
        ["A3", "C4", "E4", "G4"],
        ["F3", "A3", "C4", "E4"],
        ["G3", "B3", "D4", "E4"],
      ],
      moderate: [
        ["A3", "C4", "E4", "G4"],
        ["F3", "A3", "C4"],
        ["C4", "E4", "G4"],
        ["G3", "B3", "D4"],
      ],
      messy: [
        ["C3", "Eb3", "G3"],
        ["C3", "Eb3", "G3"],
        ["Ab2", "C3", "Eb3"],
        ["G2", "B2", "D3"],
      ],
    };
    const chords = PROGRESSIONS[tier];
    const roots = chords.map((c) => c[0]);
    const bassRoots = roots.map((r) =>
      r.replace(/\d/, (d) => String(Math.max(1, Number(d) - 2)))
    );

    // ---------- drums ----------
    const kick = new Tone.MembraneSynth({
      pitchDecay: tier === "messy" ? 0.02 : 0.05,
      octaves: 6,
      envelope: { attack: 0.001, decay: tier === "clean" ? 0.5 : 0.32, sustain: 0 },
      volume: -4,
    }).connect(rhythmVol);

    const snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
      volume: tier === "clean" ? -18 : -8,
    }).connect(rhythmVol);

    const hatCrush = new Tone.BitCrusher(has("bitcrushed") || has("chiptune") ? 4 : 16).connect(rhythmVol);
    const hat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
      volume: -14,
    }).connect(hatCrush);

    this.disposables.push(kick, snare, hat, hatCrush);

    // step patterns, deterministic from seed
    const kickPat = new Array<boolean>(STEPS).fill(false);
    const snarePat = new Array<boolean>(STEPS).fill(false);
    const hatPat = new Array<number>(STEPS).fill(0); // 0 off, 1 soft, 2 accent

    for (let s = 0; s < STEPS; s++) {
      const beat = Math.floor((s % 16) / 4); // 0..3 inside the bar
      const sub = s % 4;
      if (tier === "clean") {
        kickPat[s] = sub === 0 && (beat === 0 || beat === 2);
        hatPat[s] = sub === 2 && rand() < 0.4 ? 1 : 0;
      } else if (tier === "moderate") {
        kickPat[s] = sub === 0; // four on the floor
        snarePat[s] = sub === 0 && (beat === 1 || beat === 3);
        hatPat[s] = sub === 2 ? 2 : rand() < 0.25 ? 1 : 0;
      } else {
        // messy: broken kicks, backbeat + ghost snares, dense hats
        kickPat[s] = (sub === 0 && beat === 0) || rand() < 0.28;
        snarePat[s] =
          (sub === 0 && (beat === 1 || beat === 3)) || rand() < 0.12;
        hatPat[s] = rand() < 0.75 ? (s % 2 === 1 ? 1 : 2) : 0;
      }
    }

    // ---------- bass ----------
    const bassIs808 = has("808");
    const bassDistorted = has("distorted") || has("industrial");
    const bassDist = new Tone.Distortion(bassDistorted ? 0.6 : 0).connect(rhythmVol);
    const bass = bassIs808
      ? new Tone.MembraneSynth({
          pitchDecay: 0.08,
          octaves: 2,
          oscillator: { type: "sine" },
          envelope: { attack: 0.001, decay: 0.6, sustain: 0.05 },
          volume: -6,
        }).connect(bassDist)
      : new Tone.MonoSynth({
          oscillator: { type: bassDistorted ? "square" : has("funk") ? "sawtooth" : "triangle" },
          filter: { type: "lowpass", Q: 2 } as any,
          filterEnvelope: {
            attack: 0.005, decay: 0.15, sustain: 0.4, release: 0.1,
            baseFrequency: 120, octaves: 2.2,
          } as any,
          envelope: { attack: 0.004, decay: 0.25, sustain: 0.3, release: 0.1 },
          volume: -8,
        }).connect(bassDist);
    this.disposables.push(bass, bassDist);

    const bassPat = new Array<boolean>(STEPS).fill(false);
    for (let s = 0; s < STEPS; s++) {
      const sub = s % 4;
      if (tier === "clean") bassPat[s] = s % 16 === 0;
      else if (tier === "moderate") bassPat[s] = sub === 0 || (sub === 2 && rand() < 0.5);
      else bassPat[s] = sub === 0 || rand() < 0.2;
    }

    // ---------- chords / keys / pad ----------
    const wantsPiano = has("piano") || has("keys") || has("rhodes") || tier === "clean";
    const wantsPad = has("pad") || has("strings") || has("analog synths");
    const wantsGuitarStab = has("metal guitar");

    const keySynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: wantsPiano ? 3 : 1.5,
      modulationIndex: wantsPiano ? 8 : 4,
      envelope: { attack: wantsPiano ? 0.004 : 0.02, decay: 0.7, sustain: 0.12, release: 0.6 },
      volume: -16,
    } as any).connect(melodyVol);
    this.disposables.push(keySynth);

    let pad: Tone.PolySynth | null = null;
    if (wantsPad) {
      const padFilter = new Tone.Filter(900, "lowpass").connect(melodyVol);
      pad = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.6, decay: 0.5, sustain: 0.5, release: 1.2 },
        volume: -22,
      } as any).connect(padFilter);
      this.disposables.push(pad, padFilter);
    }

    let stab: Tone.MonoSynth | null = null;
    if (wantsGuitarStab) {
      const stabDist = new Tone.Distortion(0.8).connect(melodyVol);
      stab = new Tone.MonoSynth({
        oscillator: { type: "sawtooth" },
        filter: { type: "lowpass", Q: 4 } as any,
        filterEnvelope: {
          attack: 0.002, decay: 0.12, sustain: 0.1, release: 0.05,
          baseFrequency: 300, octaves: 2.5,
        } as any,
        envelope: { attack: 0.002, decay: 0.18, sustain: 0.05, release: 0.05 },
        volume: -14,
      }).connect(stabDist);
      this.disposables.push(stab, stabDist);
    }

    // ---------- lead / arpeggio ----------
    const wantsArp = has("arpeggios") || tier === "moderate";
    const wantsChip = has("chiptune");
    let lead: Tone.Synth | null = null;
    if (wantsArp || wantsChip) {
      const leadOut: Tone.ToneAudioNode = wantsChip
        ? new Tone.BitCrusher(4).connect(melodyVol)
        : new Tone.Filter(2400, "lowpass").connect(melodyVol);
      lead = new Tone.Synth({
        oscillator: { type: wantsChip ? "square" : "triangle" },
        envelope: { attack: 0.002, decay: 0.09, sustain: 0, release: 0.05 },
        volume: wantsChip ? -16 : -18,
      }).connect(leadOut);
      this.disposables.push(lead, leadOut);
    }

    // ---------- project-type SFX ----------
    const sfxSynth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 },
      volume: -16,
    }).connect(melodyVol);
    const glitch = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
      volume: -18,
    }).connect(melodyVol);
    this.disposables.push(sfxSynth, glitch);

    if (analysis.project_type === "library") {
      // soft vinyl crackle bed
      const crackle = new Tone.Noise("pink");
      const crackleGain = new Tone.Gain(0.015).connect(master);
      crackle.connect(crackleGain).start();
      this.disposables.push(crackle, crackleGain);
    }

    const fireSfx = (time: number, step: number) => {
      const type = analysis.project_type;
      if (type === "web_app") {
        // UI chime: two quick ascending sines
        sfxSynth.triggerAttackRelease("E6", 0.08, time);
        sfxSynth.triggerAttackRelease("B6", 0.08, time + 0.09);
      } else if (type === "web_extension") {
        // notification pop
        sfxSynth.triggerAttackRelease("G6", 0.05, time);
      } else if (type === "ml_project") {
        // glitchy stutter burst
        for (let i = 0; i < 3; i++) glitch.triggerAttackRelease(0.02, time + i * 0.04);
      } else if (type === "cli_tool") {
        // keyboard clack
        glitch.triggerAttackRelease(0.015, time);
      } else if (type === "game_engine") {
        // coin chime
        sfxSynth.triggerAttackRelease("B5", 0.05, time);
        sfxSynth.triggerAttackRelease("E6", 0.12, time + 0.06);
      }
      void step;
    };

    // steps where SFX fire (sparse, deterministic)
    const sfxSteps = new Set<number>();
    for (let bar = 0; bar < 4; bar++) {
      if (rand() < 0.8) sfxSteps.add(bar * 16 + 8 + Math.floor(rand() * 4));
    }

    // ---------- sequencer ----------
    const stepIdx = Array.from({ length: STEPS }, (_, i) => i);
    const seq = new Tone.Sequence(
      (time, s) => {
        const bar = Math.floor(s / 16);
        if (kickPat[s]) kick.triggerAttackRelease("C1", 0.1, time);
        if (snarePat[s]) snare.triggerAttackRelease(0.08, time);
        if (hatPat[s] > 0) hat.triggerAttackRelease(0.03, time, hatPat[s] === 2 ? 0.8 : 0.4);
        if (bassPat[s]) {
          bass.triggerAttackRelease(bassRoots[bar], tier === "clean" ? "2n" : "8n", time);
        }
        if (s % 16 === 0) {
          keySynth.triggerAttackRelease(chords[bar], tier === "clean" ? "1m" : "2n", time);
          pad?.triggerAttackRelease(chords[bar], "1m", time, 0.6);
        }
        if (stab && s % 8 === 4) {
          stab.triggerAttackRelease(roots[bar].replace(/\d/, "2"), "16n", time);
        }
        if (lead && s % 2 === 0) {
          const notes = chords[bar];
          const n = notes[(s / 2) % notes.length].replace(/\d/, (d) => String(Number(d) + 1));
          if (tier !== "clean" || s % 8 === 0) lead.triggerAttackRelease(n, "16n", time, 0.5);
        }
        if (sfxSteps.has(s)) fireSfx(time, s);
        Tone.getDraw().schedule(() => {
          if (this.playing) this.events.onStep?.(s);
        }, time);
      },
      stepIdx,
      "16n"
    ).start(0);
    this.disposables.push(seq);

    t.start("+0.05");

    const loopSeconds = loopSecondsFor(spec.bpm);
    const tick = () => {
      if (!this.playing) return;
      const secs = t.seconds % loopSeconds;
      this.events.onTick?.(secs, loopSeconds);
      this.tickRaf = requestAnimationFrame(tick);
    };
    this.tickRaf = requestAnimationFrame(tick);
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.tickRaf);
    const t = Tone.getTransport();
    t.stop();
    t.cancel();
    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        /* already disposed */
      }
    }
    this.disposables = [];
    this.rhythmVol = null;
    this.melodyVol = null;
    this.events.onEnd?.();
  }

  setDeckVolume(side: DeckBus, gain: number) {
    const db = Tone.gainToDb(Math.max(gain, 0.001));
    if (side === "rhythm") {
      this.rhythmGainBoost = gain;
      if (this.rhythmVol) this.rhythmVol.volume.value = db;
    } else {
      this.melodyGainBoost = gain;
      if (this.melodyVol) this.melodyVol.volume.value = db;
    }
  }
}
