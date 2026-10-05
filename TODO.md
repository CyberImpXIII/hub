# hub TODO

## Own bugs

- **Hook copies are reinstalled by hand-copying, because setup has no replace path**
  (hub, 2026-10-04): `setup . --dry-run` reports a drifted hook as `drift ... (not
  overwritten)` and nothing more. So after tools/hooks 0ddb31d, the six
  `.claude/hooks/` files were copied byte for byte from `tools/hooks/source/hooks/`
  (`cmp` equal, mode kept). That includes `prefer-recipes.sh`, which `hooks copies`
  did not flag because it differed only in its header. The next source change needs
  the same copy until setup gains an update mode (tools/setup's call).
- **The leak audit's terms are three shapes** (email, home-folder path, phone); the
  credential half is tools/checks `no-secrets`. Names of people and of private repos
  are not caught: `claudeTest-CLAUDE.md` names private repos, as it did in the first
  copy. Unconfirmed whether that matters for a public repo; Jacob's call if it does.

## Open decisions

- **`.claude/settings.json` is absent** (Jacob's step): the three shared hooks are
  installed but not registered, so they do not fire here, in a local session or a
  cloud one. setup wrote `.claude/settings.proposed.json` (untracked); applying it is
  `cp .claude/settings.proposed.json .claude/settings.json`.
- **When to refresh `docs/inputs/` again.** `./dev.sh check` prints drift as a note,
  never a fail: the copies are snapshots, and a top-level plan edit must not block a
  hub commit. Refresh before handing the cloud a new pass (`./dev.sh refresh`).

- **Where the brief is edited.** routing-tree §13.5 says hub owns the brief, but
  `docs/inputs/README.md` makes the top-level `PLAN-hub-brief.md` its original, and
  `./dev.sh refresh` copies the original over `PLAN-hub-brief.md` here. So fixed point
  9 (2026-10-04) was written at the top-level original and refreshed in; an edit made
  only to this repo's copy would be undone by the next refresh. Hinges on whether the
  copy direction should flip for the brief (this repo the original); the planner's
  and Jacob's call, since the top level is the planner's.

- **§14.6 names the manifest as a server input; fixed point 2 forbids the hub to open
  it** (2026-10-05). routing-tree §14.6: the server is "configured by two data files":
  the registry and "the manifest's `servers.<group>` entry". Brief fixed point 2: nothing
  under `tools/hub/` opens the manifest. The brief now leaves this to the plan's
  Decisions table (fixed point 10, "Not fixed") rather than guessing. Hinges on whether
  harness renders `servers.<group>` into the registry; the planner's and Jacob's call.
  Reported to the planner (below).

## Own limits, known

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

- **The fix pass may not see the new inputs** (hub, 2026-10-04): they are on `main`,
  and PLAN-hub-review.md §4a tells the cloud session to work on `plan/hub`, branched
  before them, and does not mention `main`. docs/inputs/README.md says to read them
  with `git show origin/main:docs/inputs/<file>`, but the cloud session reads the
  prompt first. Probe: whether the fix pass's commits cite PLAN-usage-reporting.md §3
  and PLAN-hard-gates.md §2. Reported to the planner (below).
- **`TODO.md` will conflict when `plan/hub` merges into `main`**: §4a step 4 has the
  cloud session write this file on `plan/hub`. Probe: `git merge-tree` of the two
  heads after the fix pass.

## Reported to other owners

- **planner** (via the dispatcher, 2026-10-04): PLAN-hub-review.md §4a's prompt should
  say "read `docs/inputs/` from `origin/main`" (or `main` be merged into `plan/hub`
  first), and should expect the TODO.md conflict above. Jacob's view message (§4a step
  3) is in no input; only the resumed session's transcript has it.
- **dispatcher** (2026-10-04): the top-level `CLAUDE.md` tools row for `tools/hub/`
  still says its `./dev.sh check` is setup's stub; it is a real check now.
- **planner** (via the dispatcher, 2026-10-05): routing-tree §14.6 lists "the
  manifest's `servers.<group>` entry" as the hub's second config file, against brief
  fixed point 2 ("nothing under `tools/hub/` opens the manifest"). Expected: §14.6 says
  the entry reaches the hub rendered into the registry, or fixed point 2 is amended.
  Also: the 2026-10-05 dispatch asked to renumber "the duplicate item 9 in §3"; no
  version of the brief in this repo (27d1a37..3f1bc95) nor the top-level original had
  one, so nothing was renumbered; §14.7's worked example may describe an uncommitted
  state. A numbering gate now catches it.
- None other open. (The setup `.gitignore` report was fixed in tools/setup 7336f9f and
  applied here 2026-10-04.)
