export type Mixer = {
  kick: number;
  hats: number;
  bass: number;
  lead: number;
  pad: number;
};

const KICK_HATS = new Set(["javascript", "typescript"]);
const BASS = new Set(["python"]);
const LEAD = new Set(["rust", "go", "c", "c++"]);

export const MIXER_CHANNELS: (keyof Mixer)[] = ["kick", "hats", "bass", "lead", "pad"];

/** Visual channel gains from language byte shares (already 0..100). */
export function mixerFromLanguages(languages: Record<string, number>): Mixer {
  let kickHats = 0;
  let bass = 0;
  let lead = 0;
  let pad = 0;
  for (const [lang, pct] of Object.entries(languages)) {
    const p = Math.min(Math.max(pct / 100, 0), 1);
    const l = lang.toLowerCase();
    if (KICK_HATS.has(l)) kickHats += p;
    else if (BASS.has(l)) bass += p;
    else if (LEAD.has(l)) lead += p;
    else pad += p;
  }
  const clamp = (x: number) => Math.min(x, 1);
  return {
    kick: clamp(kickHats),
    hats: clamp(kickHats),
    bass: clamp(bass),
    lead: clamp(lead),
    pad: clamp(pad),
  };
}

export function langsForChannel(
  channel: keyof Mixer,
  languages: Record<string, number>
): string {
  const names = Object.keys(languages)
    .map((l) => l.toLowerCase())
    .filter((l) => {
      if (channel === "kick" || channel === "hats") return KICK_HATS.has(l);
      if (channel === "bass") return BASS.has(l);
      if (channel === "lead") return LEAD.has(l);
      return !KICK_HATS.has(l) && !BASS.has(l) && !LEAD.has(l);
    });
  if (names.length === 0) return "";
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3}`;
}
