# hub TODO

## Own bugs

- **The leak audit's terms are three shapes** (email, home-folder path, phone); the
  credential half is tools/checks `no-secrets`. Names of people and of private repos
  are not caught: `claudeTest-CLAUDE.md` names private repos, as it did in the first
  copy. Unconfirmed whether that matters for a public repo; Jacob's call if it does.

## Open decisions

- **The git-side gates are off** (setup 2026-10-05): `.githooks/{pre-commit,commit-msg,
  check-pass}` are installed, but `core.hooksPath` is unset and `githooks.checks` has no
  checks CLI (setup reports `needs-jacob`). The hook wiring itself is done: Jacob's
  applied proposal, `cmp`-equal to `settings.proposed.json`, committed 10589a4
  (2026-10-13, Q6b).
- **TODO import (Q7's second half) not done**: `todo import TODO.md --dry-run` waits on
  todo's importer fix (dispatcher, 2026-10-13). This file stays hand-kept until then.
- **When to refresh `docs/inputs/` again.** `./dev.sh check` prints drift as a note,
  never a fail: the copies are snapshots, and a top-level plan edit must not block a
  hub commit. Refresh before handing the cloud a new pass (`./dev.sh refresh`).

- **`plan/hub` carries the §5.11 pass and H1a-0** (2026-10-13): the cloud pass applied
  D1-D4, 5.5, D9 and answered brief §4 questions 11-12 (§11, §12, Decisions 14-16);
  the local pass (6d2b3f6) added slice H1a-0 "the write gate" before H1a-1
  (PLAN-services.md §3 steps 3, 7), `roles.<r>.writes`, §8 "write gate", Decision 17,
  and re-costed §9 to 1.7-2.5M (58-87u). Decisions 9 and 14-17 await Jacob, via the
  planner. PLAN-context-hygiene.md and PLAN-services.md are still not §2 inputs or
  copies here (the planner's call; the pointer gate skips uncopied plans).
- **Seven inputs drifted, not refreshed** (2026-10-08, `./dev.sh drift`):
  claudeTest-CLAUDE.md, routing-tree, agent-groups, repo-setup, portable-env,
  usage-reporting, check-progress. Only the brief was re-copied for question 11.
  Eight on 2026-10-09: PLAN-todo-tool.md has drifted too.
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
  `TestHooktests`). Not re-run since `main` gained Q7 (parts) and `plan/hub` 6d2b3f6:
re-run that merge-tree before merging.

## Own limits, known

- **The check runs in parts (Q7, 2026-10-13, PLAN-small-tasks §3/§7)**: `check.parts.json`
  through `devtools/parts.py` 1.1.0 (setup's render, byte-equal to tools/checks'
  source; `tests/test_parts.py` holds that, the parts == test modules + gates both
  ways, and the wiring on a scratch copy, incl. the shared check-json and
  check-partial). `devtools/checkjson.py` is gone: `--json` is the runner's, one check
  per part, a part's FAIL lines as its failures (no file/line any more). Limits: the
  runner has no `unchecked` outcome, so a gate exiting 3 (a lone clone or a worktree
  without site-scrapers: hooktests, plans, checks) is a FAILED part, named by its last
  line -- red, never ok (reported to checks, below). `--resume` skips little: five
  gate parts read `.`, and six parts are `always` (they read other repos or file modes).
  A full check under other agents' suites took 20 min on 2026-10-13 (hooktests most).
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

- **`sealed` is red on a fresh clone** (2026-10-09, PLAN-architecture-review.md §4 U1):
  git keeps no mode bits, so a clone (the cloud pass) and any checkout or merge that
  rewrites a copy leave it 0644, and `./dev.sh check` fails until `./dev.sh seal`. Each
  FAIL line names that command. The mode is a marker only (W6: Edit/Write replace a
  0444 file and keep 0444); the guard is `inputs` against SHA256SUMS
  (`TestSealed.test_the_mode_is_not_the_guard_inputs_is` holds that). Not sealed:
  README.md and SHA256SUMS (refresh rewrites SHA256SUMS in place).

## Unconfirmed suspicions

- **Someone else ran this repo's new parts check at 00:24 on 2026-10-13** (pid 86882,
  gone by 00:26): `.progress/check.json.logs/` held a `test.hubcheck` log (44 tests, OK)
  and an empty `hooktests` log I did not start, and my `./dev.sh test test.parts` said
  "a run is writing the progress file now (pid 86882)". Unknown who (an agent's
  `dev.sh check` on hub, or a shared check). Probe: `agents.sh dispatches --open` /
  the ledger for a hub run at that time. Harmless here; two runs share one progress file.
- (The fix pass did see the new inputs: it merged `origin/main` into
  `plan/hub` first, 0e779c1, and PLAN-hub.md cites PLAN-usage-reporting.md §3 and
  PLAN-hard-gates.md §2; checked 2026-10-08.)

## Reported to other owners

- **checks** (via the dispatcher, 2026-10-13): the shared runner `parts.py` 1.1.0 maps
  any non-zero exit to `fail`; it has no `unchecked` outcome for a part that exits 3
  (the convention hub, setup and hooks use for "a sibling tool is absent"). So a lone
  clone's check goes red where it was unchecked, and `--json` says `fail` where the
  schema has `unchecked`. Input: a part `{"run": "echo 'UNCHECKED: x'; exit 3"}`.
  Expected: `unchecked` with its reason (never ok). Hub adopted it anyway.

- **planner** (via the dispatcher, 2026-10-09): PLAN-architecture-review.md §4 U1 cites
  "its TODO.md:541 says 0444", but hub's TODO.md has no such line (94 lines); 541 is
  claudeTest's top-level TODO.md, Decision 39 (open), which proposes that the TOP-level
  `PLAN-hub-brief.md` become a 0444 copy of hub's brief, gated by hub's check. The
  docs/inputs copies are now 0444 anyway (`sealed`). Decision 39's own gate (top copy
  differs or is writable) is not built: it waits on that decision.
- **hooks** (via the dispatcher, 2026-10-09): `./dev.sh check` is red on `checks`
  only: `hooks copies printed no report (exit 2): FAIL lib/extra-stores.sh: no test`
  and "the source is not well-formed" [hooks-installed]. Cause: tools/hooks' UNTRACKED
  `source/lib/extra-stores.sh` (with `store-guard.sh` and its test modified; HEAD
  a953a98), i.e. their work in progress. Nothing changed here for it.

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
