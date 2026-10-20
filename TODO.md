<!-- rendered by todo from todo.json (24 open, 9 closed in todo-history.json; seal 6f3aeef2c325): do not edit by hand, `todo check` fails on a hand edit. Change items with the todo CLI; a hand edit is recovered with `todo import`. -->
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
  2026-10-19 (tl-406): PLAN-context-hygiene.md is now a brief §2 input and a copy (42b8eb7). PLAN-services.md is not: the leak audit refused its original (home-folder path, its line 74); see the report item below.
  2026-10-19 evening (tl-406): PLAN-services.md is now a brief §2 input and a copy too (hb-27 closed).
  · added: 2026-10-19

- **hb-7 · `.claude/settings.json` is modified and uncommitted, not by an agent here**
  (mtime 2026-10-15 20:45; +3 hook registrations: git-funnel, store-guard x2). It is
  most likely Jacob applying setup's proposal for the 790d4bd render (Own limits,
  "checks is red"). Left unstaged by tl-316; Jacob's to commit.
  · added: 2026-10-19

- **hb-9 · Merging `plan/hub` into `main` conflicts in 10 files, not TODO.md only (re-run 2026-10-19)**
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
  2026-10-19 (tl-432) re-run: `git merge-tree --write-tree --name-only main plan/hub` (main bda5836, plan/hub 63cf780) -> 10 CONFLICTs: TODO.md, CLAUDE.md (1 hunk), PLAN-hub-brief.md (2), devtools/hubcheck.py (1), docs/inputs/{PLAN-check-progress,PLAN-repo-setup,PLAN-todo-tool(3),README,claudeTest-CLAUDE(2)}.md, docs/inputs/SHA256SUMS (2). Already 5 at 762a4fc (the head routing-tree §10.3 read), 2 at 790d4bd/392de0a, 0 at 10589a4; tl-406 42b8eb7 (full inputs refresh) took it to 9, 614b52b (leaks fix, same fix as plan/hub 995bc61) to 10. Jacob`s yes was "as long as the conflict has been noted correctly": it was not, so no merge and no H1a-0. Every non-TODO hunk reads as take-main: main holds the newer inputs refresh and SHA256SUMS, the same leaks fix, brief questions 13-16 (plan/hub side empty), CLAUDE.md newer rows. Needs Jacob: merge with take-main on those nine files, yes or no.
  · status: waiting-jacob
  · waits on: approval
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

- **hb-26 · commit.sh's check timed out at 1800s once under concurrent suites**
  2026-10-19 13:3x (tl-379): .claude/bin/commit.sh's ./dev.sh check ran past COMMIT_CHECK_TIMEOUT (1800s default) with only test.hubcheck and test.parts finished; hooktests.log empty; site-scrapers, todo and setup suites were running at the same time. A plain ./dev.sh check minutes earlier passed 9/9 with hooktests 354s, and the retry with COMMIT_CHECK_TIMEOUT=3600 committed ebbc298 (the monitor saw hook tests advance every 20-45s). Not known whether one hook test hung or all were slow.
  · probe: time ./dev.sh test hooktests inside commit.sh's env vs a plain shell, with another repo's check running
  · work: test
  · size: S
  · added: 2026-10-19

- **hb-31 · Unverified: decision tables (dt-N) do not resolve through todo get; relayed to todo in tl-453's report**
  2026-10-19 (tl-453): 'todo get dt-17' from claudeTest printed 'UNCHECKED: dt-17: no scanned store has prefix dt'; 'todo find table:dt-17' refused 'table' as a namespace. The tables live in claudeTest/todo-records.json (dt-15..dt-19 present), so the brief's dt-17 row 4 (tl-384) was read from the file by hand. Unverified whether dt- ids are meant to resolve through get (PLAN-services.md §3: every record has an id and get).
  · probe: todo -C <claudeTest> get dt-17
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
  2026-10-19 (tl-406): a quoted name in the §2 read column must start a '## ' heading; a '### ' subsection (PLAN-services.md §3's rules) FAILs as 'no heading starting so', so the PLAN-services.md row names §3 and puts its three subsection names in the why column. Open: whether the gate should accept '###' quotes.
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

- **hb-29 · Phase RS: build the roster settings panel (PLAN-hub.md §15) once V1, H1b, P-RS1 and Decision 18 allow**
  2026-10-19 (tl-310): the hub server is not built (stage: planning) and the view (V1) comes after H3 (Decision 6), so no page can be built today. PLAN-hub.md §15 on plan/hub settles brief question 15: a view panel over a repo's declared settings.list/settings.set verbs; read half with V1 (needs harness list --json only), write half after H1b, probe P-RS1 and Decision 18; §8 row 'roster settings' holds routing-tree §15's four gates.
  · parent: tl-310
  · blocked by: hb-28
  · work: code
  · size: M
  · done when: phase RS built: the panel lists every row harness's list --json prints and changes them only through the declared settings verb, with the §8 'roster settings' gates green
  · added: 2026-10-19

- **hb-30 · Reported to harness: list --json, a models list, tokens --json and an all-or-nothing settings verb, for the settings page (PLAN-hub.md §15)**
  2026-10-19 (tl-310), from reading .claude/agents.sh cmd_list/cmd_set and .claude/cli.json: list prints text only, without per-key source (own|coders), model_reason, maxTurns, a coders row, or a models list (manifest-schema.jq accepts a pattern; routing-tree §15 assumes 'the manifest's list of known models', which does not exist); tokens --agents has no --json in its usage text; set stops after gen and prints 'next: check, then commit', so a check refusal leaves the manifest changed. To harness (its store, .claude/todo.json, is not in todo's scan, so claudeTest is named), through the dispatcher in tl-310's report.
  2026-10-19 (hb-30 dispatch) re-verified, nothing of it built in harness: 'agents.sh list --json' exits 0 and prints the text table (cmd_list reads no argument, so 'list --bogus' exits 0 too: a JSON caller gets text with a success code); 'tokens --agents --json' exits 1 with its usage; cmd_set still ends at gen with 'next: check, then commit'. Step 0 is done (set takes planner: model effort prefer model_reason; dispatcher: model quote_last quote_max_chars). The report is tl-442 in the top-level store; .claude/todo.json and .claude/TODO.md hold no counterpart (grep tl-442: 0), so harness has not taken it. The settings verb also rides on Decision 19 (hb-28, pending Jacob). Hub-side work: none possible (stage planning; the shape is harness's to settle, so a hub gate pinned to the proposed shape would be a second copy of it).
  2026-10-19 22:29 (later): another session closed hb-28 with resolution 'accepted' (chosen and jacob_words null) while this dispatch's check ran, so Decision 19 (one all-or-nothing settings verb) no longer waits on Jacob as the line above says; the verb is harness's to build, still unbuilt.
  · status: blocked
  · parent: tl-310
  · blocked by: tl-442
  · work: code
  · size: M
  · done when: harness has list --json in PLAN-hub.md §15's shape (coders row, from per key, settable, models), tokens --agents --json, and one all-or-nothing settings verb (set, gen, check, .claude/ commit; rollback on a check refusal) with tests; or harness answered no with a reason
  · handoff: done: re-verified 2026-10-19, nothing built, harness store has no counterpart of tl-442; re-reported through the dispatcher. next: harness builds list --json / tokens --agents --json / the settings verb (after Decision 19) or answers no. verify: ./.claude/agents.sh list --json | jq -e '.rows and .models' ; ./.claude/agents.sh tokens --agents --json | jq -e . ; ./.claude/agents.sh list --bogus exits non-zero (2026-10-19, at 7ba74e7)
  · approved: jacob 2026-10-19: Jacob 2026-10-19 via auto-relay line 228 (origin jacob)
  · added: 2026-10-19

- **hb-33 · Routing-tree copy drifted again; brief line 30 lacks §25-§27 marks**
  2026-10-19 (hb-32): after ./dev.sh refresh PLAN-hub-brief.md, ./dev.sh drift printed 'DIFF docs/inputs/PLAN-routing-tree.md' (the original moved on after tl-453's refresh); left as it was, outside hb-32. Also from hb-32: brief line 30 still gives no per-section marks for routing-tree §25-§27 (it points at each section's own status).
  · probe: cd tools/hub && ./dev.sh drift
  · work: docs
  · size: S
  · done when: the routing-tree copy matches its original (./dev.sh refresh PLAN-routing-tree.md) and the brief's line 30 marks §25-§27, or a recorded decision says neither is needed
  · added: 2026-10-19
