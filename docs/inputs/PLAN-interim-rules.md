# Interim rules: temporary guardrails, marked, gated, and removed on schedule

> **Status: plan, requested by Jacob 2026-10-03.** His words: "for the sake of being
> thorough we should be building conditional rules to address all of the structural
> guardrails we are hoping to put in place. If we have to spend a lot of time and
> effort pushing past the hurdles we are trying to tame programmatically it might feel
> great when we finish but also might be more effort than its worth. Any temporary
> rules please mark as such so we can remove them as they come off the todo list."
> Owner: `harness`. **§8 all "yes" from Jacob, 2026-10-03, in the planner window**
> ("I agree with interim rule decisions, proceed"). Phase 1 (§5) is dispatchable to
> `harness` after the Fable switch, bundled with question-routing.

## 1. What this is

Every structural guardrail in the plans (routing by rule, write leases, tester roles,
origin stamping, loop control) has a cheap conditional version that can exist today as
a hook rule, a manifest note or a ledger flag. This plan does two things:

- **builds those cheap versions now,** so the pain stops before the machinery lands;
- **marks each one temporary with a machine-checked retire condition,** so the day the
  permanent thing exists, `check` goes red until the interim rule is removed. A
  temporary rule nobody removes is the exception Jacob is trying not to accumulate.

**What this does not decide: whether routing-tree's nodes pay.** That math is done
(TODO.md "Confirmed"; PLAN-context-hygiene.md §2 findings 1, 2 and 4): carried
context is 72–80% of weighted tokens, a cold start is one fixed 36–42K write per spawn
whatever the layer, and a cache read costs the same on every model, so the saving
lives in filtering, clearing and reloading context conditionally, which is what
per-node roles with small task contexts do. Interim rules are lexical flags and
guards; they touch none of that. The review in §5 asks only whether each interim rule
removed the pain it targets and which can retire early, never whether the permanent
machinery is worth building. *Corrected 2026-10-03 after Jacob pointed out the first
draft re-opened settled math.*

## 2. The convention (one shape, so it gets a parser)

Every temporary rule carries, in the file that holds it, the marker

```
TEMP[<id>] until <retire check>   # e.g. TEMP[cross-repo-claims] until manifest:nodes
```

and one entry in `.claude/temp-rules.json`:

```
{ "id": "cross-repo-claims",
  "where": ["agents.manifest.json#coders.note", "lib/agent-ledger.sh"],
  "retire": "manifest:nodes",            one of a small vocabulary of checks, §3
  "replaced_by": "PLAN-routing-tree.md §10 phase 2",
  "added": "2026-10-03" }
```

The marker and the entry are two copies of one fact, so they are gated both ways:
every marker in the tree has an entry, every entry's `where` files carry its marker.

## 3. Retire checks (data, not prose)

A retire check is something a script can answer today with no judgement:

| check | true when |
|---|---|
| `hook:<name>` | `wiring.json` requires `hooks/<name>` and it is wired |
| `manifest:<key>` | the manifest has that key (`nodes`, `roles`, `lease`) |
| `cmd:<agents.sh subcommand>` | `agents.sh` implements it |
| `plan:<FILE §n>` | the plan's header marks that phase done |

**Gate:** `agents.sh temps` prints each rule, where it lives, its check and the result;
`check` fails on a rule whose retire check is **true** and whose marker still exists,
and on a marker without an entry or an entry without a marker. Removing the rule and
its entry in the same commit is the only way back to green. An unknown check word
fails `check` too, so the vocabulary cannot drift.

## 4. The inventory: what gets an interim rule now

Each is built as the cheapest enforced form, with its test, in one `harness` batch.
Prose-only versions are not interim rules; they are what failed already.

| id | permanent guardrail (plan) | interim rule, enforced | retires when |
|---|---|---|---|
| `cross-repo-claims` | bug-report routing to the owning node (routing-tree §10 ph. 2) | coders' manifest note: a claim about another repo is `unverified: … -- settle: <cmd>`; the ledger flags an unmarked one in `dispatches` and `check` (TODO.md "Cross-repo claims") | `manifest:nodes` |
| `one-writer` | the write lease (routing-tree ph. 2, agent-groups) | `dispatch-guard.sh` refuses to spawn a folder agent while the ledger shows one running for the same folder, naming the running job; `Explore`-class spawns pass | `manifest:lease` |
| `report-shape` | tester and auditor roles (agent-groups ph. 3) | the ledger flags a roster report with no line from its repo's check command (`check:` / `hooks: clean` / suite count), and one over the ten-line limit; `check` counts them | `manifest:roles` |
| `question-kinds` | routing by rule at the server (routing-tree ph. 1–2) | PLAN-question-routing.md's Stop gate, already approved; it is an interim rule and gets the marker | `manifest:nodes` |
| `relay-origin` | server-stamped `origin` (routing-tree §2) | auto-relay's stamp and the human-origin-only quote, already built; marked | `manifest:nodes` |
| `held-not-lost` | loop control per conversation (routing-tree ph. 2) | peer-cap stores a held message and delivers it after Jacob's next prompt (auto-relay §5) | `manifest:nodes` |
| `stale-spawn` | per-node job supervision | `agent-watch.sh`, already wired; marked, and its test extended with the case from 2026-10-03 (a job 42 minutes with no end and no alert seen) | `manifest:nodes` |

Not in the batch, and why: an interim for check-progress (resume from a breakpoint) is
"commit at checkpoints", which has no cheap enforced form short of the progress file
itself; and an interim `operator` split needs the dispatcher's tools restricted, which
is routing-tree phase 4 and Jacob's settings. Both stay prose until their plan lands.

## 5. Phases

1. **`harness`, one job, after the Fable switch and bundled with question-routing:**
   `temp-rules.json`, the marker parser, `agents.sh temps`, the `check` gate, and the
   inventory rows that are new (`cross-repo-claims`, `one-writer`, `report-shape`,
   the `stale-spawn` test). Markers on the already-built rows. Tests: a rule whose
   check turns true goes red; an orphan marker goes red; an orphan entry goes red; an
   unknown check word goes red; the pass case is green.
2. **A week of work under the interim rules.** `agents.sh questions` (question-routing
   §5) and `tokens --agents` give the after.
3. **Dated review, 2026-10-10, in the planner window, of the interim rules only:**
   per row, did it fire, did it change an outcome, did it over-flag (`agents.sh
   temps` plus the question and ledger counts). A row that never fired or only
   over-flagged is removed then, without waiting for its replacement. Routing-tree's
   phases proceed on their own schedule; this review does not gate them.
4. **Retirement is automatic in direction, manual in act:** when a permanent piece
   lands, `check` goes red, and the job that landed it removes the interim rule in
   the same commit or the next one. No interim rule outlives its replacement by more
   than one harness job.

## 6. Gates (in the same change)

- marker ↔ entry, both ways; unknown check word; retire-true-but-present: all red.
- each inventory row's test proves the rule *changes an outcome*: a spawn refused, a
  report flagged, a message delivered after a hold. "It ran" is not evidence.
- `agents.sh temps` output is the documented list, so documented == implemented is
  the same check.
- no copies: everything here lives in `.claude/`.

## 7. Setup component

None now. When routing-tree §12 gives each repo a node config, `temp-rules.json`
becomes a per-node file with the same shape, and the marker convention travels in the
shared rules block. Nothing is installed into other repos by this plan.

## 8. Decisions (all answered "yes" by Jacob, 2026-10-03)

1. **The convention and the `check` gate (§2–§3).** *Recommend yes.* Without the gate
   this is a list, and lists here have not been trimmed.
2. **Batch 1 is the §4 table as written.** The three new rules are small; the marked
   ones cost only a marker. *Recommend yes.* Say which rows to drop if any.
3. **The dated review on 2026-10-10 (§5 phase 3)** of the interim rules themselves,
   removing any that did not earn their place. *Recommend yes.*
