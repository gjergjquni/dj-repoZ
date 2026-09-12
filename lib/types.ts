import { z } from "zod";

/**
 * Raw snapshot of a repository — either fetched live from the GitHub REST API
 * or loaded from a bundled fixture. This is the ONLY input to the analyzer,
 * so fixtures exercise exactly the same scoring code as live repos.
 */
export const RawRepoSnapshotSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  description: z.string(),
  stars: z.number(),
  openIssues: z.number(),
  pushedAt: z.string(),
  languages: z.record(z.string(), z.number()), // bytes per language
  treePaths: z.array(z.string()), // full file paths from the git tree
  commitDates: z.array(z.string()), // ISO dates, newest first
});

export type RawRepoSnapshot = z.infer<typeof RawRepoSnapshotSchema>;

export const ProjectTypeSchema = z.enum([
  "web_app",
  "web_extension",
  "ml_project",
  "cli_tool",
  "game_engine",
  "library",
]);

export type ProjectType = z.infer<typeof ProjectTypeSchema>;

/** Each component is normalized 0..1 before weighting. */
export const MessinessBreakdownSchema = z.object({
  issuePressure: z.number(), // open issue ratio
  churn: z.number(), // commit velocity pressure
  treeDepth: z.number(), // deep directory trees
  testGap: z.number(), // lack of test files
});

export type MessinessBreakdown = z.infer<typeof MessinessBreakdownSchema>;

export const RepoAnalysisSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  description: z.string(),
  stars: z.number(),
  pushedAt: z.string(),
  seed: z.number(),
  languages: z.record(z.string(), z.number()), // percentages, 0..100
  messiness_score: z.number().int().min(0).max(100),
  breakdown: MessinessBreakdownSchema,
  project_type: ProjectTypeSchema,
  project_signals: z.array(z.string()), // filenames/keywords that triggered the type
  commit_velocity: z.number(), // commits per day
});

export type RepoAnalysis = z.infer<typeof RepoAnalysisSchema>;

export const TierSchema = z.enum(["clean", "moderate", "messy"]);
export type Tier = z.infer<typeof TierSchema>;

/** Structured audio prompt — the contract between the analyzer and any music engine. */
export const AudioPromptSpecSchema = z.object({
  genre: z.string(),
  bpm: z.number().int(),
  tier: TierSchema,
  primary_instruments: z.array(z.string()).min(1),
  mood: z.string(),
  sfx_elements: z.array(z.string()),
  prompt_string: z.string(),
});

export type AudioPromptSpec = z.infer<typeof AudioPromptSpecSchema>;

export const DJPlanSchema = z.object({
  analysis: RepoAnalysisSchema,
  spec: AudioPromptSpecSchema,
});

export type DJPlan = z.infer<typeof DJPlanSchema>;
