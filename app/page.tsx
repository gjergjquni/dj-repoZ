"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Performer, STEPS } from "@/lib/performer";
import type { DJPlan } from "@/lib/types";

function parseRepoInput(raw: string): { owner: string; repo: string } | null {
  const t = raw.trim();
  const m =
    t.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/) ??
    t.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

const FIXTURES = [
  { id: "clean-lib", label: "clean rust lib" },
  { id: "ml-lab", label: "ml lab" },
  { id: "student-mess", label: "student repo" },
];

const BREAKDOWN_LABELS: Record<string, string> = {
  issuePressure: "open issue pressure",
  churn: "commit churn",
  treeDepth: "directory depth",
  testGap: "missing tests",
};

export default function Home() {
  const [input, setInput] = useState("");
  const [plan, setPlan] = useState<DJPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const [playhead, setPlayhead] = useState(0);
  const [loopSeconds, setLoopSeconds] = useState(1);
  const [copied, setCopied] = useState(false);
  const performerRef = useRef<Performer | null>(null);

  const load = useCallback(async (qs: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dj?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPlan(data as DJPlan);
      setStep(-1);
      setPlayhead(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const submit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const parsed = parseRepoInput(input);
      if (!parsed) {
        setError("paste owner/repo or a github.com URL");
        return;
      }
      load(
        `owner=${encodeURIComponent(parsed.owner)}&repo=${encodeURIComponent(parsed.repo)}`
      );
    },
    [input, load]
  );

  const stop = useCallback(() => {
    performerRef.current?.stop();
    performerRef.current = null;
  }, []);

  const play = useCallback(async () => {
    if (!plan) return;
    stop();
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
  }, [plan, stop]);

  const togglePlay = useCallback(() => {
    if (playing) {
      stop();
      setPlaying(false);
    } else {
      play();
    }
  }, [playing, play, stop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  useEffect(() => () => performerRef.current?.stop(), []);

  const copyPrompt = useCallback(async () => {
    if (!plan) return;
    await navigator.clipboard.writeText(plan.spec.prompt_string);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [plan]);

  const currentBar = step >= 0 ? Math.floor(step / 16) : -1;
  const kickOn = playing && step >= 0 && step % 4 === 0;

  return (
    <main>
      <header className="topbar">
        <span className="brand">
          repo<span className="box">dj</span>
        </span>
        <span className="subtitle">your codebase, but it slaps</span>
        {plan && (
          <>
            <span className="breadcrumb">
              {plan.analysis.owner} / <b>{plan.analysis.repo}</b>
            </span>
            <span className="stars">
              ★ {plan.analysis.stars.toLocaleString()}
            </span>
            <span className={`badge ${plan.spec.tier}`}>
              {plan.spec.tier} · {plan.analysis.messiness_score}/100
            </span>
          </>
        )}
        <span className="spacer" />
        {plan && (
          <button
            className={`play-btn ${playing ? "playing" : ""}`}
            onClick={togglePlay}
            disabled={loading}
          >
            {playing ? "Stop set" : "Spin repo"}
          </button>
        )}
      </header>

      {!plan && (
        <section className="empty">
          <div className="terminal">
            <div className="tbar">repodj — 80×24</div>
            <div className="tbody">
              <div>
                <span className="prompt">$</span>{" "}
                <span className="cmd">repodj spin &lt;url&gt;</span>
              </div>
              <div className="out">
                an automated AI DJ. your repo&apos;s architecture becomes a pure
                instrumental beat.
              </div>
              <div className="out">
                messiness → tempo &amp; genre. languages → instruments. project
                type → sound FX. no voice, no lyrics.
              </div>
            </div>
          </div>
          <form className="searchbox" onSubmit={submit}>
            <input
              placeholder="owner/repo or https://github.com/owner/repo"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <button className="play-btn" type="submit" disabled={loading}>
              {loading ? "analyzing…" : "analyze"}
            </button>
          </form>
          <div className="demo-links">
            no key, no Wi-Fi, no problem — fixtures:
            {FIXTURES.map((f) => (
              <button key={f.id} onClick={() => load(`demo=1&fixture=${f.id}`)}>
                {f.label}
              </button>
            ))}
          </div>
          {error && <div className="error">{error}</div>}
        </section>
      )}

      {plan && (
        <>
          <div className="physics">
            <div className="cell">
              <span className="k">messiness</span>
              <span className="v beat">{plan.analysis.messiness_score}/100</span>
            </div>
            <div className="cell">
              <span className="k">genre</span>
              <span className="v">{plan.spec.genre}</span>
            </div>
            <div className="cell">
              <span className="k">bpm</span>
              <span className="v">{plan.spec.bpm}</span>
            </div>
            <div className="cell">
              <span className="k">project type</span>
              <span className="v">{plan.analysis.project_type}</span>
            </div>
            <div className="cell">
              <span className="k">commit velocity</span>
              <span className="v">{plan.analysis.commit_velocity}/day</span>
            </div>
            <div className="cell">
              <span className="k">seed</span>
              <span className="v beat">
                {plan.analysis.seed.toString(16).padStart(8, "0")}
              </span>
            </div>
          </div>

          <div className="stage">
            {/* left: analysis rail */}
            <aside className="rail">
              <div className="panel-title">analysis — why it sounds like this</div>
              <div className="rail-section">messiness breakdown</div>
              {Object.entries(plan.analysis.breakdown).map(([k, v]) => (
                <div className="fader-row" key={k}>
                  <div className="lang">
                    <span>{BREAKDOWN_LABELS[k] ?? k}</span>
                    <span className="val">{(v * 100).toFixed(0)}%</span>
                  </div>
                  <div className="fader-track">
                    <div
                      className="fader-fill messy-fill"
                      style={{ width: `${Math.min(v, 1) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="rail-section">project signals</div>
              {plan.analysis.project_signals.length === 0 && (
                <div className="blame-row">
                  <span className="sha">TYPE</span>
                  <span className="msg">no strong signals → library</span>
                </div>
              )}
              {plan.analysis.project_signals.map((s) => (
                <div className="blame-row" key={s}>
                  <span className="sha">SIG</span>
                  <span className="msg">{s}</span>
                </div>
              ))}
              <div className="rail-section">mood</div>
              <div className="blame-row">
                <span className="sha">MOOD</span>
                <span className="msg">{plan.spec.mood}</span>
              </div>
              {plan.analysis.description && (
                <>
                  <div className="rail-section">about</div>
                  <div className="blame-row">
                    <span className="msg wrap">{plan.analysis.description}</span>
                  </div>
                </>
              )}
            </aside>

            {/* center: deck */}
            <section className="center">
              <div className="transport">
                <div className="ruler">
                  {[0, 1, 2, 3].map((bar) => (
                    <div
                      key={bar}
                      className={`barcell loop-bar ${
                        currentBar === bar ? "active" : ""
                      }`}
                    >
                      bar {bar + 1}
                    </div>
                  ))}
                  {playing && (
                    <div
                      className="playhead"
                      style={{ left: `${(playhead / loopSeconds) * 100}%` }}
                    />
                  )}
                </div>
                <div className="steps">
                  {Array.from({ length: STEPS }, (_, i) => (
                    <div
                      key={i}
                      className={`step ${i % 4 === 0 ? "beatstep" : ""} ${
                        playing && step === i ? "on" : ""
                      }`}
                    />
                  ))}
                </div>
                <div className="transport-meta">
                  <span>
                    <span className={`kick-lamp ${kickOn ? "on" : ""}`} />
                    kick
                  </span>
                  <span>{plan.spec.bpm} bpm</span>
                  <span>
                    {playing ? playhead.toFixed(1) : "0.0"}s /{" "}
                    {loopSeconds.toFixed(1)}s loop
                  </span>
                  <span>
                    <kbd>space</kbd> play / stop
                  </span>
                </div>
              </div>

              <div className="prompt-card">
                <div className="prompt-head">
                  <span>AudioPromptSpec — prompt_string</span>
                  <button className="copy-btn" onClick={copyPrompt}>
                    {copied ? "copied" : "copy"}
                  </button>
                </div>
                <div className="prompt-body">{plan.spec.prompt_string}</div>
                <div className="prompt-foot">
                  paste into any AI music generator — or press play and let the
                  built-in engine render it live. deterministic: same repo state,
                  same set.
                </div>
              </div>

              <div className="spec-grid">
                <div className="spec-card">
                  <div className="spec-title">primary_instruments</div>
                  {plan.spec.primary_instruments.map((i) => (
                    <span className="chip" key={i}>
                      {i}
                    </span>
                  ))}
                </div>
                <div className="spec-card">
                  <div className="spec-title">sfx_elements</div>
                  {plan.spec.sfx_elements.map((s) => (
                    <span className="chip sfx" key={s}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <label className="debug-row">
                <span className="spacer" />
                <button
                  className="badge"
                  style={{ cursor: "pointer", background: "none" }}
                  onClick={() => {
                    stop();
                    setPlaying(false);
                    setPlan(null);
                  }}
                >
                  new set
                </button>
              </label>
            </section>

            {/* right: language crate */}
            <aside className="mixer">
              <div className="panel-title">crate — language faders</div>
              {Object.entries(plan.analysis.languages).map(([lang, pct]) => (
                <div className="fader-row" key={lang}>
                  <div className="lang">
                    <span>{lang}</span>
                    <span className="val">{pct}%</span>
                  </div>
                  <div className="fader-track">
                    <div
                      className="fader-fill"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="hint">
                python → 808s + analog synths
                <br />
                c/c++/rust → industrial guitars
                <br />
                js/ts → synth-pop + hi-hats
                <br />
                html/css → acoustic + rhodes
                <br />
                go/elixir → electro-funk
                <br />
                asm/shell → 8-bit chiptune
                <br />
                <br />
                the producer is never an LLM. the beat is computed from repo
                physics.
              </div>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
