/** Visual deck identity: green rhythm bus / red melody bus. */
export type Side = "hype" | "diss";

export const DECK_LABEL: Record<Side, { header: string; name: string }> = {
  hype: { header: "DECK A // ", name: "RHYTHM" },
  diss: { header: "DECK B // ", name: "MELODY" },
};
