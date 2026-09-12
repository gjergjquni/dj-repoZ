import { JokeTankSchema, type JokeTank } from "./types";

const GH = "https://api.github.com";

/** Lines/strings that look like secrets never reach the LLM or the lyrics. */
const SECRET_PATTERN =
  /(key|token|secret|password|passwd|credential|bearer|authorization)[\s:=]/i;
const HIGH_ENTROPY = /[A-Za-z0-9+/_-]{32,}/; // long opaque blobs (keys, hashes in prose)
const KNOWN_KEY_SHAPES = /\b(ghp_|gho_|github_pat_|sk-|xox[bap]-|AKIA|AIza)[A-Za-z0-9_-]{8,}/;

export function scrub(text: string): string | null {
  if (SECRET_PATTERN.test(text)) return null;
  if (KNOWN_KEY_SHAPES.test(text)) return null;
  return text.replace(HIGH_ENTROPY, "[…]").trim();
}

function scrubAll(lines: string[]): string[] {
  return lines
    .map(scrub)
    .filter((l): l is string => l !== null && l.length > 0);
}

async function gh(path: string): Promise<any> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "blamebox",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(`${GH}${path}`, { headers, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`GitHub ${res.status} on ${path}`);
  }
  return res.json();
}

function cleanReadme(markdown: string): string[] {
  return scrubAll(
    markdown
      .slice(0, 800)
      .split("\n")
      .map((l) =>
        l
          .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
          .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → text
          .replace(/&[a-z#0-9]+;/gi, " ") // html entities like &middot;
          .replace(/<[^>]+>/g, "") // inline html tags
          .replace(/https?:\/\/\S+/g, "") // bare or truncated urls
          .replace(/[#>*`_|[\]()!]/g, "")
          .replace(/\s{2,}/g, " ")
          .trim()
      )
      .filter((l) => l.length > 3 && !/^-{3,}$/.test(l))
  ).slice(0, 12);
}

const TODO_RE = /\b(todo|fixme|hack|wip|workaround|broken|temp|later)\b/i;

export async function scoutRepo(owner: string, repo: string): Promise<JokeTank> {
  const base = `/repos/${owner}/${repo}`;

  const [meta, commitsRaw, languages, readmeRaw, contentsRaw] = await Promise.all([
    gh(base),
    gh(`${base}/commits?per_page=30`).catch(() => []),
    gh(`${base}/languages`).catch(() => ({})),
    gh(`${base}/readme`).catch(() => null),
    gh(`${base}/contents`).catch(() => []),
  ]);

  const commits = (Array.isArray(commitsRaw) ? commitsRaw : [])
    .map((c: any) => ({
      sha: String(c.sha ?? "").slice(0, 7),
      message: scrub(String(c.commit?.message ?? "").split("\n")[0]) ?? "",
      date: String(c.commit?.author?.date ?? c.commit?.committer?.date ?? ""),
      author: String(c.commit?.author?.name ?? c.author?.login ?? "unknown"),
    }))
    .filter((c) => c.message.length > 0);

  const readmeLines = readmeRaw?.content
    ? cleanReadme(Buffer.from(readmeRaw.content, "base64").toString("utf8"))
    : [];

  // Ugly names preferred: sort files so messy-looking names come first.
  const ugliness = (name: string) =>
    (/copy|old|backup|final|new folder|untitled|v\d|\d{2,}|temp|-{2,}|_{2,}| /i.test(name) ? 0 : 1);
  const files = (Array.isArray(contentsRaw) ? contentsRaw : [])
    .map((f: any) => String(f.name ?? ""))
    .filter((n: string) => n.length > 0 && !/^\.env/i.test(n) && scrub(n) !== null)
    .sort((a: string, b: string) => ugliness(a) - ugliness(b))
    .slice(0, 20);

  const todos = scrubAll([
    ...commits.map((c) => c.message).filter((m) => TODO_RE.test(m)),
    ...files.filter((f: string) => TODO_RE.test(f) || /copy|backup|old|untitled/i.test(f)),
  ]).slice(0, 10);

  const tank: JokeTank = {
    owner,
    repo,
    description: scrub(String(meta.description ?? "")) ?? "",
    stars: Number(meta.stargazers_count ?? 0),
    pushedAt: String(meta.pushed_at ?? ""),
    languages: languages && typeof languages === "object" ? languages : {},
    readmeLines,
    commits,
    files,
    todos,
  };

  return JokeTankSchema.parse(tank);
}
