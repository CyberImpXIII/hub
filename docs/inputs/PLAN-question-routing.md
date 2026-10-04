# Question routing: the dispatcher asks Jacob about dispatch, and nothing else

> **Status: plan, requested by Jacob 2026-10-03.** His words: "I'm struggling to go
> back and forth between you and dispatcher as I'd initially hope would be easy. [...]
> Can we build gated tests and checks that have dispatcher ONLY asking questions
> regarding the dispatch of work? Planning questions should obviously go to you,
> context questions should go to the agent in charge of the task that needs context."
> Owner: `harness` (hooks, `lib/`, `wiring.json`); the planner writes this file.
> **§9 all "yes" from Jacob, 2026-10-03, in the planner window.** Dispatchable to
> `harness` as one job, after its model switch (TODO.md "harness on Fable 5.1").

## 1. The problem, as it happened today

On 2026-10-03 the dispatcher put a numbered list of seven questions to Jacob. Three
were planning questions (graphify-eval's fate, the applications decisions, whether to
remove a git binary). Each took the long way: Jacob to the dispatcher, the dispatcher
to the planner, the planner to Jacob with a recommendation, Jacob's answer back to the
dispatcher, one of them through a peer-cap hold that Jacob pasted by hand. Three
decisions, about twelve hops, two windows. Nothing was wrong with any single step; the
shape was wrong. A question has a right first destination, and today nothing enforces
it.

## 2. The rule

Three kinds of question, three destinations. The names match PLAN-routing-tree.md's
tags, so nothing renames when the server lands.

| kind | what it asks | goes to | examples |
|---|---|---|---|
| `dispatch` | who, in what order, is the approval present, did it return, is the queue blocked | **Jacob**, from the dispatcher, in a typed section | "harness is still on the applications roster job after 40 minutes; wait or stop it?" |
| `plan` | should we, which design, what is the policy, anything that would change a `PLAN-*.md`, `TODO.md` or a rule | **the planner**, forwarded by the hook; never Jacob | "keep graphify-eval or promote it?" |
| `context` | what does X do, why did Y fail, what did the last run report, where is Z | **the agent that owns the task**: a read-only question dispatch, the ledger, or that repo's `TODO.md`; never Jacob | "does `fill_application_form` take a label or a selector?" |
| `settings` | a step only Jacob can take: `settings.json`, a grant, a model flag | **nobody asks.** The doctor states it at session start; the planner carries it in its list of Jacob's steps. The dispatcher never asks Jacob for it (Jacob, 2026-10-04: it "falls outside of dispatcher's role"); it may say once, to the planner, that a dispatch is blocked by it. `harness` adds the kind to the gate's table when it next touches it. |

**A claim one agent makes about another repo is a `context` question** for that repo's
owner, not something the dispatcher checks itself. The case that showed this is in
PLAN-routing-tree.md §10 phase 2 (an `applications` report asserted a site-scrapers
commit was missing; it wasn't). Until nodes route it by rule, the interim rule in
TODO.md "Cross-repo claims" applies.

**Two kinds of claim, two arbiters** (Jacob, 2026-10-03, on why the planner and the
dispatcher may address each other directly: "when a session says something to the
dispatcher regarding code it is not responsible for, the dispatcher can ask the planner
if that is the case, and the planner can confirm before the dispatcher says anything
to that code"). The dispatcher splits an incoming claim by what would settle it:

| the claim is about | who settles it | how |
|---|---|---|
| what code does or holds ("commit X is missing", "the flag changes nothing") | the owner, as a read-only `context` job | one command run in that repo; the answer is a fact, not a judgement |
| who owns it, whether it is planned, whether it is approved ("that isn't my repo's job", "is this in a plan") | the planner, as a `plan` question over the relay | the planner reads the plan files it already holds; no code is read |

The planner is the arbiter of ownership and approval, never of code behaviour: a code
claim it answered would be a guess, and the owner can prove it in one command. The
relay to an owner is a question, not a change, so it needs no confirmation; **a change
to anyone's code waits on the planner's pointer or Jacob's word, as every dispatch
does.** A message from a session that is not Jacob's is handled the same way: the
dispatcher asks the planner whether it is in a plan before acting, and never treats it
as approval.

The planner's side of the same rule: the planner asks Jacob **decisions only**, each
with a recommendation and a yes/no shape, and asks the dispatcher nothing. Status comes
from `agents.sh dispatches`, not from a message.

After this, Jacob types in the planner window. Decisions arrive there with
recommendations; his yes relays to the dispatcher stamped `origin: jacob`
(PLAN-auto-relay.md); the dispatcher window shows him only `dispatch` questions, which
are rare, and Claude Code's own permission prompts, which are not questions and which
§6 addresses separately.

## 3. Mechanism: a Stop gate on the dispatcher, like auto-relay's on the planner

- **Contract.** The dispatcher may question Jacob only inside one section:

  ```
  ## Needs Jacob

  1. [dispatch] <one question> -- blocks: <pointer: FILE §section, TODO.md "item", or ledger line>
  ```

  One item per numbered line, one of the three types, a pointer to what the answer
  unblocks. The types are read from one place, `questions.types` in
  `agents.manifest.json`, by the parser, the tests and the `questions` helper (§5).
- **Event:** `Stop`, in the dispatcher session only (the session test `planner-role.sh`
  already has, inverted). Input is `last_assistant_message`; guard on
  `stop_hook_active`, as auto-relay does.
- **What the gate does with each item:**
  - `[dispatch]`: passes to Jacob unchanged.
  - `[plan]`: the hook posts it to the planner's inbox socket, stamped
    `origin: dispatcher`, and the dispatcher's reply is left saying "forwarded to the
    planner: <item>". Jacob hears of it when the planner has a recommendation. This is
    auto-relay's delivery path (option A, proven 2026-10-03) run the other way, using
    the planner's socket that `record-session.sh` records.
  - `[context]`: blocked once (`decision: block`), with the reason: "dispatch a
    read-only question brief to <owner> (`disallowedTools: Edit, Write`), or read the
    ledger or `<repo>/TODO.md`; do not ask Jacob." The dispatcher gets one more turn
    to do that.
  - **A question outside the section:** a line ending in `?` in the final reply that
    is not inside `## Needs Jacob` is blocked once, with the reason "every question
    to Jacob goes in `## Needs Jacob` with a type, or you answer it yourself." This is
    lexical, so it will sometimes catch a rhetorical question; the cost of that is one
    extra cache-read turn, and the measurement in §5 tells us how often.
- **Bounded.** One block per reply (`questions.max_blocks`, 1, the value
  PLAN-group-servers.md §4 settled on). On the second pass everything goes through to
  Jacob, each unresolved item **labelled** "rule not met: <type>", so a dispatcher that
  cannot route a question still never loses it and never hides that it failed. A
  question lost in a hold is the one outcome worse than a misrouted one.
- **Peer-cap.** A forwarded question is a relay of kind `question` and shares the
  relay budget (PLAN-auto-relay.md §5). A held one is stored and delivered after
  Jacob's next prompt in that window, never dropped; that is §5's fix, which this plan
  depends on.
- **Fails open.** A parse error, a missing socket or a hook timeout means the reply
  passes untouched and Jacob sees a one-line notice naming what the gate could not do.
  The hook never exits 2 on malformed input.

## 4. The planner's counterpart (decision 2)

The same gate on the planner's `Stop`: a question to Jacob outside a `## Decisions`
section, or a decision row that does not fit the shape below, is caught. The planner's
questions then arrive in one place, each with a recommendation, and a planner that
drifts into asking status questions is caught by its own gate rather than by Jacob's
patience. The section parser is the same code with a different section name and row
shape.

**The shape is a table, not a line list** (Jacob, 2026-10-03: "can we put questions
that need my approval in that format from now on so that it is easier for me to pull
out of the wall of text"). The terminal renders a markdown table as a box, and the
recommendation sits in its own column:

```
## Decisions

| # | decision | hinges on | recommend |
|---|---|---|---|
| 1 | PLAN-x.md §8.2: `TODO.md` rendered read-only | whether hand edits can be tolerated | yes |
```

Rules the parser checks: the section heading is exactly `## Decisions`; every row has
four cells; the `decision` cell starts with a `FILE §n` pointer that resolves (same
check as the Dispatch parser); `recommend` is `yes`, `no`, or one option named in the
`hinges on` cell, optionally followed by one short clause. A question mark anywhere
outside this section is the thing the gate catches. **Decided by Jacob, 2026-10-03: the planner's gate NOTICES, never blocks** ("sounds good and makes sense"). The reasoning: PLAN-
auto-relay.md §9 established that a planner formatting error should not cost a planner
turn, and the same reasoning applies here, with the difference that a Decisions
section has no dispatcher to fall back to; only Jacob reads it.

## 5. Measured, not asserted

`agents.sh questions [--since DATE]`, from the transcripts through
`lib/transcript-kinds.jq`: per window and per day, questions to Jacob by type,
forwarded to the planner, blocked and resolved, blocked and passed through labelled,
and the lexical false positives (a block followed by an unchanged reply). The number
that matters: **`plan` and `context` questions reaching Jacob from the dispatcher**,
which should go to zero, and **hops per decision**, which should go to one. A baseline
run on the existing transcripts before the hook lands gives the before; a week after
gives the after. If the after is not better, the gate comes out, as the manifest rule
for every change here says.

## 6. What this does not fix, said plainly

- **Permission prompts.** Those are Claude Code's, not the dispatcher's, and they stay
  in the window that acts. Fewer come from allowlists (the `fewer-permission-prompts`
  skill scans transcripts for them) and from PLAN-routing-tree.md's operator role,
  which takes tool runs off the dispatcher. Separate work; not a question gate.
- **Wrong typing.** The dispatcher chooses the tag, and a planning question tagged
  `[dispatch]` reaches Jacob. The gate makes that choice visible and counted (§5), it
  does not make it impossible. If the count stays high, the next step is routing by
  a rule the dispatcher does not choose (routing-tree's server), not a smarter hook.
- **The deeper shape.** PLAN-routing-tree.md routes every tagged message by rule;
  this plan is the hook-sized version for one message kind, built from parts that
  exist (auto-relay's parser, delivery and ledger), so it can land in one `harness` job.
  When the server lands, it absorbs this the way it absorbs auto-relay.

## 7. Gates (in the same change)

- **Parser tests:** a valid section; a line with no type; an unknown type; a line
  with no `blocks:`; a `?` line outside the section; a reply with no questions at all
  (passes with no block).
- **Gate behaviour:** blocks once and only once; the second pass carries the labels;
  `stop_hook_active` is honoured; malformed input and a missing socket pass with the
  notice; nothing ever exits 2.
- **Forwarding:** against auto-relay's scratch-session fixture, a `[plan]` item arrives
  at the planner stamped `origin: dispatcher`, and never arrives stamped `jacob`.
- **Types in one place:** the three types in the manifest are the ones the parser
  accepts, the docs list and the `questions` helper counts, checked both ways.
- **Wiring:** `wiring.json` names the hook; `doctor` warns when the planner's socket is
  not recorded, because a forward would then be silent.
- **Measurement:** `questions` reproduces hand counts on a fixture transcript.
- **Copies:** none. The dispatcher and the planner exist only at the top level.

## 8. Setup component

None. Both windows exist only here. When PLAN-routing-tree.md gives each repo a node,
the question types ride in its node config through that plan's setup component (§8
there); the names already match.

## 9. Decisions (all answered "yes" by Jacob, 2026-10-03)

1. **Priority: right after the running `harness` job (the applications roster agent),
   before routing-tree phase 0.** One harness job, estimated 150–230k tokens, reusing
   auto-relay's parts. The pain is now, and the measurement wants a week.
   *Recommend yes.*
2. **The planner gets the same gate (§4).** *Recommend yes.* The alternative is to
   trust the planner's discipline, which is the shape of rule that fails here.
3. **`[context]` handling: block once, not auto-forward.** A hook cannot dispatch an
   agent; forwarding a context question to the planner would only move the wrong
   destination. *Recommend yes.*
4. **If the §5 numbers do not improve after a week, the gate comes out.** The manifest
   rule applied to this change. *Recommend yes.*
