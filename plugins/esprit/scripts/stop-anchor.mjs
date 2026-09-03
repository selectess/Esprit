#!/usr/bin/env node
/**
 * Stop hook — reversal 5: no number without its provenance.
 *
 * Reads the agent's last message from the transcript and flags numbers that are
 * ASSERTED with no source. The three-stops guard (guard.mjs) refuses; this one
 * WARNS ONLY.
 *
 * Why non-blocking: a Stop hook that blocks re-runs the agent, and an imperfect
 * detector would loop on legitimate answers. A false positive here degrades
 * every turn of the session — a cost far above the benefit. `stop_hook_active`
 * is honoured regardless.
 *
 * Measured on the ecom-conversion corpus, 1,691 lines across 8 files, 2026-09-02:
 *   v1, lexical matching alone .... 34 flags  (unusable)
 *   + grammatical discriminator ...  3 flags  (1 true, 2 false)
 *   + hypothetical filter .........  1 flag   (a true positive)
 *   after correcting the corpus ...  0 flags
 *
 * Bilingual since 2026-09-03. Before that the detector held French patterns
 * only and returned zero on English text — silently. See anchor-lint.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const read = () => new Promise((r) => {
  let d = ""; process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (d += c));
  process.stdin.on("end", () => r(d));
  setTimeout(() => r(d), 2000);
});

const done = (msg) => { if (msg) process.stderr.write(msg); process.exit(0); };

try {
  const input = JSON.parse((await read()) || "{}");
  if (input.stop_hook_active) done();                    // anti-loop guard
  const tp = input.transcript_path;
  if (!tp || !fs.existsSync(tp)) done();

  // Last assistant message in the JSONL transcript.
  const lines = fs.readFileSync(tp, "utf8").split("\n").filter(Boolean);
  let text = "";
  for (let i = lines.length - 1; i >= 0 && !text; i--) {
    try {
      const e = JSON.parse(lines[i]);
      const c = e?.message?.content;
      if (e?.message?.role !== "assistant" || !Array.isArray(c)) continue;
      text = c.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    } catch {}
  }
  if (!text.trim()) done();

  const { analyse } = await import(
    pathToFileURL(path.join(path.dirname(new URL(import.meta.url).pathname), "anchor-lint.mjs")).href
  );
  const r = analyse(text);
  if (!r.sansSource) done();

  done(
    `\n⚠️  Esprit — reversal 5: ${r.sansSource} number(s) asserted without provenance.\n\n` +
    r.trouvailles.filter((t) => !t.couvert).slice(0, 5)
      .map((t) => `   « ${t.valeur} »  …${t.extrait}…`).join("\n") +
    `\n\n   No source, no number. A range announced as a range is honest;\n` +
    `   the same figure stated as a fact is not.\n`
  );
} catch { done(); }
