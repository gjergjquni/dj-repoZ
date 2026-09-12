# blamebox — git log, but it fights you

Paste a public GitHub repo; two constrained agents fight a 20-second blame battle using only strings that already exist in that repo, over a beat computed from its commit history.

- Run: `npm install && npm run dev` → http://localhost:3000
- Test: `npm test` (math layer: BPM clamp, entropy, Jaccard hypocrisy)
- Env (`.env.local`, all optional): `GITHUB_TOKEN=`, `GROQ_API_KEY=` (or `OPENAI_API_KEY=`)
- No keys? The Markov assembler writes the bars and `?demo=1` uses bundled fixtures.
