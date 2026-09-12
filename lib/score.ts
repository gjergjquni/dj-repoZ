import { hash32 } from "./hash";
import type { Commit, JokeTank, Mixer, RepoPhysics } from "./types";

export const TOTAL_SECONDS = 20;
export const TOTAL_BARS = 8;
export const BAR_SECONDS = TOTAL_SECONDS / TOTAL_BARS;

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** seed = hash32(owner + "/" + repo + pushedAt) */
export function computeSeed(owner: string, repo: string, pushedAt: string): number {
  return hash32(owner + "/" + repo + pushedAt);
}

/** Median hours between consecutive commits. n<2 → 24. */
export function medianCommitGapHours(commits: Commit[]): number {
  if (commits.length < 2) return 24;
  const times = commits
    .map((c) => new Date(c.date).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (times.length < 2) return 24;
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    gaps.push((times[i] - times[i - 1]) / 3_600_000);
  }
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 === 1 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
}

/** BPM = clamp(70 + 180/(delta + 0.5), 78, 168) */
export function computeBPM(commits: Commit[]): number {
  const delta = medianCommitGapHours(commits);
  return clamp(70 + 180 / (delta + 0.5), 78, 168);
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

/** Shannon entropy of unigrams normalized by log2(|V|+1). */
export function computeChaos(commitMessages: string[]): number {
  const tokens = commitMessages.flatMap(tokenize);
  if (tokens.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  const n = tokens.length;
  let H = 0;
  for (const c of counts.values()) {
    const p = c / n;
    H -= p * Math.log2(p);
  }
  const norm = Math.log2(counts.size + 1);
  return norm > 0 ? clamp(H / norm, 0, 1) : 0;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are",
  "was", "were", "be", "been", "it", "its", "this", "that", "with", "as",
  "at", "by", "from", "we", "you", "i", "not", "no", "but", "if", "so",
  "do", "does", "did", "have", "has", "had", "will", "can", "should",
]);

export function contentWords(text: string): Set<string> {
  return new Set(tokenize(text).filter((t) => !STOPWORDS.has(t) && t.length > 1));
}

/** Hypocrisy H = Jaccard distance between README words and commit-message words. */
export function computeHypocrisy(readmeLines: string[], commits: Commit[]): number {
  const a = contentWords(readmeLines.join(" "));
  const b = contentWords(commits.map((c) => c.message).join(" "));
  if (a.size === 0 && b.size === 0) return 0.5;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  if (union === 0) return 0.5;
  return clamp(1 - inter / union, 0, 1);
}

/** Fraction of commits with UTC hour in {0..5}. */
export function computeNightOwl(commits: Commit[]): number {
  if (commits.length === 0) return 0;
  let night = 0;
  for (const c of commits) {
    const d = new Date(c.date);
    if (!Number.isFinite(d.getTime())) continue;
    const h = d.getUTCHours();
    if (h >= 0 && h <= 5) night++;
  }
  return night / commits.length;
}

/** rhymeKey = last 2 letters of last alphabetic word, last 3 if word length >= 5. */
export function rhymeKey(message: string): string | null {
  const words = message.toLowerCase().match(/[a-z]+/g);
  if (!words || words.length === 0) return null;
  const last = words[words.length - 1];
  if (last.length >= 5) return last.slice(-3);
  if (last.length >= 2) return last.slice(-2);
  return last;
}

export function buildRhymeGroups(commits: Commit[]): Record<string, Commit[]> {
  const groups: Record<string, Commit[]> = {};
  for (const c of commits) {
    const key = rhymeKey(c.message);
    if (!key) continue;
    (groups[key] ??= []).push(c);
  }
  return groups;
}

const LANG_CHANNEL: Record<string, keyof Mixer> = {
  javascript: "kick",
  typescript: "kick",
  python: "bass",
  rust: "lead",
  go: "lead",
  c: "lead",
  "c++": "lead",
};

/** Language byte shares → mixer gains. Silent channels floor at 0.04. */
export function computeMixer(languages: Record<string, number>): Mixer {
  const total = Object.values(languages).reduce((s, b) => s + b, 0);
  const mixer: Mixer = { kick: 0, hats: 0, bass: 0, lead: 0, pad: 0 };
  if (total > 0) {
    for (const [lang, bytes] of Object.entries(languages)) {
      const share = bytes / total;
      const channel = LANG_CHANNEL[lang.toLowerCase()];
      if (channel === "kick") {
        mixer.kick += share;
        mixer.hats += share; // JS/TS → kick + hats
      } else if (channel) {
        mixer[channel] += share;
      } else {
        mixer.pad += share;
      }
    }
  }
  for (const k of Object.keys(mixer) as (keyof Mixer)[]) {
    mixer[k] = clamp(Math.max(mixer[k], 0.04), 0.04, 1);
  }
  return mixer;
}

export function computePhysics(tank: JokeTank): RepoPhysics {
  const messages = tank.commits.map((c) => c.message);
  return {
    seed: computeSeed(tank.owner, tank.repo, tank.pushedAt),
    bpm: computeBPM(tank.commits),
    chaos: computeChaos(messages),
    hypocrisy: computeHypocrisy(tank.readmeLines, tank.commits),
    nightOwl: computeNightOwl(tank.commits),
    mixer: computeMixer(tank.languages),
  };
}

/**
 * Bar sides. Default alternation hype/diss.
 * H > 0.55 → bars 6,7 both diss (pile-on). H < 0.25 → bar 7 hype (uneasy truce).
 */
export function barSides(hypocrisy: number): ("hype" | "diss")[] {
  const sides: ("hype" | "diss")[] = [
    "hype", "diss", "hype", "diss", "hype", "diss", "hype", "diss",
  ];
  if (hypocrisy > 0.55) {
    sides[6] = "diss";
    sides[7] = "diss";
  } else if (hypocrisy < 0.25) {
    sides[7] = "hype";
  }
  return sides;
}
