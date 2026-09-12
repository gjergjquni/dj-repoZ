import { markovBars } from "./markov";
import { barSides, computePhysics } from "./score";
import { BattlePlanSchema, type Bar, type BattlePlan, type JokeTank } from "./types";
import { llmBars } from "./writers";

/**
 * Compose a BattlePlan: math first, then LLM writers if keys exist,
 * Markov assembler for anything the LLM failed to deliver.
 */
export async function composeBattle(tank: JokeTank): Promise<BattlePlan> {
  const physics = computePhysics(tank);
  const sides = barSides(physics.hypocrisy);

  let llm: Bar[] = [];
  try {
    llm = await llmBars(tank, physics, sides);
  } catch (e) {
    console.warn("[blamebox] LLM writers failed, using markov:", (e as Error).message);
    llm = [];
  }

  const byIndex = new Map<number, Bar>();
  for (const b of llm) {
    if (b.side === sides[b.barIndex]) byIndex.set(b.barIndex, b);
  }

  const missing = Array.from({ length: 8 }, (_, i) => i).filter(
    (i) => !byIndex.has(i)
  );
  if (missing.length > 0) {
    for (const b of markovBars(tank, sides, physics.seed, missing)) {
      byIndex.set(b.barIndex, b);
    }
  }

  const bars = Array.from({ length: 8 }, (_, i) => byIndex.get(i)!);
  // llm badge only if the LLM delivered the majority of bars
  const assembler: "llm" | "markov" = 8 - missing.length >= 5 ? "llm" : "markov";

  return BattlePlanSchema.parse({ tank, physics, bars, assembler });
}
