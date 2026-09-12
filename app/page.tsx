"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnalysisPanel } from "@/app/components/AnalysisPanel";
import { ErrorBanner } from "@/app/components/ErrorBanner";
import { FilmGate } from "@/app/components/FilmGate";
import { LanguageMixer } from "@/app/components/LanguageMixer";
import { PhysicsStrip } from "@/app/components/PhysicsStrip";
import { SlapMark } from "@/app/components/SlapMark";
import { StatusBar } from "@/app/components/StatusBar";
import { TerminalInput } from "@/app/components/TerminalInput";
import { DJConsole } from "@/app/components/console/DJConsole";
import { boostsFromCrossfade } from "@/app/components/console/Crossfader";
import type { Side } from "@/app/components/types";
import { mixerFromLanguages } from "@/lib/mixer";
import { parseRepoInput } from "@/lib/parse-repo";
import { loopSecondsFor, Performer, STEPS_PER_BAR } from "@/lib/performer";
import type { DJPlan } from "@/lib/types";

type Film = "idle" | "scan" | "lock" | "live";

export default function Home() {
  const [input, setInput] = useState("");
  const [plan, setPlan] = useState<DJPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [film, setFilm] = useState<Film>("idle");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const [playhead, setPlayhead] = useState(0);
  const [loopSeconds, setLoopSeconds] = useState(1);
  const [crossfade, setCrossfade] = useState(0);
  const [emphasis, setEmphasis] = useState<"none" | Side>("none");
  const [clock, setClock] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [exploding, setExploding] = useState(false);

  const filmRef = useRef<Film>("idle");
  filmRef.current = film;
  const performerRef = useRef<Performer | null>(null);
  const crossfadeRef = useRef(0);
  const revealRef = useRef<number | null>(null);
  const explodeRef = useRef<number | null>(null);

  const applyCrossfade = useCallback((value: number) => {
    crossfadeRef.current = value;
    setCrossfade(value);
    const { rhythm, melody } = boostsFromCrossfade(value);
    performerRef.current?.setDeckVolume("rhythm", rhythm);
    performerRef.current?.setDeckVolume("melody", melody);
    setEmphasis(value <= -0.5 ? "hype" : value >= 0.5 ? "diss" : "none");
  }, []);

  const stop = useCallback(() => {
    performerRef.current?.stop();
    performerRef.current = null;
  }, []);

  const load = useCallback(
    async (qs: string) => {
      if (revealRef.current) window.clearTimeout(revealRef.current);
      stop();
      setPlaying(false);
      setLoading(true);
      setFilm("scan");
      setError("");
      try {
        const res = await fetch(`/api/dj?${qs}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        const next = data as DJPlan;
        setPlan(next);
        setStep(-1);
        setPlayhead(0);
        setLoopSeconds(loopSecondsFor(next.spec.bpm));
        applyCrossfade(0);
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setFilm("live");
        } else {
          setFilm("lock");
          revealRef.current = window.setTimeout(() => setFilm("live"), 900);
        }
      } catch (e) {
        setError((e as Error).message);
        setPlan(null);
        setFilm("idle");
        setExploding(false);
      } finally {
        setLoading(false);
      }
    },
    [stop, applyCrossfade]
  );

  const submit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const parsed = parseRepoInput(input);
      if (!parsed) {
        setError("unparseable input");
        return;
      }
      const qs = `owner=${encodeURIComponent(parsed.owner)}&repo=${encodeURIComponent(parsed.repo)}`;
      if (explodeRef.current) window.clearTimeout(explodeRef.current);
      if (reduceMotion) {
        void load(qs);
        return;
      }
      setExploding(true);
      explodeRef.current = window.setTimeout(() => void load(qs), 480);
    },
    [input, load, reduceMotion]
  );

  const play = useCallback(async () => {
    if (!plan) return;
    stop();
    setStep(-1);
    setPlayhead(0);
    const p = new Performer(plan, {
      onStep: setStep,
      onTick: (secs, loop) => {
        setPlayhead(secs);
        setLoopSeconds(loop);
      },
      onEnd: () => {
        setPlaying(false);
        setStep(-1);
        setPlayhead(0);
      },
    });
    performerRef.current = p;
    setPlaying(true);
    await p.start();
    const { rhythm, melody } = boostsFromCrossfade(crossfadeRef.current);
    p.setDeckVolume("rhythm", rhythm);
    p.setDeckVolume("melody", melody);
  }, [plan, stop]);

  const togglePlay = useCallback(() => {
    if (playing) {
      stop();
      setPlaying(false);
    } else {
      void play();
    }
  }, [playing, play, stop]);

  const reset = useCallback(() => {
    if (revealRef.current) window.clearTimeout(revealRef.current);
    if (explodeRef.current) window.clearTimeout(explodeRef.current);
    stop();
    setPlaying(false);
    setPlan(null);
    setError("");
    setStep(-1);
    setPlayhead(0);
    applyCrossfade(0);
    setFilm("idle");
    setExploding(false);
  }, [stop, applyCrossfade]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (filmRef.current !== "live") return;
        togglePlay();
      } else if (e.key.toLowerCase() === "m") {
        applyCrossfade(crossfadeRef.current >= 0.5 ? 0 : 1);
      } else if (e.key.toLowerCase() === "r") {
        applyCrossfade(crossfadeRef.current <= -0.5 ? 0 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, applyCrossfade]);

  useEffect(
    () => () => {
      performerRef.current?.stop();
      if (explodeRef.current) window.clearTimeout(explodeRef.current);
    },
    []
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!plan || playing || reduceMotion || film === "idle") return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (t: number) => {
      setClock((t - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [plan, playing, reduceMotion, film]);

  const currentBar = step >= 0 ? Math.floor(step / STEPS_PER_BAR) : -1;
  const mixer = useMemo(
    () => (plan ? mixerFromLanguages(plan.analysis.languages) : null),
    [plan]
  );
  const { rhythm: rhythmBoost, melody: melodyBoost } = boostsFromCrossfade(crossfade);
  const bpm = plan?.spec.bpm ?? 120;
  const beatSec = 60 / bpm;
  const playingPulse = Math.pow(1 - (playhead % beatSec) / beatSec, 3);
  const idleBeatSec = 60 / 96;
  const idlePulse = Math.pow(1 - (clock % idleBeatSec) / idleBeatSec, 3) * 0.4;
  const pulse = reduceMotion ? 0 : playing ? playingPulse : idlePulse;
  const rotation = playing ? (playhead * bpm / 60) * 240 : reduceMotion ? 0 : clock * 12;

  const mixerOn = !!plan && (film === "lock" || film === "live");
  const homeOn = film === "idle";
  const gateMode = film === "scan" ? "scan" : film === "lock" ? "lock" : "off";
  const liveKey =
    currentBar >= 0
      ? currentBar % 2 === 0
        ? `break:${["issuePressure", "churn", "treeDepth", "testGap"][currentBar]}`
        : "mood"
      : null;

  return (
    <main className={`app film-${film}`}>
      <StatusBar
        plan={mixerOn ? plan : null}
        scanning={film === "scan"}
        onReset={plan ? reset : undefined}
      />
      {film === "live" && plan ? <PhysicsStrip plan={plan} /> : null}

      <div className="frame">
        {plan && mixerOn && mixer ? (
          <section className={`stage${film === "live" ? " is-lit" : " is-dim"}`}>
            <AnalysisPanel plan={plan} liveKey={liveKey} />
            <div className="stage-center">
              <DJConsole
                plan={plan}
                mixer={mixer}
                playing={playing}
                currentBar={currentBar}
                playhead={playhead}
                duration={loopSeconds}
                pulse={pulse}
                rotation={rotation}
                crossfade={crossfade}
                onCrossfade={applyCrossfade}
                onPlay={togglePlay}
                onStop={() => {
                  stop();
                  setPlaying(false);
                }}
                onRestart={() => void play()}
                rhythmBoost={rhythmBoost}
                melodyBoost={melodyBoost}
                reduceMotion={reduceMotion}
                emphasis={emphasis}
              />
            </div>
            <LanguageMixer mixer={mixer} languages={plan.analysis.languages} pulse={pulse} />
          </section>
        ) : null}

        <section className={`home-layer${homeOn ? " is-on" : " is-off"}`} aria-hidden={!homeOn}>
          <h1 className="hero">
            YOUR CODEBASE,
            <br />
            BUT IT SLAPS.<SlapMark exploding={exploding} />
          </h1>
          <p className="lede">
            Paste a public GitHub repo. Messiness sets the tempo.
            <br />
            Languages pick the instruments. No voice, no lyrics.
          </p>
          {error ? <ErrorBanner message={error} /> : null}
          <TerminalInput
            value={input}
            onChange={setInput}
            onSubmit={submit}
            disabled={loading || exploding}
          />
        </section>

        <FilmGate
          mode={gateMode}
          scanComplete={!loading && !!plan}
          lockLine={plan ? `${plan.analysis.owner} / ${plan.analysis.repo}` : undefined}
        />
      </div>
    </main>
  );
}
