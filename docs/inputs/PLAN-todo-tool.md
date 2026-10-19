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
todo blockers [--json]                   what holds each open item (blocked_by, waits_on), and the dispatchable roots (td-39)
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
  because his question found a gap. **Superseded 2026-10-18 by §10.6:** the store
  moves to SQLite, now.

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

## 10. What blocks each branch (Jacob, 2026-10-12)

> "how are there 66 todos and almost none are do-able. This needs an audit. When I ask
> for todos to be dispatched, I need to be presented with things that are blocking
> certain 'branches' of todo, otherwise, it defeats the point."

**Approved: Jacob 2026-10-12** (the words above). The shape below is the planner's,
under root principle 1 (PLAN-architecture.md §5.6): the answer to "what blocks what"
is a command's output, never something an agent works out each time.

### 10.1 The audit (planner, 2026-10-12, from `todo list --all` and `todo ready`)

71 items are open across the 2 stores. 66 carry no approval, and 3 are ready except
for a missing size. Here is what they actually are:

| count | what | blocked on |
|---|---|---|
| 11 | income section headings A-K stored as items (inc-2..12) | nothing: they are groupings, not work |
| 27 | income questions (inc-13..41) | Jacob's answers. All are in the wizard: `wizard due` lists 40 |
| 10 | income actions (inc-42..52) | those answers |
| 4 | inc-54, inc-57, inc-58, td-2 | Jacob: a rename decision, a wizard fix, and `wiring --apply` twice |
| 2 | inc-60, inc-61 | the wizard's remote (Jacob's `setup --github`), and the wizard owner's reply |
| 5 | todo reports td-4, 7, 8, 9, 25 | other owners: each counterpart sits in their store |
| 12 | todo's own notes, decisions, suspicion and temp | no approval, and most lack a size: owner triage |

Not in this count: **the top-level TODO.md has no store** (§9 step 1 is still open), so
`dispatchable` cannot see any of its items. It is where most approved work lives.

**The causes are structural, not 66 separate problems:**
1. `dispatchable` needs Jacob's approval on every item, even an owner's own small bug
   in its own repo. **TD-B1 approved: Jacob 2026-10-12 ("TD-B1) yes"): approval by
   rule.** An item counts as approved when all of these hold:
   - its kind is `bug`, `suspicion` or `temp`;
   - its repo is its owner's own;
   - its size is S or M, and it has `work` and `done_when`;
   - it changes no settings, pushes to no new remote, and is not irreversible or
     outward-facing.

   Its approval is recorded as `source: rule TD-B1`, so a rule approval is never taken
   for Jacob's own. The kinds, sizes and exclusions are data in `vocab.json` (§10.4).
   Gates: a fixture for each condition shows the rule not applying when that condition
   fails, and `dispatchable` names rule approvals separately.
2. Headings were imported as items.
3. A `waiting-jacob` item does not say which of his actions clears it, so 41 items
   that one wizard session and one `wiring --apply` would clear look like 41
   separate blocks.
4. A report waits on another owner, but it still counts as this store's work.
5. Nothing names the root blocker of a branch. `dispatchable` prints only "66 carry
   no approval".

### 10.2 The fix

1. **`todo blockers [--root DIR]`, across every store.** It lists every open item that
   is not dispatchable, grouped by its root blocker. The roots are ranked by how many
   items each would free. One line per root: what it is, the one command or pointer
   that clears it, the count it frees, and the ids (the first 5, then a count). Its
   output is bounded: the top 10 roots, then a count of the rest. The kinds of root:
   - **jacob:** an answer (with the `wizard run <def>` command when the question is
     in a definition), an approval (`todo approve`), or a settings step;
   - **item:** the open item at the end of a `blocked_by` chain, followed to its end;
   - **owner:** a report waiting on another store's counterpart, with that id;
   - **field:** what `brief` needs and lacks (`size`, `work`, `done_when`), so the
     owner triages it.
2. **A `waits_on` field on every `waiting-jacob` item:** `wizard:<definition>`,
   `settings`, `approval`, or `decision:<FILE §n>`. Grouping uses it, never prose.
   `add`, `edit` and `import` refuse `waiting-jacob` without it. `check` lists old
   items that lack it, so `blockers` can name them, and fails none.
3. **`dispatchable`, when nothing is dispatchable,** prints the top 5 lines of
   `blockers` in place of the bare count.
4. **A heading is not an item.** `check` flags an item with no `work` that other items
   use as a group. The income owner turns inc-2..12 into a `group:` tag on their
   items and closes the headings (as `done-superseded`, so the history keeps them).
5. **Each owner triages its own items once:** set size, work and done_when, or close
   an item as stale with the reason, or report it.
6. **The importer reads what a hand TODO.md already says, so the top-level store can
   be made (§9 step 1).** The planner ran `todo init --prefix tl` at the top level
   on 2026-10-12; the empty store is there. A dry run of `todo import TODO.md` gave
   159 open and 57 closed. Importing that as it stands would put wrong facts in the
   store:
   - 91 items came in as `decision waiting-jacob`, because they sit under
     `## Needs Jacob`, even where the text says "approved: Jacob <date>";
   - preamble paragraphs and headings came in as notes ("The delegation layer lives
     in...", "#1: cloud offload").

   The rules, each with a fixture:
   - "approved: Jacob YYYY-MM-DD" in an item's lead sets its approval (date, plus the
     quoted words as the source), with status `open`;
   - a `waits_on` is set from "waits on W-1", "JS-5" and the like, when the pointer
     resolves; otherwise the item is listed for the planner;
   - text before a section's first bullet, and a bullet holding only a heading, is not
     an item.

   The planner does not import until a dry run shows no approved item left
   `waiting-jacob`. It then reviews the dry run once, imports and renders.
7. **The dispatcher, when Jacob asks to dispatch,** runs `todo dispatchable`, then
   `todo blockers`, and shows both before it sends anything. That is CLAUDE.md prose,
   the dispatcher's to write, once step 1 exists.

**Gates:** each root kind has a passing and a failing fixture. A chain fixture checks
that the root found is the end of the chain. A cycle in `blocked_by` is reported,
never looped on. `waits_on` values come from `vocab.json`, and a check confirms that
each value is used and each used value is declared. The count `blockers` frees must
equal the number of items it lists.

### 10.3 Decisions and lists are generated, not written (Jacob, 2026-10-12)

> "Decisions should be able to be generated procedurally, and so should todo lists
> (e.g. what is blocked, what is blocking, etc) Again, the goal is for this to be able
> to move foward with as little AI intervention as possible."

**Approved: Jacob 2026-10-12** (the words above). Most of the loop exists already:
the wizard can take a todo store's items as its questions, and it writes the answers
back through `todo` (tools/wizard README, the `todo` sink). What is missing is that a
decision is still prose in a reply, and an answer does not move anything forward on
its own.

**The loop, with no agent in it:**
1. **A decision is an item.** Kind `decision`, status `waiting-jacob`, `waits_on:
   approval`, plus three fields: `pointer` (a `FILE §n` that resolves), `hinges_on`,
   and `recommend` (`yes`, `no`, or one named option). An item with an option set uses
   `options`. `add` refuses a decision missing any of these. The planner and the owners
   create them with `todo add`; nobody types a Decisions table again.
2. **`todo decisions [--root DIR]` renders the table:** `| # | decision | hinges on |
   recommend |`. Rows are ordered by how many items each decision frees (from
   `blockers`), so the decision that unblocks the most comes first. The planner's
   reply includes this output, so the table is generated. `question-gate.sh` already
   checks that shape.
3. **Jacob answers wherever he likes:** in a window, or with `wizard run decisions`.
   A `decisions` wizard definition reads the store's `waiting-jacob` decisions, shows
   each one's recommendation as the default, and accepts yes, no, an option, or
   "skip". The answer is written back with `todo approve --source "wizard <date>"`, or
   for a no, `todo done --as rejected`.
4. **An answer moves things by itself.** Approving a decision closes it, which frees
   every item whose `blocked_by` names it. `dispatchable` then lists them, and the
   dispatcher sends them. A rejection marks its dependents `waits_on: decision` again,
   with the reason, and they show in `blockers`. Neither needs an agent's judgement.
5. **The lists are views of the store, never prose:** `dispatchable` (can go now),
   `blockers` (what blocks each branch, ranked), `decisions` (what Jacob alone can
   clear), and `tree` (the branches). TODO.md is rendered from the same store.

**Where the planner still has to think:** writing a plan, and deciding which steps
need Jacob's yes. Everything after that point (items, decisions, blocking, freeing,
dispatching) is procedure. G6's `sync-plans` (PLAN-services.md §3) creates a
`waiting-jacob` decision for each needs-yes step, so even that list is generated.

**Gates:** `decisions` output matches `question-gate.sh`'s shape (one shared
fixture). An approval through the wizard frees its dependents (fixture: a
decision, a blocked child, and the child dispatchable after `approve`). A rejected
decision never frees anything. The wizard definition's read must equal `todo list
--kind decision --status waiting-jacob` (`wizard check` already compares the two).

### 10.3a The table Jacob reads is numbered 1, 2, 3, and his reply is parsed (Jacob, 2026-10-12)

> "please list the rest 1,2,3,4 rather than this new shorthand you've adopted. If we
> need to proceduralize how these decision tables are generated, we should do so."

**Approved: Jacob 2026-10-12.** Ids such as `TD-B1` or `KB-1` are shorthand made up in
a reply, and they never reach Jacob again.
1. **`todo decisions` numbers its rows 1..n**, in the order 10.3 step 2 sets. The `#`
   column is that number only. The item id is kept out of the table, and the
   decision cell starts with the `FILE §n` pointer as now.
2. **Each render is saved as a snapshot,** with the date and the mapping from number
   to item id. A later render gets new numbers, and an answer is always read against
   the snapshot Jacob was shown.
3. **`todo answer "<his reply>"`** parses replies like "1) yes 2) no 3) b 4)
   elaborate" against the latest snapshot.
   - `yes`, `no` and a named option are applied as 10.3 step 3 describes.
   - "elaborate", or any other text, leaves the item waiting, and is attached to it
     as Jacob's words for the planner to answer.
   - A number not in the snapshot is refused by name, and nothing is applied
     silently.
4. **Until this is built,** the planner numbers each Decisions table 1..n by hand,
   and records each answer against the plan section its row points to.

**Gates:**
- a render then an answer approves exactly the items its numbers name (fixture);
- an answer to an older snapshot applies to that snapshot's items, not to the
  current numbering;
- "elaborate" changes no status;
- `question-gate.sh` accepts the numbered table (one shared fixture with 10.3).

### 10.3b Tables are recorded once and referred to by id (Jacob, 2026-10-12)

> "These decision and blocking and dispatch tables shouldn't be generated every time.
> I think this should be recorded and then if we need to re-use the information, it
> can also be referenced by id."

**Approved: Jacob 2026-10-12.** A table is a record, and a reply refers to it. It is
never retyped.
1. **Each Decisions table is stored once, as a record with an id** (`dt-<n>`), in the
   store that holds its items (10.3a's snapshot, made durable). The record holds:
   - its date;
   - the rows, numbered 1..n, each tied to an item id;
   - the status of each row.

   The record never changes. Jacob's answer is appended against it ("dt-4: 1 ok,
   2 yes, 4 elaborate").
2. **Re-asking cites the record.** "dt-4, rows 6-15 still open" refers to rows that
   already exist. When an elaboration changes a row's wording, `todo decisions --from
   dt-4` makes a new table that holds only the rows still open, and it records which
   earlier rows each new row supersedes. So nothing is lost and nothing is asked
   twice.
3. **Dispatch lines are item ids, not prose.** An approved item already holds its
   pointer, its work and its approval. So a `## Dispatch` line becomes `N. <item id>
   -- approved: <where it is recorded>`. `auto-relay.sh` and the dispatcher read the
   rest from the store (`todo brief <id>`). The same line is never sent twice: a sent
   item is marked `dispatched`.
4. **Blockers are derived, never kept as text.** `todo blockers` computes them from
   `waits_on` and the detectors (10.5). A reply cites a blocker by item id, and shows
   it in full only when it is new.
5. **Ids in the table, numbers for Jacob.** He answers by row number, as 10.3a says.
   The table's id says which table he is answering. Item ids such as `td-33` are
   store ids, never shorthand made up in a reply.

**Gates:**
- a second render of the same open rows returns the existing table id, and makes no
  new table;
- an answer that names a table id applies only to that table's rows;
- `auto-relay.sh` refuses a Dispatch line whose id is not an approved item, and one
  whose item is already marked dispatched;
- `question-gate.sh` accepts a table cited by id with no rows retyped.

**Until built:** the planner keeps writing tables by hand, and notes which earlier
table a row comes from.

### 10.4 Every knob is set through the service, so everything can be read-only (Jacob, 2026-10-12)

> "all of these things need to be adjustable via the service servers once implemented
> so that everything can be read only."

**Approved: Jacob 2026-10-12.** Nothing in §10 is a constant in code. Every knob here
is data in the todo store's `vocab.json`, with a documented default:
- the `waits_on` values;
- the decision fields and recommend values;
- the root kinds and their ranking;
- the output bounds (10 roots, 5 ids, 5 lines in `dispatchable`);
- the import rules.

Today they change through `todo` commands. Once the services exist (PLAN-services.md
§3), they change through the todo service's server and nothing else, so the files
behind it, `vocab.json` included, can be read-only like the stores.

**Gate:** each knob that code reads exists in `vocab.json`, and each key there is
read: §5's vocabulary check, extended to the new keys. A literal found in code that
belongs in vocab fails that check.

**Order:** todo (1-3 and 6, then its own triage under 5), then income (4, `waits_on`
on its items, its triage), then the planner's top-level import (6), then the
dispatcher (7). After that, 10.3: todo (the decision
fields, `decisions`, approve and reject freeing their dependents), then the wizard (the
`decisions` definition, after todo's fields exist), then the top-level store (§9 step
1), so the planner's decisions have a store to live in. §9 step 1, the top-level TODO.md moving
into a store, is what puts most approved work in view.

### 10.5 Detectors: a stall becomes an item without anyone finding it (Jacob, 2026-10-12)

> "So can stalls be programatically included in how todos cli works? It should [not]
> require that we "accidentally" find out."

**Approved: Jacob 2026-10-12.** This replaces `stalls` as a view of its own
(PLAN-architecture.md §11 S0). A stall or a lag is an ordinary todo item, written
and closed by a detector. So `list`, `blockers`, `dispatchable` and `decisions` show
it with no separate command, and no one has to go looking.

1. **A detector is data.** Detectors are registered in `vocab.json` under
   `detectors`. Each one has:
   - an `id`;
   - a `command`, which prints a JSON list of findings, one per repo and cause:
     `{repo, subject, count, evidence, clears_with}`;
   - the item `kind` it files (`stall` or `lag`);
   - `waits_on`, if the finding needs Jacob;
   - a `cadence`.

   todo runs the command and reads no roster: findings name repos, never agents
   (todo's own rule).
2. **`todo detect [--id D]` reconciles, and is idempotent.** Each finding becomes one
   item, keyed `detector:<id>:<repo>:<subject>`.
   - **A new finding** adds an item, with its evidence and `clears_with`.
   - **A finding seen again** updates the count and the evidence, and never adds a
     second item.
   - **A finding gone** closes the item with `closed_by: detector <id>`.

   An item can't be closed by hand while its detector still reports it: `done` refuses
   and names the detector.
3. **Rolled up, never flooded.** A finding is per repo and cause, with a count (for
   example, "13 uncommitted render files"), never per file. The cap is a vocab value.
4. **The detectors at the start** (each command owned by the repo named):
   - S2, uncommitted files from another session (`harness`, from the git-stamp ledger);
   - S3, built but unwired (`harness`, from F1's declarations);
   - S4, unfiled reports (`harness`, `report-filer.sh list --json`);
   - S5, a dispatch lost or ended with no check line (`harness`, `dispatches --json`);
   - S7, a Jacob step whose `done_check` passes, which closes it;
   - S1 and S6 as `lag` items, one per requirement and repo, from `checks practices
     --json` (PLAN-architecture.md §10).

   S8, the planner's slips, has no detector. Its gates block the act itself.
5. **When detectors run, with no one asking.**
   - **At session start:** `doctor` runs `todo detect` and prints the root blockers.
   - **On the event:** the SubagentStop hook runs S5's detector, and setup's render
     and the report filer run theirs.
   - **On a schedule:** a cron entry through `chron.py` runs all of them hourly, so a
     stall appears even when no session is open.
6. **A detector that does not run is itself a finding.** Each run records its time and
   exit code in the store.
   - A failing command files a `stall` item, "detector D failed", with its stderr
     digest.
   - A detector past twice its cadence is reported by `todo check` and by `doctor`.
   - A detector that is present, silent and not running is the worst state there is,
     so it is checked like any other.

**Gates (fixtures):**
- each detector, on a planted cause, files exactly one item, and a second run files
  none;
- removing the cause closes the item;
- `done` by hand refuses while the cause is present;
- a failing detector command files the "detector failed" item;
- a stale run time is reported;
- `blockers` ranks a detector item with its dependents;
- the vocab check covers `detectors` in both directions.

**Order:** todo builds `detect` and the item keying, then harness writes S2-S5's
commands (PLAN-architecture.md §11), then checks supplies `practices --json` for the
`lag` items, then cron-scheduler adds the hourly entry.

### 10.6 The store moves to SQLite, now (Jacob, 2026-10-18)

**Approved: Jacob 2026-10-18** ("3) now"), under PLAN-services.md §3 "Every store is
static or dynamic". This replaces §9's "Storage stays JSON" (2026-10-09). Both of that
answer's reasons still hold, and the static export keeps them:
- **It shows in a diff.** The committed export is text, so a change to an item reads
  in the repo's history as before.
- **History's append-only check** runs against the git log of the history export
  instead of `todo-history.json`.

**What changes, per repo:**
- **The dynamic store:** `todo.db`, one SQLite file, gitignored. It holds three tables
  for today's three files: open items, history, and records. History is append-only
  in the schema itself: a trigger refuses UPDATE and DELETE on it.
- **The static stores, committed:**
  - the rendered `TODO.md`, unchanged;
  - an export of each table: sorted, one record per line, deterministic, at mode 0444,
    sealed, with its producer and `user_version` in a header.

  Every write ends by rewriting the exports, in the same command (PLAN-repo-setup.md
  §7.11: store to files always). `todo check` fails when an export and the store
  differ.
- **A fresh clone has only the exports.** The first `todo` command on a repo with no
  `todo.db` imports them. So the exports are also the way across machines and into
  `DATA_REPO`.
- **The store module has nothing todo-specific in it.** It opens with WAL and foreign
  keys on, migrates by `user_version`, wraps each write in a transaction, and writes
  the export. Setup lifts it as the shared Python helper (PLAN-services.md §3 ST6,
  §4 step 10.2).

**Before the switch: every direct reader.** Some code outside `tools/todo` reads
`todo.json` or `todo-history.json` by path: hooks, `agents.sh`, checks, setup or the
wizard. That breaks when the file goes. So todo's agent:
1. lists each such reader, with file and line;
2. moves each to a `todo` command. When the reader belongs to another repo, it reports
   it to that repo's owner in its report rather than editing it;
3. switches only once the list is empty.

The `accessor` check in tools/checks then covers `todo.db` as it covers any store.

**The migration:**
- one `todo migrate` per repo, which:
  - imports the JSON files into `todo.db`;
  - writes the exports;
  - checks that they hold the same items, history and records as the JSON did,
    record for record;
  - only then removes the JSON files, in one commit per repo;
- a dry run first across every repo that has a store (`todo repos`), reporting per
  repo: migrated, or why not;
- `.mutants/` and the fixtures move with the tests, not by `migrate`.

**Gates:**
- `stores-classified` (PLAN-services.md §3 ST5) passes for todo: `todo.db` is
  declared dynamic, and the exports and `TODO.md` are declared static and regenerable;
- the history trigger refuses an UPDATE (a test);
- removing `todo.db` and running `todo list` gives back the same items from the
  exports (a test);
- an export edited by hand fails `todo check`.

**Measure:** `agents.sh tokens --prompts --since 2026-10-18` for the planner and the
dispatcher, before and after. Nothing they read should change size.
