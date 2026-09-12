"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Performer } from "@/lib/performer";
import { BAR_SECONDS, TOTAL_SECONDS } from "@/lib/score";
import type { Bar, BattlePlan } from "@/lib/types";

function parseRepoInput(raw: string): { owner: string; repo: string } | null {
  const t = raw.trim();
  const m =
    t.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/) ??
    t.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

/** Render bar text with the verbatim quote highlighted. */
function BarText({ bar }: { bar: Bar }) {
  const i = bar.text.indexOf(bar.quote);
  if (i < 0 || bar.quote.length === 0) return <>{bar.text}</>;
  return (
    <>
      {bar.text.slice(0, i)}
      <span className="q">{bar.quote}</span>
      {bar.text.slice(i + bar.quote.length)}
    </>
  );
}

const FIXTURES = [
  { id: "student-mess", label: "student repo" },
  { id: "linux-ish", label: "linux-ish" },
  { id: "react-ish", label: "react-ish" },
];

export default function Home() {
  const [input, setInput] = useState("");
  const [plan, setPlan] = useState<BattlePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentBar, setCurrentBar] = useState(-1);
  const [firedBars, setFiredBars] = useState<Set<number>>(new Set());
  const [playhead, setPlayhead] = useState(0);
  const [showSources, setShowSources] = useState(false);
  const [emphasis, setEmphasis] = useState<"none" | "hype" | "diss">("none");
  const performerRef = useRef<Performer | null>(null);

  const load = useCallback(async (qs: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/battle?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPlan(data as BattlePlan);
      setCurrentBar(-1);
      setFiredBars(new Set());
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
      load(`owner=${encodeURIComponent(parsed.owner)}&repo=${encodeURIComponent(parsed.repo)}`);
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
    setCurrentBar(-1);
    setFiredBars(new Set());
    const p = new Performer(plan, {
      onBar: (i) => {
        setCurrentBar(i);
        setFiredBars((prev) => new Set(prev).add(i));
      },
      onTick: setPlayhead,
      onEnd: () => {
        setPlaying(false);
        setCurrentBar(-1);
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

  // keyboard: space play/stop, D diss emphasis, H hype emphasis
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key.toLowerCase() === "d") {
        setEmphasis((cur) => {
          const next = cur === "diss" ? "none" : "diss";
          performerRef.current?.setSideVolume("diss", next === "diss" ? 1 : 0.9);
          performerRef.current?.setSideVolume("hype", next === "diss" ? 0.35 : 0.9);
          return next;
        });
      } else if (e.key.toLowerCase() === "h") {
        setEmphasis((cur) => {
          const next = cur === "hype" ? "none" : "hype";
          performerRef.current?.setSideVolume("hype", next === "hype" ? 1 : 0.9);
          performerRef.current?.setSideVolume("diss", next === "hype" ? 0.35 : 0.9);
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  useEffect(() => () => performerRef.current?.stop(), []);

  const liveBar = plan?.bars.find((b) => b.barIndex === currentBar);
  const liveSourceIds = new Set(liveBar?.sourceIds ?? []);
  const kickOn = playing && (playhead % BAR_SECONDS) < 0.2;

  return (
    <main>
      <header className="topbar">
        <span className="brand">
          blame<span className="box">box</span>
        </span>
        <span className="subtitle">git log, but it fights you</span>
        {plan && (
          <>
            <span className="breadcrumb">
              {plan.tank.owner} / <b>{plan.tank.repo}</b>
            </span>
            <span className="stars">★ {plan.tank.stars.toLocaleString()}</span>
            <span className={`badge ${plan.assembler}`}>
              assembler: {plan.assembler}
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
            {playing ? "Stop blame" : "Play blame"}
          </button>
        )}
      </header>

      {!plan && (
        <section className="empty">
          <div className="terminal">
            <div className="tbar">blamebox — 80×24</div>
            <div className="tbody">
              <div>
                <span className="prompt">$</span>{" "}
                <span className="cmd">blamebox clone &lt;url&gt;</span>
              </div>
              <div className="out">
                two agents. twenty seconds. only strings that already exist in
                your repo.
              </div>
              <div className="out">
                HYPE quotes the README. DISS quotes your commits. the beat is
                computed, not composed.
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
              {loading ? "cloning…" : "blame"}
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
              <span className="k">seed</span>
              <span className="v beat">
                {plan.physics.seed.toString(16).padStart(8, "0")}
              </span>
            </div>
            <div className="cell">
              <span className="k">bpm</span>
              <span className="v">{plan.physics.bpm.toFixed(1)}</span>
            </div>
            <div className="cell">
              <span className="k">chaos</span>
              <span className="v">{plan.physics.chaos.toFixed(3)}</span>
            </div>
            <div className="cell">
              <span className="k">hypocrisy</span>
              <span className="v">{plan.physics.hypocrisy.toFixed(3)}</span>
            </div>
            <div className="cell">
              <span className="k">night owl</span>
              <span className="v">
                {(plan.physics.nightOwl * 100).toFixed(0)}%
              </span>
            </div>
            <div className="cell">
              <span className="k">emphasis</span>
              <span className="v">{emphasis}</span>
            </div>
          </div>

          <div className="stage">
            {/* left: blame rail */}
            <aside className="rail">
              <div className="panel-title">blame — evidence</div>
              <div className="rail-section">readme hunks</div>
              {plan.tank.readmeLines.map((line, i) => (
                <div
                  key={`r${i}`}
                  className={`blame-row readme-row ${
                    liveSourceIds.has(`readme:${i}`) ? "firing" : ""
                  }`}
                >
                  <span className="sha">READ</span>
                  <span className="msg">{line}</span>
                </div>
              ))}
              <div className="rail-section">commit hunks</div>
              {plan.tank.commits.map((c) => (
                <div
                  key={c.sha}
                  className={`blame-row ${
                    liveSourceIds.has(`commit:${c.sha}`) ||
                    liveBar?.sha === c.sha
                      ? "firing"
                      : ""
                  }`}
                >
                  <span className="sha">{c.sha.slice(0, 7)}</span>
                  <span className="msg">{c.message}</span>
                  <span className="who">{c.author}</span>
                </div>
              ))}
              {plan.tank.files.length > 0 && (
                <>
                  <div className="rail-section">files</div>
                  {plan.tank.files.slice(0, 8).map((f) => (
                    <div
                      key={f}
                      className={`blame-row ${
                        liveSourceIds.has(`file:${f}`) ? "firing" : ""
                      }`}
                    >
                      <span className="sha">FILE</span>
                      <span className="msg">{f}</span>
                    </div>
                  ))}
                </>
              )}
            </aside>

            {/* center: transport + battle */}
            <section className="center">
              <div className="transport">
                <div className="ruler">
                  {plan.bars.map((b) => (
                    <div
                      key={b.barIndex}
                      className={`barcell ${b.side}-bar ${
                        currentBar === b.barIndex ? "active" : ""
                      }`}
                    >
                      {b.barIndex + 1}·{b.side}
                    </div>
                  ))}
                  {playing && (
                    <div
                      className="playhead"
                      style={{ left: `${(playhead / TOTAL_SECONDS) * 100}%` }}
                    />
                  )}
                </div>
                <div className="transport-meta">
                  <span>
                    <span className={`kick-lamp ${kickOn ? "on" : ""}`} />
                    kick
                  </span>
                  <span>{plan.physics.bpm.toFixed(1)} bpm</span>
                  <span>
                    {playing ? playhead.toFixed(1) : "0.0"}s / {TOTAL_SECONDS}s
                  </span>
                  <span>
                    <kbd>space</kbd> play · <kbd>H</kbd> hype · <kbd>D</kbd>{" "}
                    diss
                  </span>
                </div>
              </div>

              <div className="battle">
                <div className="col hype-col">
                  <div className="col-head">HYPE — counsel for the readme</div>
                  {plan.bars
                    .filter((b) => b.side === "hype")
                    .map((b) => (
                      <div
                        key={b.barIndex}
                        className={`bar-card ${
                          currentBar === b.barIndex ? "live" : ""
                        } ${firedBars.has(b.barIndex) ? "fired" : ""}`}
                      >
                        <div className="meta">
                          <span>bar {b.barIndex + 1}</span>
                          <span>
                            t={(b.barIndex * BAR_SECONDS).toFixed(1)}s
                          </span>
                        </div>
                        <div className="body">
                          <BarText bar={b} />
                        </div>
                        {showSources && (
                          <div className="sources">
                            src: {b.sourceIds?.join(", ") ?? "—"}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
                <div className="col diss-col">
                  <div className="col-head">DISS — counsel for git history</div>
                  {plan.bars
                    .filter((b) => b.side === "diss")
                    .map((b) => (
                      <div
                        key={b.barIndex}
                        className={`bar-card ${
                          currentBar === b.barIndex ? "live" : ""
                        } ${firedBars.has(b.barIndex) ? "fired" : ""}`}
                      >
                        <div className="meta">
                          <span>bar {b.barIndex + 1}</span>
                          {b.sha && <span>{b.sha.slice(0, 7)}</span>}
                          <span>
                            t={(b.barIndex * BAR_SECONDS).toFixed(1)}s
                          </span>
                        </div>
                        <div className="body">
                          <BarText bar={b} />
                        </div>
                        {showSources && (
                          <div className="sources">
                            src: {b.sourceIds?.join(", ") ?? "—"}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              <label className="debug-row">
                <input
                  type="checkbox"
                  checked={showSources}
                  onChange={(e) => setShowSources(e.target.checked)}
                />
                show sources
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
                  new battle
                </button>
              </label>
            </section>

            {/* right: mixer */}
            <aside className="mixer">
              <div className="panel-title">mixer — language faders</div>
              {Object.entries(plan.physics.mixer).map(([ch, gain]) => (
                <div className="fader-row" key={ch}>
                  <div className="lang">
                    <span>{ch}</span>
                    <span className="val">{(gain as number).toFixed(2)}</span>
                  </div>
                  <div className="fader-track">
                    <div
                      className="fader-fill"
                      style={{ width: `${Math.min(gain as number, 1) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="hint">
                js/ts → kick+hats
                <br />
                python → bass
                <br />
                rust/go/c → lead
                <br />
                other → pad
                <br />
                <br />
                gains are byte shares from the languages API. the producer is
                never an LLM.
              </div>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
