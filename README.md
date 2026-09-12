# repodj — your codebase, but it slaps

An automated AI DJ: paste a public GitHub repo and its architecture becomes a pure instrumental beat. No voice, no lyrics.

- Messiness score (issues, churn, tree depth, missing tests) → tempo & genre: clean = classical/lo-fi 70–95 BPM, moderate = house/synthwave 100–125 BPM, messy = breakcore/DnB 140–185 BPM.
- Language byte shares → instrument palette (Python = 808s + analog synths, Rust/C = industrial guitars, JS/TS = synth-pop, HTML/CSS = acoustic + rhodes, Go/Elixir = electro-funk, ASM/Shell = chiptune).
- Project type (`manifest.json`, `requirements.txt`, `index.html`, `cmd/`, shaders) → sound FX drops.
- Two-deck console: rhythm (drums + bass) vs melody (keys, lead, SFX). Crossfader and R/M keys mix the buses. The 4-bar loop is synthesized live in Tone.js from the repo seed.
- Output is a structured `AudioPromptSpec` with a copyable `prompt_string` for any AI music generator.
- Run: `npm install && npm run dev` → http://localhost:3000 · Test: `npm test`
- Env (`.env.local`, optional): `GITHUB_TOKEN=` (higher rate limits). No key? Fixtures on the home screen still play.
