# A tools folder: what in harness's plans is not harness, and ships beside it

> **Status: plan, requested by Jacob 2026-10-03.** His words: "I think todo can be in
> a new tools folder, especially because my next suggestion is that we look at the
> harness todo and try to abstract other aspects into parallel tasks and tools. The
> context filtering for example, while useful, is not contingent on the manifest
> agent grouping to be so." Owner: the planner for this file; `deep-work` for each
> extraction; `harness` only for what stays. **§6 all "yes" from Jacob, 2026-10-03, in the planner window** ("Yes to the four decisions regarding tools"). Phase 1 of §4 waits on PLAN-todo-tool.md §8.

## 1. The criterion

A piece belongs in `tools/` rather than `.claude/` when **it reads no roster**: not the
manifest, not the agent definitions, not the ledger's agent names. It takes a path, a
transcript or a settings file, and it would work in a repo that has never heard of the
dispatcher. Installing it may still go through `wiring.json` (a hook is a hook), but
that is installation, not dependence, and it is the same seam every hook copy already
crosses.

The reason is Jacob's: those pieces are blocked today only by sharing a queue with the
roster work, and a `harness` job is the most expensive kind here. Extracted, each is an
ordinary tool with its own folder agent, its own `dev.sh check`, and its own repo, built
by `deep-work` in parallel with whatever harness is doing.

**Gate for the criterion:** a direction audit per extracted tool (nothing under it
reads `.claude/`, names a roster agent, or imports from `.claude/lib`), run by its
`check`. The same audit PLAN-todo-tool.md §5 already has.

## 2. What the lib says today

Of the 27 files in `.claude/lib/`, the ones that read the manifest are the roster's
own: the ledger, the schema, the guard, the quote, peer-cap, the relay gate. The ones
that do not are a cluster: transcript reading (`transcript-kinds.jq`,
`session-facts.jq`, `recent-prompts.jq`, `peer-turns.jq`), the token audit
(`tokens.jq`, `agent-tokens.jq`, `prompt-cost.jq`), and the section parser
(`dispatch-section.sh`). That cluster is a tool already, in everything but location.

## 3. Candidates, in the order they pay

| tool | from | what it is without the roster | depends on harness? |
|---|---|---|---|
| `tools/todo/` | PLAN-todo-tool.md | per-repo items, rendered `TODO.md`, paired reports | no; harness consumes it later |
| `tools/transcripts/` | `agents.sh tokens`, `lib/transcript-kinds.jq`, `tokens.jq`, `prompt-cost.jq`, `session-facts.jq` | token and turn accounting over `~/.claude/projects/*.jsonl`: per session, per model, per prompt, cache read/write split, cold rebuilds. The price table moves with it (one source). `agents.sh tokens --agents` keeps the per-agent view by calling it with the roster's names as an argument | no; `agents.sh` becomes a caller |
| `tools/context-hygiene/` | PLAN-context-hygiene.md C2, C4, and the research scripts already in `scriptingTools/context-hygiene/research/` | the status line with the cold-cache guard, the bulky-output shrinker for named tools, the compaction-window bundle. None of it knows what an agent is; Jacob's point exactly | no; wiring installs its hooks like any other |
| `tools/setup/` | PLAN-repo-setup.md | the installer that brings a repo to zero drift: shared rules block, hook copies, `TODO.md`/`todo.json`, check command; routing-tree §12's declared sync is its sync step | no; the roster is one of the things it installs, from a list it is given |
| `tools/hub/` (later) | PLAN-routing-tree.md §7 "one command, portable" | the node server: envelope, routing, dead-letter, origin stamp. Designed portable already; it reads a node config, not the manifest | not by design; the top node's config names the roster, the program does not |

Stays in `.claude/`, because it *is* the roster: the manifest and `gen`, `check`,
`doctor`, `wiring`, the dispatch guard, the quote, peer-cap, the ledger of spawns,
agent-watch, and the two window-specific Stop gates (auto-relay, question-routing)
until `hub` absorbs them.

## 4. Order and cost

*Reordered 2026-10-03: setup goes first.* Jacob asked for new tools to be scaffolded
by the dispatcher ("we ultimately WILL be relying on dispatcher to create new folders
and initialize git and agents in those new folders"). The dispatcher may run a tool
but may not write by hand, so the scaffolding tool has to exist before the first
scaffold. That tool is PLAN-repo-setup.md §2, with the `agent` component left to
harness (the manifest is harness's) and everything else portable.

1. **`tools/setup/`**, `deep-work`, one job: PLAN-repo-setup.md §2 minus the `agent`
   and `server` components (those print "needs harness" and the manifest line to
   add); `--github` creates a **public** repo by default, `--private` on request;
   its own `dev.sh check`; the direction audit; gates from PLAN-repo-setup.md §3.
   This is the one tool that is scaffolded by hand, since nothing exists to scaffold
   it. ~150k tokens.
2. **`tools/hooks/`**, `deep-work`, one job, right after setup (approved 2026-10-03,
   §7): the three generic hooks, `write-targets.sh` and their tests as one source;
   each hook carries a small declaration (`applies_to: all | repos | roles`) that
   setup's `hooks` component reads to decide where it is installed. **Plug-in
   aspect (Jacob):** "there will have to be some plug-in aspect with harness when
   it's finished as role-specific hooks are also important." So the install
   interface is the product: harness (and later each hub role) contributes
   role-specific hooks through the same declaration and the same `setup hooks`
   step, never by a second mechanism. The eight hand copies retire when setup has
   installed from this source into every repo and the copies comparison reads from
   it. ~150k tokens.
3. **`tools/checks/`**, `deep-work`, one job, approved 2026-10-03 (§8, Jacob:
   "yes" to all three): the generic pre-commit gates (`help-matches`, `rules-in-sync`,
   `hooks-installed`, `todo-valid`, `no-secrets`, `tree-clean`, `check-fails`,
   `docs-rows`, `no-roster`) as one source with the same `applies_to` declaration
   as hooks; `checks run` from each repo's `dev.sh check`, `checks all` from the
   top. Runs in parallel with todo. ~200k.
4. **`tools/todo/`**: scaffolded by the dispatcher with `setup tools/todo --github`,
   then built by `deep-work` (PLAN-todo-tool.md §6). Runs alongside addon-bench.
5. **`tools/transcripts/`**, `deep-work`, one job: move the jq cluster and the price
   table, give it a CLI and tests, make `agents.sh tokens` a thin caller, prove the
   numbers unchanged on three fixed sessions before and after. ~150k tokens. This
   one also unblocks the Fable price row and the interim-rules counts without a
   harness turn.
6. **`tools/context-hygiene/`**, `deep-work`, C2 then C4, each with the measurement
   PLAN-context-hygiene.md names (average context per request, cache reads per prompt,
   seven days before and after). C1 and C3 are settings and stay Jacob's. **Pinned
   2026-10-03:** Jacob has a larger project, not yet described, that should set the
   order in which this functionality is built; its §6 decisions 1 and 3 wait for that.
7. **`tools/hub/`** is routing-tree phase 1, in its own time; this plan only fixes its
   home.

Each is a new tool here, so each gets the folder agent, the rules copy, the hooks via
§12 S1 rather than by hand, and the tool-table row. From the second one on, the
dispatcher scaffolds it with setup.

## 5. Setup component

`tools/` is a convention, not a component: a folder whose members pass the direction
audit. Setup phase 2 treats each member as an adopter.

## 6. Decisions (all answered "yes" by Jacob, 2026-10-03)

1. **The folder is `tools/`, new, at the top level,** rather than `scriptingTools/`,
   which already holds two tools and one research folder and would blur the criterion.
   *Recommend yes.* PLAN-todo-tool.md §8 decision 1 changes to `tools/todo/` with this.
2. **The criterion in §1 and its audit are the membership rule.** *Recommend yes.*
3. **Order as in §4,** with `transcripts` second because it unblocks two approved items
   without a harness turn. *Recommend yes.*
4. **Each extraction is a `deep-work` job, not a `harness` one,** with harness only
   trimming its own callers afterwards. *Recommend yes.*

## 7. What harness is, conceptually, and the rest of what leaves it

> Added 2026-10-03 after Jacob asked: "Can you describe conceptually what harness is
> doing? Are there no more bits of functionality that should be separated?"

`.claude/` is about 8,200 lines across `agents.sh`, 11 hooks and 27 library files. It
does six different jobs that happen to share a folder:

| job | what it is | files | reads the roster? |
|---|---|---|---|
| **A. Roster** | who exists, on which model, with which tools, owning which folder; rendered read-only | manifest, `gen`, `agents/*.md`, `manifest-schema.jq`, `effective.jq` | it *is* the roster |
| **B. Policy guards** | who may write where and spawn whom; the quote of Jacob's words on each spawn | `dispatch-guard.sh`, `quote-words.sh`, `grant` | yes |
| **C. Generic guards** | rules about *how* work is done, true in any repo: no inline blobs, use the recipe, don't re-run a blocked recipe unattended | `no-inline-blobs.sh`, `prefer-recipes.sh`, `troubleshooting.sh`, `write-targets.sh` (the shell-command parser they share) | **no** |
| **D. Window messaging** | two main threads reaching each other: the relay, its section parser, the cap, the role note, the session record | `auto-relay.sh`, `peer-cap.sh`, `planner-role.sh`, `record-session.sh`, `dispatch-section.sh`, `relay-gate.sh`, `relay-*.jq`, `peer-*.jq` | mostly no (the cap and the role note read agent names) |
| **E. Telemetry** | what was spawned, when it went quiet, what it cost | `agent-watch.sh`, `dispatch-ledger.sh`, `agent-ledger.*`, `spawn-event.jq`, `tokens`, `spawns`, `dispatches`, `*-tokens.jq`, `prompt-cost.jq`, `transcript-kinds.jq`, `session-facts.jq` | recording no; interpretation yes (stale minutes, agent types) |
| **F. Self-check and install** | does the layer match its own description: `check`, `doctor`, `wiring` → `settings.proposed.json`, the eight-copies comparison, `pair` | `agents.sh check/doctor/wiring/pair`, `wiring.json`, `wiring.jq`, `session-doctor.sh` | yes, as the thing it checks |

**What harness irreducibly is: A and B, the roster and the policy over it,** plus the
part of F that checks them. Everything else is mechanism the roster configures, and
mechanism that reads no roster is a tool by §1's criterion.

Beyond §3's five, the criterion names two more, one strong and one not yet:

| tool | from | why it leaves | depends on harness? |
|---|---|---|---|
| **`tools/hooks/`** (strong) | row C, plus `check-hooks.sh` and the per-hook tests | These three hooks and their parser live in **eight hand-kept copies** because a hook fires only from the project that holds it. One source under `tools/hooks/`, installed into each repo by `setup`'s `hooks` component, turns "if you change one, change all eight" into "change one, run setup", and the copies comparison becomes setup's drift check. `write-targets.sh` comes with them: a pure function over a command string, with its own tests, usable by any future guard. | no; `dispatch-guard.sh` keeps calling `write-targets.sh` by path, and setup installs the copies |
| **`tools/ledger/`** (not yet) | row E's recording half | The recorder takes hook input and appends an event; it needs no roster. But the useful views (`spawns`, stale alerts, per-agent cost) all read the manifest, and `transcripts` (§3) already takes the roster-free token half. Splitting the recorder alone saves nothing today. Revisit when `hub` exists, since the hub records its own conversations and the ledger becomes its log. | yes, for every view |

Row D is `hub` (§3): the relay, the cap and the parsers are the first node's inbox,
written before there was a node. Row F's `pair` is a 60-line AppleScript opener that
can move into `setup` as `setup pair` when setup exists; not worth a job of its own.

**After all of this, harness is:** the manifest, `gen`, `dispatch-guard.sh`,
`quote-words.sh`, `grant`, `check`, `doctor`, `wiring`, and the manifest-reading views
over data that tools record. Roughly a third of today's lines, every one of them
about who the agents are and what they may do. That is the shape Jacob asked for:
harness programmatises the roster; everything else is a tool the roster uses.

§4's order has `tools/hooks/` right after `setup` (it is setup's first real
`hooks` component payload) and before `transcripts`.

**Decided 2026-10-03 (Jacob, planner window):** `tools/hooks/` yes, "but also I think
there will have to be some plug-in aspect with harness when it's finished as
role-specific hooks are also important"; its place right after setup, yes; the ledger
stays until hub, yes, "and this speaks to the bigger project I was going to explain to
you." The plug-in aspect is folded into §4 step 2: one declaration per hook saying
where it applies, one install step that reads it, so a role-specific hook from harness
and a generic one from this tool arrive the same way. Hold both this and the ledger
deferral against the bigger project when he describes it.

## 8. Reusable checks, managed from the top: `tools/checks/`

> Added 2026-10-03 after Jacob: "Also worth thinking about is if there are reusable
> tests and audits that can be managed from the top down as well, instead of
> re-writing all of them."

**Where things stand.** Six of the seven tool repos have a `dev.sh` with a `check`
(emailTools has a `tests/` folder and no `dev.sh`). The subcommand names that recur
across them are `check` and `test` (every one), `hooks` (4), `audit` and `clean` (3),
`sync` (2). Each `check` was written by its own agent from the same CLAUDE.md
paragraph, so the same intent exists in six hand-written forms, and a seventh repo
has none. That is the eight-copies problem again, one level up: the hooks were the
rule's *guards* in copies; the checks are the rule's *gates* in copies.

**What is generic.** Reading "Gate the seams" and the repo `check`s together, these
need nothing but a repo path and a few parameters:

| check | what it proves | today |
|---|---|---|
| `help-matches` | `dev.sh usage()` lists exactly the subcommands the `case` implements, both directions | the failure CLAUDE.md names ("wrong three times in one session"); site-scrapers has it, the others do not |
| `rules-in-sync` | the shared sections of this repo's `CLAUDE.md` match the top-level copy on meaning (heading set + "Constraints that don't bend" verbatim) | seven copies, no check at all |
| `hooks-installed` | each hook declared for this repo is present, executable, parses, matches the `tools/hooks/` source, and fails open on malformed input | site-scrapers `check-hooks.sh` + `hooks.test.js`, knowledge-base `check-hooks.sh`; others nothing |
| `todo-valid` | `TODO.md` present, and when the repo has `todo.json`, rendered == store | `todo check` once it exists; until then presence only |
| `no-secrets` | nothing credential-shaped tracked; `.env`, tokens and capture dirs gitignored | each repo's agent remembers to look |
| `tree-clean` | working tree clean, branch not behind `origin` | site-scrapers `check` has the first half |
| `check-fails` | the repo's own `check` exits non-zero on a planted failure | nowhere; the "guard that reports no error and does not run" case |
| `docs-rows` | the top-level CLAUDE.md tool table has a row per folder and a folder per row | nowhere |
| `no-roster` | under `tools/`, nothing reads the manifest, agent definitions or agent names (§1's direction audit) | planned per tool; belongs here once |

What stays per repo is what only that repo can know: its suite, site-scrapers'
`audit.js` (`inline`, `repeats`, `literals`, `hardcoded`), the recipe verifiers,
applications' leak audit. Those are the data; the table above is the procedure.

**The shape.** One repo, `tools/checks/`, public `CyberImpXIII/checks`:

- `checks/<name>.sh`: one check, a pure function over a repo path, exit 0 or 2 with
  one line per finding, and a two-line declaration at the top: `applies_to:
  all | tools | repos:<list> | roles:<list>` and `params:` the keys it reads. The same
  declaration shape as `tools/hooks/` (§4 step 2), so Jacob's plug-in point holds
  here too: harness's `check` becomes a check with `roles: harness`, written against
  the same interface, run by the same runner.
- `checks run [path]`: runs every check whose declaration matches the repo, reports
  per check (never only the first failure), exit non-zero if any fails. A repo's
  `dev.sh check` becomes `checks run . && <its own suite>`. Setup's `check` component
  installs that line instead of today's failing stub.
- `checks all`: runs from the top across every repo, one process per repo, and prints
  a repo-by-check grid. This is the top-down view Jacob asked for, and what
  `session-doctor.sh` prints at session start reduces to the failing cells of it.
- Per-repo parameters, when a check needs one (which files hold the shared rules,
  which dirs are capture dirs), live in a small `checks.json` in that repo. No
  parameter, no file.
- `checks list` prints the declarations; `checks explain <name>` says what a check
  proves and how to make it pass.

**Gates on the tool itself** (the seams it creates):

- every check ships with two fixtures, one that passes and one that fails, and the
  tool's own `check` runs both; a check with no failing fixture is refused. This is
  `check-fails` applied to itself.
- `checks list` == the files in `checks/`, both directions; `explain` exists for each.
- the declaration vocabulary is one file, read by the runner and by setup; a key in
  neither is an error.
- the runner's per-check report is tested with a fixture where two checks fail, and
  the output names both.
- `no-roster` runs against this repo too.

**Costs.** ~200k tokens to build with the first five checks and `run`/`all`; the
remaining four follow as repos adopt it, ~30k each. Adoption is one line per repo's
`dev.sh`, which is each owner's commit, so it rides along with their next change and
needs no sweep. Migration risk: a repo's existing check is stricter than the generic
one in some detail; the rule is that the generic check is added beside the existing
one and the existing one is deleted only after both have passed together once.

**Order.** Step 3 in §4, right after `tools/hooks/` (it consumes hooks' source for
`hooks-installed`) and in parallel with todo, which gets `todo-valid` as its first
consumer. **All three decided "yes" by Jacob, 2026-10-03, in the planner window:** the tool, step 3 in parallel with todo, and the add-beside-then-delete migration rule.
