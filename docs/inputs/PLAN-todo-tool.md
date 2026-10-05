# The TODO list as its own tool: structured items, rendered files, checkable seams

> **Status: plan, requested by Jacob 2026-10-03.** His words: "can we create the todo
> list as its own project? While I think feature-wise, when we get there, harness may
> need to work with the to-do list to implement the parent child relationship, we can
> use to-do as a dependency rather than wait for harness to do that work, as its
> functionally separate?" Owner: `deep-work` for phase 1, then a `todo` folder agent.
> Decisions in §8.

## 1. Why a tool, and why separate from harness

"Keep an active TODO" is Jacob's rule and it is prose-enforced only. Nine `TODO.md`
files exist, each hand-written, each with its own headings, and the four things the
rule asks for (own bugs, open decisions, suspicions with their probe, what was
reported to another owner) are indistinguishable from each other by anything but a
reader. The one that matters most, **what was reported to whom**, is the one that
fails silently: a report in one file has no counterpart in the other, so a stalled
report looks exactly like a handled one.

Jacob's separation argument holds. A todo store is data with a CLI over it; the
delegation layer is a consumer of that data (the ledger could write "reported" items;
the interim-rules register is a kind of todo item). **The dependency points one way:
`harness` may call `todo`; `todo` never reads `.claude/`.** That is an audit (§5), so
the direction cannot drift. Nothing here waits for routing-tree's nodes, and the
parent-child relationship Jacob names is item-to-item by id across repos, which the
tool does by itself (§3).

## 2. Shape

- **A repo, `tools/todo/`,** public `CyberImpXIII/todo`, the CLAUDE.md
  copy of the rules, `TODO.md` (its own, rendered by itself from day one), `dev.sh
  check`, python3 stdlib only, like `kb`.
- **The store is per repo, committed with it:** `todo.json` at each repo root, one
  item per entry, so a fresh clone carries its own list. The top-level folder is not a
  git repo; its `todo.json` sits beside `TODO.md` as that file does today.
- **`TODO.md` becomes a rendered file, written read-only** by `todo render`, the way
  `agents.sh gen` writes `.claude/agents/*.md`. A hand edit is visible (the file
  differs from the render, and `check` says so) and the CLI is the only way in. This
  is the enforcing choice; §8 decision 2.
- **One item:**

  ```
  { "id": "ss-41",                      repo prefix + counter; stable, never reused
    "title": "...", "kind": "bug",        kind: bug | decision | suspicion | report | temp | note
    "status": "open",                     open | waiting-jacob | blocked | done
    "evidence": "ran X, saw Y, concluded Z",
    "probe": "...",                       required when kind is suspicion
    "reported_to": {"repo": "site-scrapers", "date": "2026-10-03", "their_id": null},
    "parent": "ct-7",                     any item, any repo
    "repo": "site-scrapers",             where the work lives; a repo name, never an agent
    "work": "test",                       code | test | audit | tooling | docs | decision
    "files": ["lib/x.js"], "done_when": "suite passes with the new case",
    "retire": "manifest:nodes",           required when kind is temp (PLAN-interim-rules §3)
    "added": "2026-10-03", "done": null, "resolution": null }
  ```

  Kinds and statuses are a vocabulary in one file the parser, the renderer, the docs
  and the tests all read.

## 2a. History: done items leave the store, never the record

> **Jacob, 2026-10-04:** "I'd also like to add a history to the todo. This way we can
> have historical data loaded when necessary for checks, but as tasks fall away we can
> keep the main todo trim."

- **Two files per repo:** `todo.json` holds open items only; `todo-history.json` holds
  every item that reached `done`, with its closing fields (`done` date, `resolution`,
  and the evidence it carried). `todo done ID` moves the item across in one write; the
  item's id, `added` date and every field it had come with it, so nothing is lost by
  closing. `TODO.md` renders the store alone, which is what keeps it trim.
- **History is append-only.** An id that has entered history is never removed or
  reused; `todo done` on an id already in history is refused. Editing a history
  entry is not a command.
- **Checks read it when they need the past:**
  - `todo check` pairs a `reported_to` against the counterpart's store *and* history,
    so a report the owner already closed is not re-reported (the CLAUDE.md rule "so the
    next session doesn't report it again" becomes a lookup);
  - the migration check in §6 phase 3 counts closed items too, so a repo whose TODO.md
    shrank because items were done is distinguished from one that lost them;
  - a `suspicion` that was settled stays findable with its probe and outcome.
- **`todo history [ID | --since DATE | --repo R | --kind K | --grep TEXT]`** prints the
  matching closed items, newest first, with their resolution; without arguments the
  last ten. `todo show ID` falls through to history when the id is closed, and says so.
- **`todo import TODO.md`** sends bullets marked DONE (today's "DONE 2026-10-03: ..."
  form) to history with the date in the bullet, and everything else to the store, so
  the existing files convert without a second pass.
- **`todo render --history`** writes `TODO-HISTORY.md` read-only for a human to read;
  it is never required and never checked, since the data file is the record.

**Gates for §2a** (added to §5): an id appears in exactly one of the two files, and
every id ever written to history is still there (an audit against the git log of the
file); `done` then `history ID` round-trips every field; `import` of a fixture with
DONE bullets puts them in history with the right dates and leaves the store trim;
the pairing check finds a counterpart in history, with a fixture where the owner has
already closed the report.

## 3. Commands

```
todo add "<title>" --kind bug [--evidence ...] [--probe ...] [--parent ID] [--retire CHECK]
todo done ID --resolution "..."          todo edit ID --status waiting-jacob ...
todo report ID --to <repo>               marks it reported; creates the counterpart item there
todo list [--kind ..] [--status ..] [--repo ..] [--mine]
todo show ID                             todo render [--all]      todo tree [ID]
todo check                               todo import TODO.md      todo repos
todo history [ID | --since D | --repo R | --kind K | --grep T]   closed items, newest first (§2a)
todo render --history                    TODO-HISTORY.md, read-only, never checked
todo ready [--repo ..] [--work ..]       open items with repo, work and done_when set: dispatchable at a glance
todo brief ID                            the item as a dispatch brief: what, why (evidence), files, done_when
```

- **Cross-repo by scanning, not by configuration:** `todo repos` finds every
  `todo.json` under the parent of the current repo. `tree` and `list --all` read them.
  No list of repos to keep in step, and no read of `.claude/`.
- **`report` is the whole point of the structure.** It writes the item in the
  reporter's store with `reported_to`, and the counterpart in the owner's store with
  `parent` pointing back, status `open`. The owner's `check` shows unanswered reports;
  the reporter's `check` shows reports whose counterpart is `done`, so it can close its
  own. A stalled report is now a line in two places, not an assumption.
- **`import`** turns a current `TODO.md` into items: one bullet per item, kind from the
  section heading where it is clear (`Needs Jacob` → decision, `Unconfirmed` →
  suspicion, `Resolved` → done), `note` otherwise, the bullet text as evidence, nothing
  dropped. Deterministic, so it can be re-run until the owner is satisfied, then the
  file is rendered and the hand-written one is gone.
- **Output is trimmed:** `list` prints id, kind, status and title, one line each;
  `show` prints one item in full. Nothing prints a whole store unless asked.

## 4. What it replaces and what it feeds

| today | after |
|---|---|
| `TODO.md "item title"` pointers in plans and Dispatch lines | `todo:ss-41`, stable across rewording |
| the "what you reported" bullet, kept by diligence | `kind: report`, checked in both stores |
| PLAN-interim-rules' `temp-rules.json` register | `kind: temp` items with `retire`; `agents.sh temps` reads them through `todo list --kind temp --all` once this exists (a later `harness` job; the register ships first as approved) |
| the ledger's "reported a problem" lines in reports | a later `harness` job can `todo report` from the ledger; not phase 1 |
| the dispatcher writing a brief from a TODO bullet | `todo brief ID` is the brief; the dispatcher resolves `repo` + `work` to an agent through harness's existing `resolve-owner.sh` and spawns; the agent closes the item itself with `todo done` in its own repo, so the ledger pointer is `todo:ID` and the loop closes without a rewrite (Jacob, 2026-10-03: "Having todo items that can be dispatched at a glance means less work") |
| `knowledge-base`'s `plan-sync` for TODO copies | unchanged; plans stay prose, items stay data |

## 5. Gates (in the same change as each part)

- **Rendered == store:** `check` fails when `TODO.md` differs from `render` (a hand
  edit), and the file is written read-only.
- **Vocabulary both ways:** every kind and status the code handles is declared; every
  declared one is handled, rendered and documented.
- **Required fields by kind:** a suspicion without a probe, a temp without a retire
  check, a done without a resolution: refused at `add`/`done`, and red in `check`
  for imported items.
- **Reports in pairs:** every `reported_to` has a counterpart item in the named repo's
  store, or `check` names it; every counterpart's `parent` resolves.
- **Ids:** unique within a repo, never reused after `done`; a `parent` that does not
  resolve across the scanned repos is red.
- **Import is lossless:** importing a fixture `TODO.md` and rendering it back loses no
  bullet text (a diff of the bullet bodies is empty), on fixtures taken from three
  real files.
- **Direction audit:** no file in `todo/` reads `.claude/` or names a roster agent.
- **Documented == implemented:** the §3 command list against the parser, both ways.
- **History (§2a):** one file per id, history append-only against its own git log,
  `done` round-trips every field, DONE bullets import to history, pairing finds a
  closed counterpart.
- **One pre-commit command,** `./dev.sh check`, from the first commit.

## 6. Phases

1. **Scaffold, by the dispatcher, with the setup tool** (Jacob, 2026-10-03: "we
   ultimately WILL be relying on dispatcher to create new folders and initialize git
   and agents in those new folders, so please have this INITIAL scaffolding done by
   dispatcher"). `setup tools/todo --github` makes the folder, `git init`, the public
   `CyberImpXIII/todo` repo, the shared-rules block of `CLAUDE.md`, a `TODO.md`, and
   the failing `dev.sh check` stub (PLAN-repo-setup.md §2). The dispatcher runs a
   tool; it writes nothing by hand, so the dispatch guard is not in the way, and the
   setup tool's own gates are the enforcement. **This waits on setup existing**
   (PLAN-tools-folder.md §4, now first). The roster entry is harness's, added in its
   next job; until then the folder is built by deep-work under the folder's own
   `CLAUDE.md`.
2. **Build, by `deep-work`, one job:** the store, CLI, renderer, importer, gates,
   README, the real `dev.sh check`, push. Its own `TODO.md` is the first rendered one.
   Estimated 200–300k tokens.
3. **Migration, one repo per owner, bundled into each owner's next job:** `todo
   import TODO.md`, review, `render`, commit. The top-level and the planner's items
   go through the planner (the planner writes `TODO.md` today, and would write
   `todo.json` through the CLI instead; `dispatch-guard` needs `todo.json` added to
   what the dispatcher and planner may write at the top level, a `harness` line).
4. **The tool-table row and the roster entry:** the dispatcher adds the row; `harness`
   adds the `todo` folder agent with its next queued job, hooks via routing-tree
   §12 S1 alongside addon-bench's, not as a tenth hand copy.
5. **Later, each a `harness` job when it is cheap:** `temps` reads `kind: temp`
   items; the ledger files `report` items; pointers in Dispatch lines accept
   `todo:ID`.

## 7. Setup component

`tools/todo/` is an adopter like every repo, and the first one setup scaffolds from
nothing. What it contributes to setup, when PLAN-repo-setup.md's phase 2 runs: a repo
is at zero drift only if it has a `todo.json`, its `TODO.md` is the render of it, and
`todo check` is green, replacing "has a TODO.md" with something a script can fail.

## 8. Decisions (all decided by Jacob, 2026-10-03, in the planner window)

1. **Home and builder: `tools/todo/`, PUBLIC `CyberImpXIII/todo`, scaffolded by the
   dispatcher with the setup tool, built by `deep-work`.** *Jacob's answer:* "I don't
   think it's necessary for it to be private ... please have this INITIAL scaffolding
   done by dispatcher, unless there is a reason not to." The one reason is that the
   setup tool does not exist yet, so setup moves to the front of PLAN-tools-folder.md
   §4. **Decided**, with that ordering in this reply's table.
2. **`TODO.md` is rendered and read-only; the CLI is the only way in.** *Jacob:*
   "elaborate before proceeding." The elaboration is in the planner reply of
   2026-10-03 and, in short: the store (`todo.json`) is the one source; the file is a
   view, like the agent definitions `gen` writes; a hand edit is visible to `check`
   and recoverable through `import`, never lost; the alternative (markdown canonical,
   parsed by the CLI) makes every agent's prose style a parser input forever, which is
   the import problem made permanent. **Decided 2026-10-03,** Jacob: "ok I think.
   still a little iffy but I think it makes sense." Because of the reservation,
   phase 3's first week runs the rendered-equals-store check as a counted warning,
   not a failure, so the number of hand edits is known before the gate bites.
3. **Migration per owner, bundled into each one's next job.** *Jacob:* "yes."
4. **Direction fixed by audit: `todo` never reads `.claude/`;** harness integrations
   are later `harness` jobs. *Jacob:* "elaborate, I'm not sure." In short: the audit
   is a `check` step that fails if any file under `tools/todo/` mentions `.claude/`,
   the manifest, or a roster agent name; items name *repos*, not agents, so the tool
   needs no roster; this is what makes it usable from a fresh clone, or by harness as
   a dependency, without harness being installed first. **Decided 2026-10-03 with
   Jacob's refinement:** "We do know that certain todo items relate to certain agents
   within the group. Tests, audits, code, tooling, etc. Having todo items that can be
   dispatched at a glance means less work." Both hold at once: an item carries `repo`
   and `work` (§2), which are facts about where the work lives, and the mapping from
   those to an agent is harness's one existing resolver, read by the dispatcher at
   dispatch time, never by the tool. `todo ready` and `todo brief` (§3) are the
   at-a-glance part. The audit is unchanged: no file under `tools/todo/` reads the
   manifest or names a roster agent.
5. **Order against addon-bench:** *Jacob:* "parallel unless there is a reason one
   should come first." None: they share no files and no owner. **Decided: parallel.**
   Todo's own start waits on setup (decision 1), not on addon-bench.

**td-1, answered by Jacob 2026-10-04 (planner window):** "Yeah I think we can make an
exception or maybe a special case such as 'done-depricated'." So: an imported DONE
bullet with no resolution gets the resolution value `done-deprecated` (spelled so in
the vocabulary), set by the import, shown as such, and the §5 red stays for every
other closed item. The todo agent builds it with its gate and a mutant.
