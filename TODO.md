<!-- rendered by todo from todo.json (59 open, 15 closed in todo-history.json; seal 73053c9ff27f): do not edit by hand, `todo check` fails on a hand edit. Change items with the todo CLI; a hand edit is recovered with `todo import`. -->
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

- **hb-34 · devtools/hubcheck.py:48 REQUIRED lists todo.json and todo-history.json, so hubcheck will report t...**
  reported from tools/todo to tools/hub in dispatch toolu_01XngPqWP4Abzbj63Ght5hjp, filed from the dispatch ledger by the delegation layer's report filer: devtools/hubcheck.py:48 REQUIRED lists todo.json and todo-history.json, so hubcheck will report them missing once the store moves to todo.db -- input: `todo --root <workspace> migrate --readers` lines 94-102 -- expected: check through `todo -C . check` or accept the exports; there is no tl item for this yet
  · parent: tl-471
  · added: 2026-10-20

- **hb-70 · PLAN-hub.md still says HUB_TOKEN lives in .claude/local.env after hb-69 answered env**
  hb-69 was answered env by Jacob 2026-10-20 (HUB_TOKEN from the environment only, as H1a-0 built it; routing-tree §15 now says so). PLAN-hub.md still names .claude/local.env as the token's home: grep -n local.env PLAN-hub.md hits §2 (line ~107), §3 step 1 (~297), §5 (~587), §10 (~854), §15 P-RS1 (reads .claude/local.env, where routing-tree §15 says an inherited variable, env in Bash, or a store read), Setup component (~1276-1277) and Risks (~1358). Seen by tl-454, which did not touch them (outside its done-when).
  · repo: tools/hub
  · work: docs
  · size: S
  · files: PLAN-hub.md
  · done when: PLAN-hub.md names the environment as HUB_TOKEN's only source in §3 step 1 and every other hit, P-RS1 tries the three reads routing-tree §15 names, and grep -n local.env PLAN-hub.md shows only lines about other keys or the history
  · added: 2026-10-20

- **hb-73 · hb-29's blocked_by lacks the phases its title waits on (V1, H1b, P-RS1, Decision 18), so todo ready lists it ready and approved though nothing it builds on exists**
  2026-10-22: todo -C tools/hub get hb-29 shows status open, blocked_by [hb-28] (closed), approved by Jacob 2026-10-22, title 'Phase RS: build the roster settings panel (PLAN-hub.md §15) once V1, H1b, P-RS1 and Decision 18 allow'; the hub has H1a-0 only (PLAN-hub.md §9: RS's read half ships with V1, the write half after P-RS1). The planner held it out of Dispatch 335-365. Expected: hb-29 blocked_by the items that build V1, H1b and P-RS1, and Decision 18's item
  · probe: todo -C tools/hub get hb-29 | jq .record.blocked_by
  · parent: tl-553
  · added: 2026-10-22

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

- **hb-7 · `.claude/settings.json` is modified and uncommitted, not by an agent here**
  (mtime 2026-10-15 20:45; +3 hook registrations: git-funnel, store-guard x2). It is
  most likely Jacob applying setup's proposal for the 790d4bd render (Own limits,
  "checks is red"). Left unstaged by tl-316; Jacob's to commit.
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

- **hb-50 · Unconfirmed: context persists across stream-json turns in one -p process**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432). Cited (agent-sdk/streaming-input#benefits, 'Context persistence: maintain conversation context across multiple turns naturally', read live 2026-10-13; PLAN-hub.md §11), not yet run.
  · probe: D0 first clause: message A "remember X", message B "what was X", B result contains X, with a result line between them
  · added: 2026-10-20

- **hb-51 · Unconfirmed: a turn's result line may precede a background subagent's completion in a stream-json session**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432). PLAN-hub.md §11, the idle point. The headless page says the run stays open for background subagents at exit; whether a mid-session turn's result waits is not said. The hub waits for the tool_result either way, so a yes costs nothing but the record.
  · probe: D0 fourth clause: a fixture background subagent sleeping 20 s; record whether result arrives before its tool_result
  · added: 2026-10-20

- **hb-52 · Unconfirmed: --resume <path> accepts a transcript the hub wrote**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432). PLAN-hub.md §11, M2. The flag is documented for a session's own transcript; the line format is not. A fail leaves M3 as the rebuild.
  · probe: D0 M2 clause, with the claude --version
  · added: 2026-10-20

- **hb-62 · Unconfirmed: an Edit(<repo>/...) allow rule under dontAsk in a -p role denies an edit outside the repo, and the sandbox writable set follows it**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432). PLAN-hub.md §4, Decision 13. Both documented (permissions#read-and-edit; sandboxing#permission-rules: 'Edit allow rules | Grant write access to specific paths, the same way sandbox.filesystem.allowWrite does'); neither run.
  · probe: H0 Edit-rule clause, with Edit and with a Bash echo >, inside and outside the repo
  · added: 2026-10-20

- **hb-63 · unverified: setup plans edit --from <file> cannot be fed under the gate, since every Write is denied, so the planner cannot make the file**
  src/gate.js denies every Edit/Write/NotebookEdit/MultiEdit (Decision 17); --from reads a file. Needs --from - (stdin) on setup's side, or a scratch-path exception decided in the plan
  · probe: with the gate registered, try a planner Write to a scratch file, then setup plans edit --from it
  · files: src/gate.js
  · added: 2026-10-20

## Reported to other owners

- **hb-68 · Reported to hooks: write-targets.sh drops a -* operand after -- (touch -- -odd gives no target)**
  bash tests/hub/write-targets-oracle.sh <lib> /w/node 'touch -- -odd' prints nothing; expected /w/node/-odd. Held in classify.test.js KNOWN
  · reported to: hooks on 2026-10-20 (no counterpart yet)
  · added: 2026-10-20

- **hb-71 · Reported to planner: routing-tree §24 and §20's opening still say lifetime is not a design axis, against §20's hybrid answer**
  report to planner (via tl-454's report): PLAN-routing-tree.md §24 'The replacement' (line ~1794) still says a role is 'started by the hub in its folder for each request (§20). How long it lives is not a design axis' and that 'A sentence that distinguishes roles by lifetime ... is deleted'; §20 (line ~1403 '(... no role is kept between tasks ...)', ~1427) says the same, while §20 'Answered hybrid' makes lifetime one declared column of the roles table (per-task, or kept for a repo's coding role). The brief (tl-454) follows §20's answer. Expected: §24 and §20's earlier paragraphs restated to the hybrid answer, or marked superseded by it.
  · reported to: claudeTest on 2026-10-20 as tl-528
  · repo: tools/hub
  · work: docs
  · size: S
  · files: PLAN-routing-tree.md
  · done when: routing-tree §20 and §24 no longer contradict the hybrid answer, or the planner says why they stand
  · added: 2026-10-20

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
  2026-10-20 (tl-432): plan/hub merged into main; its eight requests are now items hb-53..hb-60 (one per owner; the harness one beside hb-30). Jacob's merge-now (tl-443) frees them; sending each once (todo report --to <owner>) is the next step, not done in tl-432.
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
  · approved: jacob 2026-10-22: Jacob, planner window, 2026-10-22: 'Please dispatch anything that is awaiting my yes for the hub, harness, or context cleaner.'
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

- **hb-36 · Phase H1a-0b, the read route (cloud, after H1a-0)**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432). PLAN-hub.md §3 H1a-0b; §9 row H1a-0b; §8 row 'read route'. Size 50-90k (2-3u), split off H1a-0. Inputs: PLAN-hub.md §2 (owners, workspace, stores, stores.json), §3, §8, §12; docs/inputs/PLAN-todo-tool.md §3. Runs on the credits (routing-tree §10.3 answer 4). The real stores.json is setup's to render; H1a-0b does not wait on it.
  · work: code
  · done when: POST /read-request answers a fixture declared-prefix id and a path a fixture stores.json lists with the store get; a Read of an owned non-store path and of an unowned path are plain Read, never denied, with no server call; with the server killed a declared-prefix read and a Read of a listed store path are denied with the hub status line and a Read of an unlisted path is allowed; with stores.json removed every Read of a path is plain Read and hub status reports it missing; every answer is a ledger row; every other §8 read route clause passes in tests/
  · added: 2026-10-20

- **hb-37 · Phase H1a-1, the program with no routing yet (cloud item 1)**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432). PLAN-hub.md §9 row H1a-1; §2 registry, §3 hub up, §7 status --json, §8 rows help == implemented, vocabulary, registry, kill the server first half, direction audit, no names in the program, services as data audit, owners both ways schema. Size 80-130k (3-5u), extends H1a-0's server skeleton. Inputs: PLAN-hub.md §1-§3, §7, §8; PLAN-routing-tree.md §2, §7, §14.6-§14.8; docs/inputs/PLAN-group-servers.md §1a; docs/inputs/PLAN-portable-env.md §3.1.
  · work: code
  · done when: hub init writes a starter that passes hub check; the §2 example registry passes hub check with no child, limits and stores included; a warm mode fails hub check (Decision 1); hub up binds, writes .hub/server.json, answers /health and /status with the token and refuses without it; hub status --json reports {"up": false} within one second after a kill and hub up restores held/dead-letter/ledger state from .hub/; hub --help == the subcommands and docs/API.md == the served routes, both ways, in a test; nothing under tools/hub/ reads .claude/ or names a repo, path or command (two audits in ./dev.sh check)
  · added: 2026-10-20

- **hb-38 · Phase H1a-2, the relay through the server (cloud item 2)**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432). PLAN-hub.md §9 row H1a-2; §1, §3 (Dispatch section path, admission list), §8 rows determinism, kill the server hook half, origin, admission gate half, limits both ways budget and stub, references by id ctx: half, failures are messages, agent last counts, fails open every hook. Size 140-200k (5-7u). Inputs: PLAN-hub.md §1, §3, §8, §12; docs/inputs/PLAN-auto-relay.md §2-§4, §9; PLAN-question-routing.md §3-§4; PLAN-usage-reporting.md §3; PLAN-routing-tree.md §3, §6, §13.3, §14.3, §14.7. The .claude/ hook sources are not copied (PLAN-cloud-offload.md §8): rebuilt from contracts, the planner diffs behaviour at review. Beside it, local: harness (gen renders .claude/hub-roles.json, never hub.json; three hooks become one-line callers; user-prompt hook; dispatch-guard reads hub status --json) and tools/setup (the hub component writes hub.json from the role list, drift in its check).
  · work: code
  · done when: /route stamps origin from a fixture transcript (forged jacob -> model; a Jacob turn carries origin_id and its stub line, never the text; hub get ctx:<id> returns the prompt a fixture ctx: CLI stored; a body with the prompt past stub_chars is flagged pasted); admission (identical dropped, invalid dead-lettered with notice, budget_per_conversation + 1 held, released by a fixture Jacob prompt once); a fixture usage CLI asked (0 goes, warn holds a job without a checkpoint, hold queues with one line); limits export equals hub.json limits both ways and a budget of 1 holds on the second model message naming the limit; hub hook planner-stop and dispatcher-stop forward through /route and with the server killed relay direct or block once; hub hook user-prompt with the server killed still stores the prompt; a delivery failure reaches the owners row; 100 fixture envelopes route identically twice; every hook exits 0 on malformed input
  · added: 2026-10-20

- **hb-39 · Phase S1, declared sync for files (cloud item 3)**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432). PLAN-hub.md §6; §9 row S1; §8 row sync first three clauses. Size 120-180k (4-6u). Inputs: PLAN-hub.md §6; PLAN-routing-tree.md §12; docs/inputs/PLAN-tools-folder.md §8; docs/inputs/PLAN-repo-setup.md §2.
  · work: code
  · done when: hub sync --check with no server prints ok | behind N | missing | edited locally | override | undeclared per child and artifact on a fixture tree with drift injected into each; hub sync --apply <id> writes into this node only; a root with no children prints nothing to sync (root, no children); every declared source exists and every target holds it; an edit inside a copied file is caught; --json output is what tools/checks hooks-installed will read (documented in docs/API.md)
  · added: 2026-10-20

- **hb-40 · Phase H1b, the first spawn and the write service (cloud item 4)**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432). PLAN-hub.md §9 row H1b; §3 H1b; §4 cold row; §8 rows conformance, per-branch report, read-only roles, services as data write, admission spawn half. Size 150-200k (5-7u). Inputs: PLAN-hub.md §3, §4, §8; PLAN-routing-tree.md §5, §13.2-§13.4, §14.6; docs/inputs/PLAN-hard-gates.md §2, §3; PLAN-group-servers.md §1a. Probe first, local, H0: hub send from inside a cold role and dontAsk honouring the tool list; if H0 has not run, the session runs those two on a fixture and records the result.
  · work: code
  · done when: a task to a fixture repo set up from its path alone spawns claude -p --agent <role> read-only (hook the gate, flags a default only) with the origin_id stub line, reads the stream to its result line, records usage in the ledger and returns a report; the role write-request runs the fixture CLI declared verb and an undeclared verb is refused and answered; a Bash write in the sandbox fails and the same write as a write-request succeeds; a commit write makes carries Agent: <role>; two tasks to one dir run in turn; three spawns with two failing on different steps report each outcome; hub log --usage shows the spawn in 1u
  · added: 2026-10-20

- **hb-41 · Phase R1, references by id (cloud item 5)**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432). PLAN-hub.md §12; §9 row R1; §8 row references by id. Size 120-170k (4-6u). Inputs: PLAN-hub.md §2 (stores, limits.stub_chars), §12, §8; docs/inputs/PLAN-todo-tool.md §3 and §4 step 4; PLAN-routing-tree.md §14.1, §14.8.
  · work: code
  · done when: a fixture services.json ids entry appears in stores at hub up and hub reload; a planted todo: id renders a stub (id, line cut at stub_chars, source, date); hub get <id> and GET /refs/<id> return the store get output byte for byte; hub send --ref x:1 with an undeclared prefix is refused naming the declared prefixes; a sender refs is overwritten; a body with more than stub_chars of a referenced record is flagged pasted: <id> and answered, hub log --pasted counts it; a store whose get is missing makes hub check red on stores and its stubs unchecked; an unknown id renders unresolved: not found; a record changed between send and expand renders changed since cited; two repos declaring one prefix fail hub check
  · added: 2026-10-20

- **hb-42 · Phase H2, agent to agent (cloud item 6)**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432). PLAN-hub.md §9 row H2; §4 The coder's exception; §5 Cross-repo claims; §8 rows lease, loops, claims, limits both ways hops and ping-pong, failures are messages proposal. Size 160-200k (6-7u); lease and routes --proposed may split off as H2b. Inputs: PLAN-hub.md §2-§5, §8; PLAN-routing-tree.md §3, §6, §9, §10 phase 2, §13.5, §14.7; docs/inputs/PLAN-interim-rules.md §4. Probe first, local, H0: the Edit-rule clause.
  · work: code
  · done when: a report from fixture node A naming B path arrives at B as bug-report and B report closes the conversation with the top dispatcher inbox receiving neither; a claim with no owner dead-letters with notice; a ping-pong is held at pingpong_hold and a hop-limit message dead-letters, each read from limits and biting at 1; two tasks to one repo coder run in turn, the second report says it queued; the coder Edit rule holds inside the repo and fails outside (Edit and Bash echo >); green edit committed by write with Agent:, red comes back check-red with nothing committed; the lease clause (leased coder may Edit a source file, not todo.json; without the lease neither); a coder without the lease has no Edit rule; the third identical re-route of an unowned kind appears in hub routes --proposed
  · added: 2026-10-20

- **hb-43 · Phase G1, the check and hook services (cloud item 7)**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432). PLAN-hub.md §9 row G1; §1 last row; §8 rows services as data check/hook, owners both ways flip, agent last checks. Size 150-200k (5-7u); the site-scrapers pilot is a local follow-up (1-2u). Inputs: PLAN-hub.md §1, §2, §8; PLAN-routing-tree.md §14.2, §14.3, §14.6; docs/inputs/PLAN-group-servers.md §3.2, §5; PLAN-agent-groups.md §4.4.
  · work: code
  · done when: a check request {repo, scope} runs only the command the repos row names on a fixture repo; green returns a report to from; red returns one check-red per finding to the owners row with file:line, suite output in the ledger never the body; a check that raises is check-broken to tools/checks; flipping the fixture result moves the message between the two; /stop blocks once (max_blocks) and the verdict stands; hook answers a fixture history question from the ledger within its timeout and the caller continues without it when the server is down; hub status counts model turns by step
  · added: 2026-10-20

- **hb-44 · Phase H3, hierarchy (cloud item 8)**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432). PLAN-hub.md §9 row H3; §5; §6 S3 and S4; §8 rows hierarchy, conformance child half, vocabulary with children, limits both ways heartbeat, sync last three clauses. Size 160-200k (6-7u); site-scrapers as the first live child is a local follow-up (1-2u). Inputs: PLAN-hub.md §5, §6, §8; PLAN-routing-tree.md §1, §7, §8, §9, §12; docs/inputs/PLAN-repo-setup.md §7.5, §7.8.
  · work: code
  · done when: a child posts /register on hub up with the parent token, is heartbeated every limits.heartbeat_s and marked down after limits.heartbeat_misses (one miss at 1), and hub down de-registers it; a three-level fixture tree leaves no grandchild in any parent .hub/children/; a de-registered child tags route to the parent dispatcher with notice; a child advertising a parent tag is refused; hub up --tree and hub status --tree cover the tree; a node with no HUB_PARENT_URL runs as a root and says so; hub sync --propose sends drift as a sync message; a vocab entry is inherited and cannot be redefined; a write-request for a rendered file in a child is served by the child server with no message in the parent ledger
  · added: 2026-10-20

- **hb-45 · Phase D1, driven sessions (cloud item 9, after D0)**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432). PLAN-hub.md §11; §9 row D1; §8 row driven session. Size 120-180k (4-6u). After D0, local (§9 row D0, 20-40k): D0 decides which of M1, M2, M3 this builds; not dispatchable until D0 has run. Inputs: PLAN-hub.md §4, §11, §12, §8; the D0 result in tools/hub/probes/. Decision 14 (2026-10-13): D0 runs on a fixture before anything touches the planner window.
  · work: code
  · done when: on a fixture role: hub session start runs the stream-json process with --replay-user-messages and the hub list equals the acknowledged messages plus the result lines; the idle point holds; a rebuild from a ctx: id by the chosen mechanism leaves the next answer knowing Y and not X; after a rebuild hub origin says model; a rebuild file with a recorded tool_result line is refused; every pre-rebuild message is in the snapshot the ledger names; hub session from a role Bash is refused and answered; no committed registry names a driven role
  · added: 2026-10-20

- **hb-46 · stores.json is setup's to render, and is not built**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432), Open decisions. PLAN-hub.md §2 and the Setup component table; PLAN-services.md §3 step 3, 'Two more from the hub owner' 1. The hub reads it, on fixtures until setup writes the real one (read-only, beside hub.json, from every owner's cli.json, re-rendered whenever setup runs at any repo, drift when it no longer matches). The plan/hub entry says reported to tools/setup through the 2026-10-13 session's report; unverified that it reached setup -- settle: tools/todo/todo find repo:setup (from the top level).
  · added: 2026-10-20

- **hb-47 · The workspace row has no source yet**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432), Open decisions. The manifest has no owners block (grep '"owners"' .claude/agents.manifest.json: nothing, 2026-10-13) and .claude/hub-roles.json does not exist (H1a-2's harness job renders it), so the row reaches hub.json only once harness renders it into the role list: name it in the H1a-2 harness job's brief. H1a-0 is built on fixtures and does not wait on it.
  · added: 2026-10-20

- **hb-48 · The planner's kb check on the 2026-10-13 citations**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432), Open decisions. The cloud pass read these pages live from code.claude.com and quoted them; the anchors are slugged headings, unverified offline: prompt-caching#how-the-cache-is-organized, #cache-lifetime, #check-cache-performance; headless#auto-approve-tools, #continue-conversations, #stream-responses, #follow-subagent-messages, #background-tasks-at-exit; cli-reference#cli-flags, #system-prompt-flags-in-resumed-conversations; hooks#userpromptsubmit, #stop; permissions#read-and-edit; sandboxing#permission-rules; agent-sdk/overview#compare-the-agent-sdk-to-other-claude-tools; agent-sdk/streaming-input#benefits. An anchor that does not resolve is a wrong pointer to a right quote.
  · probe: kb check --all PLAN-hub.md PLAN-hub-view.md (the planner, locally; the mirror is private)
  · added: 2026-10-20

- **hb-49 · kb check cannot run in the cloud**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432), Own limits. The docs mirror is private and local (docs/inputs/README.md). Citations are written as "quote" (url#anchor) from live reads (2026-10-05, 2026-10-13); only the planner's kb check --all PLAN-hub.md PLAN-hub-view.md settles them. Still marked unverified in the text: the Wave Terminal and Tabby quotes (PLAN-hub-view.md §4; docs.waveterm.dev was blocked from the container, its GitHub sources read instead). The streaming-input claim is cited (PLAN-hub.md §11) and still unrun (D0).
  · added: 2026-10-20

- **hb-53 · To send to cron-scheduler: chron.py list --json, and the server list from hub status --json --tree**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432), Reported to other owners: not sent (per review finding 9 they go out after Jacob's yes on PLAN-hub.md's Decisions, each once; hb-19). chron.py list --json returning [{job, next_run, schedule, enabled}] (PLAN-hub.md §7; PLAN-hub-view.md §2, V2); and reading the server list from hub status --json --tree instead of the manifest (PLAN-hub.md §7, Decision 5, approved 2026-10-09; changes group-servers decision 4's data source, not its owner).
  · added: 2026-10-20

- **hb-54 · To send to harness: gen renders .claude/hub-roles.json, never hub.json; hooks become hub hook callers**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432), Reported to other owners: not sent (per review finding 9 they go out after Jacob's yes on PLAN-hub.md's Decisions, each once; hb-19). gen renders .claude/hub-roles.json (roles with default tools, routes, children, server from servers.<group>, owners defaults, its source hash) and never hub.json (PLAN-hub.md §2, Decision 2); auto-relay.sh, question-gate.sh and record-session.sh become one-line callers of hub hook; a UserPromptSubmit hook for the two windows, hub hook user-prompt, stores each typed prompt in ctx: (Decision 3); dispatch-guard.sh reads hub status --json; quote-words.sh injects the origin_id stub through hub origin, not the text (PLAN-hub.md §1, §2; beside H1a-2 and in H4). Distinct from hb-30 (list --json, models, tokens, the settings verb).
  · added: 2026-10-20

- **hb-55 · To send to tools/setup: the hub component is the one writer of hub.json at every node**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432), Reported to other owners: not sent (per review finding 9 they go out after Jacob's yes on PLAN-hub.md's Decisions, each once; hb-19). Reading .claude/hub-roles.json where it exists and writing the starter where it does not, with drift in its idempotent check (PLAN-hub.md §2, Decision 2); the rest of the component (PLAN-hub.md Setup component: services.json with verbs, tags and ids, cli.json skeletons, registry.proposed.json, --node, local.env keys, .gitignore lines, checks run . as the last step); and stores.json (see the stores.json item).
  · added: 2026-10-20

- **hb-56 · To send to context-hygiene: the ctx: store takes typed prompts from hub hook user-prompt**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432), Reported to other owners: not sent (per review finding 9 they go out after Jacob's yes on PLAN-hub.md's Decisions, each once; hb-19). Through its own CLI, answering get <id> with one line and the text (PLAN-hub.md §1, §12; its write verb is that plan's to name); its CLI calls hub session rebuild <id> --from ctx:<id> when its monitor says it is time, with the rendered list as a ctx: record (§11); and a question: are ctx: records immutable, so a cited snapshot never changes (§12 changed since cited)? Related: hb-25.
  · added: 2026-10-20

- **hb-57 · To send to todo: todo get ID is read as is as the second store**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432), Reported to other owners: not sent (per review finding 9 they go out after Jacob's yes on PLAN-hub.md's Decisions, each once; hb-19). PLAN-hub.md §12, R1; the todo repo's services.json declares ids for todo: when the component installs it.
  · added: 2026-10-20

- **hb-58 · To send to tools/checks: hub sync --check --json readers and the four §14.8 contract checks**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432), Reported to other owners: not sent (per review finding 9 they go out after Jacob's yes on PLAN-hub.md's Decisions, each once; hb-19). rules-in-sync and hooks-installed read hub sync --check --json after S1 (PLAN-hub.md §6); and the four contract checks of routing-tree §14.8 (check-json, accessor, services-valid, registry-matches) that PLAN-hub.md depends on and does not build.
  · added: 2026-10-20

- **hb-59 · To send to knowledge-base: mirror the external tools' docs the hub cites**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432), Reported to other owners: not sent (per review finding 9 they go out after Jacob's yes on PLAN-hub.md's Decisions, each once; hb-19). Jacob 2026-10-05: 'we want the docs for every external tool put into the knowledge base, rather than storing the entirety of the code in context' (a builder asks kb q, not cat on a vendored tree). Add Claude Code's docs/en/agent-sdk/streaming-input (absent from the mirror; PLAN-hub.md §11 cites it from a live read), docs/en/prompt-caching (§4, §11), Wave Terminal's documentation (docs.waveterm.dev: customwidgets, wsh-reference, layouts and config at least) and tmux's manual (PLAN-hub-view.md §4, V0), and the same for any host, library or CLI a later phase adopts.
  · added: 2026-10-20

- **hb-60 · To send to tools/usage: usage gate <estimate> with exit 0 = go, warn / hold on non-zero**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432), Reported to other owners: not sent (per review finding 9 they go out after Jacob's yes on PLAN-hub.md's Decisions, each once; hb-19). usage gate <estimate> with exit code 0 = go and the words warn / hold with a hold time on non-zero (PLAN-hub.md §3; PLAN-usage-reporting.md §3).
  · added: 2026-10-20

- **hb-61 · The role list's shape is wider than REVIEW §5.8's wording**
  from plan/hub TODO.md (0057a4b), carried in by the merge of 2026-10-20 (tl-432), Open decisions (a confirmation for the planner with harness, not a decision for Jacob). 5.8 described .claude/hub-roles.json as each role's name, mode, dir and tools plus the routes; PLAN-hub.md §2 also puts children, server (port, keep-alive from servers.<group>) and the owners defaults in it, because gen no longer writes hub.json. The planner confirms the shape with harness before the H1a-2 harness job; the alternative is setup flags, which would make the port a per-machine argument against Decision 10.
  · added: 2026-10-20

- **hb-64 · A read verb from a role outside the writers is denied (e.g. items list): cli.json verbs do not say read or write**
  tests/hub fixture: verbs add|done|list are all write requests; gate.js treats any declared verb on a store as a write. Needs cli.json to mark read verbs (checks' schema) or the classifier to pass them as reads
  · files: src/gate.js, src/classify.js
  · added: 2026-10-20

- **hb-65 · stores.json format in H1a-0 is the fixture's ({stores:1, entries:[{path, declared_by}]}); setup owns the real one (hb-46): align when it lands**
  · files: src/registry.js, docs/API.md
  · added: 2026-10-20

- **hb-66 · The no-names audit uses workspace folder names as a stand-in for roster agent names (reading the roster would break the direction rule it audits)**
  · files: tests/hub/audit.test.js
  · added: 2026-10-20

- **hb-67 · The classifier sees less than the shared write-target parser: git checkout/restore, patch, vim/ex/ed, sqlite3 pass as reads; listed in classify.test.js KNOWN. Decide: run the shared parser, or port its reach**
  · files: src/classify.js, tests/hub/classify.test.js
  · added: 2026-10-20

- **hb-74 · Brief fixed point 11 and question 16 still call §21 row 4 needs-yes; approved 2026-10-22**
  2026-10-22 (hb-33): after the routing-tree refresh, §21 steps 2-3 record Jacob's approval of improvement rows 1-4 (dt-40 rows 18-19; row 4 into tl-351); the brief's fixed point 11 still says 'its rows 1-6 are needs-yes in §21' and question 16 still asks how unread stays apart from awaiting-your-answer 'if routing-tree §21 row 4 ... (needs-yes) is approved'. hb-33 changed only line 30's row; the other two restate a requirement, which is the planner's call
  · probe: grep -n 'rows 1-6\|row 4' PLAN-hub-brief.md (the copy, after ./dev.sh refresh PLAN-hub-brief.md)
  · work: docs
  · size: S
  · files: PLAN-hub-brief.md
  · done when: fixed point 11 and question 16 state §21 rows 1-4 as approved (dt-40 rows 18-19) and row 5 as needs-yes, edited at the top-level original and re-copied with ./dev.sh refresh PLAN-hub-brief.md, or the planner records that they stand
  · added: 2026-10-22
