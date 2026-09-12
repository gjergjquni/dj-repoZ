import { buildRhymeGroups } from "./score";
import { WriterOutputSchema, type Bar, type JokeTank, type RepoPhysics } from "./types";

const FORBIDDEN =
  /\b(yo|lit|fire|sick|vibe|drop the beat|ladies and gentlemen|check it|ai|rap god|let'?s go)\b/i;

const HYPE_SYSTEM = `You are HYPE, counsel for the repository in a 20-second blame battle.
You only speak using evidence in the JSON. You sound like a deadpan README: proud, short, slightly corporate, never a rapper.
Write exactly 4 bars (barIndex 0,2,4,6). Each bar MUST contain a verbatim quote from readmeLines or description.
No slang. No metaphors you invented. If the README is empty, quote the repo name and description only.
Return JSON { bars: { barIndex, text, quote }[] }`;

const DISS_SYSTEM = `You are DISS, counsel for git history in a 20-second blame battle.
You only speak using evidence in the JSON. You sound like \`git log --oneline\` read aloud: flat, cruel, funny because it is true.
Write exactly 4 bars (barIndex 1,3,5,7). Prefer commit messages that share a rhymeKey. Quote them verbatim inside the bar.
Never invent bugs that are not in the JSON. Never say yo/lit/fire.
If commits are boring, use ugly filenames and todos as the knife.
Return JSON { bars: { barIndex, text, quote, sha? }[] }`;

const GLUE_NOTE = `Glue words allowed besides the evidence: I, I'm, you, your, said, then, but, still, named, shipped, called. Each bar is at most 90 characters. Bars must each contain at least one verbatim substring from the evidence JSON.`;

type ChatMessage = { role: "system" | "user"; content: string };

async function chatOnce(
  url: string,
  key: string,
  model: string,
  messages: ChatMessage[],
  timeoutMs: number
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  } finally {
    clearTimeout(timer);
  }
}

async function chatJSON(messages: ChatMessage[], timeoutMs = 8000): Promise<unknown> {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!groqKey && !openaiKey) throw new Error("no LLM key");

  const url = groqKey
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const key = groqKey ?? openaiKey!;
  // llama-3.3-70b-versatile was retired; gpt-oss is Groq's current fast chat family.
  // On 429 (free-tier token limit) retry once on the smaller model.
  const models = groqKey
    ? [process.env.GROQ_MODEL ?? "openai/gpt-oss-120b", "openai/gpt-oss-20b"]
    : ["gpt-4o-mini"];

  let lastError: Error = new Error("no LLM attempt");
  for (const model of models) {
    try {
      return await chatOnce(url, key, model, messages, timeoutMs);
    } catch (e) {
      lastError = e as Error;
      if (!lastError.message.includes("429")) break;
    }
  }
  throw lastError;
}

/** All tank strings a quote may verbatim-match against. */
export function tankStrings(tank: JokeTank): string[] {
  return [
    tank.description,
    tank.repo,
    tank.owner + "/" + tank.repo,
    ...tank.readmeLines,
    ...tank.commits.map((c) => c.message),
    ...tank.files,
    ...tank.todos,
  ].filter((s) => s.length > 0);
}

export function isVerbatim(quote: string, tank: JokeTank): boolean {
  if (quote.trim().length < 3) return false;
  return tankStrings(tank).some((s) => s.includes(quote.trim()));
}

function sourceIdsFor(quote: string, tank: JokeTank): string[] {
  const ids: string[] = [];
  const q = quote.trim();
  tank.commits.forEach((c) => {
    if (c.message.includes(q)) ids.push(`commit:${c.sha}`);
  });
  tank.readmeLines.forEach((l, i) => {
    if (l.includes(q)) ids.push(`readme:${i}`);
  });
  tank.files.forEach((f) => {
    if (f.includes(q)) ids.push(`file:${f}`);
  });
  tank.todos.forEach((t, i) => {
    if (t.includes(q)) ids.push(`todo:${i}`);
  });
  if (ids.length === 0 && (tank.description.includes(q) || tank.repo.includes(q))) {
    ids.push("meta");
  }
  return ids;
}

/**
 * Run one writer. Returns only bars that pass every constraint;
 * missing/invalid bars are the caller's problem (filled by Markov).
 */
async function runWriter(
  system: string,
  tank: JokeTank,
  physics: RepoPhysics,
  side: "hype" | "diss",
  wantedIndexes: number[]
): Promise<Bar[]> {
  const rhymeGroups = Object.fromEntries(
    Object.entries(buildRhymeGroups(tank.commits)).map(([k, v]) => [
      k,
      v.map((c) => ({ sha: c.sha, message: c.message })),
    ])
  );
  // Trimmed evidence: keeps the free-tier token bill low without losing material
  const user = JSON.stringify({
    tank: {
      owner: tank.owner,
      repo: tank.repo,
      description: tank.description,
      readmeLines: tank.readmeLines,
      commits: tank.commits.map((c) => ({ sha: c.sha, message: c.message })),
      files: tank.files.slice(0, 12),
      todos: tank.todos,
    },
    physics: {
      bpm: Math.round(physics.bpm),
      chaos: Number(physics.chaos.toFixed(3)),
      hypocrisy: Number(physics.hypocrisy.toFixed(3)),
      nightOwl: Number(physics.nightOwl.toFixed(3)),
    },
    rhymeGroups,
    wantedBarIndexes: wantedIndexes,
  });
  const raw = await chatJSON([
    { role: "system", content: system + "\n" + GLUE_NOTE },
    { role: "user", content: user },
  ]);
  const parsed = WriterOutputSchema.parse(raw);

  const bars: Bar[] = [];
  for (const b of parsed.bars) {
    if (!wantedIndexes.includes(b.barIndex)) continue;
    if (b.text.length > 90) continue;
    if (FORBIDDEN.test(b.text)) continue;
    if (!isVerbatim(b.quote, tank)) continue;
    if (!b.text.includes(b.quote.trim())) continue;
    bars.push({
      barIndex: b.barIndex,
      side,
      text: b.text,
      quote: b.quote.trim(),
      sha: b.sha,
      sourceIds: sourceIdsFor(b.quote, tank),
    });
  }
  return bars;
}

export async function llmBars(
  tank: JokeTank,
  physics: RepoPhysics,
  sides: ("hype" | "diss")[]
): Promise<Bar[]> {
  const hypeIndexes = sides.flatMap((s, i) => (s === "hype" ? [i] : []));
  const dissIndexes = sides.flatMap((s, i) => (s === "diss" ? [i] : []));
  // allSettled: if one writer is rate-limited, keep the other's bars
  const results = await Promise.allSettled([
    runWriter(HYPE_SYSTEM, tank, physics, "hype", hypeIndexes),
    runWriter(DISS_SYSTEM, tank, physics, "diss", dissIndexes),
  ]);
  const bars = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (bars.length === 0) {
    const firstError = results.find((r) => r.status === "rejected") as
      | PromiseRejectedResult
      | undefined;
    throw new Error(firstError?.reason?.message ?? "no LLM bars");
  }
  return bars;
}
