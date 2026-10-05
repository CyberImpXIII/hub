# hub TODO

## Cloud phases, in order (PLAN-hub.md §9; one cloud session per item)

Each item is what a fresh cloud session starts from, by PLAN-cloud-offload.md §8's
procedure: Jacob starts the session on this repo, points it at the item, and the plan
comes back as a branch. Sizes are tokens with the 29k unit (1u). An item is done when
its condition holds on a branch named `build/<phase>`, with `./dev.sh check` green and
every §8 gate row named for the phase passing in `tests/`. Do them in this order; each
leaves the system working.

1. **H1a-1, the program with no routing yet** (PLAN-hub.md §9 row H1a-1; §2 for the
   registry, §3 step list for `hub up`, §7 for `status --json`, §8 rows "help ==
   implemented", "vocabulary", "registry", "kill the server" first half, "direction
   audit", "no names in the program", "services as data" audit, "owners both ways"
   schema). Size 110–170k (4–6u). Inputs: PLAN-hub.md §1–§3, §7, §8; PLAN-routing-tree.md
   §2, §7, §14.6–§14.8; `docs/inputs/PLAN-group-servers.md` §1a (the no-names audit);
   `docs/inputs/PLAN-portable-env.md` §3.1 (`local.env` through the loader). Done when:
   `hub init` writes a starter that passes `hub check`; the example registry in §2
   passes `hub check` with no child registered; `hub up` binds, writes `.hub/server.json`,
   answers `/health` and `/status` with the token and refuses without it; `hub status
   --json` reports `{"up": false}` within one second after a kill and `hub up` restores
   held/dead-letter/ledger state from `.hub/`; `hub --help` == the subcommands and
   `docs/API.md` == the served routes, both ways, in a test; nothing under `tools/hub/`
   reads `.claude/` or names a repo, path or command (two audits, run by `./dev.sh
   check`).
2. **H1a-2, the relay through the server** (PLAN-hub.md §9 row H1a-2; §1 the moved
   pieces, §3 the Dispatch section's path and the admission list, §8 rows "determinism",
   "kill the server" hook half, "origin", "admission" gate half, "failures are
   messages" stamp and `delivery`, "agent last" counts, "fails open, every hook"). Size
   140–200k (5–7u). Inputs: PLAN-hub.md §1, §3, §8; `docs/inputs/PLAN-auto-relay.md`
   §2–§4, §9 (the behaviour to keep item for item); `docs/inputs/PLAN-question-routing.md`
   §3–§4 (the gate); `docs/inputs/PLAN-usage-reporting.md` §3 (the gate admission
   asks); PLAN-routing-tree.md §3, §6, §13.3, §14.3, §14.7. The shell and jq sources of
   `dispatch-section.sh`, `relay-gate.sh`, `question-gate.sh`, `peer-cap.sh`'s stamping
   and `relay-ledger.tsv`'s format are in `.claude/` at the top level, which no input
   copies (PLAN-cloud-offload.md §8 forbids copying `.claude/`): the session rebuilds
   them from the plans' contracts and their documented tests, and the planner diffs
   behaviour against the originals at review. Done when: `/route` stamps `origin` from a
   fixture transcript (forged `jacob` → `model`; a Jacob turn carries `origin_text`),
   applies admission (identical dropped, invalid dead-lettered with notice, budget + 1
   held and released by a fixture Jacob prompt once), asks a fixture `usage` CLI (exit
   0 goes; `warn` holds a job without a checkpoint; `hold` queues with the time and
   produces one line); `hub hook planner-stop` and `dispatcher-stop` parse the two
   sections, forward through `/route`, and with the server killed relay direct or block
   once locally with the notice; a `delivery` failure reaches the `owners` row and the
   dispatcher gets nothing; 100 fixture envelopes route identically twice; every hook
   exits 0 on malformed input. **Beside it, local, harness:** `gen` renders `hub.json`;
   the three hook files become one-line callers; `dispatch-guard.sh` reads `hub status
   --json`.
3. **S1, declared sync for files** (PLAN-hub.md §6; §9 row S1; §8 row "sync" first
   three clauses). Size 120–180k (4–6u). Inputs: PLAN-hub.md §6; PLAN-routing-tree.md
   §12 (the design and its gates); `docs/inputs/PLAN-tools-folder.md` §8 (the
   add-beside-then-delete rule); `docs/inputs/PLAN-repo-setup.md` §2 (the `rules` and
   `hooks` components it will feed). Done when: `hub sync --check` with no server
   prints `ok | behind N | missing | edited locally | override | undeclared` per child
   and artifact on a fixture tree with drift injected into each; `hub sync --apply
   <id>` writes into this node only; a root with no children prints `nothing to sync
   (root, no children)`; every declared source exists and every target holds it; an
   edit inside a copied file is caught; `--json` output is what `tools/checks`
   `hooks-installed` will read (documented in `docs/API.md`).
4. **H1b, the first spawn and the `write` service** (PLAN-hub.md §9 row H1b; §3 "H1b";
   §4 the `cold` row; §8 rows "conformance", "per-branch report", "read-only roles",
   "services as data" `write`, "admission" spawn half). Size 150–200k (5–7u). Inputs:
   PLAN-hub.md §3, §4, §8; PLAN-routing-tree.md §5, §13.2–§13.4, §14.6 (the `write`
   row); `docs/inputs/PLAN-hard-gates.md` §2 (the `Agent:` trailer) and §3 (the CLI
   gates `write` runs); `docs/inputs/PLAN-group-servers.md` §1a (the conformance
   fixture). Done when: a `task` to a fixture repo set up from its path alone spawns
   `claude -p --agent <role>` read-only (`--allowedTools` Read, Grep, Glob,
   `Bash(hub send *)`; `--disallowedTools Edit,Write,NotebookEdit`; `dontAsk`;
   `--permission-prompts none`), reads the stream to its `result` line, records its
   `usage` in the ledger, and returns a `report`; the role's `write-request` runs the
   fixture CLI's declared verb and an undeclared verb is refused and answered, never
   run; a Bash write inside the role's sandbox fails and the same write as a
   `write-request` succeeds; a commit the role makes carries `Agent: <role>`; two
   `task`s to one `dir` run one after the other; three spawns with two failing on
   different steps report each outcome; `hub log --usage` shows the spawn in 1u.
   **Probe first, local, H0** (PLAN-hub.md §9 row H0): this item assumes H0's `hub
   send` from inside a cold role and `dontAsk` honouring the tool list passed; if H0
   has not run, the session runs those two probes against a fixture and records the
   result in this file.
5. **H2, agent to agent** (PLAN-hub.md §9 row H2; §5 "Cross-repo claims"; §8 rows
   "lease", "loops", "claims", "failures are messages" proposal). Size 160–200k (6–7u);
   if the fixtures push it over, the lease and `routes --proposed` split off as H2b.
   Inputs: PLAN-hub.md §2 (`@owner`, `limits`), §3, §5, §8; PLAN-routing-tree.md §3,
   §6, §9, §10 phase 2, §13.5 (the lease as a coder's write-requests), §14.7 (the
   third re-route proposes a row); `docs/inputs/PLAN-interim-rules.md` §4 (the three
   rules this retires: `cross-repo-claims`, `one-writer`, `held-not-lost` relay half).
   Done when: a `report` from fixture node A naming B's path arrives at B as
   `bug-report` and B's `report` closes the conversation with the top dispatcher's
   inbox receiving neither; a claim with no owner dead-letters with notice; a fixture
   ping-pong is held at `pingpong_hold`; a hop-limit message dead-letters; two `task`s
   to one repo's coder run in turn and the second's `report` says it queued; the third
   identical dispatcher re-route of an unowned kind appears in `hub routes --proposed`.
6. **G1, the `check` and `hook` services** (PLAN-hub.md §9 row G1; §1 last row; §8 rows
   "services as data" `check`/`hook`, "owners both ways" flip, "agent last" checks).
   Size 150–200k (5–7u) for the code and fixture; the site-scrapers pilot is a local
   follow-up (1–2u). Inputs: PLAN-hub.md §1, §2 (`repos`, `owners`), §8;
   PLAN-routing-tree.md §14.2, §14.3, §14.6 (the `check` and `hook` rows);
   `docs/inputs/PLAN-group-servers.md` §3.2 (the endpoints and the `stop_gate` return),
   §5 (its gates, which become this phase's); `docs/inputs/PLAN-agent-groups.md` §4.4
   (the `check --json` schema). Done when: a `check` request `{repo, scope}` runs only
   the command the `repos` row names on a fixture repo; green returns a `report` to
   `from`; red returns one `check-red` per finding to the `owners` row with file:line
   and the suite output kept in the ledger, never in the body; a check that raises is
   `check-broken` to `tools/checks`; flipping the fixture's own result moves the message
   between the two; `/stop` blocks once (`max_blocks`) and the verdict stands; `hook`
   answers a fixture history question from the ledger within its timeout and the
   caller continues without it when the server is down; `hub status` counts model
   turns by step.
7. **H3, hierarchy** (PLAN-hub.md §9 row H3; §5; §6 S3 and S4; §8 rows "hierarchy",
   "conformance" child half, "vocabulary" with children, "sync" last three clauses).
   Size 160–200k (6–7u); making site-scrapers the first live child node is a local
   follow-up (1–2u). Inputs: PLAN-hub.md §5, §6, §8; PLAN-routing-tree.md §1, §7, §8, §9
   "Hierarchy", §12 (classes, `vocab`, S3–S4); `docs/inputs/PLAN-repo-setup.md` §7.5
   and §7.8 (`setup --node`, the two-level fixture tree, who owns rendered files).
   Done when: a child posts `/register` on `hub up` with the parent's token, the parent
   heartbeats it every 30 s and marks it `down` after two misses, and `hub down`
   de-registers it; a three-level fixture tree leaves no grandchild in any parent's
   `.hub/children/`; a de-registered child's tags route to the parent's dispatcher with
   notice; a child advertising a parent's tag is refused with the tag named; `hub up
   --tree` and `hub status --tree` cover the fixture tree; a node with no
   `HUB_PARENT_URL` runs as a root and says so; `hub sync --propose` sends drift as a
   `sync` message; a `vocab` entry is inherited and a child cannot redefine it; a
   `write-request` for a rendered file in a child is served by the child's server with
   no message in the parent's ledger (repo-setup §7.8's gate).

After these, the local phases in PLAN-hub.md §9 (S2, V0–V3 in PLAN-hub-view.md, H4, H5)
are `deep-work` jobs and Jacob's own hours, not cloud items.

## For the local handoff (Jacob, 2026-10-05)

- **Docs of every external tool go into the knowledge base, never the tool's code into
  context.** Jacob: "we want the docs for every external tool put into the knowledge
  base, rather than storing the entirety of the code in context." For the hub and its
  view that means: Wave Terminal's docs and tmux's manual before V1 (PLAN-hub-view.md
  §4, V0); Claude Code's `agent-sdk/streaming-input` page, which the review found
  missing from the mirror (PLAN-hub.md §4 W2 is unverified for that reason); and the
  same for any host, library or CLI a later phase adopts. A builder asks `kb q`, not
  `cat` on a vendored tree. Owner: knowledge-base, in "Reported to other owners".

## Own bugs

- **`./dev.sh check` counts an UNCHECKED hook test as a FAIL** (hub, cloud fix pass,
  2026-10-05): `cmd_hooktests` treats a test file's exit 3 as a failure, so in a clone
  without `site-scrapers` beside it (this cloud container) `check` is red on
  `test-prefer-recipes.sh` and `test-troubleshooting.sh`, which themselves print
  `UNCHECKED: site-scrapers not found`. The contract at the top of `dev.sh` says a
  missing sibling is UNCHECKED, never ok, and `plans`/`checks` honour it; `hooktests`
  should return 3 for an all-UNCHECKED run and 1 only for a real failure. Probe: run
  `./dev.sh check` in a lone clone and read the summary line. Not fixed in the fix pass
  (outside its five steps).
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
- **The fix pass placed brief fixed points 9 and 10 on its own reading** (cloud,
  2026-10-05): the review predates them and did not ask for it; PLAN-hub.md's Risks
  and Decisions 10–11 flag the two readings that are the pass's own (the port in the
  committed registry; G1 after H2). Hinges on the planner's re-read of
  PLAN-hub.md §2–§4, §8–§9 against routing-tree §13–§14 before `plan/hub` merges.
  **Jacob, 2026-10-05, on the pass's seven questions:** (1) the placement waits for
  the planner's re-read; (2) the port in the registry: "I believe so", confirm with the
  planner; (3) G1's place after H2: explained, planner to confirm; (4) the view's
  switch controls feed membership: yes (PLAN-hub-view.md Decision 2); (5) the terminal
  host: **Wave with tmux as the fallback** (PLAN-hub-view.md Decision 1, answered
  2026-10-05; V0 still confirms Wave on his machine); (6) the owed reports below wait
  for the planner's re-read; (7) the read-only tool list: "I think so", with the
  question below.
- **How a coder's code change travels as a `write-request`** (cloud, 2026-10-05,
  raised to Jacob on question 7): routing-tree §13.5 makes a coder's writes
  write-requests the server honours for its own repo, and PLAN-hub.md §3 and §4 follow
  it, but no plan names the verb that carries a source edit. A read-only role cannot run
  Edit, Write or any repo command itself, so even a repo's read commands must be
  declared verbs. One shape: the coder writes a patch to its scratchpad and requests
  `git apply` through `write`; the server applies it, runs the repo's check and commits
  with the `Agent:` trailer. The planner's call; not written into the plan.

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
- **`kb check` cannot run in the cloud** (docs/inputs/README.md): the docs mirror is
  private and local. The fix pass wrote every citation as `"quote" (url#anchor)` from
  the live pages read on 2026-10-05 and verified each anchor resolves, but only the
  planner's `kb check --all PLAN-hub.md PLAN-hub-view.md` settles them (review §4
  step 4). Two claims are marked unverified in the text: W2's multi-turn context
  (PLAN-hub.md §4, the streaming-input page is not in the mirror) and the Wave Terminal
  and Tabby quotes (PLAN-hub-view.md §4, outside Claude Code's docs; docs.waveterm.dev
  was blocked from the container, so its source files on GitHub were read instead).

## Unconfirmed suspicions

- **A long-lived `claude -p` may not keep its sandbox across messages** (routing-tree
  §13.2's open question, carried into PLAN-hub.md H0): until the probe passes, no role
  is `warm`. Probe: H0's sandbox clause, a `--bg` role asked to write outside its
  scratchpad on its second message.
- **Context may not persist across stream-json turns in one `-p` process** (PLAN-hub.md
  §4 W2, marked unverified): the cli-reference says a queued message starts a new turn;
  whether the new turn sees the old one is the SDK page's claim, not the mirror's.
  Probe: H0's three-clause warm probe.

## Reported to other owners

Per review finding 9, the hub's requests to other owners go out **after Jacob's yes on
PLAN-hub.md's Decisions**, each once, from this list. None sent yet (2026-10-05).

- **cron-scheduler**, to send: `chron.py list --json` returning `[{job, next_run,
  schedule, enabled}]` (PLAN-hub.md §7; PLAN-hub-view.md §2, V2); and reading the
  server list from `hub status --json --tree` instead of the manifest (PLAN-hub.md §7,
  Decision 5; changes group-servers decision 4's data source, not its owner).
- **harness**, to send: `gen` renders `hub.json` from the manifest (roles with
  read-only tools, tags, children, `server` from `servers.<group>`, `owners` defaults);
  `auto-relay.sh`, `question-gate.sh` and `record-session.sh` become one-line callers
  of `hub hook`; `dispatch-guard.sh` reads `hub status --json`; `quote-words.sh` reads
  `hub origin` (PLAN-hub.md §1, §2; beside H1a-2 and in H4).
- **tools/setup**, to send: the `hub` component (PLAN-hub.md "Setup component":
  `services.json` and `cli.json` skeletons, `registry.proposed.json`, `--node`,
  `local.env` keys, `.gitignore` lines, `checks run .` as the last step).
- **tools/checks**, to send: `rules-in-sync` and `hooks-installed` read `hub sync
  --check --json` after S1 (PLAN-hub.md §6); and the four contract checks of
  routing-tree §14.8 (`check-json`, `accessor`, `services-valid`, `registry-matches`)
  that PLAN-hub.md depends on and does not build.
- **knowledge-base**, to send: add to the mirror Claude Code's
  `docs/en/agent-sdk/streaming-input` page (the review found it absent; PLAN-hub.md §4
  cites it as unverified), Wave Terminal's documentation (docs.waveterm.dev:
  `customwidgets`, `wsh-reference`, layouts and config at least) and tmux's manual, so
  `kb q` and `kb check` cover every external tool the hub and its view use (Jacob's
  directive above; PLAN-hub-view.md §4 and V0).
- **tools/usage**, to send: `usage gate <estimate>` with exit code 0 = go and the words
  `warn` / `hold` with a hold time on non-zero (PLAN-hub.md §3; PLAN-usage-reporting.md
  §3).
- **planner** (via the dispatcher, 2026-10-04): PLAN-hub-review.md §4a's prompt should
  say "read `docs/inputs/` from `origin/main`" (or `main` be merged into `plan/hub`
  first), and should expect the TODO.md conflict. **Resolved by the fix pass
  2026-10-05:** it merged `origin/main` into `plan/hub` first (commit 0e779c1), so the
  new inputs were read from the branch and this file was edited from `main`'s version;
  `git merge-tree` of the two heads is the probe before the merge back.
- **dispatcher** (2026-10-04): the top-level `CLAUDE.md` tools row for `tools/hub/`
  still says its `./dev.sh check` is setup's stub; it is a real check now.
