"use client";

import * as Tone from "tone";
import { mulberry32 } from "./hash";
import { BAR_SECONDS, TOTAL_SECONDS } from "./score";
import type { BattlePlan } from "./types";

export type PerformerEvents = {
  onBar?: (barIndex: number) => void;
  onTick?: (seconds: number) => void;
  onEnd?: () => void;
};

/**
 * Deterministic 20-second performance.
 * The beat is pure math from RepoPhysics — the LLM never touches audio.
 */
export class Performer {
  private plan: BattlePlan;
  private events: PerformerEvents;
  private disposables: { dispose(): void }[] = [];
  private tickRaf = 0;
  private startedAt = 0;
  private utterances: SpeechSynthesisUtterance[] = [];
  private stopTimeout: ReturnType<typeof setTimeout> | null = null;
  playing = false;
  hypeGainBoost = 1;
  dissGainBoost = 1;
  private hypeVol: Tone.Volume | null = null;
  private dissVol: Tone.Volume | null = null;

  constructor(plan: BattlePlan, events: PerformerEvents = {}) {
    this.plan = plan;
    this.events = events;
  }

  async start() {
    if (this.playing) return;
    await Tone.start();
    this.playing = true;

    const { physics, bars } = this.plan;
    const { mixer, seed, bpm, chaos, nightOwl } = physics;
    const rand = mulberry32(seed);
    const now = Tone.now() + 0.1;
    this.startedAt = now;

    const master = new Tone.Gain(0.9).toDestination();

    // channel strips, panned like the columns: hype left, diss right
    const hypePan = new Tone.Panner(-0.5).connect(master);
    const dissPan = new Tone.Panner(0.5).connect(master);
    this.hypeVol = new Tone.Volume(0).connect(hypePan);
    this.dissVol = new Tone.Volume(0).connect(dissPan);

    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.35, sustain: 0 },
      volume: Tone.gainToDb(mixer.kick),
    }).connect(master);

    const hat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
      volume: Tone.gainToDb(mixer.hats * 0.5),
    }).connect(master);

    const bass = new Tone.MonoSynth({
      oscillator: { type: "square" },
      filter: { type: "lowpass", frequency: 300 } as any,
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.1 },
      volume: Tone.gainToDb(mixer.bass * 0.8),
    }).connect(master);

    const lead = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
      volume: Tone.gainToDb(mixer.lead * 0.6),
    }).connect(master);

    const pad = new Tone.Noise("pink");
    const padGain = new Tone.Gain(mixer.pad * 0.12).connect(master);
    const padFilter = new Tone.Filter(400, "lowpass").connect(padGain);
    pad.connect(padFilter);
    pad.start(now);
    pad.stop(now + TOTAL_SECONDS);

    this.disposables.push(master, hypePan, dissPan, this.hypeVol, this.dissVol, kick, hat, bass, lead, pad, padGain, padFilter);

    // ---- deterministic grid ----
    const beat = 60 / bpm;
    const sixteenth = beat / 4;
    const swing = nightOwl > 0.4 ? sixteenth * 0.3 * nightOwl : 0;
    const bassNotes = ["C2", "C2", "Eb2", "G1"];
    const leadNotes = ["C5", "Eb5", "G5", "Bb5"];

    for (let bar = 0; bar < 8; bar++) {
      const barStart = now + bar * BAR_SECONDS;
      // kick lands on every bar, plus BPM-aligned kicks inside the bar
      kick.triggerAttackRelease("C1", 0.1, barStart);
      for (let b = 1; b * beat < BAR_SECONDS - 0.05; b++) {
        if (b % 2 === 0 || rand() < 0.3) {
          kick.triggerAttackRelease("C1", 0.08, barStart + b * beat, 0.7);
        }
      }
      // hats: density from entropy, offbeats when chaotic; swung 8ths when night owl
      for (let s = 0; s * sixteenth < BAR_SECONDS - 0.03; s++) {
        const isOffbeat = s % 2 === 1;
        const p = isOffbeat ? chaos * 0.9 : 0.55 + chaos * 0.3;
        if (rand() < p) {
          const swungTime =
            barStart + s * sixteenth + (isOffbeat ? swing : 0);
          hat.triggerAttackRelease(0.03, swungTime, isOffbeat ? 0.4 : 0.8);
        }
      }
      // bass: 8ths, gain already from Python bytes
      if (mixer.bass > 0.05) {
        for (let e = 0; e * beat * 0.5 < BAR_SECONDS - 0.05; e++) {
          if (rand() < 0.6) {
            bass.triggerAttackRelease(
              bassNotes[e % 4],
              beat * 0.4,
              barStart + e * beat * 0.5
            );
          }
        }
      }
      // lead blips from Rust/Go/C
      if (mixer.lead > 0.05) {
        for (let q = 0; q < 4; q++) {
          if (rand() < 0.35) {
            lead.triggerAttackRelease(
              leadNotes[Math.floor(rand() * 4)],
              0.08,
              barStart + q * (BAR_SECONDS / 4) + sixteenth
            );
          }
        }
      }
    }

    // ---- voices: 8 utterances locked to bar starts (16th-note grid origin) ----
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (synth) {
      synth.cancel();
      const voices = synth.getVoices();
      const enVoices = voices.filter((v) => v.lang.startsWith("en"));
      const hypeVoice = enVoices[0] ?? voices[0];
      const dissVoice = enVoices.length > 1 ? enVoices[enVoices.length - 1] : hypeVoice;

      for (const bar of bars) {
        const u = new SpeechSynthesisUtterance(bar.text);
        const isHype = bar.side === "hype";
        u.pitch = isHype ? 1.5 : 0.6;
        u.rate = isHype ? 1.15 : nightOwl > 0.4 ? 0.85 : 0.95;
        u.volume = isHype ? this.hypeGainBoost : this.dissGainBoost;
        u.voice = isHype ? hypeVoice : dissVoice;
        this.utterances.push(u);
        const delayMs = (bar.barIndex * BAR_SECONDS + 0.12) * 1000;
        const t = setTimeout(() => {
          if (!this.playing) return;
          u.volume = Math.min(bar.side === "hype" ? this.hypeGainBoost : this.dissGainBoost, 1);
          synth.speak(u);
        }, delayMs);
        this.stoppers.push(t);
      }
    }

    // bar highlight callbacks
    for (const bar of bars) {
      const t = setTimeout(() => {
        if (this.playing) this.events.onBar?.(bar.barIndex);
      }, bar.barIndex * BAR_SECONDS * 1000);
      this.stoppers.push(t);
    }

    // playhead
    const tick = () => {
      if (!this.playing) return;
      const elapsed = Tone.now() - this.startedAt;
      this.events.onTick?.(Math.max(0, Math.min(elapsed, TOTAL_SECONDS)));
      this.tickRaf = requestAnimationFrame(tick);
    };
    this.tickRaf = requestAnimationFrame(tick);

    // exactly 20 seconds then stop
    this.stopTimeout = setTimeout(() => this.stop(), TOTAL_SECONDS * 1000 + 150);
  }

  private stoppers: ReturnType<typeof setTimeout>[] = [];

  setSideVolume(side: "hype" | "diss", boost: number) {
    if (side === "hype") this.hypeGainBoost = boost;
    else this.dissGainBoost = boost;
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    if (this.stopTimeout) clearTimeout(this.stopTimeout);
    for (const t of this.stoppers) clearTimeout(t);
    this.stoppers = [];
    cancelAnimationFrame(this.tickRaf);
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        /* already disposed */
      }
    }
    this.disposables = [];
    this.events.onEnd?.();
  }
}
