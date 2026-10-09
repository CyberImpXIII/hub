# hub TODO

## Own bugs

- **The leak audit's terms are three shapes** (email, home-folder path, phone); the
  credential half is tools/checks `no-secrets`. Names of people and of private repos
  are not caught: `claudeTest-CLAUDE.md` names private repos, as it did in the first
  copy. Unconfirmed whether that matters for a public repo; Jacob's call if it does.

## Open decisions

- **`.claude/settings.json` lacks 12 hook registrations** (Jacob's step; setup
  2026-10-05): the shared hooks are installed but not registered, so they do not fire
  here, in a local session or a cloud one. setup wrote `.claude/settings.proposed.json`
  (untracked); applying it is `cp .claude/settings.proposed.json .claude/settings.json`.
  setup also installed `.githooks/{pre-commit,commit-msg,check-pass}`, but
  `core.hooksPath` is unset and `githooks.checks` has no checks CLI, so those gates are
  off (setup reports `needs-jacob`).
- **When to refresh `docs/inputs/` again.** `./dev.sh check` prints drift as a note,
  never a fail: the copies are snapshots, and a top-level plan edit must not block a
  hub commit. Refresh before handing the cloud a new pass (`./dev.sh refresh`).

- **Brief §4 question 11 (a session the hub runs) is unanswered** (added 2026-10-08,
  Jacob's yes relayed by the planner): PLAN-hub.md on `origin/plan/hub` answers ten.
  The next cloud pass adds its section and any Decisions rows. Question 11 points at
  PLAN-context-hygiene.md §0 (and that plan at PLAN-services.md §3); neither is a §2
  input or a copy here, so the brief states the requirement whole. Whether to add them
  to §2 (and copy them) is the planner's call; the pointer gate skips uncopied plans.
- **Seven inputs drifted, not refreshed** (2026-10-08, `./dev.sh drift`):
  claudeTest-CLAUDE.md, routing-tree, agent-groups, repo-setup, portable-env,
  usage-reporting, check-progress. Only the brief was re-copied for question 11.
  Refresh (leak audit first) before the next cloud pass.

- **Where the brief is edited.** routing-tree §13.5 says hub owns the brief, but
  `docs/inputs/README.md` makes the top-level `PLAN-hub-brief.md` its original, and
  `./dev.sh refresh` copies the original over `PLAN-hub-brief.md` here. So fixed point
  9 (2026-10-04) was written at the top-level original and refreshed in; an edit made
  only to this repo's copy would be undone by the next refresh. Hinges on whether the
  copy direction should flip for the brief (this repo the original); the planner's
  and Jacob's call, since the top level is the planner's.

- **Merging `plan/hub` into `main` conflicts in `TODO.md`, and only there** (confirmed
  2026-10-08: `git merge-tree --write-tree origin/main origin/plan/hub` -> one
  CONFLICT, TODO.md; heads aa949b2 / e80d6b7). When to merge waits on Jacob's yes on
  PLAN-hub.md's Decisions. On the merge, take `plan/hub`'s TODO.md as the base and drop
  its own-bug entry "`./dev.sh check` counts an UNCHECKED hook test as a FAIL": fixed
  on `main` 2026-10-08 (`cmd_hooktests` returns 3; `tests/test_hubcheck.py`
  `TestHooktests`). The local `plan/hub` branch is stale (a803ccf); use `origin/plan/hub`.

## Own limits, known

- **`check --json` (2026-10-05, PLAN-agent-groups §4.4)**: `devtools/checkjson.py`, the
  third copy of the same emitter (setup, hooks, hub), each with its own finding
  readers. The shape is held by the shared validator; the readers are per repo. If a
  fourth repo copies it, the row format and verdict belong in one place (tools/checks'
  call). Drift is not in `--json` (a note, not a check): `./dev.sh drift --json`. Exit
  codes other than 0/1/3 from a gate are `error`. `checks one check-json ../hub` took
  140 s on 2026-10-05 (limit 280 s; the plain check alone took 70 s, the 44 unit tests
  ~30 s of it, mostly the mutant and validator runs).
- **Roles are the §4.1 starting set** (`gate_role` in dev.sh): inputs, plans -> docs;
  leaks, checks -> audit; the rest -> code. That each names a role in hub's group
  waits on the node registry (§4.4's second gate); hub has no group in the manifest yet.

- **The numbering gate reads column-0 items only** (`hubcheck.py brief_numbering`,
  2026-10-05): each must be previous + 1 or 1 (a new list). Not seen: a duplicate in a
  nested (indented) list, or a second list that restarts at 1 where a continuation was
  meant. The ok line prints the item count (20 on 2026-10-05).

- **The brief-pointer gate checks that a target exists, not what it says**
  (`hubcheck.py brief_pointers`, 2026-10-04): `§N` in the §2 table and `<plan> §N`
  in the text must be a `## N.` heading in the copy. Not checked: that fixed point 9
  says what routing-tree §13 decided (meaning, by reading only), `§N.M` subsections,
  bare `§N` without a plan name, and a pointer split across a line break. The ok line
  prints how many it checked (49 on 2026-10-04), so a regex that stops matching shows
  as a drop, not a pass.

## Unconfirmed suspicions

- None open. (The fix pass did see the new inputs: it merged `origin/main` into
  `plan/hub` first, 0e779c1, and PLAN-hub.md cites PLAN-usage-reporting.md §3 and
  PLAN-hard-gates.md §2; checked 2026-10-08.)

## Reported to other owners

- **hooks** (via the dispatcher, 2026-10-08): `./dev.sh check` is red on `checks`
  (`hooks-installed`: `prefer-recipes.sh` and `test-prefer-recipes.sh` drift) against
  tools/hooks' UNCOMMITTED `source/hooks/` edits (their tree: those two files and
  TODO.md modified, HEAD 43d2a1e). Not re-copied here: the source is mid-task.
  Re-copy once they commit. Unconfirmed: whether tools/checks should compare against
  the committed source rather than the working tree.
- The planner's §4a report was overtaken by the fix pass (above); the
  dispatcher's top-level `CLAUDE.md` row now says hub's check is a real gate since
  47eea1a (read 2026-10-08). The hub's requests to other owners are drafted in
  `origin/plan/hub:TODO.md`, to send after Jacob's yes on PLAN-hub.md's Decisions.
