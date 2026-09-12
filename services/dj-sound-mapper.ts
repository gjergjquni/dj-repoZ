import {
  AudioPromptSpecSchema,
  type AudioPromptSpec,
  type ProjectType,
  type RepoAnalysis,
  type Tier,
} from "@/lib/types";

/**
 * Mapping engine: RepoAnalysis → AudioPromptSpec.
 * Deterministic — same repo state always produces the same spec.
 * The producer is never an LLM; the prompt_string is ready for any
 * external AI music generator, and the built-in Tone.js engine renders
 * an approximation locally.
 */

type TierDef = {
  tier: Tier;
  genres: string[];
  bpmLo: number;
  bpmHi: number;
  mood: string;
  moodAdj: string;
};

const TIERS: TierDef[] = [
  {
    tier: "clean",
    genres: [
      "elegant classical piano",
      "smooth lo-fi",
      "clean ambient strings",
    ],
    bpmLo: 70,
    bpmHi: 95,
    mood: "calm, elegant, polished",
    moodAdj: "mellow",
  },
  {
    tier: "moderate",
    genres: ["upbeat house", "synthwave", "smooth trap", "groove-focused funk"],
    bpmLo: 100,
    bpmHi: 125,
    mood: "energetic, groovy, confident",
    moodAdj: "groovy",
  },
  {
    tier: "messy",
    genres: [
      "fast breakcore",
      "frantic gabber",
      "hard drum & bass",
      "distorted dubstep",
      "industrial breakbeat",
    ],
    bpmLo: 140,
    bpmHi: 185,
    mood: "frantic, chaotic, high-energy",
    moodAdj: "high-energy",
  },
];

export function tierFor(score: number): TierDef {
  if (score <= 30) return TIERS[0];
  if (score <= 65) return TIERS[1];
  return TIERS[2];
}

/** BPM scales with position inside the tier's score band. */
export function bpmFor(score: number): number {
  const t = tierFor(score);
  const lo = t.tier === "clean" ? 0 : t.tier === "moderate" ? 31 : 66;
  const hi = t.tier === "clean" ? 30 : t.tier === "moderate" ? 65 : 100;
  const pos = (score - lo) / (hi - lo);
  return Math.round(t.bpmLo + pos * (t.bpmHi - t.bpmLo));
}

/** Language → instrument palette. Keys are lowercase GitHub language names. */
const LANG_INSTRUMENTS: [RegExp, string[]][] = [
  [/^python$/, ["analog synths", "sub-bass 808s", "futuristic synth pads"]],
  [
    /^(c|c\+\+|rust)$/,
    ["heavy industrial metal guitar", "distorted bass", "raw acoustic percussion"],
  ],
  [
    /^(javascript|typescript)$/,
    ["upbeat synth-pop keys", "digital hi-hats", "bouncy bassline"],
  ],
  [
    /^(html|css|scss|less)$/,
    ["chill acoustic guitar", "light brass", "relaxed rhodes piano"],
  ],
  [/^(go|elixir)$/, ["electro-funk bass", "rhythmic synth arpeggios"]],
  [
    /^(assembly|shell|batchfile|powershell|makefile)$/,
    ["retro 8-bit chiptune lead", "bitcrushed drum machine"],
  ],
];

export function instrumentsFor(
  languages: Record<string, number>
): string[] {
  const out: string[] = [];
  // languages arrive sorted by share (analyzer) — keep that order,
  // but ignore languages under 5% so the palette stays focused
  for (const [lang, pct] of Object.entries(languages)) {
    if (pct < 5) continue;
    const hit = LANG_INSTRUMENTS.find(([re]) => re.test(lang.toLowerCase()));
    for (const inst of hit?.[1] ?? []) {
      if (!out.includes(inst)) out.push(inst);
    }
    if (out.length >= 6) break;
  }
  if (out.length === 0) out.push("warm analog pad", "soft drum machine");
  return out.slice(0, 6);
}

/** Project type → sound FX / sample drops. */
const TYPE_SFX: Record<ProjectType, string[]> = {
  web_app: ["UI chime samples", "browser click percussion accents"],
  web_extension: ["notification pop SFX", "subtle radio glitches", "light digital pings"],
  ml_project: ["futuristic robot soundscapes", "data-sweep risers", "glitchy stutter FX"],
  cli_tool: ["mechanical keyboard clack percussion", "modem handshake textures"],
  game_engine: ["16-bit arcade audio drops", "coin chimes", "retro laser pads"],
  library: ["soft vinyl crackle", "page-turn ticks"],
};

export function sfxFor(type: ProjectType): string[] {
  return TYPE_SFX[type];
}

export function buildPromptString(
  bpm: number,
  moodAdj: string,
  genre: string,
  instruments: string[],
  sfx: string[]
): string {
  return (
    `${bpm} BPM ${moodAdj} ${genre} beat with ` +
    `${instruments.join(", ")}, subtle ${sfx.join(", ")}, ` +
    `no voice, no lyrics, pure instrumental`
  );
}

export function mapToAudioSpec(analysis: RepoAnalysis): AudioPromptSpec {
  const tier = tierFor(analysis.messiness_score);
  const genre = tier.genres[analysis.seed % tier.genres.length];
  const bpm = bpmFor(analysis.messiness_score);
  const primary_instruments = instrumentsFor(analysis.languages);
  const sfx_elements = sfxFor(analysis.project_type);

  return AudioPromptSpecSchema.parse({
    genre,
    bpm,
    tier: tier.tier,
    primary_instruments,
    mood: tier.mood,
    sfx_elements,
    prompt_string: buildPromptString(
      bpm,
      tier.moodAdj,
      genre,
      primary_instruments,
      sfx_elements
    ),
  });
}
