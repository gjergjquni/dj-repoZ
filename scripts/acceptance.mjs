/* Acceptance checks against a running dev server. */
const BASE = "http://localhost:3000";

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  → " + detail}`);
  if (!ok) failures++;
}

const EXPECTED_TIER = {
  "clean-lib": "clean",
  "ml-lab": "moderate",
  "student-mess": "messy",
};

const BPM_RANGE = {
  clean: [70, 95],
  moderate: [100, 125],
  messy: [140, 185],
};

for (const fixture of Object.keys(EXPECTED_TIER)) {
  const res = await fetch(`${BASE}/api/dj?demo=1&fixture=${fixture}`);
  check(`[${fixture}] demo=1 responds 200`, res.ok, String(res.status));
  if (!res.ok) continue;
  const plan = await res.json();
  const { analysis, spec } = plan;

  check(
    `[${fixture}] tier is ${EXPECTED_TIER[fixture]}`,
    spec.tier === EXPECTED_TIER[fixture],
    `got ${spec.tier} (score ${analysis.messiness_score})`
  );

  const [lo, hi] = BPM_RANGE[spec.tier];
  check(
    `[${fixture}] bpm ${spec.bpm} within ${lo}-${hi}`,
    spec.bpm >= lo && spec.bpm <= hi
  );

  check(
    `[${fixture}] prompt_string is instrumental-only`,
    spec.prompt_string.includes("no voice, no lyrics, pure instrumental"),
    spec.prompt_string
  );

  check(
    `[${fixture}] prompt_string carries bpm + genre + instruments`,
    spec.prompt_string.includes(`${spec.bpm} BPM`) &&
      spec.prompt_string.includes(spec.genre) &&
      spec.primary_instruments.every((i) => spec.prompt_string.includes(i))
  );

  check(
    `[${fixture}] has instruments and sfx`,
    spec.primary_instruments.length > 0 && spec.sfx_elements.length > 0
  );

  // determinism: same fixture again → identical plan
  const plan2 = await (
    await fetch(`${BASE}/api/dj?demo=1&fixture=${fixture}`)
  ).json();
  check(
    `[${fixture}] deterministic plan`,
    JSON.stringify(plan2) === JSON.stringify(plan)
  );

  console.log(
    `      score=${analysis.messiness_score} tier=${spec.tier} bpm=${spec.bpm} type=${analysis.project_type} genre="${spec.genre}"`
  );
  console.log(`      prompt: ${spec.prompt_string}`);
}

// error handling: bad params
const bad = await fetch(`${BASE}/api/dj`);
check("missing params → 400", bad.status === 400);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
