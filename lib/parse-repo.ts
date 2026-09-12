export function parseRepoInput(raw: string): { owner: string; repo: string } | null {
  const t = raw.trim();
  const m =
    t.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/) ??
    t.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}
