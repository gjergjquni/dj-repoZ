import { describe, expect, it } from "vitest";
import {
  barSides,
  buildRhymeGroups,
  clamp,
  computeBPM,
  computeChaos,
  computeHypocrisy,
  computeMixer,
  computeNightOwl,
  computeSeed,
  rhymeKey,
} from "./score";
import type { Commit } from "./types";

function commit(message: string, date: string): Commit {
  return { sha: "abc1234", message, date, author: "dev" };
}

describe("seed", () => {
  it("is deterministic for same repo + pushedAt", () => {
    const a = computeSeed("torvalds", "linux", "2026-01-01T00:00:00Z");
    const b = computeSeed("torvalds", "linux", "2026-01-01T00:00:00Z");
    expect(a).toBe(b);
  });
  it("changes when pushedAt changes", () => {
    const a = computeSeed("torvalds", "linux", "2026-01-01T00:00:00Z");
    const b = computeSeed("torvalds", "linux", "2026-01-02T00:00:00Z");
    expect(a).not.toBe(b);
  });
});

describe("BPM", () => {
  it("clamps to [78, 168]", () => {
    // no commits → delta 24 → 70 + 180/24.5 ≈ 77.35 → clamped to 78
    expect(computeBPM([])).toBe(78);
    // commits seconds apart → delta ~0 → 70 + 360 → clamped to 168
    const fast = [
      commit("a", "2026-01-01T00:00:00Z"),
      commit("b", "2026-01-01T00:00:10Z"),
      commit("c", "2026-01-01T00:00:20Z"),
    ];
    expect(computeBPM(fast)).toBe(168);
  });
  it("computes mid-range BPM from median gap", () => {
    // gaps of exactly 1 hour → 70 + 180/1.5 = 190 → clamp 168
    const hourly = [
      commit("a", "2026-01-01T00:00:00Z"),
      commit("b", "2026-01-01T01:00:00Z"),
    ];
    expect(computeBPM(hourly)).toBe(168);
    // gap of 12 hours → 70 + 180/12.5 = 84.4
    const slow = [
      commit("a", "2026-01-01T00:00:00Z"),
      commit("b", "2026-01-01T12:00:00Z"),
    ];
    expect(computeBPM(slow)).toBeCloseTo(84.4, 5);
  });
  it("clamp helper works", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe("entropy (chaos)", () => {
  it("is 0 for empty input", () => {
    expect(computeChaos([])).toBe(0);
  });
  it("is 0 for a single repeated token", () => {
    // one unique token: H = 0, norm = log2(2) = 1 → 0
    expect(computeChaos(["fix fix fix fix"])).toBe(0);
  });
  it("matches known value for uniform two-token string", () => {
    // tokens: fix, bug each p=0.5 → H = 1 bit; norm = log2(3) ≈ 1.585
    const c = computeChaos(["fix bug"]);
    expect(c).toBeCloseTo(1 / Math.log2(3), 5);
  });
  it("is higher for messier messages", () => {
    const boring = computeChaos(["update", "update", "update", "update"]);
    const messy = computeChaos(["wip asdf", "final FINAL v2", "revert oops", "why broken"]);
    expect(messy).toBeGreaterThan(boring);
  });
});

describe("hypocrisy (Jaccard)", () => {
  it("is 0 when README and commits use identical words", () => {
    const commits = [commit("blazing fast parser", "2026-01-01T00:00:00Z")];
    expect(computeHypocrisy(["blazing fast parser"], commits)).toBe(0);
  });
  it("is 1 when sets are disjoint", () => {
    const commits = [commit("oops revert broken", "2026-01-01T00:00:00Z")];
    expect(computeHypocrisy(["enterprise grade solution"], commits)).toBe(1);
  });
  it("known partial overlap", () => {
    // readme: {fast, parser}, commits: {fast, hack} → inter 1, union 3 → 1 - 1/3
    const commits = [commit("fast hack", "2026-01-01T00:00:00Z")];
    expect(computeHypocrisy(["fast parser"], commits)).toBeCloseTo(2 / 3, 5);
  });
});

describe("night owl", () => {
  it("counts UTC hours 0-5", () => {
    const commits = [
      commit("a", "2026-01-01T03:00:00Z"),
      commit("b", "2026-01-01T14:00:00Z"),
    ];
    expect(computeNightOwl(commits)).toBe(0.5);
  });
});

describe("rhyme groups", () => {
  it("uses last 2 letters for short last word, 3 for length>=5", () => {
    expect(rhymeKey("fix the bug")).toBe("ug");
    expect(rhymeKey("update the parser")).toBe("ser");
    expect(rhymeKey("123 456")).toBe(null);
  });
  it("buckets commits by shared key", () => {
    const groups = buildRhymeGroups([
      commit("fix bug", "2026-01-01T00:00:00Z"),
      commit("kill the rug", "2026-01-01T01:00:00Z"),
    ]);
    expect(groups["ug"]).toHaveLength(2);
  });
});

describe("mixer", () => {
  it("maps languages to channels with 0.04 floor", () => {
    const m = computeMixer({ TypeScript: 900, Python: 100 });
    expect(m.kick).toBeCloseTo(0.9, 5);
    expect(m.hats).toBeCloseTo(0.9, 5);
    expect(m.bass).toBeCloseTo(0.1, 5);
    expect(m.lead).toBe(0.04);
    expect(m.pad).toBe(0.04);
  });
  it("all floors when no languages", () => {
    const m = computeMixer({});
    expect(m).toEqual({ kick: 0.04, hats: 0.04, bass: 0.04, lead: 0.04, pad: 0.04 });
  });
});

describe("bar sides", () => {
  it("alternates by default", () => {
    expect(barSides(0.4)).toEqual([
      "hype", "diss", "hype", "diss", "hype", "diss", "hype", "diss",
    ]);
  });
  it("pile-on ending when H > 0.55", () => {
    const s = barSides(0.7);
    expect(s[6]).toBe("diss");
    expect(s[7]).toBe("diss");
  });
  it("uneasy truce when H < 0.25", () => {
    expect(barSides(0.1)[7]).toBe("hype");
  });
});
