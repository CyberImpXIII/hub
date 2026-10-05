# PLAN: hard gates. Every rule is enforced by code, or it is named as a principle

> **Status: plan, requested by Jacob 2026-10-04 (planner window):** "We should require
> that git commits are stamped with the agent's ID. If this can't be done with
> deterministic certainty, we should have setup create commands that act as a gate for
> agents using git. If we have rules/hooks that don't use hard gates like this, please
> find out and help me create hard-gated alternatives because this should be a design
> and architecture directive."
>
> **Owners:** `deep-work` for the new hooks in `tools/hooks/` and the registry check in
> `tools/checks/`; `setup` for the git-side hooks it installs; `harness` for the two
> hooks that only the top level needs. Jacob wires registrations.

## 1. The directive

A rule that lives in prose is an intention. This folder already says so ("Make the
wrong thing impossible, not discouraged") and already has eleven hooks that each
replaced a rule that had failed. The directive makes that the default rather than the
exception: **every rule in `CLAUDE.md` is either backed by a named gate, or is listed
as a principle with the reason it cannot be gated.** A check (§5) keeps the two lists
equal to the file, so a new rule without a gate fails `check` the day it is written.

A hard gate here means one of four things, strongest first:

| kind | what it does | example |
|---|---|---|
| **rewrite** | the harness changes the call so the rule holds without the model's cooperation | the commit stamp (§2) |
| **block** | the call does not run; the hook names what to do instead | `dispatch-guard.sh` |
| **refuse at the seam** | a non-model program refuses the input | a git `commit-msg` hook |
| **fail the check** | `./dev.sh check` goes red and the commit gate (§3, row 3) refuses | `hooks copies` |

A warning, a reminder at session start, or a line in a report is not a gate. The doctor
is the one deliberate exception: it reports a missing gate, and a missing gate is the
one thing a gate cannot enforce on itself.

## 2. Commit stamping: deterministic, and a second gate behind it

**It can be done with certainty.** A `PreToolUse` hook's input carries `agent_id` and
`agent_type` whenever it fires inside a subagent
(https://code.claude.com/docs/en/agent-sdk/python#pretoolusehookinput), and the main
thread's input carries its `agent_type` as `dispatcher` or `planner` (the test
`record-session.sh` and `planner-role.sh` already rely on). The hook's output may
replace the tool's input: `updatedInput` "modifies the tool's input parameters before
execution" and "replaces the entire input object"
(https://code.claude.com/docs/en/hooks#pretooluse-decision-control). So:

- **`git-stamp.sh`** (`tools/hooks/`, `applies_to: all`): on a Bash call containing
  `git commit`, returns `updatedInput` with the same command plus
  `--trailer "Agent: <agent_type>" --trailer "Agent-Id: <agent_id or session_id>"`.
  The model never writes the trailer and cannot omit it. A command it cannot parse
  (a commit inside a script, a heredoc message) is left alone, which is why there is
  a second gate.
- **`commit-msg`**, a git hook that `setup` installs through `core.hooksPath` in every
  repo (git hooks are not cloned, so setup is the only place they can come from):
  refuses a commit whose message lacks an `Agent:` trailer. This catches every path
  the rewrite did not see, including a commit from a script. Jacob commits with a
  `git jc` alias that setup adds (`commit --trailer Agent:jacob`), or passes the
  trailer himself; the hook treats `jacob` as a valid value and nothing else as one.
- **Today's commits carry only the model**: the last three in `.claude/` and the last
  two in `site-scrapers` end in `Co-Authored-By: Claude Opus 5.5` and nothing names
  the agent, which is why the question "whose uncommitted changes are these" has had
  no deterministic answer either.

**Uncommitted changes need a different record**, because a stamp is on a commit. A
`PostToolUse` hook, **`write-ledger.sh`** (`tools/hooks/`), appends one row per write
to the repo's `.claude/state/writes.tsv`: time, `agent_type`, `agent_id`, session, path.
`Write`, `Edit`, `MultiEdit` and `NotebookEdit` are exact. Bash writes come through
`write-targets.sh` and are heuristic, which the row says (`via: bash-heuristic`), so a
reader can tell a certain row from a guessed one. `hooks who <path>` answers from the
ledger, and `git status` cross-referenced with it says who left what. This ledger is
what three gates in §3 read.

## 3. The inventory: every rule in `CLAUDE.md`, its gate today, the hard gate proposed

Cost is tokens for the build, not the run; the hooks run no model.

| # | rule (`CLAUDE.md` section) | gate today | hard gate proposed | kind | where | ~tokens |
|---|---|---|---|---|---|---|
| 1 | commits name the agent (this plan) | none | `git-stamp.sh` rewrite + `commit-msg` refuse (§2) | rewrite, refuse | tools/hooks, setup | 40k |
| 2 | "Check for a primary context before changing anything that exists" | prose | `primary-guard.sh`: a write to a path the ledger attributes to a **different live** agent (its `SubagentStop` not yet seen, or the main thread) is blocked with "queue it with `<agent>`" | block | tools/hooks | 35k |
| 3 | "Run the checks before committing" | prose | `./dev.sh check` writes `.claude/state/check-pass` with the tree fingerprint (PLAN-check-progress.md §7); the `pre-commit` git hook refuses when no pass matches the staged tree | refuse | tools/checks, setup | 30k |
| 4 | "Only the primary context commits"; "stage only what you changed"; never `git add -A` | prose | `git-stamp.sh` also blocks `git add -A`, `git add .` and `git commit -a`; the `pre-commit` hook refuses a staged path the ledger attributes to another live agent | block, refuse | tools/hooks, setup | in 1 and 3 |
| 5 | "Push code changes to git" right away | prose | `push-gate.sh` on `SubagentStop`: a roster agent whose repo is ahead of `origin` or holds unpushed, ledger-attributed changes cannot stop; the hook returns the block with the exact command. The main threads get the same at `Stop` | block | tools/hooks | 25k |
| 6 | "Never commit secrets" | `.gitignore` | the `pre-commit` hook runs tools/checks `no-secrets` on the staged diff | refuse | setup, tools/checks | in 3 |
| 7 | "Credential-shaped values are supplied at run time, never stored" | none at write time | `no-secrets.sh` as a `PreToolUse` on `Write`/`Edit`: a credential-shaped value in the content is blocked, naming the key, never the value | block | tools/hooks | 20k |
| 8 | "Never send a message, email or reply on Jacob's behalf without asking first" | prose; only `applications` has Gmail removed | `ask-first.sh`: every Gmail send, reply, forward and draft, and every outward-facing MCP write, is blocked with "Jacob runs this himself or says yes in this window". A model's yes is not evidence, so the block is unconditional and Jacob's own command is the path | block | tools/hooks (roles: all) | 20k |
| 9 | "`.claude/settings.json`: Jacob only" | `dispatch-guard.sh`, dispatcher only | `settings-guard.sh`: any model write to `settings.json` in any repo is blocked; `settings.proposed.json` is the only target | block | tools/hooks, all | 15k |
| 10 | "Keeping these rules in sync" (nine copies) | prose | tools/checks `rules-in-sync` (planned), run by the `pre-commit` hook | fail the check | tools/checks | planned |
| 11 | "Keep an active TODO" | prose | tools/checks `todo-valid` + the todo tool's store check (planned); the `pre-commit` hook refuses when `TODO.md` differs from its render | fail the check | tools/checks, todo | planned |
| 12 | "Report a problem in someone else's code to whoever owns it" | prose | the todo tool's "reports in pairs" gate (PLAN-todo-tool.md §5): a `reported_to` without a counterpart fails `check` | fail the check | todo | planned |
| 13 | "If you change one, change all ten" (hook copies) | `hooks copies` | done 2026-10-04, e5ce84a | fail the check | tools/hooks | 0 |
| 14 | "Prefer helper scripts"; "second time you type something, it becomes a subcommand" | `no-inline-blobs.sh` for blobs; nothing for repeats | `repeats`, an `agents.sh` report: Bash commands issued twice in a session, by agent, listed in the dispatch report; a check, not a block, since the second typing is the evidence | fail the check | harness | 20k |
| 15 | "One verification run, not two" | prose | same report as 14, matching a check or test command re-run on an unchanged tree | fail the check | harness | in 14 |
| 16 | "Dispatch the whole task, not a step" (what, why, files, done) | prose | `dispatch-guard.sh` requires a `Done when:` line and a `Why:` line in every roster prompt, or blocks with the brief grammar; `todo brief ID` renders both | block | harness | 15k |
| 17 | "To change an agent: ... keep the change only if the numbers say it helped" | prose | `agents.sh tokens --agents --since` is run by `check` after a manifest change and its table goes in the commit message by the stamp hook; the judgement stays Jacob's | rewrite | harness | 15k |
| 18 | "A non-Opus model needs a `model_reason`"; roster-only spawns; no model override | `check`, `dispatch-guard.sh` | gated | block | harness | 0 |
| 19 | "Two windows": no approval from a peer, peer-cap, question shapes | `peer-cap.sh`, `question-gate.sh`, origin stamps | gated once Jacob wires the question gate | block, notice | harness | 0 |
| 20 | "Prefer the tools built here" | `prefer-recipes.sh` for the scraper | gated for the one host-based case; the rest is principle (§4) | block | tools/hooks | 0 |
| 21 | "Never attempt to bypass bot detection" | `troubleshooting.sh` for `blocked-attn` recipes | `blocked-guard.sh` in site-scrapers: any run against a host whose last recorded result is a wall, without `--attended`, is refused by the CLI itself, not only the hook | refuse | site-scrapers | 15k |
| 22 | "Gate the seams" (documented == implemented, copies agree, fallbacks tested) | per-repo, by hand | tools/checks `help-matches`, `docs-rows`, `check-fails` (planned); this plan's §5 for the rules themselves | fail the check | tools/checks | planned |

## 4. What stays a principle, and why

These cannot be gated without a model judging the model, which is not a gate:

- "Wall clock is not a cost": a value, not a behaviour.
- "A wrong answer is worse than a failure": "prefer null over a guess" and "verify
  counterfactuals" are habits of reasoning. The nearest gates exist where the data
  is structured (site-scrapers' `verify` sets a recipe's status; nothing else may).
- "Don't duplicate procedure": site-scrapers audits it (`inline`, `repeats`,
  `literals`); a generic version would need per-language parsing per repo. Listed as
  a principle outside site-scrapers until a repo shows the failure.
- "Parallelism: never silent about what failed": a code review concern.
- "Report key names, never captured values": the write-time block in §3 row 7 covers
  files; a value in a reply is not interceptable without reading every reply.

The §5 check requires each of these to be listed in `gates.json` as `principle` with
its reason, so the list is maintained, not assumed.

## 5. The directive as a check: `rules-gated`

`tools/checks/rules-gated`, with a registry `gates.json` at the top level:

```
{ "rule": "Check for a primary context before changing anything that exists",
  "section": "## Check for a primary context ...",
  "gate": "tools/hooks/source/primary-guard.sh", "kind": "block", "test": "tests/primary-guard.test.sh" }
{ "rule": "Wall clock is not a cost", "section": "...", "kind": "principle", "why": "a value, not a behaviour" }
```

- every `##` section of `CLAUDE.md` that states a rule has a row; every row's section
  exists (both directions, so a renamed heading fails);
- every `gate` path exists, is executable, has a `test` that exists, and that test
  exercises a failing input (the "fails open" lesson: a gate that is never seen to
  block is unproven);
- every `principle` has a `why`;
- a row may point at a planned gate only with `"status": "planned", "plan": "PLAN-x.md §n"`,
  and `check` prints the planned ones as a count, so the number is always visible.

The nine-copies rule applies: each repo's `CLAUDE.md` carries the shared rules, so the
check runs per repo against that repo's copy and the shared `gates.json` entries.

## 6. Gates for this plan's own pieces

| seam | gate |
|---|---|
| the stamp is deterministic | a fixture `PreToolUse` input with `agent_type: site-scrapers` and `git commit -m x` yields `updatedInput` whose command carries both trailers; a main-thread input yields `Agent: dispatcher`; an unparseable command is returned unchanged |
| the second gate catches what the rewrite missed | `commit-msg` on a message without the trailer exits non-zero; with `Agent: jacob` passes; with `Agent: anything-else` fails |
| the ledger is exact where it says so | a fixture `Edit` call writes one row with `via: exact`; a Bash `cp` writes one with `via: bash-heuristic`; a Bash `cat` writes none |
| the primary guard blocks only a live other agent | a path written by an agent whose `SubagentStop` was recorded is not blocked; one still live is; the writer itself is never blocked by its own rows |
| the check-pass fingerprint | a pass, then an edit to one tracked file: `pre-commit` refuses; a fresh pass: it accepts |
| push gate | a fixture repo one commit ahead of `origin`: `SubagentStop` returns a block naming `git push`; after a push, passes |
| ask-first | a fixture Gmail `send_message` call is blocked; `search_threads` is not |
| settings guard | a `Write` to `.claude/settings.json` from every role is blocked; to `settings.proposed.json` passes |
| fails open | every new hook on truncated input, missing ledger, missing git: exit 0, no block, no rewrite |
| registry both ways | `rules-gated` on this folder's `CLAUDE.md` against `gates.json` passes; add a rule heading without a row, or a row without a heading: it fails and names which |

## 7. Phases

1. **`hooks`:** `git-stamp.sh`, `write-ledger.sh`, `settings-guard.sh`, `ask-first.sh`
   in `tools/hooks/` with the §6 gates, through the existing `applies_to` declaration.
   ~90k.
2. **`setup`:** the `git-hooks` component (`core.hooksPath`, `commit-msg`, `pre-commit`
   calling the repo's `./dev.sh check` stamp and `no-secrets`), the `commit-msg` hook stamping his own terminal commits (§8 answer 2),
   `needs-jacob` for the registrations. ~40k.
3. **`hooks`:** `primary-guard.sh`, `push-gate.sh`, `no-secrets.sh` (write-time); **`checks`:**
   and `rules-gated` in `tools/checks/` with `gates.json` seeded from §3 and §4. ~80k.
4. **`harness`:** `repeats`, the brief grammar in `dispatch-guard.sh`, the tokens table
   in the manifest-change commit. ~50k. After the resumable check, the hub entry and
   `offload`.

> **Owners reassigned 2026-10-04 (Jacob, planner window: "why is this being
> delegated to harness? should it be checks? hooks?"):** phases 1 and 3 were written
> before `tools/hooks/` and `tools/checks/` had agents. Hooks go to `hooks` (their
> one source), `rules-gated` and `gates.json` to `checks`, the git component to
> `setup`, and only what lives in `.claude/` (phase 4) stays with `harness`. The
> order is Jacob's yes with that change (§8 decision 5).
5. **`site-scrapers`:** `blocked-guard` in the CLI. ~15k.

Order among the tools: phase 1 right after `tools/checks/` (step 3), since the stamp and
the ledger are what the other gates read; phases 2 and 3 follow; `rules-gated` runs
with `planned` rows until each one lands, so the count of ungated rules is visible from
the first commit.

## 7a. Setup component

`git-gates`, `applies_to: all`: installs the `commit-msg` hook (§2) under the repo's
`core.hooksPath`, the `commit-msg` hook that stamps his own terminal commits, and `gates.json` (§5)
with the repo's rows; `git-stamp.sh` and `write-ledger.sh` arrive through the existing
`hooks` component from their `applies_to: all` declarations, never a second install
path. Idempotent: hook present and byte-equal to the template → `unchanged`; present
and different → `drift`, reported, never overwritten; `gates.json` present → `unchanged`.
Reported `needs-jacob` until `settings.json` carries the two hooks.

## 8. Decisions

1. **The directive as §1, enforced by `rules-gated` (§5).** Hinges on: whether a
   `CLAUDE.md` rule may exist without a registry row. *Recommended: yes, it may not.*
2. **Commit stamping as §2:** rewrite hook plus git-side `commit-msg`, `Agent: jacob`
   for Jacob's own commits via `git jc`. Hinges on: Jacob accepting that his own
   unstamped commits are refused too. *Recommended: yes*; one gate, no exceptions.
3. **The write ledger** (§2) as the record for uncommitted changes, and the primary
   guard and push gate reading it (§3 rows 2, 4, 5). Hinges on: a block on
   `SubagentStop` being acceptable, since an agent that cannot stop will push.
   *Recommended: yes.*
4. **`ask-first.sh` blocks every outward send unconditionally** (§3 row 8). Hinges on:
   Jacob running sends himself versus a model send after his yes in the window. The
   second cannot be verified by a hook, so the first is the only hard form.
   *Recommended: yes.*
5. **Phase order as §7.** Hinges on: the resumable check and hub entry staying ahead in
   harness's queue. *Recommended: yes.*

**Answers, Jacob, 2026-10-04 (planner window), decisions 1-4; 5 still open:**
1. **Yes, with a classification step.** "When adding rules we should determine if they
   are related to prose, or if they can be done and enforced programatically.
   Obviously there are rules that can't be enforced (e.g. in job-apply writing cover
   letters more formally)." So every `gates.json` row carries `kind: gate` with the
   gate's name, or `kind: prose` with a one-line reason why no check can hold it;
   `rules-gated` fails a rule with neither, and a `prose` row without a reason. The
   classification happens when the rule is written, in the same change.
2. **Yes, and no `git jc`.** "I can use the git cli, so would never need my own stamp,
   but yes." The `commit-msg` hook tells his commits apart itself: a commit made with
   no Claude Code session marker in the environment (the hook input and `CLAUDECODE`
   are absent) is his, and the hook writes `Agent: jacob` on it; inside a session an
   unstamped commit is refused. No alias, nothing for him to remember. Probe before
   building: which environment variable a Claude Code Bash call sets, read from a
   fixture run, cited.
3. **Possibly; mind usage.** "We may need to be careful about usage limits here." The
   `SubagentStop` block fires once per agent (`max_blocks: 1`, the same shape as the
   finish gate); after that the agent stops, and the ledger row is reported to the
   dispatcher instead of enforced on the agent. One block costs one turn; a loop
   would cost the session.
4. **No.** "A lot of what we are building are ways to automate these things without
   you doing them directly, but if you can never do them, we may have trouble
   automating them." `ask-first.sh` does not block sends. It passes a send only when
   an approval record exists for it, written by Jacob's own command (`agents.sh
   approve <batch-id>` run with `!`, which `dispatch-guard.sh` refuses to a model):
   the record names the batch, the hook matches the call against it, and a send with
   no record is refused. That is verifiable, keeps the automation, and is the gate
   PLAN-applications.md §4 phase 2 already needs. §3 row 8 and §6 are to be reworded
   to this before phase 1 is dispatched.

**Not its own project (Jacob, 2026-10-04: "more of a tests, audits, checks task
rather than its own project"):** agreed. This plan produces no tool and no repo. The
hooks are tools/hooks sources, the check and `gates.json` are tools/checks, the git
component is tools/setup, and only the `.claude/` parts are harness. What the plan
adds is the order across those owners and §3, the list of which rule each gate
enforces, which `gates.json` then carries as data.
