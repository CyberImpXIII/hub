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
todo get ID                              one record by id, as JSON, with its tags (PLAN-services.md §3)
todo find TAG...                         ids and titles of the records holding every tag named
todo refs ID                             the records whose ref: tag names this id
todo approve ID [--source S] [--date D] [--clear]   record Jacob's approval: the day and where he gave it
todo dispatch ID [--note N] [--clear]    mark an approved item handed out; --clear when it comes back
todo dispatchable                        approved, not dispatched, ready: what can be dispatched now
todo stale-plans [--repo R] [--json]     open items whose pinned plan section changed, is gone, or was never pinned
```

Added 2026-10-09 (todo's td-27): the seven commands built past this list, so the test
that keeps plan and CLI equal can drop them from its `BEYOND_PLAN` exemptions.

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

## 9. Load only what the work needs: ids, tags and the top-level store (Jacob, 2026-10-09)

> **Jacob:** "I also think that using IDs and tags could help reduce usage regarding
> TODO and PLAN. We shouldn't necissarily be reloading everything on a todo if there
> are items that are blocking and finished todo items might better exist as things
> that only are loaded when needed to see if a task WAS completed. Perhaps we could
> convert todo to a database and CLI so that it can be better integrated with checks
> and hooks."

**Most of this is built; the top level never moved onto it.** `tools/todo` is already
a store behind a CLI that is the only way in. Closed items already leave the open
store for `todo-history.json` (§2a, his own 2026-10-04 request) and are read only by
`todo history` and `todo show`. `todo ready` lists only what can be dispatched, and
`tools/checks` runs `todo-valid` in every repo. The cost is in the one file that was
never migrated: the top-level `TODO.md`, measured 2026-10-09 at 2,100 lines and
155,662 characters, about 39k tokens. Every session that reads it pays for all of it:
- `## Needs Jacob` is 102k characters, with 12 inline "DONE" bullets still in it;
- `## Confirmed` and `## Unconfirmed` together are 13k characters of settled findings;
- the `## Resolved` sections are 9k characters.

Phase 3 (§6) planned that migration, and it waits on two things:
- `dispatch-guard.sh` must let the planner write `todo.json` and `todo-history.json`
  at the top level (a harness change);
- the CLI must accept a store in a folder that is not a git repo. Today `todo -C .`
  answers "no todo.json ... run `todo init --prefix XX` there first", so `init` may be
  all it needs. Unconfirmed until the todo agent runs it.

**What changes:**
1. **The top level moves into the store** (phase 3, as planned). The planner runs
   `todo init --prefix tl`, then `todo import TODO.md --dry-run`, reviews the result,
   imports and renders. DONE bullets and Resolved sections go to history. A confirmed
   finding becomes a closed item with its evidence, so it stays findable by
   `todo history --grep` without being loaded. `TODO.md` is rendered from then on, and
   holds open items only.

   **The import rule (todo td-22), approved: Jacob 2026-10-09 ("2) Yes"):** a dry run
   that day sent the 24 blocks under "## Confirmed" to the store as open notes. One
   vocab.json import rule closes them: a heading matching `confirmed` (word boundary,
   so "Unconfirmed" stays open) imports as `done`. It comes with its test, and it
   applies to every repo's import.
2. **Agents read lines, not the file.** A session uses `todo list` (one line per item),
   `todo show ID` and `todo ready`. It never reads the rendered `TODO.md`, which is for
   Jacob. Whether a task was done is `todo show ID`, which falls through to history.
3. **Blocking is a field, so a blocked item is not loaded with the ready ones.** A new
   field, `blocked_by: [ids]`, names the items that must close first. `todo ready`
   leaves out an item until every id it names is in history, and `todo list --ready`
   and `--blocked` split the two. The gates: a `blocked_by` id that exists in neither
   file fails, and a cycle fails.
4. **Ids and tags as PLAN-services.md §3 says:**
   - `todo:<id>` everywhere;
   - tags from the vocabulary (`repo:`, `plan:`, `kind:`, `origin:`, `status:`, `ref:`);
   - `get`, `find` and `refs` at its server.

   `find plan:PLAN-context-hygiene.md§0` lists every item a plan section produced.
5. **Hooks and checks call the CLI:**
   - a Dispatch line may point at `todo:<id>`, and `auto-relay.sh` refuses a line whose
     id is closed or blocked (phase 5's "pointers accept `todo:ID`", now with a check);
   - `todo brief <id>` is the dispatch brief, so the dispatcher no longer copies an
     item's text into it;
   - the "Keep an active TODO" rule becomes checkable: setup's zero-drift test (§7)
     already requires a store.
6. **Plans get the same treatment.** Every plan section already has an address,
   `plan:PLAN-x.md§n`. What is missing:
   - a verb that prints one section, so an agent loads §3 rather than 550 lines;
   - a `status:` per section (open, approved, done), so `setup plans` can list what is
     still live, and done sections are skipped unless asked for.

   This is the plans gate's job, so it belongs to setup.

**Storage format.** "A database and CLI" holds already, as far as any caller can tell:
the CLI is the only way in. So whether the file behind it is JSON or SQLite is internal
to the tool. JSON stays for now, for two reasons:
- **It shows in a diff.** A change to an item reads in the repo's history; a SQLite
  file is binary.
- **History's append-only check reads it.** That check works against the git log of
  `todo-history.json` (§2a gates).

SQLite is the answer once a query is slow or a store holds thousands of items, and the
switch is the todo agent's alone, because no caller reads the file.

**Measure** (CLAUDE.md "To change an agent", step 4): the planner's starting context and
its per-turn reads of `TODO.md`, before and after step 1. Read with
`agents.sh tokens --prompts --since <the migration date>`.

**Jacob's answers, 2026-10-09:** "1) yes 2) yes 3) yes 4) I dont understand this 5)
sure, though I don't understand how this fits our read-only and gated goals".
- **Steps 1-2, 3, 4-5: approved: Jacob 2026-10-09.** For tags, step 4 uses only the
  seven shared namespaces in PLAN-services.md §3's table. The hinges cell of his row 3
  named that, so nothing new gets added before the architecture service exists.
- **Step 6 (one plan section at a time): not approved.** It is explained again in the
  planner's reply and asked again.
- **Storage stays JSON: approved: Jacob 2026-10-09,** with the guard below added,
  because his question found a gap.

**The gap his question found: the store files are not guarded.** The rendered
`TODO.md` is written read-only (mode 0444) and carries a seal, so a hand edit fails
`todo check`. But `todo.json` and `todo-history.json` are plain writable files: on
2026-10-09 both were mode 0644 in `tools/todo/`. Any session with the Edit tool can
change an item without the CLI. Whatever it writes passes so long as it is
well-formed, and the "only way in" is then a convention rather than a gate. History's
append-only audit only catches it after a commit. SQLite would not close this either:
the `sqlite3` command writes to it just as Edit writes JSON. The format is not what
gates it. What gates it:
1. **The store files are written read-only.** The CLI makes a file writable for its
   one write, then sets it back, as `TODO.md` is handled now.
2. **The store carries a seal** over its own content, the same digest `TODO.md`
   carries. `todo check` fails on a store whose seal does not match its last write by
   the CLI.
3. **A PreToolUse hook refuses Edit and Write on `todo.json` and `todo-history.json`,**
   and names the `todo` command to use. It lives with the shared hooks in
   `tools/hooks/source/`, so every repo gets it through setup. Bash writes are caught
   as well as `lib/write-targets.sh` can see them.

The tests:
- a hand edit to a planted store fails `todo check`;
- the hook blocks Edit on the store, and passes Edit on any other file;
- a CLI write still succeeds on a read-only file.

**Jacob's answers to the planner's two rows, 2026-10-09:** "1) ues 2) yes".
- **Step 6: approved: Jacob 2026-10-09,** widened by his request in the same session:
  "You often make references to specific plans and todos without showing me the full
  text. Can we have hooks that pulls that data by reference rather than having you
  retrieve it and output it to me?" Design:
  - **setup** adds `setup plans show <FILE> §<n>`, which prints one section, and a
    status for each section;
  - **harness** adds a Stop hook, `show-refs.sh`, on both windows. It finds each
    pointer in the final reply: `FILE §n`, `TODO.md "title"`, `<repo>/TODO.md "title"`
    and `todo:<id>`. It resolves each one through its owner's CLI (`setup plans show`,
    `todo show`, and a bold-title match in a hand-written TODO.md until that file is
    migrated). It prints the text to Jacob as the hook's `systemMessage`.
    - A synchronous hook's `systemMessage` "shows a message to the user, not the
      model" (agent-sdk/hooks#systemmessage-not-appearing-in-output). An async hook's
      goes to the model instead (hooks#how-async-hooks-execute), so this one must be
      synchronous.
    - **No model tokens are spent:** the model writes a pointer, and the hook shows
      the text.
    - **Caps:** up to 25 lines per reference, plus the path of a file holding the full
      section.
    - **A pointer that does not resolve is shown as `does not resolve`,** which also
      checks every pointer the planner writes.
    - It runs only after Jacob registers it in `settings.json`.
- **The store guard: approved: Jacob 2026-10-09,** and widened to every store: see
  PLAN-services.md §3 "Every data store is gated and read-only". That section's single
  hook replaces the todo-only hook in step 3 above.
