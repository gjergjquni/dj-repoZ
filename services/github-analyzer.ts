import { hash32 } from "@/lib/hash";
import {
  RawRepoSnapshotSchema,
  RepoAnalysisSchema,
  type MessinessBreakdown,
  type ProjectType,
  type RawRepoSnapshot,
  type RepoAnalysis,
} from "@/lib/types";

const GH = "https://api.github.com";

async function gh(path: string): Promise<any> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "github-ai-dj",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(`${GH}${path}`, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path}`);
  return res.json();
}

/** Fetch a raw snapshot of the repo from the GitHub REST API (server-only). */
export async function fetchSnapshot(
  owner: string,
  repo: string
): Promise<RawRepoSnapshot> {
  const base = `/repos/${owner}/${repo}`;
  const meta = await gh(base);
  const branch = String(meta.default_branch ?? "main");

  const [languages, commitsRaw, treeRaw] = await Promise.all([
    gh(`${base}/languages`).catch(() => ({})),
    gh(`${base}/commits?per_page=100`).catch(() => []),
    gh(`${base}/git/trees/${encodeURIComponent(branch)}?recursive=1`).catch(
      () => null
    ),
  ]);

  let treePaths: string[] = Array.isArray(treeRaw?.tree)
    ? treeRaw.tree
        .filter((n: any) => n.type === "blob")
        .map((n: any) => String(n.path))
    : [];
  if (treePaths.length === 0) {
    // fallback: top-level contents only
    const contents = await gh(`${base}/contents`).catch(() => []);
    treePaths = (Array.isArray(contents) ? contents : []).map((f: any) =>
      String(f.path ?? f.name ?? "")
    );
  }

  const commitDates = (Array.isArray(commitsRaw) ? commitsRaw : [])
    .map((c: any) =>
      String(c.commit?.author?.date ?? c.commit?.committer?.date ?? "")
    )
    .filter((d: string) => d.length > 0);

  return RawRepoSnapshotSchema.parse({
    owner,
    repo,
    description: String(meta.description ?? ""),
    stars: Number(meta.stargazers_count ?? 0),
    openIssues: Number(meta.open_issues_count ?? 0),
    pushedAt: String(meta.pushed_at ?? ""),
    languages: languages && typeof languages === "object" ? languages : {},
    treePaths: treePaths.slice(0, 5000),
    commitDates,
  });
}

/** commits per day across the fetched window */
export function computeCommitVelocity(commitDates: string[]): number {
  const times = commitDates
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (times.length === 0) return 0;
  if (times.length === 1) return 1;
  const spanDays = (times[times.length - 1] - times[0]) / 86_400_000;
  return times.length / Math.max(spanDays, 1);
}

/** deepest directory nesting in the tree (a/b/c.ts → depth 3) */
export function maxTreeDepth(treePaths: string[]): number {
  let max = 0;
  for (const p of treePaths) {
    const depth = p.split("/").filter(Boolean).length;
    if (depth > max) max = depth;
  }
  return max;
}

const TEST_PATH =
  /(^|\/)(tests?|__tests__|spec|e2e|cypress)(\/|$)|\.(test|spec)\.[a-z]+$|_test\.(go|py|rb|rs|c|cpp)$/i;

/** share of files that look like tests, 0..1 */
export function testFileRatio(treePaths: string[]): number {
  if (treePaths.length === 0) return 0;
  const tests = treePaths.filter((p) => TEST_PATH.test(p)).length;
  return tests / treePaths.length;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Messiness score 0..100.
 * Weighted: open-issue pressure 25%, commit churn 30%,
 * directory depth 15%, missing tests 30%.
 */
export function computeMessiness(snapshot: RawRepoSnapshot): {
  score: number;
  breakdown: MessinessBreakdown;
} {
  const issuePressure = clamp01(
    snapshot.openIssues / (snapshot.openIssues + 30)
  );
  const velocity = computeCommitVelocity(snapshot.commitDates);
  const churn = clamp01(velocity / 6);
  const depth = maxTreeDepth(snapshot.treePaths);
  const treeDepth = clamp01((depth - 2) / 8);
  const testGap = clamp01(1 - testFileRatio(snapshot.treePaths) * 10);

  const breakdown: MessinessBreakdown = {
    issuePressure,
    churn,
    treeDepth,
    testGap,
  };
  const score = Math.round(
    100 *
      (0.25 * issuePressure + 0.3 * churn + 0.15 * treeDepth + 0.3 * testGap)
  );
  return { score: Math.min(100, Math.max(0, score)), breakdown };
}

/**
 * Classify the project from file signatures.
 * Returns the type plus the signals (filenames/keywords) that triggered it.
 */
export function detectProjectType(snapshot: RawRepoSnapshot): {
  type: ProjectType;
  signals: string[];
} {
  const paths = snapshot.treePaths.map((p) => p.toLowerCase());
  const names = new Set(paths.map((p) => p.split("/").pop() ?? p));
  const rootNames = new Set(
    paths.filter((p) => !p.includes("/")).map((p) => p)
  );
  const text = (snapshot.repo + " " + snapshot.description).toLowerCase();

  const grab = (re: RegExp, max = 3) =>
    snapshot.treePaths.filter((p) => re.test(p)).slice(0, max);

  // web extension: manifest.json at root + extension-ish hints
  if (
    rootNames.has("manifest.json") &&
    (paths.some((p) => /background|content[_-]?script|popup/.test(p)) ||
      /extension|addon|add-on/.test(text))
  ) {
    return {
      type: "web_extension",
      signals: ["manifest.json", ...grab(/background|content[_-]?script|popup/i)],
    };
  }

  // game / graphics engine
  if (
    paths.some((p) =>
      /\.(unity|tscn|godot|gd|blend|glsl|hlsl|shader)$/.test(p)
    ) ||
    /\bgame\b|game engine|graphics engine|renderer/.test(text)
  ) {
    return {
      type: "game_engine",
      signals: grab(/\.(unity|tscn|godot|gd|glsl|hlsl|shader)$/i) .length
        ? grab(/\.(unity|tscn|godot|gd|glsl|hlsl|shader)$/i)
        : ["game keyword"],
    };
  }

  // AI / machine learning
  if (
    paths.some((p) => /\.(ipynb|onnx|pt|h5|safetensors)$/.test(p)) ||
    (names.has("requirements.txt") &&
      paths.some((p) => /model|train|dataset|torch|tensorflow|sklearn/.test(p))) ||
    /machine learning|deep learning|neural|llm|\bai\b/.test(text)
  ) {
    return {
      type: "ml_project",
      signals: grab(/\.(ipynb|onnx|pt|h5|safetensors)$|requirements\.txt|model|train/i),
    };
  }

  // CLI tool / terminal utility
  if (
    paths.some((p) => /^(bin|cmd)\//.test(p)) ||
    paths.some((p) => /(^|\/)cli\.[a-z]+$|(^|\/)main\.go$/.test(p)) ||
    /\bcli\b|command[- ]line|terminal/.test(text) ||
    paths.filter((p) => p.endsWith(".sh")).length >= 3
  ) {
    return {
      type: "cli_tool",
      signals: grab(/^(bin|cmd)\/|(^|\/)cli\.[a-z]+$|\.sh$/i),
    };
  }

  // web app: index.html or package.json + app structure
  if (
    names.has("index.html") ||
    (rootNames.has("package.json") &&
      paths.some((p) => /^(src|app|pages|public)\//.test(p))) ||
    names.has("dockerfile")
  ) {
    return {
      type: "web_app",
      signals: grab(/(^|\/)index\.html$|^package\.json$|^dockerfile$/i),
    };
  }

  return { type: "library", signals: [] };
}

/** bytes → percentages (0..100), sorted descending, minor languages (<1%) dropped */
export function languagePercentages(
  languages: Record<string, number>
): Record<string, number> {
  const total = Object.values(languages).reduce((s, b) => s + b, 0);
  if (total <= 0) return {};
  const out: Record<string, number> = {};
  for (const [lang, bytes] of Object.entries(languages).sort(
    (a, b) => b[1] - a[1]
  )) {
    const pct = (bytes / total) * 100;
    if (pct >= 1) out[lang] = Math.round(pct * 10) / 10;
  }
  return out;
}

/** Pure analysis — same code path for live repos and fixtures. */
export function analyzeSnapshot(snapshot: RawRepoSnapshot): RepoAnalysis {
  const { score, breakdown } = computeMessiness(snapshot);
  const { type, signals } = detectProjectType(snapshot);
  return RepoAnalysisSchema.parse({
    owner: snapshot.owner,
    repo: snapshot.repo,
    description: snapshot.description,
    stars: snapshot.stars,
    pushedAt: snapshot.pushedAt,
    seed: hash32(snapshot.owner + "/" + snapshot.repo + snapshot.pushedAt),
    languages: languagePercentages(snapshot.languages),
    messiness_score: score,
    breakdown,
    project_type: type,
    project_signals: signals,
    commit_velocity: Math.round(computeCommitVelocity(snapshot.commitDates) * 100) / 100,
  });
}

export async function analyzeRepo(
  owner: string,
  repo: string
): Promise<RepoAnalysis> {
  return analyzeSnapshot(await fetchSnapshot(owner, repo));
}
