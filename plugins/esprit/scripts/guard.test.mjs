import { spawnSync } from "node:child_process";

const G = process.argv[2];
if (!G) { console.error("usage: node test-guard.mjs <path/to/guard.mjs>"); process.exit(1); }

// Literals assembled at runtime: they never appear in the shell command that
// launches this test, so the live guard does not fire on it.
const KIE = "kie" + ".mjs";
const FAL = "fal" + ".run";
const ELE = "api.eleven" + "labs.io";
const RM = "r" + "m";
const PUSH = "pu" + "sh";
const GH = "g" + "h";
const PR = "p" + "r";
const CREATE = "cre" + "ate";

const cas = [
  // ── SPEND ──
  ["BLOCK   spend: node runs a paid script",        `node ${KIE} shot x a.png b.mp4`,                          2],
  ["BLOCK   spend: curl to a router",              `curl -X POST https://${FAL}/fal-ai/kling`,                2],
  ["BLOCK   spend: curl to a voice API",                 `curl https://${ELE}/v1/tts`,                              2],
  ["BLOCK   spend: after a pipe",             `cat p.txt | node ${KIE} still`,                           2],
  ["PASS    spend: BUDGET prefix",            `ESPRIT_BUDGET_OK="3 USD" node ${KIE} shot x`,             0],
  ["PASS    spend: SPEND prefix",             `ESPRIT_SPEND_OK="3 USD, ok" node ${KIE} shot x`,          0],
  ["PASS    spend: prefix with spaces",       `ESPRIT_BUDGET_OK="3 USD, approved" node ${KIE} x`,    0],
  ["PASS    spend: echo merely mentions",        `echo "node ${KIE} shot"`,                                 0],
  ["PASS    spend: grep",                      `grep -r ${ELE} .`,                                        0],
  ["PASS    spend: ls on a path",          `ls ~/skills/${KIE}`,                                      0],
  // Agentic video pipelines (OpenMontage and the like) reach far past the
  // endpoints a coding session touches. Audited 2026-09-03.
  ["BLOCK   spend: voice cloning",                `curl -X POST https://api.fish.audio/v1/tts`,              2],
  ["BLOCK   spend: Alibaba DashScope",            `curl https://dashscope.aliyuncs.com/api/v1/x`,            2],
  ["BLOCK   spend: Kling video",                  `curl https://api-singapore.klingai.com/v1/videos`,        2],
  ["BLOCK   spend: Volcengine Doubao",            `curl https://ark.cn-beijing.volces.com/api/v3/tts`,       2],
  ["BLOCK   spend: Azure Speech",                 `curl https://eastus.tts.speech.microsoft.com/cognitive`,   2],
  ["BLOCK   spend: HeyGen avatar",                `curl https://api.heygen.com/v2/video`,                    2],
  ["BLOCK   spend: Google Cloud TTS",             `curl https://texttospeech.googleapis.com/v1/text`,        2],
  ["PASS    spend: free stock (Pexels)",          `curl https://www.pexels.com/api/videos`,                  0],
  ["PASS    spend: public archive",               `curl https://archive.org/download/x.mp4`,                 0],
  ["PASS    spend: local ffmpeg render",          `ffmpeg -i in.mp4 -c:v libx264 out.mp4`,                   0],
  // ── DELETE ──
  ["BLOCK   delete: rm -rf outside temp",            `${RM} -rf ~/.claude/skills/x`,                            2],
  ["BLOCK   delete: plain rm outside temp",         `${RM} ~/notes.md`,                                        2],
  ["BLOCK   delete: rm of a paid name is a DELETE", `${RM} ~/skills/${KIE}`,                                   2],
  ["BLOCK   delete: variable, no temp cited",     `${RM} -rf "$HOME/proj"`,                                  2],
  ["BLOCK   delete: rmdir",                       `rmdir ~/old`,                                             2],
  ["BLOCK   delete: find -delete",                `find ~/x -name "*.log" -delete`,                          2],
  ["BLOCK   delete: git reset --hard",            `git reset --hard HEAD~1`,                                 2],
  ["BLOCK   delete: git clean -fd",               `git clean -fd`,                                           2],
  ["PASS    delete: DELETE prefix",              `ESPRIT_DELETE_OK="duplicate, empty diff" ${RM} -rf ~/x`,     0],
  ["PASS    delete: /tmp",                        `${RM} -f /tmp/case.json`,                                 0],
  ["PASS    delete: scratchpad",                  `${RM} -rf /private/tmp/claude-501/s/scratchpad/y`,        0],
  ["PASS    delete: variable + temp cited",        `P=/private/tmp/z; ${RM} -rf "$P"/*`,                      0],
  ["PASS    delete: find -delete inside /tmp",      `find /tmp/x -delete`,                                     0],
  ["PASS    delete: git status",                  `git status --short`,                                      0],
  ["PASS    delete: soft git reset",              `git reset HEAD~1`,                                        0],
  // ── PUBLISH ──
  ["BLOCK   publish: git push",                    `git ${PUSH} origin main`,                                 2],
  ["BLOCK   publish: git push after &&",           `git add . && git commit -m x && git ${PUSH}`,             2],
  ["BLOCK   publish: vercel deploy",               `vercel deploy`,                                           2],
  ["BLOCK   publish: vercel --prod",               `vercel --prod`,                                           2],
  ["BLOCK   publish: npm publish",                 `npm publish`,                                             2],
  ["BLOCK   publish: gh pr create",                `gh pr create --title x`,                                  2],
  ["BLOCK   publish: docker push",                 `docker ${PUSH} img:1`,                                    2],
  ["BLOCK   publish: rsync to a remote",          `rsync -avz ./dist root@srv.example:/var/www/`,            2],
  ["BLOCK   publish: scp to a remote",            `scp f.txt host.example:/tmp/`,                            2],
  ["PASS    publish: PUBLISH prefix",             `ESPRIT_PUBLISH_OK="go received" git ${PUSH} origin main`,     0],
  ["PASS    publish: git commit alone",             `git commit -m "x"`,                                       0],
  ["PASS    publish: npm install",                 `npm install`,                                             0],
  ["PASS    publish: gh pr list",                  `gh pr list`,                                              0],
  ["PASS    publish: rsync, local only",                 `rsync -avz a/ b/`,                                        0],
  ["PASS    publish: docker build",                `docker build -t img .`,                                   0],
  ["BLOCK   publish: gh repo create --push",       `gh repo create me/x --public --push`,                     2],
  ["BLOCK   publish: gh repo create --source",     `gh repo create me/x --source=. --remote=origin`,          2],
  ["BLOCK   publish: gh repo sync",                `gh repo sync me/x`,                                       2],
  ["PASS    publish: gh repo create, no upload",   `gh repo create me/x --public`,                            0],
  ["PASS    publish: gh repo view",                `gh repo view me/x`,                                       0],
  // Prose that NAMES a blocked command must not be read as one. The guard once
  // refused a commit whose own message described the commands it blocks.
  ["PASS    publish: commit message names it",     `git commit -m "only looked at ${GH} ${PR} ${CREATE}"`,    0],
  ["PASS    publish: heredoc names it",            `git commit -F- <<MSG\nmentions ${GH} repo ${CREATE} --push\nMSG`, 0],
  ["BLOCK   publish: the command, invoked",        `git add . && ${GH} ${PR} ${CREATE} --title x`,            2],
  // ── COMBINED ──
  ["BLOCK   combined: 2 stops, only 1 prefix",  `ESPRIT_DELETE_OK="x" ${RM} -rf ~/a && git ${PUSH}`,       2],
  ["PASS    combined: 2 stops, 2 prefixes",      `ESPRIT_DELETE_OK="x" ESPRIT_PUBLISH_OK="y" ${RM} -rf ~/a && git ${PUSH}`, 0],
  // ── NEUTRAL ──
  ["PASS    ordinary command",                     `ls -la`,                                                  0],
];

let ko = 0;
const run = (payload) => spawnSync("node", [G], { input: payload, encoding: "utf8" }).status;

for (const [nom, cmd, attendu] of cas) {
  const got = run(JSON.stringify({ tool_name: "Bash", tool_input: { command: cmd } }));
  const ok = got === attendu; if (!ok) ko++;
  console.log(`  ${ok ? "✓" : "✗"} exit=${got} (expected ${attendu})  ${nom}`);
}
for (const [nom, payload] of [
  ["PASS    non-Bash tool",  JSON.stringify({ tool_name: "Read", tool_input: { file_path: `/tmp/${KIE}` } })],
  ["PASS    unreadable input", "not json"],
]) {
  const got = run(payload); const ok = got === 0; if (!ok) ko++;
  console.log(`  ${ok ? "✓" : "✗"} exit=${got} (expected 0)  ${nom}`);
}
const total = cas.length + 2;
console.log(`\n  ${ko === 0 ? `${total}/${total} pass` : `${ko} FAILURE(S) of ${total}`}`);
process.exit(ko ? 1 : 0);
