#!/usr/bin/env node
/**
 * Esprit's guard — PreToolUse on Bash.
 *
 * Esprit's autonomy contract comes down to three stops: SPEND, DELETE, PUBLISH.
 * Written in a SKILL.md they hold only if the model chooses to honour them.
 * This script makes them MECHANICAL: the harness runs it whether the model
 * agrees or not.
 *
 * It blocks none of the three acts. It blocks the SILENT act.
 *
 *   node kie.mjs shot …                                → refused
 *   ESPRIT_BUDGET_OK="~3 USD, approved" node …         → allowed
 *
 *   rm -rf ~/project/old                               → refused
 *   ESPRIT_DELETE_OK="duplicate, diff -rq empty" rm …  → allowed
 *
 *   git push origin main                               → refused
 *   ESPRIT_PUBLISH_OK="reviewed, go received" git …    → allowed
 *
 * The prefix is not a formality: it writes the announcement into the session
 * transcript. What is not announced is not executable. This is the oldest
 * conversion lever in the world — disclosing the cost before the commitment —
 * turned inward.
 *
 * Three design principles, all three learned by being blocked:
 *
 *  - Inspect only what is INVOKED, never what is named. v1 blocked a cleanup
 *    command because a JSON test string mentioned kie.mjs. A guard that cries
 *    wolf teaches the operator to prefix by reflex, and the contract is worth
 *    nothing after that.
 *  - Shell redirections are not targets. Found in real use 2026-09-02:
 *    `rm -rf x 2>/dev/null` made "2>/dev/null" look like a file to delete,
 *    outside any temp path, so the command was wrongly refused. Fixed
 *    2026-09-03 — see REDIRECTION below. Same class as the first principle:
 *    something written in the command but never operated on.
 *  - Fail open. Unreadable input → let it through. This is a discipline, not a
 *    security boundary. A hook that exceeds its timeout does not block either:
 *    the harness falls back to the normal permission flow.
 */

// ── What triggers each stop ────────────────────────────────────────────────

const PAID = [
  { re: /kie\.mjs|api\.kie\.ai/i,                  name: "kie.ai (image / video)" },
  { re: /fal\.(ai|run)/i,                           name: "fal.ai (model router)" },
  { re: /api\.elevenlabs\.io|elevenlabs\.io\/v1/i,  name: "ElevenLabs (voice)" },
  { re: /api\.replicate\.com|replicate\.com\/v1/i,  name: "Replicate" },
  { re: /api\.openai\.com/i,                        name: "OpenAI" },
  { re: /api\.anthropic\.com/i,                     name: "Anthropic" },
  { re: /api\.minimax|minimaxi\.com/i,              name: "MiniMax" },
  { re: /api\.runwayml\.com/i,                      name: "Runway" },
  { re: /generativelanguage\.googleapis\.com/i,     name: "Google Generative AI" },
  { re: /aiplatform\.googleapis\.com/i,             name: "Vertex AI" },
  { re: /texttospeech\.googleapis\.com/i,           name: "Google Cloud TTS" },

  // Added 2026-09-03 after auditing OpenMontage's provider surface: an agentic
  // video pipeline reaches for a much wider set of paid endpoints than a coding
  // session does, and eight of its thirteen were passing the guard in silence.
  // A stop that covers most of the spend is not a stop.
  { re: /api\.fish\.audio|fish\.audio\/v1/i,        name: "fish.audio (voice cloning)" },
  { re: /dashscope\.aliyun(cs)?\.com/i,             name: "Alibaba DashScope (Qwen)" },
  { re: /klingai\.com/i,                            name: "Kling (video, avatar, lip-sync)" },
  { re: /volces\.com|volcengine\.com/i,             name: "Volcengine Doubao (voice)" },
  { re: /speech\.microsoft\.com|api\.cognitive\.microsoft\.com/i, name: "Azure AI Speech" },
  { re: /api\.heygen\.com/i,                        name: "HeyGen (avatar)" },
  { re: /higgsfield\.ai/i,                          name: "Higgsfield (video)" },
  { re: /suno\.(ai|com)\/|api\.suno/i,              name: "Suno (music)" },
];

const INTERPRETERS = /^(node|nodejs|bun|deno|npx|python3?|ts-node|tsx)$/;
const FETCHERS     = /^(curl|wget|http|https|httpie|xh)$/;

// A temp path is deleted without announcement: it is working material.
// Two regexes, because two questions: "is this ARGUMENT a temp path?" (anchored)
// and "does this COMMAND mention a temp path anywhere?" (free). One anchored
// regex failed the second case: `P=/private/tmp/z; rm -rf "$P"/*` starts with
// `P=`, not with `/private/tmp`.
const TEMP_PATH  = /^(\/tmp|\/private\/tmp|\/var\/folders|\$TMPDIR)|scratchpad/;
const TEMP_CITED = /(\/tmp|\/private\/tmp|\/var\/folders|\$TMPDIR|scratchpad)/;

// An argument `user@host:path` or `host:path` names a remote machine.
const REMOTE = /^(?!\.|\/)(?:[\w.-]+@)?[\w.-]+:/;

// Shell redirections: `2>/dev/null`, `>out.log`, `2>&1`, `&>/dev/null`, `<in`.
// Plumbing, never operands — nothing is deleted, fetched or pushed through
// them, and treating them as targets is what made the guard refuse its own
// operator's legitimate cleanup.
const REDIRECTION      = /^(?:\d*>>?|\d*>&\d*|&>>?|<<?)/;
// A bare operator (`2>`, `>`, `>>`) swallows the filename that follows it.
const BARE_REDIRECTION = /^(?:\d*>>?|\d*>&\d*|&>>?|<<?)$/;
// Device files are not deletable artefacts.
const DEVICE = /^\/dev\//;

const PREFIXES = {
  spend:   /ESPRIT_(BUDGET|SPEND)_OK\s*=/,
  delete:  /ESPRIT_DELETE_OK\s*=/,
  publish: /ESPRIT_PUBLISH_OK\s*=/,
};

// ── Splitting the command ──────────────────────────────────────────────────

// Strips leading assignments, quoted values included:
//   ESPRIT_DELETE_OK="verified duplicate" rm -rf x   →   rm -rf x
const ASSIGNMENTS = /^\s*(?:[A-Za-z_]\w*=(?:"[^"]*"|'[^']*'|\S*)\s+)*/;

// Split on separators the shell would honour, and ONLY those. A naive
// cmd.split(/[;|\n]/) also cuts inside quoted arguments, which is how this
// guard once refused a commit whose own message described the commands it
// blocks: the sentence contained "gh pr create", the newline before it became
// a segment boundary, and prose was executed as a command. Same failure as
// v1's — inspecting what is NAMED instead of what is INVOKED — reached by a
// different road, so the fix belongs in the splitter rather than a detector.
const splitTop = (cmd) => {
  const out = [];
  let cur = "", quote = null, heredoc = null;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (heredoc) {                       // inside <<'X' … X, nothing is a command
      cur += c;
      if (c === "\n" && cmd.startsWith(heredoc, i + 1) &&
          /^[\s\n]|$/.test(cmd[i + 1 + heredoc.length] || "")) heredoc = null;
      continue;
    }
    if (quote) { cur += c; if (c === quote && cmd[i - 1] !== "\\") quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    const hd = /^<<-?\s*(['"]?)([A-Za-z_]\w*)\1/.exec(cmd.slice(i));
    if (hd) { heredoc = hd[2]; cur += hd[0]; i += hd[0].length - 1; continue; }
    if (c === ";" || c === "\n" || c === "|") { out.push(cur); cur = ""; continue; }
    if (c === "&" && cmd[i + 1] === "&") { out.push(cur); cur = ""; i++; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
};

const segments = (cmd) =>
  splitTop(cmd)
    .map((s) => s.replace(ASSIGNMENTS, "").trim())
    .filter(Boolean)
    .map((seg) => {
      const toks = seg.split(/\s+/);
      return { toks, exe: (toks[0] || "").split("/").pop() };
    });

// Everything the command actually operates on: not flags, not redirections,
// not the filename a bare redirection carries, not device files.
const targets = (toks) => {
  const out = [];
  for (let i = 1; i < toks.length; i++) {
    const t = toks[i];
    if (t.startsWith("-")) continue;
    if (REDIRECTION.test(t)) { if (BARE_REDIRECTION.test(t)) i++; continue; }
    if (DEVICE.test(t)) continue;
    out.push(t);
  }
  return out;
};

const isTemp = (arg, cmd) =>
  TEMP_PATH.test(arg.replace(/^["']/, "")) ||
  // unresolved variable: exempt only if the command cites a temp path
  // somewhere (e.g. `P=/private/tmp/…; rm -rf "$P"/*`)
  (arg.includes("$") && TEMP_CITED.test(cmd));

// ── Detection ──────────────────────────────────────────────────────────────

const detectSpend = ({ toks, exe }) => {
  let invoked = [];
  if (INTERPRETERS.test(exe)) {
    const script = toks.slice(1).find((t) => !t.startsWith("-"));
    if (script) invoked = [script];
  } else if (FETCHERS.test(exe)) {
    invoked = targets(toks);
  } else {
    invoked = [exe]; // the executable itself, never its arguments
  }
  const hit = PAID.find((p) => invoked.some((c) => p.re.test(c)));
  return hit ? hit.name : null;
};

const detectDelete = ({ toks, exe }, cmd) => {
  const nonTemp = (args) => args.filter((a) => !isTemp(a, cmd));

  if (exe === "rm" || exe === "rmdir") {
    const c = nonTemp(targets(toks));
    return c.length ? `${exe} ${c.join(" ")}` : null;
  }
  if (exe === "find" && toks.includes("-delete")) {
    const c = nonTemp(targets(toks).slice(0, 1));
    return c.length ? `find … -delete on ${c[0]}` : null;
  }
  if (exe === "git") {
    const sub = toks[1];
    if (sub === "clean" && toks.some((t) => /^-\w*f/.test(t))) return "git clean -f";
    if (sub === "reset" && toks.includes("--hard")) return "git reset --hard";
  }
  // Found 2026-09-03, reaching for it: deleting an entire GitHub repository
  // passed the delete stop untouched, because the detector only knew about
  // files on disk. The most destructive deletion available was the one act
  // this guard could not see.
  if (exe === "gh" && toks[1] === "repo" && /^(delete|archive)$/.test(toks[2] || ""))
    return `gh repo ${toks[2]}`;
  if (/^(vercel|netlify)$/.test(exe) && /^(remove|rm|sites:delete)$/.test(toks[1] || ""))
    return `${exe} ${toks[1]}`;
  return null;
};

const detectPublish = ({ toks, exe }) => {
  const sub = toks[1];
  if (exe === "git" && sub === "push") return "git push";
  if (/^(vercel|netlify)$/.test(exe) && (toks.includes("deploy") || toks.includes("--prod") || toks.length === 1))
    return `${exe} deploy`;
  if (/^(npm|pnpm|yarn)$/.test(exe) && sub === "publish") return `${exe} publish`;
  if (exe === "gh" && /^(pr|release)$/.test(sub) && toks[2] === "create") return `gh ${sub} create`;
  // Found 2026-09-03 while publishing this very repository: `gh repo create`
  // with --push or --source uploads the whole tree in one command, and the
  // rule above let it through because it only looked at pr and release. A
  // guard against silent publication that misses the command which publishes
  // an entire repository is worse than none — it grants false confidence.
  if (exe === "gh" && sub === "repo" && toks[2] === "create" &&
      toks.some((t) => t === "--push" || t === "--source" || t.startsWith("--source=")))
    return "gh repo create --push";
  if (exe === "gh" && sub === "repo" && toks[2] === "sync") return "gh repo sync";
  if (exe === "docker" && sub === "push") return "docker push";
  if (/^(rsync|scp)$/.test(exe) && targets(toks).some((a) => REMOTE.test(a))) return `${exe} to a remote machine`;
  return null;
};

// ── Messages ───────────────────────────────────────────────────────────────

const MESSAGES = {
  spend: (what) =>
    `⛔ Esprit — silent spend refused.\n\n` +
    `This command calls a paid API: ${what}.\n\n` +
    `The contract requires ANNOUNCING the amount before spending. This guard\n` +
    `does not forbid the spend — it forbids the spend being silent.\n\n` +
    `  1. Tell the human what this call costs, in figures.\n` +
    `  2. Wait for their go.\n` +
    `  3. Re-run with the prefix:\n\n` +
    `     ESPRIT_BUDGET_OK="~3 USD, one 30 s clip, approved" <your command>`,

  delete: (what) =>
    `⛔ Esprit — silent deletion refused.\n\n` +
    `This command erases something that exists: ${what}.\n\n` +
    `The contract requires SHOWING THE BEFORE prior to deleting. A temp path\n` +
    `(/tmp, scratchpad) passes without announcement; nothing else does.\n\n` +
    `  1. Show what is about to disappear (ls, diff, wc).\n` +
    `  2. If it belongs to the human, wait for their go. If it is yours, say so.\n` +
    `  3. Re-run with the prefix:\n\n` +
    `     ESPRIT_DELETE_OK="duplicate, diff -rq empty, 11 files" <your command>`,

  publish: (what) =>
    `⛔ Esprit — silent publication refused.\n\n` +
    `This command sends something outward: ${what}.\n\n` +
    `The contract requires SHOWING THE DELIVERABLE before publishing. What goes\n` +
    `to a repository, a server or a registry does not come back.\n\n` +
    `  1. Show what is about to leave (git diff --stat, the page, the artefact).\n` +
    `  2. Wait for the go.\n` +
    `  3. Re-run with the prefix:\n\n` +
    `     ESPRIT_PUBLISH_OK="reviewed, go received" <your command>`,
};

// ── Input / output ─────────────────────────────────────────────────────────

const read = () =>
  new Promise((res) => {
    let d = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => res(d));
    setTimeout(() => res(d), 2000); // never hang the harness
  });

const pass = () => process.exit(0);

const block = (reason) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    })
  );
  process.stderr.write(reason + "\n");
  process.exit(2);
};

const main = async () => {
  let input;
  try {
    input = JSON.parse((await read()) || "{}");
  } catch {
    return pass();
  }
  if (input.tool_name !== "Bash") return pass();
  const cmd = String(input.tool_input?.command || "");
  if (!cmd) return pass();

  const missing = [];
  for (const seg of segments(cmd)) {
    const s = detectSpend(seg);
    if (s && !PREFIXES.spend.test(cmd)) missing.push(MESSAGES.spend(s));
    const d = detectDelete(seg, cmd);
    if (d && !PREFIXES.delete.test(cmd)) missing.push(MESSAGES.delete(d));
    const p = detectPublish(seg);
    if (p && !PREFIXES.publish.test(cmd)) missing.push(MESSAGES.publish(p));
  }

  if (!missing.length) return pass();
  block(
    [...new Set(missing)].join("\n\n──────\n\n") +
      `\n\nThe prefix writes the announcement into the transcript. What is not\n` +
      `announced is not executable.`
  );
};

main();
