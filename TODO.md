# hub TODO

## Own bugs

- **`./dev.sh check` is red on `hooks-installed`, not by anything here** (hub,
  2026-10-04): mid-session, `tools/hooks` gained an uncommitted edit to
  `source/hooks/test-no-inline-blobs.sh` (+71 lines of cases), and `./hooks copies`
  then reported all 14 copies of that file as DRIFT, this one included. The other six
  gates were green in the same run. When tools/hooks commits it, reinstall this copy
  (re-run `../setup/setup .`, or the reinstall the hooks owner names) and re-run the
  check. Not reinstalled from an uncommitted source on purpose.
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
- None other open. (The setup `.gitignore` report was fixed in tools/setup 7336f9f and
  applied here 2026-10-04.)
