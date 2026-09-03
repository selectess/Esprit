#!/usr/bin/env node
/**
 * The anchoring detector — Esprit's reversal 5.
 *
 * "No number without its provenance." Written as prose in the SKILL, honoured
 * only if the model chooses to. This script makes it measurable.
 *
 * It looks for numbers that are ASSERTED with no provenance. An agent that says
 * "this will take about three days" or "we're at roughly 70%" anchors a human
 * decision on an invented estimate — with no intent, and with no one noticing.
 *
 *   node anchor-lint.mjs --text "…"      inspect a string
 *   node anchor-lint.mjs --file f.md     inspect a file
 *   node anchor-lint.mjs --self-test     run the case suite
 *
 * (--texte / --fichier still work: the flags were French before v1.1.)
 *
 * ── BILINGUAL, and that is a correctness property, not a nicety ────────────
 *
 * Measured 2026-09-03, four identical assertions written twice:
 *
 *     French   3 detections
 *     English  0 detections
 *
 * Zero. Not "fewer" — blind. Both gates below (ASSERTIVE, ILLUSTRATIVE) held
 * French patterns only, and the assertion gate is hard: `if (!ASSERTIVE) continue`.
 * No English number ever reached the test.
 *
 * That is the silent false negative this file's own header calls worse than a
 * noisy false positive. Shipped as-is, an English-speaking user installs Esprit,
 * the Stop hook runs on every turn, reports nothing, and they conclude it works.
 * Half of everything Esprit mechanically enforces would have been dead on
 * arrival, quietly. Hence: both grammars, unioned, run on every text. No
 * language detection — a mixed-language document has to work too.
 *
 * ── WHAT THE FRENCH MEASUREMENT ESTABLISHED ────────────────────────────────
 *
 * On the ecom-conversion corpus (8 real files, 1,691 lines, written under the
 * "no source, no number" rule):
 *
 *     lexical matching alone            34 flags — unusable
 *     + grammatical assertion filter     3
 *     + hypothetical-comparison filter   1 — a true positive
 *     after correcting the corpus        0
 *
 * The true positive was "90 % de la littérature UX": an unsourced assertion,
 * written by me, inside the file that forbids exactly that.
 *
 * The decisive insight is that the discriminator is NOT the number. The same
 * string "3,000 MAD" is a fault in "the average basket is 3,000 MAD" and
 * legitimate in "a product at 3,000 MAD, for example". What separates them is
 * the grammatical function of what PRECEDES it: a number introduced by a
 * preposition is a complement and qualifies an object; a number preceded by a
 * copula or a verb of measurement is a predicate and asserts a quantity.
 *
 * Same lesson as guard.mjs — inspect only what is INVOKED, never what is NAMED.
 * Here: inspect only what is ASSERTED, never what is MENTIONED.
 *
 * ⚠️ Wired as a Stop hook, WARN-ONLY. A blocking Stop hook re-runs the agent, so
 * an imperfect detector would loop on legitimate answers.
 */

// A number is an anchor only if it is ASSERTED. These contexts never assert.
const EXEMPT_ZONES = [
  /```[\s\S]*?```/g,          // fenced code
  /`[^`\n]*`/g,               // inline code
  /\|[^\n]*\|/g,              // table rows (the source sits in a column)
  /^\s*>.*$/gm,               // block quotes
  /https?:\/\/\S+/g,          // URLs
];

// Numeric forms that are not quantified claims.
const NOT_ASSERTIVE = [
  /^v?\d+\.\d+(\.\d+)?$/,                 // version
  /^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$/,   // date
];
// NOTE — two rules were removed after they failed the self-test: `^\d+$` (bare
// integer) and `^\d{4}$` (year). They applied to the NUMBER while the unit is
// captured separately, so they excluded "70 %", "3 USD", "4 %" — precisely the
// targets. A detector that detects nothing looks clean: that is the silent
// false negative, worse than the noisy false positive. NUMBER already requires
// a unit, so a bare year or integer cannot match anyway.

// Provenance markers accepted anywhere in the neighbourhood.
const SOURCE = new RegExp([
  // French
  "source", "selon", "d'après", "d’après", "cité", "citée",
  "étude", "etude", "méta-analys", "meta-analys", "recherche",
  "mesuré", "mesure", "vérifi", "verifi", "observé", "observe",
  "note\\s*[ABC]\\b", "calculé par", "calcule par", "d'après le", "sortie de",
  // English
  "according to", "cited", "citing", "study", "studies", "meta-analys",
  "research", "measured", "verified", "observed", "reported by",
  "grade\\s*[ABC]\\b", "computed by", "calculated by", "per the docs",
  "as measured", "benchmarked",
  // language-neutral
  "\\bIC\\s*9[05]", "\\bCI\\s*9[05]", "n\\s*=\\s*\\d",
  "\\b(19|20)\\d{2}\\b",            // a year is probably a citation
  "documentation", "officiel", "official", "rapport", "report", "benchmark",
].join("|"), "i");

// Owned-uncertainty markers: honest, therefore accepted.
const HEDGE = new RegExp([
  // French
  "environ", "à peu près", "a peu pres", "approximativement",
  "de l['’]ordre", "estimation", "fourchette", "entre\\s",
  // English
  "about", "around", "roughly", "approximately", "circa", "ballpark",
  "an estimate", "estimated", "or so", "give or take", "between\\s",
  // symbols
  "~", "±",
].join("|"), "i");

/**
 * GATE 1 — inspect only what ASSERTS.
 *
 * Only EXPLICIT example markers, over a wide window. Bare prepositions were
 * removed: "de\s*$" also matched the tail of "est de", so illustration
 * overrode assertion. They were redundant anyway — the conservative default
 * (`!assertive → ignore`) already covers them.
 */
const ILLUSTRATIVE = new RegExp([
  // French
  "par exemple", "p\\.\\s?ex\\b", "disons", "mettons", "supposons", "admettons",
  "comme un\\b", "comme une\\b", "tel qu", "du genre", "style\\s",
  "imaginons", "mettez", "prenons",
  "\\bun\\s+\\w+\\s+(qui|à)\\b", "\\bune\\s+\\w+\\s+(qui|à)\\b",
  // English
  "for example", "for instance", "e\\.\\s?g\\b", "let['’]s say", "\\bsay\\b",
  "suppose", "imagine", "such as", "something like", "\\blike an?\\b",
  // Hypothetical comparison: indefinite subject + relative clause.
  // "a seller THAT converts at 6%", "an offer THAT costs 3 USD". Assertive
  // grammar, invented world — this was the last false-positive pattern on the
  // French corpus, and it transfers directly.
  "\\ban?\\s+\\w+\\s+(that|which|at)\\b",
].join("|"), "i");

const ASSERTIVE = new RegExp([
  // French — copulas and verbs of measurement, anchored at the number
  "\\best de\\s*$", "\\bsont de\\s*$", "\\bfait\\s*$", "\\bfont\\s*$",
  "\\batteint\\s*$", "\\breprésente\\s*$", "\\bs['’]élève à\\s*$",
  "\\btaux[^.]{0,30}$", "\\bmoyenne?[^.]{0,20}$", "\\bconvertit à\\s*$",
  "\\bcoûte\\s*$", "\\bvaut\\s*$", "\\bgagne\\s*$", "\\bperd\\s*$",
  "\\bprend\\s*$", "\\bdure\\s*$", "\\baugmente de\\s*$", "\\bbaisse de\\s*$",
  // English — same two families
  "\\b(is|are|was|were)\\s*$",
  "\\b(costs?|takes?|took|reaches|reached|hits?|weighs?|lasts?)\\s*$",
  "\\b(represents?|amounts? to|comes? to|adds? up to)\\s*$",
  "\\bconverts? at\\s*$", "\\bsits? at\\s*$", "\\bstands? at\\s*$",
  "\\b(increases?|decreases?|drops?|rises?|grows?|falls?) by\\s*$",
  "\\brates?[^.]{0,30}$", "\\baverages?[^.]{0,20}$",
  // language-neutral: a colon introduces a stated figure
  ":\\s*$",
].join("|"), "i");

// A number counts only when it carries a unit. Two shapes, because English puts
// currency in front ("$50", "€3,000") and French puts it behind ("50 €").
const UNIT_AFTER =
  "(%|€|\\$|£|USD|MAD|EUR|GBP|px|ms|s\\b|kg|km|Mo|Go|MB|GB|k\\b|×|x\\s|fois|times" +
  "|jours?|heures?|minutes?|semaines?|mois|ans?" +
  "|days?|hours?|minutes?|seconds?|weeks?|months?|years?)";
const NUMBER = new RegExp(
  "(?:([€$£])\\s*(\\d[\\d\\s.,]*)|(\\d[\\d\\s.,]*)\\s*" + UNIT_AFTER + ")",
  "gi"
);

export function analyse(texte, { fenetre = 120 } = {}) {
  let masked = texte;
  for (const z of EXEMPT_ZONES) masked = masked.replace(z, (m) => " ".repeat(m.length));

  const findings = [];
  for (const m of masked.matchAll(NUMBER)) {
    // Either the prefix-currency branch (groups 1,2) or the suffix-unit branch (3,4).
    const raw = (m[2] ?? m[3] ?? "").trim();
    if (!raw) continue;
    if (NOT_ASSERTIVE.some((r) => r.test(raw))) continue;

    const i = m.index;
    const ctx = texte.slice(Math.max(0, i - fenetre), Math.min(texte.length, i + m[0].length + fenetre));
    if (SOURCE.test(ctx)) continue;

    // What immediately precedes the number decides its status. Two windows,
    // two questions: the assertion reads right before the number, while the
    // example declares itself earlier in the sentence.
    const upstream = texte.slice(Math.max(0, i - 40), i);
    const sentence = texte.slice(Math.max(0, i - 160), i);
    if (!ASSERTIVE.test(upstream)) continue;    // no claim → no anchoring
    if (ILLUSTRATIVE.test(sentence)) continue;  // a claim, but inside an example

    // Hedging is read on a TIGHT window, not on ctx. A hedge qualifies the
    // number it sits against ("about 3 days", "3 days or so"); tested over the
    // full ±120 context, a single "about" anywhere nearby immunised every
    // unrelated number around it — which is how three asserted figures came
    // back marked "hedged" because one neighbouring sentence said "about".
    const near = texte.slice(Math.max(0, i - 32), Math.min(texte.length, i + m[0].length + 18));

    findings.push({
      valeur: m[0].trim(),
      position: i,
      couvert: HEDGE.test(near) ? "hedged" : null,
      extrait: texte.slice(Math.max(0, i - 45), Math.min(texte.length, i + m[0].length + 45)).replace(/\s+/g, " ").trim(),
    });
  }
  const hard = findings.filter((t) => !t.couvert);
  return { total: findings.length, sansSource: hard.length, trouvailles: findings };
}

// ── CLI ────────────────────────────────────────────────────────────────────
// Runs ONLY when the file is launched directly. Without this guard, an `import`
// from stop-anchor.mjs triggered the CLI, printed the help and exited before any
// analysis: valid syntax, dead hook. A syntax check cannot see that — only a
// real invocation reveals it.
const RUN_DIRECTLY =
  process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].split("/").pop());
if (!RUN_DIRECTLY) { /* imported as a module: run nothing */ }
else {

const argv = process.argv.slice(2);
const arg = (...names) => {
  for (const n of names) { const i = argv.indexOf(`--${n}`); if (i > -1) return argv[i + 1]; }
  return null;
};

if (argv.includes("--self-test")) {
  const cases = [
    // [text, expected count of numbers asserted WITHOUT source, note]

    // ── French: the original suite, kept verbatim as a regression guard ────
    ["ça prendra environ trois jours et coûtera 50 dollars", 0, "FR hedged → covered"],
    ["le taux de confirmation est de 70 %", 1, "FR asserted, no source → must flag"],
    ["ça coûte 3 USD par clip", 1, "FR asserted, no source → must flag"],
    ["48 % des abandons évitables (Baymard, note A)", 0, "FR source present → OK"],
    ["Méta-analyse de 156 études : r = 0,563", 0, "FR meta-analysis = source → OK"],
    ["net par lead 42,80 MAD — calculé par unit-economics.mjs", 0, "FR provenance given → OK"],
    ["| Fitts | 512 px vers 32 px | 5 bits |", 0, "FR table exempt → OK"],
    ["lance `sleep 30` puis attends", 0, "FR inline code exempt → OK"],
    ["```\nnpm i -g lighthouse@12.8.2\n```", 0, "FR fenced code exempt → OK"],
    ["la version 0.7.0 du plugin", 0, "FR version → not assertive"],
    ["publié le 29 mai 2026", 0, "FR date → not assertive"],
    ["d'après la doc officielle, la fenêtre est de 7 jours", 0, "FR source present → OK"],
    ["l'effet est de 0,825 (IC 95 %)", 0, "FR CI = statistical marker → OK"],
    ["je pense que ça convertit à 4 %", 1, "FR asserted, no source → must flag"],

    // ── English: the mirror. Every one of these scored 0 before v1.1. ──────
    ["the average basket is 3,000 MAD", 1, "EN asserted, no source → must flag"],
    ["the confirmation rate is 70 %", 1, "EN asserted, no source → must flag"],
    ["it costs 3 USD per clip", 1, "EN asserted, no source → must flag"],
    ["this will take about 3 days", 0, "EN hedged → covered"],
    ["48 % of abandonments are avoidable (Baymard, grade A)", 0, "EN source present → OK"],
    ["meta-analysis of 156 studies: r = 0.563", 0, "EN meta-analysis = source → OK"],
    ["a product that costs 3,000 MAD, for example", 0, "EN illustrative → OK"],
    ["according to the official docs, the window is 7 days", 0, "EN source present → OK"],
    ["the effect is 0.825 (CI 95 %)", 0, "EN CI = statistical marker → OK"],
    ["| Fitts | 512 px to 32 px | 5 bits |", 0, "EN table exempt → OK"],
    ["run `sleep 30` and wait", 0, "EN inline code exempt → OK"],
    ["version 0.7.0 of the plugin", 0, "EN version → not assertive"],
  ];
  let ko = 0;
  for (const [t, expected, note] of cases) {
    const r = analyse(t);
    const ok = r.sansSource === expected;
    if (!ok) ko++;
    console.log(`  ${ok ? "✓" : "✗"} ${r.sansSource}/${expected}  ${note}`);
    if (!ok) r.trouvailles.forEach((x) => console.log(`        → « ${x.valeur} » : ${x.extrait}`));
  }
  console.log(`\n  ${ko === 0 ? `${cases.length}/${cases.length} pass` : `${ko} FAILURE(S) of ${cases.length}`}`);
  process.exit(ko ? 1 : 0);
}

const src = arg("text", "texte")
  ?? (arg("file", "fichier") ? (await import("node:fs")).readFileSync(arg("file", "fichier"), "utf8") : null);
if (!src) { console.log("\n  node anchor-lint.mjs --text \"…\" | --file f.md | --self-test\n"); process.exit(0); }
const r = analyse(src);
console.log(`\n  ${r.sansSource} number(s) asserted without provenance, of ${r.total} considered\n`);
for (const t of r.trouvailles) console.log(`  ${t.couvert ? "~" : "✗"} « ${t.valeur} »${t.couvert ? ` (${t.couvert})` : ""}\n      ${t.extrait}`);
process.exit(r.sansSource ? 1 : 0);

}  // end of CLI block
