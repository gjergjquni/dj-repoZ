/* Acceptance checks against a running dev server. */
const BASE = "http://localhost:3000";
const FORBIDDEN =
  /\b(yo|lit|fire|sick|vibe|drop the beat|ladies and gentlemen|check it|rap god|let'?s go)\b/i;

function tankStrings(tank) {
  return [
    tank.description,
    tank.repo,
    tank.owner + "/" + tank.repo,
    ...tank.readmeLines,
    ...tank.commits.map((c) => c.message),
    ...tank.files,
    ...tank.todos,
  ].filter(Boolean);
}

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  → " + detail}`);
  if (!ok) failures++;
}

for (const fixture of ["student-mess", "linux-ish", "react-ish"]) {
  const res = await fetch(`${BASE}/api/battle?demo=1&fixture=${fixture}`);
  check(`[${fixture}] demo=1 responds 200`, res.ok, String(res.status));
  if (!res.ok) continue;
  const plan = await res.json();

  check(`[${fixture}] 8 bars`, plan.bars.length === 8);

  const strings = tankStrings(plan.tank);
  const badQuote = plan.bars.find(
    (b) => !strings.some((s) => s.includes(b.quote))
  );
  check(
    `[${fixture}] every quote is verbatim tank substring`,
    !badQuote,
    badQuote && JSON.stringify(badQuote)
  );

  const badText = plan.bars.find((b) => !b.text.includes(b.quote));
  check(`[${fixture}] every bar text contains its quote`, !badText,
    badText && JSON.stringify(badText));

  const tooLong = plan.bars.find((b) => b.text.length > 90);
  check(`[${fixture}] bars <= 90 chars`, !tooLong, tooLong && tooLong.text);

  const cringe = plan.bars.find((b) => FORBIDDEN.test(b.text));
  check(`[${fixture}] no forbidden words`, !cringe, cringe && cringe.text);

  const sides = plan.bars.map((b) => b.side);
  check(
    `[${fixture}] hype/diss alternation respects hypocrisy rule`,
    plan.physics.hypocrisy > 0.55
      ? sides[6] === "diss" && sides[7] === "diss"
      : plan.physics.hypocrisy < 0.25
        ? sides[7] === "hype"
        : sides.join() === "hype,diss,hype,diss,hype,diss,hype,diss"
  );

  // determinism: same fixture again → same seed, bpm, same bar texts
  const plan2 = await (
    await fetch(`${BASE}/api/battle?demo=1&fixture=${fixture}`)
  ).json();
  check(
    `[${fixture}] deterministic seed+bpm`,
    plan2.physics.seed === plan.physics.seed &&
      plan2.physics.bpm === plan.physics.bpm
  );
  if (plan.assembler === "markov") {
    check(
      `[${fixture}] deterministic markov bars`,
      JSON.stringify(plan2.bars) === JSON.stringify(plan.bars)
    );
  }
  console.log(
    `      assembler=${plan.assembler} bpm=${plan.physics.bpm.toFixed(1)} chaos=${plan.physics.chaos.toFixed(3)} hyp=${plan.physics.hypocrisy.toFixed(3)} night=${plan.physics.nightOwl.toFixed(2)}`
  );
  for (const b of plan.bars) {
    console.log(`      bar${b.barIndex} [${b.side}] ${b.text}`);
  }
}

// error handling: bad params
const bad = await fetch(`${BASE}/api/battle`);
check("missing params → 400", bad.status === 400);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
