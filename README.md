<p align="center">
  <img src="assets/mark-dark.svg" width="88" height="88" alt="Esprit">
</p>

<h1 align="center">Esprit</h1>

<p align="center">
  <strong>A conduct layer for autonomous agents.</strong><br>
  The dark patterns of persuasion, turned inward.
</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/licence-MIT-C9A227.svg"></a>
  <img alt="Claude Code plugin" src="https://img.shields.io/badge/Claude%20Code-plugin-1C6B52.svg">
  <img alt="Codex hook included" src="https://img.shields.io/badge/Codex-hook%20included-1C6B52.svg">
</p>

<p align="center">
  <a href="https://selectess.github.io/esprit/"><strong>The eleven reversals, as a page →</strong></a>
</p>

---

> **Two of eleven reversals are mechanical. Nine are prose the model chooses to
> honour.** Most projects leave that ratio vague. Publishing it is itself one of
> the eleven — see [what is actually enforced](#what-is-actually-enforced).

---

## The problem

The sciences of persuasion were built to **make a human act**. Costs revealed at
the last step. Pre-checked boxes. Anchoring. Manufactured urgency. Social proof.

They work. That is the problem: **an agent applies them by default, without
meaning to**, because they saturate the commercial language it is made of.

> An agent that says *"this will take about three days"* has just anchored a human
> decision on a number it invented — with no intent, and with no one noticing.

This is not speculation. The Center for Democracy & Technology's May 2026
taxonomy of 37 chatbot dark patterns puts it plainly: *with chatbots, dark
patterns may emerge from system behaviours, rather than a deliberate intent to
deceive.*

## The idea

Esprit takes that literature and **reverses every mechanism**.

> A mechanism that makes a decision easier to obtain is the same one that makes
> it harder to examine. Esprit always chooses examination.

Eleven reversals. Nine from marketing and behavioural economics; two with no
commercial equivalent because they are specific to agents — **sycophancy** and
**anthropomorphism**.

| | Persuasion does this | Esprit does the opposite |
|---|---|---|
| 1 | Reveals fees at the last step | **Announces the cost before the commitment** |
| 2 | Trims fields to raise conversion | Asks everything in **one pass** |
| 3 | Engineers a goodbye that hooks | Ends on a **resolution**, never a hook |
| 4 | Pre-checks what suits the seller | Pre-decides only what **undoes in one command** |
| 5 | Anchors with a struck-through price | **No number without its provenance** |
| 6 | Frames as loss to force action | Reports loss and gain **in the same terms** |
| 7 | "10,000 satisfied customers" | Cites the **mechanism**, never the headcount |
| 8 | Manufactures countdowns | Urgency carries **a date and a source** |
| 9 | Never shows uncertainty | **States its holes**, and what it cannot do |
| 10 | Flatters to retain | **Contradicts when it disagrees** |
| 11 | Simulates attachment | **No affect used as a lever** |

## What is actually enforced

This is the part most projects leave vague. Esprit publishes it as a table.

**Two of eleven reversals are mechanical. Nine are prose the model chooses to
honour.** Saying so is itself reversal 9.

### The autonomy contract

Esprit acts alone on everything reversible. It stops dead on three acts — and a
`PreToolUse` hook enforces all three:

```bash
node kie.mjs shot …                                  # ⛔ refused
ESPRIT_BUDGET_OK="~3 USD, approved" node …           # ✓ passes

rm -rf ~/project/old                                 # ⛔ refused
ESPRIT_DELETE_OK="duplicate, diff -rq empty" rm …    # ✓ passes

git push origin main                                 # ⛔ refused
ESPRIT_PUBLISH_OK="reviewed, go received" git …      # ✓ passes
```

**The guard forbids none of these acts. It forbids them being silent.** The prefix
writes the announcement into the session transcript; what is not announced is not
executable.

This is not a spend cap. It is **informed consent, mechanised**.

### The anchoring detector

A `Stop` hook reads the last assistant message from the transcript and flags
asserted numbers with no provenance. It **warns, it does not block** — a blocking
Stop hook re-runs the agent, and an imperfect detector would loop on legitimate
answers.

Precision came from one insight: **the discriminator is not the number, it is what
precedes it.**

```
"the average basket is 3,000 MAD"   → asserts  → flagged
"a product at 3,000 MAD"            → illustrates → ignored
```

Measured on a 1,691-line corpus:

| Stage | Flags |
|---|---|
| Lexical matching alone | 34 — unusable |
| \+ grammatical assertion filter | 3 |
| \+ hypothetical-comparison filter | 1 — a true positive |
| After correcting the corpus | **0** |

**It is bilingual, and that is a correctness property rather than a nicety.**
Until v1.1 both gates held French patterns only, and the assertion gate is hard.
Four identical assertions, written twice, scored **3 in French and 0 in English**
— not fewer, blind. An English-speaking user would have installed Esprit, watched
the hook run on every turn, seen nothing reported, and concluded it worked, while
half of everything Esprit mechanically enforces was dead. That is precisely the
silent false negative the detector's own header calls worse than a noisy false
positive. Both grammars now run on every text, with no language detection, so a
mixed-language document works too.

```bash
node plugins/esprit/scripts/anchor-lint.mjs --self-test   # 26/26: 14 FR, 12 EN
```

## Install

```bash
claude plugin marketplace add selectess/esprit
claude plugin install esprit@esprit
```

Then `/esprit:esprit`, or simply *"take over"*.

Hooks activate on the next plugin load, not at install.

### Codex

`plugins/esprit/.codex/hooks.json` ships both hooks with Codex paths. They are
plain Node reading JSON on stdin, so there is no proprietary mechanism involved.

Be precise about what that has and has not been tested. The hook's own command,
`node ".agents/skills/esprit/scripts/guard.mjs"`, was executed from a project
root laid out the way the config assumes: it refuses `git push` and `rm` with
exit 2, lets `ls -la` through with exit 0, and emits the expected decision JSON.
**What remains unverified is Codex's hook schema itself** — whether Codex reads
`matcher`, `type: command` and the `Stop` event the way this file assumes. That
needs Codex, and this has never run there.

The path is relative on purpose and is the fragile part: it resolves only from
the project root, with the skill installed under `.agents/skills/esprit/`.

## Layout

```
plugins/esprit/
├── skills/esprit/SKILL.md   the conduct: 11 reversals, 3 stops, sources
├── hooks/hooks.json         PreToolUse + Stop
├── .codex/hooks.json        same hooks, Codex paths — untested
└── scripts/
    ├── guard.mjs            the three stops
    ├── guard.test.mjs       45-case suite
    ├── anchor-lint.mjs      the anchoring detector, bilingual, 26-case suite
    └── stop-anchor.mjs      Stop hook, warn-only
```

```bash
node plugins/esprit/scripts/guard.test.mjs plugins/esprit/scripts/guard.mjs
node plugins/esprit/scripts/anchor-lint.mjs --self-test
```

## What Esprit is not

- **Not a security guardrail.** It caps nothing and protects against no attack.
  [AgentOps](https://github.com/garethdaine/agentops) and
  [compass](https://github.com/dshakes/compass) do that, and have done it longer.
- **Not self-modifying.** Domain knowledge may evolve from measured evidence;
  conduct never does. *The layer that governs change cannot be modified by what it
  governs.*
- **Not neutral.** Every rule costs speed, fluency, sometimes a yes you would
  otherwise have obtained. That is the deliberate price of examinable conduct.

## Where this sits

The Agent Skills format has been an open standard since December 2025, adopted
across 26+ platforms. Blocking hooks are documented and common. Conduct plugins
exist. **None of the mechanism here is new.**

What is unusual is the angle. Skill governance in 2026 works on **provenance
before installation** — is this skill trustworthy? Esprit works on **conduct
during execution** — how does the agent behave while using any skill, trustworthy
or not.

A perfectly safe skill can still lead an agent to anchor a decision on an invented
number. No provenance model catches that.

This is not an invention. It is a blind spot, correctly identified.

## Known debts

- **Reversals 8 and 10 deserve a hook and have none.** Detecting manufactured
  urgency or an unearned agreement in free text is unsolved.
- **The guard is bypassable** by one level of indirection — `eval`, a subshell, a
  script. It stops a distracted agent, not a determined one. That is the intended
  scope: the thesis is that manipulation here is *unintentional*.
- **Codex's hook schema has never been exercised.** The hooks' commands run and
  behave correctly against the documented layout, but no Codex runtime has ever
  loaded the config that invokes them.

## Sources

[CDT, *Dark Patterns in AI Chatbots*](https://cdt.org/insights/dark-patterns-in-ai-chatbots-a-taxonomy-to-inform-better-design/) (May 2026) ·
[DarkBench](https://arxiv.org/abs/2503.10728) (ICLR 2025) ·
[Emotional Manipulation by AI Companions](https://arxiv.org/abs/2508.19258) (HBS 2025) ·
[Baymard Institute](https://baymard.com/) · Kahneman, peak-end rule

## Licence

MIT, © 2026 Mehdi Wahbi.

The page under `docs/` is driven by **[scrollcraft](https://github.com/nateherkai/scroll-craft)**,
a scroll-driven interaction runtime by Nate Herk, vendored as `docs/scrollcraft.js`
and `docs/scrollcraft.css`. It is MIT too, and its notice travels with it in
`docs/scrollcraft.LICENSE`. The engine is used unmodified; every effect on the
page is authored in `docs/index.html` against its `data-sc-*` attributes.
