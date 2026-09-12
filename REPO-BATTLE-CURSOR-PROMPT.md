# Build this app from scratch (H4ck&Stack, 6 hours)

You are a senior product engineer. Build a complete, deployable web app called **BLAMEBOX**.

One sentence: paste a public GitHub repo; two constrained agents fight a 20-second rap battle using **only strings that already exist in that repo**; your code composes the beat with math; two voices perform on the kick.

This is a hackathon demo. It must look like a **GitHub blame view crossed with a tiny DAW**, not like a generic AI startup landing page.

---

## What this is NOT

Do not build: a chatbot, a “generate a song about this repo” wrapper, a Spotify clone, Suno/Udio, login, database, user accounts, purple gradients, Inter-on-white SaaS, emoji soup, “yo yo drop a sick fire track” lyrics, glassmorphism, hero sections with fake testimonials.

If the lyrics could fit any other repo, the product is wrong. Rebuild the writer until every bar is traceable to a real commit, README line, TODO, or filename.

---

## Stack

- Next.js App Router + TypeScript
- Server routes for secrets (`GITHUB_TOKEN`, `GROQ_API_KEY` or `OPENAI_API_KEY`)
- Zod for all agent I/O
- Beat: **Tone.js** (or raw Web Audio if you must) — generated, no MP3 assets
- Voice: **Web Speech API** first (`speechSynthesis`), two voices via pitch/rate/utterance. Optional later: OpenAI TTS. Do not block v1 on a paid TTS vendor.
- Deployable on Vercel. `npm run build` must pass.

Env:

```
GITHUB_TOKEN=
GROQ_API_KEY=
```

Use Groq (`llama-3.3-70b-versatile` or current fast chat model). If Groq is missing, fall back to OpenAI `gpt-4o-mini`. If both missing, **Markov assembler still works** (see below). The app must demo with fixtures even with zero AI keys.

---

## Architecture (not an API wrapper)

```
paste owner/repo
    → GET /api/battle
         1. Scout (code): GitHub REST → JokeTank
         2. Math (code): seed, BPM, entropy, hypocrisy, rhyme groups, mixer, nightOwl
         3. Two writers (LLM, hard-constrained) OR Markov fallback
         4. Return BattlePlan JSON
    → client Performer: Tone.js transport 20s + two TTS voices locked to 16th notes
    → UI: blame/DAW chrome, Hype left / Diss right, quotes highlighted as they fire
```

**Producer is never an LLM.** Music is deterministic from repo stats + a hash seed.

---

## GitHub Scout (code)

Server-only. Endpoints:

- `GET /repos/{owner}/{repo}`
- `GET /repos/{owner}/{repo}/commits?per_page=30`
- `GET /repos/{owner}/{repo}/languages`
- `GET /repos/{owner}/{repo}/readme` (decode base64 markdown, take first ~800 chars)
- `GET /repos/{owner}/{repo}/contents` (top-level names)

Never send `.env`, tokens, or high-entropy secret-looking strings to the LLM or to the lyrics. Strip anything matching key/token/secret/password patterns.

`JokeTank` Zod shape:

```ts
{
  owner: string
  repo: string
  description: string
  stars: number
  pushedAt: string
  languages: Record<string, number> // bytes
  readmeLines: string[]        // cleaned, max 12
  commits: { sha: string; message: string; date: string; author: string }[]
  files: string[]              // ugly names preferred
  todos: string[]              // from commit messages / filenames if no code search
}
```

Cache three **fixtures** in `/fixtures` (e.g. torvalds/linux snippet-shaped fake, a messy student repo, facebook/react-like) so Wi-Fi death still demos. Query `?demo=1` uses fixtures.

---

## Math (this is the “worth building” layer)

Implement in `lib/score.ts` with unit tests (`vitest` or `node:test`). These numbers drive the beat AND which lines get into the battle.

Let \(n\) = number of commits fetched.

1. **Seed**  
   `seed = hash32(owner + "/" + repo + pushedAt)` using a mulberry32 PRNG. Same repo + same push time → same drum pattern and same line picks.

2. **Commit rate → BPM**  
   Let \(\Delta\) be median hours between consecutive commit timestamps (if \(n < 2\), \(\Delta = 24\)).  
   \(\mathrm{BPM} = \mathrm{clamp}(70 + \frac{180}{\Delta + 0.5},\; 78,\; 168)\)  
   Fast messy repos = faster fight.

3. **Chaos / entropy \(C\)**  
   Tokenize commit messages (lowercase, `[a-z0-9]+`). Shannon entropy of unigrams, normalized by \(\log_2(|V|+1)\).  
   High \(C\): more offbeat hats, Diss gets the last word more often.

4. **Hypocrisy \(H\)**  
   Jaccard distance between content-word sets of README vs all commit messages (stopword-stripped).  
   \(H \in [0,1]\). High \(H\): Hype opens with README, Diss answers with commits (classic roast). Low \(H\): they trade file names / TODOs more.

5. **Night owl \(N\)**  
   Fraction of commits with UTC hour in \(\{0,1,2,3,4,5\}\).  
   High \(N\): swung 8ths, slightly slower voice rate on Diss.

6. **Rhyme groups (lyrics picker, not LLM rhymes)**  
   For each commit, `rhymeKey` = last 2 letters of the last alphabetic word (or last 3 if word length ≥ 5). Bucket messages by key. Prefer pairing two commits that share a key in adjacent Diss bars. This is how the song “rhymes” without fake rap.

7. **Mixer gains from languages**  
   \(g_\ell = \mathrm{bytes}_\ell / \sum \mathrm{bytes}\). Map:
   - JavaScript/TypeScript → kick + hats
   - Python → bass
   - Rust/Go/C → lead blip
   - other → pad noise  
   Silent channels at 0.04 so the mix always has a body.

8. **Line budget**  
   8 bars total, 20.0 seconds. Bar duration \(= 20/8\) seconds, also aligned to BPM so kicks land on bars.  
   Alternate: bar 0 Hype, 1 Diss, 2 Hype, 3 Diss, 4 Hype, 5 Diss, 6 Hype, 7 Diss.  
   If \(H > 0.55\), bars 6–7 are both Diss (pile-on ending). If \(H < 0.25\), bar 7 is Hype (uneasy truce).

Export `RepoPhysics` from these functions and show the numbers in a small “PHYSICS” strip in the UI (monospace, like GitHub Insights). That strip is how judges see it is not a wrapper.

---

## Lyric engine (not cringe)

**Rule:** the model may reorder, repeat, and add glue words from this allowlist only: `I`, `I'm`, `you`, `your`, `said`, `then`, `but`, `still`, `named`, `shipped`, `called`.  
**Forbidden:** yo, lit, fire, sick, vibe, drop the beat, ladies and gentlemen, check it, AI, rap god, let’s go.

Each bar is ≤ 90 characters. Each bar MUST include at least one **verbatim substring** from `JokeTank` (commit message, readme line, filename, or todo). Return `sourceIds` proving it.

### Hype writer system prompt (put this in code)

```
You are HYPE, counsel for the repository in a 20-second blame battle.
You only speak using evidence in the JSON. You sound like a deadpan README: proud, short, slightly corporate, never a rapper.
Write exactly 4 bars (barIndex 0,2,4,6). Each bar MUST contain a verbatim quote from readmeLines or description.
No slang. No metaphors you invented. If the README is empty, quote the repo name and description only.
Return JSON { bars: { barIndex, text, quote }[] }
```

### Diss writer system prompt (put this in code)

```
You are DISS, counsel for git history in a 20-second blame battle.
You only speak using evidence in the JSON. You sound like `git log --oneline` read aloud: flat, cruel, funny because it is true.
Write exactly 4 bars (barIndex 1,3,5,7). Prefer commit messages that share a rhymeKey. Quote them verbatim inside the bar.
Never invent bugs that are not in the JSON. Never say yo/lit/fire.
If commits are boring, use ugly filenames and todos as the knife.
Return JSON { bars: { barIndex, text, quote, sha? }[] }
```

Pass `RepoPhysics` + `rhymeGroups` + `JokeTank` into both prompts so they share evidence.

Parse with Zod. If a bar has no verbatim quote, discard and replace from the Markov assembler.

### Markov assembler (required fallback — this makes it “not a wrapper”)

Build an order-2 Markov chain on commit tokens + readme tokens. Generate 4 Diss-like fragments and 4 Hype-like fragments (Hype biased to README start tokens; Diss biased to commit start tokens). Use when LLM fails, times out (>8s), or returns invalid JSON. Show a tiny badge: `ASSEMBLER: markov` vs `ASSEMBLER: llm` in the UI.

---

## Performer (client)

- Transport: exactly 20 seconds then stop.
- Kick on each bar. Hats from entropy. Bass from Python gain, etc.
- Schedule 8 utterances: `utterance.text = bar.text`, start time = `barIndex * (20/8)`.
- Hype: higher pitch, slightly faster rate, pan left.
- Diss: lower pitch, slower if nightOwl, pan right.
- Highlight the quote in the blame list as it fires (the actual commit row glows).
- Keyboard: space play/stop, D emphasis Diss volume, H Hype volume.
- If speechSynthesis is missing, still play the beat and karaoke-scroll the bars.

---

## UI / design (special, not generic AI)

Visual thesis: **GitHub Primer dark + a hardware sampler**.

- Background: `#0d1117`. Panels: `#161b22`. Hairline: `#30363d`. Text: `#e6edf3`. Comment: `#8b949e`.
- Hype column accent: GitHub `--diff-addition` green `#3fb950`.
- Diss column accent: `--diff-deletion` red `#f85149`.
- Beat accent: `#d2a8ff` only for the playhead and note ticks (like a blame age heatmap + notes). Do not purple-wash the whole app.
- Font: **IBM Plex Mono** (or `ui-monospace`) everywhere. No Inter. No Poppins. No rounded “friendly” buttons.
- Layout: left **file/blame rail** (commits as rows, SHA prefix, message, like `git blame`). Center **transport** (20s ruler, BPM, bar grid, playhead). Right **mixer** (language faders).
- Top bar like GitHub: `owner / repo` breadcrumb, star count, a **Play blame** button that looks like a merge button, not a pill CTA.
- Battle captions overlay the blame view like review comments on a PR: Hype comments on README hunks, Diss comments on commit hunks.
- Micro-motion: playhead and kick flash only. No bounce, no confetti, no typewriter hero.
- Empty state: a fake terminal, `blamebox clone <url>` and a paste field that looks like a GitHub search box.
- Favicon: a note inside the GitHub-mark silhouette (CSS or inline SVG, original, not stolen brand assets).

Name on screen: **blamebox**. Subtitle: `git log, but it fights you`.

Mobile: transport + two columns stack. Must work on a phone for voting.

---

## Routes

- `/` — paste + stage
- `/api/battle?owner=&repo=` — POST or GET, returns BattlePlan
- `/api/battle?demo=1` — fixtures
- README.md for the hackathon: 8 lines, how to run, one sentence product, env vars.

`BattlePlan` JSON:

```ts
{
  tank: JokeTank
  physics: { seed, bpm, chaos, hypocrisy, nightOwl, mixer }
  bars: { barIndex: 0-7, side: "hype"|"diss", text: string, quote: string, sha?: string }[]
  assembler: "llm" | "markov"
}
```

---

## Acceptance tests (you must satisfy these)

1. Pasting `https://github.com/OWNER/REPO` produces a battle without a page reload crash.
2. Every bar’s `quote` is a substring of tank data. Add a debug checkbox “show sources”.
3. Same repo twice in a row → same BPM and same drum seed.
4. `?demo=1` works with APIs unplugged.
5. Play is 20s of audio + 8 bars. Looks like GitHub, not ChatGPT UI.
6. No cringe words from the forbidden list in default fixtures.
7. `lib/score.ts` tests for clamp BPM, entropy on a known string, Jaccard hypocrisy.

Build the whole thing. Start with fixtures + math + performer so there is sound in 30 minutes, then wire GitHub, then LLM. Do not polish marketing copy. Ship the blame/DAW screen first.
