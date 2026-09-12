import { mulberry32 } from "./hash";
import { buildRhymeGroups, rhymeKey, tokenize } from "./score";
import type { Bar, JokeTank } from "./types";

/**
 * Order-2 Markov chain over commit + readme tokens.
 * Used when the LLM is missing, times out, or returns invalid bars.
 * Every generated bar embeds a verbatim quote from the tank, so the
 * "quote is a substring of tank data" invariant holds without an LLM.
 */

type Chain = Map<string, string[]>;

function buildChain(texts: string[]): { chain: Chain; starts: string[][] } {
  const chain: Chain = new Map();
  const starts: string[][] = [];
  for (const text of texts) {
    const tokens = tokenize(text);
    if (tokens.length >= 2) starts.push([tokens[0], tokens[1]]);
    for (let i = 0; i + 2 < tokens.length; i++) {
      const key = tokens[i] + " " + tokens[i + 1];
      const arr = chain.get(key) ?? [];
      arr.push(tokens[i + 2]);
      chain.set(key, arr);
    }
  }
  return { chain, starts };
}

function generateFragment(
  chain: Chain,
  starts: string[][],
  rand: () => number,
  maxTokens: number
): string {
  if (starts.length === 0) return "";
  const start = starts[Math.floor(rand() * starts.length)];
  const out = [...start];
  while (out.length < maxTokens) {
    const key = out[out.length - 2] + " " + out[out.length - 1];
    const nexts = chain.get(key);
    if (!nexts || nexts.length === 0) break;
    out.push(nexts[Math.floor(rand() * nexts.length)]);
  }
  return out.join(" ");
}

/** Pick a quote that fits in the remaining character budget, verbatim. */
function fitQuote(source: string, budget: number): string {
  const s = source.trim();
  if (s.length <= budget) return s;
  // cut at a word boundary, still a verbatim substring
  const cut = s.slice(0, budget);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 10 ? cut.slice(0, lastSpace) : cut;
}

export function markovBars(
  tank: JokeTank,
  sides: ("hype" | "diss")[],
  seed: number,
  onlyIndexes?: number[]
): Bar[] {
  const rand = mulberry32(seed ^ 0x5eed);

  const hypeSources = [
    ...tank.readmeLines,
    ...(tank.description ? [tank.description] : []),
    tank.repo,
  ].filter((s) => s.length > 0);

  const dissSources = [
    ...tank.commits.map((c) => c.message),
    ...tank.todos,
    ...tank.files,
  ].filter((s) => s.length > 0);

  const hypeChain = buildChain([...tank.readmeLines, tank.description]);
  const dissChain = buildChain([
    ...tank.commits.map((c) => c.message),
    ...tank.todos,
  ]);

  // Diss prefers rhyme-paired commits in adjacent bars.
  const groups = buildRhymeGroups(tank.commits);
  const pairedKeys = Object.keys(groups).filter((k) => groups[k].length >= 2);
  const rhymedDiss: string[] = [];
  for (const k of pairedKeys) {
    rhymedDiss.push(groups[k][0].message, groups[k][1].message);
  }

  const bars: Bar[] = [];
  let hypeIdx = 0;
  let dissIdx = 0;

  for (let barIndex = 0; barIndex < 8; barIndex++) {
    if (onlyIndexes && !onlyIndexes.includes(barIndex)) continue;
    const side = sides[barIndex];
    const isHype = side === "hype";
    const sources = isHype ? hypeSources : dissSources;
    const { chain, starts } = isHype ? hypeChain : dissChain;

    let source: string;
    if (!isHype && dissIdx < rhymedDiss.length) {
      source = rhymedDiss[dissIdx++];
    } else if (isHype) {
      source = sources[hypeIdx++ % Math.max(sources.length, 1)] ?? tank.repo;
    } else {
      source = sources[dissIdx++ % Math.max(sources.length, 1)] ?? tank.repo;
    }

    const glue = isHype ? "still shipped" : "then you said";
    let fragment = generateFragment(chain, starts, rand, 4);
    // Fragment must not eat the whole budget; quote comes first-class.
    const prefix = fragment && rand() > 0.35 ? fragment + ", " : glue + " ";
    const budget = 90 - prefix.length;
    const quote = fitQuote(source, Math.max(budget, 20));
    let text = (prefix + quote).slice(0, 90);
    if (!text.includes(quote)) text = quote.slice(0, 90);

    const commit = tank.commits.find((c) => c.message === source);
    bars.push({
      barIndex,
      side,
      text,
      quote,
      sha: commit?.sha,
      sourceIds: [
        commit
          ? `commit:${commit.sha}`
          : tank.readmeLines.includes(source)
            ? `readme:${tank.readmeLines.indexOf(source)}`
            : `tank:${source.slice(0, 20)}`,
      ],
    });
  }
  return bars;
}

export { rhymeKey };
