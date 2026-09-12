import { describe, expect, it } from "vitest";
import {
  analyzeSnapshot,
  computeCommitVelocity,
  computeMessiness,
  detectProjectType,
  languagePercentages,
  maxTreeDepth,
  testFileRatio,
} from "./github-analyzer";
import {
  bpmFor,
  instrumentsFor,
  mapToAudioSpec,
  sfxFor,
  tierFor,
} from "./dj-sound-mapper";
import type { RawRepoSnapshot } from "@/lib/types";

function snapshot(overrides: Partial<RawRepoSnapshot> = {}): RawRepoSnapshot {
  return {
    owner: "o",
    repo: "r",
    description: "",
    stars: 0,
    openIssues: 0,
    pushedAt: "2026-01-01T00:00:00Z",
    languages: { TypeScript: 100 },
    treePaths: ["src/index.ts"],
    commitDates: ["2026-01-01T00:00:00Z"],
    ...overrides,
  };
}

describe("github-analyzer", () => {
  it("commit velocity: burst of commits in one night is high churn", () => {
    const dates = Array.from(
      { length: 10 },
      (_, i) => `2026-05-19T0${Math.floor(i / 5)}:${10 + i}:00Z`
    );
    expect(computeCommitVelocity(dates)).toBeGreaterThanOrEqual(10);
  });

  it("commit velocity: spread-out commits are low churn", () => {
    const dates = ["2026-01-01T00:00:00Z", "2026-03-01T00:00:00Z"];
    expect(computeCommitVelocity(dates)).toBeLessThan(0.1);
  });

  it("tree depth counts nesting", () => {
    expect(maxTreeDepth(["a.ts", "x/y/z/deep.ts"])).toBe(4);
  });

  it("test file ratio detects tests/ dirs and .test. files", () => {
    const ratio = testFileRatio([
      "src/a.ts",
      "src/a.test.ts",
      "tests/b_test.py",
      "src/c.ts",
    ]);
    expect(ratio).toBeCloseTo(0.5);
  });

  it("clean repo scores <= 30", () => {
    const { score } = computeMessiness(
      snapshot({
        openIssues: 2,
        treePaths: ["src/lib.rs", "tests/a_test.rs", "tests/b_test.rs"],
        commitDates: ["2026-01-01T00:00:00Z", "2026-03-01T00:00:00Z"],
      })
    );
    expect(score).toBeLessThanOrEqual(30);
  });

  it("messy repo (no tests, one-night churn, deep tree) scores >= 66", () => {
    const { score } = computeMessiness(
      snapshot({
        openIssues: 4,
        treePaths: [
          "index.html",
          "New folder/stuff/old versions/backup/final.js",
        ],
        commitDates: Array.from(
          { length: 10 },
          (_, i) => `2026-05-19T02:${10 + i}:00Z`
        ),
      })
    );
    expect(score).toBeGreaterThanOrEqual(66);
  });

  it("detects web_app from index.html", () => {
    expect(
      detectProjectType(snapshot({ treePaths: ["index.html", "script.js"] }))
        .type
    ).toBe("web_app");
  });

  it("detects web_extension from manifest.json + content script", () => {
    expect(
      detectProjectType(
        snapshot({ treePaths: ["manifest.json", "src/content_script.js"] })
      ).type
    ).toBe("web_extension");
  });

  it("detects ml_project from requirements.txt + train code", () => {
    expect(
      detectProjectType(
        snapshot({ treePaths: ["requirements.txt", "src/train_model.py"] })
      ).type
    ).toBe("ml_project");
  });

  it("detects cli_tool from cmd/ layout", () => {
    expect(
      detectProjectType(snapshot({ treePaths: ["cmd/root.go", "main.go"] }))
        .type
    ).toBe("cli_tool");
  });

  it("detects game_engine from shader files", () => {
    expect(
      detectProjectType(snapshot({ treePaths: ["src/water.shader"] })).type
    ).toBe("game_engine");
  });

  it("falls back to library", () => {
    expect(
      detectProjectType(snapshot({ treePaths: ["src/lib.rs"] })).type
    ).toBe("library");
  });

  it("language percentages sum to ~100 and drop dust", () => {
    const pct = languagePercentages({ A: 900, B: 99, C: 1 });
    expect(pct.A).toBeCloseTo(90, 0);
    expect(pct.C).toBeUndefined();
  });

  it("analysis is deterministic (same seed for same snapshot)", () => {
    const s = snapshot();
    expect(analyzeSnapshot(s).seed).toBe(analyzeSnapshot(s).seed);
  });
});

describe("dj-sound-mapper", () => {
  it("tier boundaries: 30 clean, 31 moderate, 66 messy", () => {
    expect(tierFor(30).tier).toBe("clean");
    expect(tierFor(31).tier).toBe("moderate");
    expect(tierFor(65).tier).toBe("moderate");
    expect(tierFor(66).tier).toBe("messy");
  });

  it("bpm stays inside tier ranges", () => {
    expect(bpmFor(0)).toBeGreaterThanOrEqual(70);
    expect(bpmFor(30)).toBeLessThanOrEqual(95);
    expect(bpmFor(31)).toBeGreaterThanOrEqual(100);
    expect(bpmFor(65)).toBeLessThanOrEqual(125);
    expect(bpmFor(66)).toBeGreaterThanOrEqual(140);
    expect(bpmFor(100)).toBeLessThanOrEqual(185);
  });

  it("python maps to 808s and analog synths", () => {
    const inst = instrumentsFor({ Python: 100 });
    expect(inst).toContain("sub-bass 808s");
    expect(inst).toContain("analog synths");
  });

  it("rust maps to industrial guitars", () => {
    expect(instrumentsFor({ Rust: 100 })).toContain(
      "heavy industrial metal guitar"
    );
  });

  it("unknown languages still get a palette", () => {
    expect(instrumentsFor({ Brainfuck: 100 }).length).toBeGreaterThan(0);
  });

  it("sfx match project type", () => {
    expect(sfxFor("game_engine")).toContain("coin chimes");
    expect(sfxFor("cli_tool")).toContain(
      "mechanical keyboard clack percussion"
    );
  });

  it("prompt_string is instrumental-only and complete", () => {
    const analysis = analyzeSnapshot(
      snapshot({
        openIssues: 4,
        languages: { Python: 100 },
        treePaths: ["requirements.txt", "train.py"],
        commitDates: Array.from(
          { length: 10 },
          (_, i) => `2026-05-19T02:${10 + i}:00Z`
        ),
      })
    );
    const spec = mapToAudioSpec(analysis);
    expect(spec.prompt_string).toContain(`${spec.bpm} BPM`);
    expect(spec.prompt_string).toContain(spec.genre);
    expect(spec.prompt_string).toContain(
      "no voice, no lyrics, pure instrumental"
    );
    for (const i of spec.primary_instruments) {
      expect(spec.prompt_string).toContain(i);
    }
  });

  it("mapping is deterministic", () => {
    const a = analyzeSnapshot(snapshot());
    expect(mapToAudioSpec(a)).toEqual(mapToAudioSpec(a));
  });
});
