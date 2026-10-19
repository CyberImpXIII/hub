<!-- rendered by todo from todo.json (22 open, 3 closed in todo-history.json; seal 181f8ad068a0): do not edit by hand, `todo check` fails on a hand edit. Change items with the todo CLI; a hand edit is recovered with `todo import`. -->
# hub TODO

## Own bugs

- **hb-1 · The leak audit's terms are three shapes**
  (email, home-folder path, phone); the
  credential half is tools/checks `no-secrets`. Names of people and of private repos
  are not caught: `claudeTest-CLAUDE.md` names private repos, as it did in the first
  copy. Unconfirmed whether that matters for a public repo; Jacob's call if it does.
  · added: 2026-10-19

- **hb-22 · test_parts goes red on tools/checks' uncommitted runner edits**
  2026-10-19 13:00, tl-356: commit.sh's check failed test.parts (test_the_runner_copy_agrees_with_its_source) while tools/checks had checkslib/parts.py modified and uncommitted (mtime 12:59; adds --jobs, 1.3.0 -> next). Nothing in hub changed. hooks-installed treats an uncommitted source as UNCHECKED; this test compares with the working tree, so another owner's mid-edit blocks every hub commit.
  · work: test
  · done when: the test compares with tools/checks' committed runner (git show HEAD:checkslib/parts.py) or is UNCHECKED while the source is uncommitted; a fixture shows each
  · added: 2026-10-19

## Open decisions

- **hb-2 · The git-side gates are off**
  (setup 2026-10-05): `.githooks/{pre-commit,commit-msg,
  check-pass}` are installed, but `core.hooksPath` is unset and `githooks.checks` has no
  checks CLI (setup reports `needs-jacob`). The hook wiring itself is done: Jacob's
  applied proposal, `cmp`-equal to `settings.proposed.json`, committed 10589a4
  (2026-10-13, Q6b).
  · added: 2026-10-19

- **hb-3 · When to refresh `docs/inputs/` again.**
  `./dev.sh check` prints drift as a note,
  never a fail: the copies are snapshots, and a top-level plan edit must not block a
  hub commit. Refresh before handing the cloud a new pass (`./dev.sh refresh`).
  · added: 2026-10-19

- **hb-4 · `plan/hub` carries the §5.11 pass and H1a-0**
  (2026-10-13): the cloud pass applied
  D1-D4, 5.5, D9 and answered brief §4 questions 11-12 (§11, §12, Decisions 14-16);
  the local pass (6d2b3f6) added slice H1a-0 "the write gate" before H1a-1
  (PLAN-services.md §3 steps 3, 7), `roles.<r>.writes`, §8 "write gate", Decision 17,
  and re-costed §9 to 1.7-2.5M (58-87u). Decisions 9 and 14-17 await Jacob, via the
  planner. PLAN-context-hygiene.md and PLAN-services.md are still not §2 inputs or
  copies here (the planner's call; the pointer gate skips uncopied plans).
  · added: 2026-10-19

- **hb-5 · Seven inputs drifted, not refreshed**
  (2026-10-08, `./dev.sh drift`):
  claudeTest-CLAUDE.md, routing-tree, agent-groups, repo-setup, portable-env,
  usage-reporting, check-progress. Only the brief was re-copied for question 11.
  Eight on 2026-10-09: PLAN-todo-tool.md has drifted too.
  Refresh (leak audit first) before the next cloud pass.
  2026-10-19 (tl-316): routing-tree and the brief re-copied for routing-tree §15 with
  the new `./dev.sh refresh COPY...`; `./dev.sh drift` then listed eight still drifted
  (claudeTest-CLAUDE.md, agent-groups, todo-tool, cloud-offload, repo-setup,
  portable-env, usage-reporting, check-progress).
  · added: 2026-10-19

- **hb-7 · `.claude/settings.json` is modified and uncommitted, not by an agent here**
  (mtime 2026-10-15 20:45; +3 hook registrations: git-funnel, store-guard x2). It is
  most likely Jacob applying setup's proposal for the 790d4bd render (Own limits,
  "checks is red"). Left unstaged by tl-316; Jacob's to commit.
  · added: 2026-10-19

- **hb-8 · Where the brief is edited.**
  routing-tree §13.5 says hub owns the brief, but
  `docs/inputs/README.md` makes the top-level `PLAN-hub-brief.md` its original, and
  `./dev.sh refresh` copies the original over `PLAN-hub-brief.md` here. So fixed point
  9 (2026-10-04) was written at the top-level original and refreshed in; an edit made
  only to this repo's copy would be undone by the next refresh. Hinges on whether the
  copy direction should flip for the brief (this repo the original); the planner's
  and Jacob's call, since the top level is the planner's.
  · added: 2026-10-19

- **hb-9 · Merging `plan/hub` into `main` conflicts in `TODO.md`, and only there**
  (confirmed
  2026-10-08: `git merge-tree --write-tree origin/main origin/plan/hub` -> one
  CONFLICT, TODO.md; heads aa949b2 / e80d6b7). When to merge waits on Jacob's yes on
  PLAN-hub.md's Decisions. On the merge, take `plan/hub`'s TODO.md as the base and drop
  its own-bug entry "`./dev.sh check` counts an UNCHECKED hook test as a FAIL": fixed
  on `main` 2026-10-08 (`cmd_hooktests` returns 3; `tests/test_hubcheck.py`
  `TestHooktests`). Not re-run since `main` gained Q7 (parts) and `plan/hub` 6d2b3f6:
  re-run that merge-tree before merging. Since tl-356 (2026-10-19) `main`'s TODO.md is
  rendered from `todo.json`: bring `plan/hub`'s entries in with `todo add`, never by
  merging the text.
  · added: 2026-10-19

## Unconfirmed suspicions

- **hb-16 · Someone else ran this repo's new parts check at 00:24 on 2026-10-13**
  (pid 86882,
  gone by 00:26): `.progress/check.json.logs/` held a `test.hubcheck` log (44 tests, OK)
  and an empty `hooktests` log I did not start, and my `./dev.sh test test.parts` said
  "a run is writing the progress file now (pid 86882)". Unknown who (an agent's
  `dev.sh check` on hub, or a shared check). Probe: `agents.sh dispatches --open` /
  the ledger for a hub run at that time. Harmless here; two runs share one progress file.
  · probe: `agents.sh dispatches --open` / the ledger for a hub run at that time.
  · added: 2026-10-19

## Reported to other owners

## Notes

- **hb-10 · The check runs in parts (Q7, 2026-10-13, PLAN-small-tasks §3/§7)**
  : `check.parts.json`
  through `devtools/parts.py` 1.2.0 (setup's render b33b571, byte-equal to tools/checks'
  source; `tests/test_parts.py` holds that, the parts == test modules + gates both
  ways, and the wiring on a scratch copy, incl. the shared check-json and
  check-partial). `devtools/checkjson.py` is gone: `--json` is the runner's, one check
  per part, a part's FAIL lines as its failures. A gate exiting 3 (a lone clone or a
  worktree without site-scrapers: hooktests, plans, checks) is `UNCHK`/`unchecked`
  and **does not make the run red** (runner 1.2.0's contract; 1.1.0 called it a fail;
  `test_a_gate_exiting_3_is_unchecked_never_ok_and_never_kept` holds it and fails on
  1.1.0). Open: whether hub wants an unchecked gate to block a commit; today only the
  summary line says so. `--resume` skips little: five gate parts read `.`, and six are
  `always` (they read other repos or file modes). A full check under other agents'
  suites took 15-20 min on 2026-10-13 (hooktests 904 s).
  · added: 2026-10-19

- **hb-11 · Shared hook copies drift whenever tools/hooks moves on**
  : setup leaves a logic
  drift for the owner, so `checks` (`hooks-installed`) goes red here until someone runs
  `setup tools/hub --only hooks --rebuild`. Last seen 2026-10-19 (tl-356):
  `lib/ledger.sh`, `hooks/store-guard.sh` and its test, behind tools/hooks fc28e54 and
  bdd932f (2026-10-13); rebuilt, and `./dev.sh test checks` went from FAIL to ok. No
  gate warns before a commit hits it.
  · added: 2026-10-19

- **hb-12 · Roles are the §4.1 starting set**
  (`gate_role` in dev.sh): inputs, plans -> docs;
  leaks, checks -> audit; the rest -> code. That each names a role in hub's group
  waits on the node registry (§4.4's second gate); hub has no group in the manifest yet.
  · added: 2026-10-19

- **hb-13 · The numbering gate reads column-0 items only**
  (`hubcheck.py brief_numbering`,
  2026-10-05): each must be previous + 1 or 1 (a new list). Not seen: a duplicate in a
  nested (indented) list, or a second list that restarts at 1 where a continuation was
  meant. The ok line prints the item count (20 on 2026-10-05).
  · added: 2026-10-19

- **hb-14 · The brief-pointer gate checks that a target exists, not what it says**
  (`hubcheck.py brief_pointers`, 2026-10-04): `§N` in the §2 table and `<plan> §N`
  in the text must be a `## N.` heading in the copy. Not checked: that fixed point 9
  says what routing-tree §13 decided (meaning, by reading only), `§N.M` subsections,
  bare `§N` without a plan name, and a pointer split across a line break. The ok line
  prints how many it checked (49 on 2026-10-04), so a regex that stops matching shows
  as a drop, not a pass.
  · added: 2026-10-19

- **hb-15 · `sealed` is red on a fresh clone**
  (2026-10-09, PLAN-architecture-review.md §4 U1):
  git keeps no mode bits, so a clone (the cloud pass) and any checkout or merge that
  rewrites a copy leave it 0644, and `./dev.sh check` fails until `./dev.sh seal`. Each
  FAIL line names that command. The mode is a marker only (W6: Edit/Write replace a
  0444 file and keep 0444); the guard is `inputs` against SHA256SUMS
  (`TestSealed.test_the_mode_is_not_the_guard_inputs_is` holds that). Not sealed:
  README.md and SHA256SUMS (refresh rewrites SHA256SUMS in place).
  · added: 2026-10-19

- **hb-17 · Reported to planner: routing-tree §15 has a split sentence**
  (via the dispatcher,
  2026-10-19, tl-316; still there on the 2026-10-19 re-copy for tl-356): routing-tree §15 has a
  sentence split by an insertion: the bullet "Jacob's first use of it sets
  `planner.effort` ..." ends "It takes effect at the planner window's next start. A
  change `check`" and the next line, at column 0, reads "refuses shows its message and
  changes nothing:", so the refusal list now reads as part of the step-0 bullets. The
  copy here (sha256 86a06dd2...) carries it as written; re-copy after the fix with
  `./dev.sh refresh PLAN-routing-tree.md`.
  2026-10-19 13:22 (tl-379): still split in the re-copy ('A change `check`' / 'refuses shows its message' at routing-tree §15).
  · added: 2026-10-19

- **hb-18 · Reported to planner: review U1 cites a TODO.md line hub does not have**
  (via the
  dispatcher, 2026-10-09): PLAN-architecture-review.md §4 U1 cites
  "its TODO.md:541 says 0444", but hub's TODO.md has no such line (94 lines); 541 is
  claudeTest's top-level TODO.md, Decision 39 (open), which proposes that the TOP-level
  `PLAN-hub-brief.md` become a 0444 copy of hub's brief, gated by hub's check. The
  docs/inputs copies are now 0444 anyway (`sealed`). Decision 39's own gate (top copy
  differs or is writable) is not built: it waits on that decision.
  · added: 2026-10-19

- **hb-19 · Requests to other owners wait in `origin/plan/hub:TODO.md`**
  , drafted there, to
  send after Jacob's yes on PLAN-hub.md's Decisions. (The planner's §4a report was
  overtaken by the fix pass; hub's check is a real gate since 47eea1a.)
  · added: 2026-10-19

- **hb-21 · Routing-tree copy is the 12:28 snapshot; the original moved on at 12:44**
  tl-356 copied PLAN-routing-tree.md at 2026-10-19 12:28 (§15-§19, sha in SHA256SUMS). At 12:44 the planner's edit added §10.1 (Jacob's D1-D5 for the cloud plan), §16 step 4 answered (research answers) and §17.1 (fan-out), and names a §20 not yet written; ./dev.sh drift lists the copy as DIFF. Not re-copied mid-edit. §10.1 D1 says hub refreshes the stale copies and SHA256SUMS before the cloud session.
  2026-10-19 13:22 (tl-379): PLAN-routing-tree.md re-copied with the brief (§20-§23 and the 12:44 edit now in the copy). Not the full refresh D1 asks for: ./dev.sh drift still lists 8 DIFF (claudeTest-CLAUDE.md, agent-groups, todo-tool, cloud-offload, repo-setup, portable-env, usage-reporting, check-progress).
  · work: docs
  · done when: after the planner's §20 lands: ./dev.sh refresh (all, per D1), README bullet, ./dev.sh drift shows no DIFF
  · added: 2026-10-19

- **hb-24 · PLAN-architecture.md §9 step 10.3: your services.json registry draft is in RESEARCH-registry-drafts.md, section `tools/hub`; write it in, then checks one registered**
  Draft by deep-work 2026-10-19 (tl-322), read-only: description, stores and shapes for tools/hub, written from its CLAUDE.md and cli.json; validated as written there: checks one registered and checks one services-valid both ok on a git-archive copy of the repo with the draft as services.json, other fields unchanged. stores [] (no cli.json); no shapes; the description says planning stage, so it changes when the hub is built. Reword the description freely; stores must stay equal to cli.json's store (registered holds them equal both ways).
  filed 2026-10-19 in tools/hub/TODO.md as a bullet marked todo:tl-341: hub has no store (their_id stays null)
  · parent: tl-341
  · done when: services.json in tools/hub carries description, stores and (where any) shapes, and 'checks one registered tools/hub' from tools/checks is ok
  · added: 2026-10-19

- **hb-25 · To hub: serve the ctx: store as a first-phase hub store (dt-5 row 4)**
  2026-10-15: dt-5 row 4 (Jacob 2026-10-13, TODO.md): the first-phase hub stores are ctx: and todo:. No hub store or item tracks serving the ctx: store (todo repos lists no hub store; tools/hub TODO.md and PLAN-hub-brief.md do not name ctx:). Relayed by the dispatcher from this agent's report.
  2026-10-18: re-read against §3 'Every store is static or dynamic' (ST1-ST5): unchanged. Its done_when (hub serves ctx: get/find/refs with a contract store.py calls) is ST4's form (<service>:<id> resolved through the owner's get and refs). Whether the ctx: store itself must become SQLite (ST1) or is static-immutable (ST2) is a separate item §4 step 10.4's planner files from 10.3's report, not this one.
  2026-10-19: re-pinned (tl-373). The §3 change since the 2026-10-18 pin is the R3 amendment (research routing: desk research to research on the model PLAN-routing-tree.md §16 prefers); it touches none of ST1-ST5 or the ctx: hub-store row this item rests on, so the pin is only refreshed.
  2026-10-19: todo check fails 'reports ch-65: hub has a store now: pair it with todo report ch-65 --to hub' -- present at fff36a6 too (stash run), not from the re-pin. Left for the dispatcher: pairing writes hub's store, outside tl-373's scope.
  · parent: ch-65
  · work: code
  · done when: the hub server serves the ctx: store's get/find/refs as a first-phase store, with a contract store.py can call
  · added: 2026-10-19
