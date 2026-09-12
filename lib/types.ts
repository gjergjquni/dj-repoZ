import { z } from "zod";

export const CommitSchema = z.object({
  sha: z.string(),
  message: z.string(),
  date: z.string(),
  author: z.string(),
});

export const JokeTankSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  description: z.string(),
  stars: z.number(),
  pushedAt: z.string(),
  languages: z.record(z.string(), z.number()),
  readmeLines: z.array(z.string()).max(12),
  commits: z.array(CommitSchema),
  files: z.array(z.string()),
  todos: z.array(z.string()),
});

export type JokeTank = z.infer<typeof JokeTankSchema>;
export type Commit = z.infer<typeof CommitSchema>;

export const MixerSchema = z.object({
  kick: z.number(),
  hats: z.number(),
  bass: z.number(),
  lead: z.number(),
  pad: z.number(),
});

export type Mixer = z.infer<typeof MixerSchema>;

export const RepoPhysicsSchema = z.object({
  seed: z.number(),
  bpm: z.number(),
  chaos: z.number(),
  hypocrisy: z.number(),
  nightOwl: z.number(),
  mixer: MixerSchema,
});

export type RepoPhysics = z.infer<typeof RepoPhysicsSchema>;

export const BarSchema = z.object({
  barIndex: z.number().int().min(0).max(7),
  side: z.enum(["hype", "diss"]),
  text: z.string().max(90),
  quote: z.string(),
  sha: z.string().optional(),
  sourceIds: z.array(z.string()).optional(),
});

export type Bar = z.infer<typeof BarSchema>;

export const BattlePlanSchema = z.object({
  tank: JokeTankSchema,
  physics: RepoPhysicsSchema,
  bars: z.array(BarSchema).length(8),
  assembler: z.enum(["llm", "markov"]),
});

export type BattlePlan = z.infer<typeof BattlePlanSchema>;

/** LLM writer output shapes */
export const WriterBarSchema = z.object({
  barIndex: z.number().int(),
  text: z.string(),
  quote: z.string(),
  sha: z.string().optional(),
});

export const WriterOutputSchema = z.object({
  bars: z.array(WriterBarSchema),
});

export type WriterOutput = z.infer<typeof WriterOutputSchema>;
