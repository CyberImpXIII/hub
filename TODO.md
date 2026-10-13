# hub TODO

## Cloud phases, in order (PLAN-hub.md §9; one cloud session per item)

Each item is what a fresh cloud session starts from, by PLAN-cloud-offload.md §8's
procedure: Jacob starts the session on this repo, points it at the item, and the plan
comes back as a branch. Sizes are tokens with the 29k unit (1u). An item is done when
its condition holds on a branch named `build/<phase>`, with `./dev.sh check` green and
every §8 gate row named for the phase passing in `tests/`. Do them in this order; each
leaves the system working. **Cloud is the default, not a commitment** (PLAN-hub.md
Decision 9, Jacob 2026-10-09): when the credits run low or an item stalls, the same
item runs locally as a `deep-work` job, and the next pass of PLAN-hub.md says so in §9.

**Before item 1, locally (not a cloud item): H1a-0, the write gate and the read route**
(PLAN-hub.md §3 "H1a-0"; §9 row H1a-0; §8 rows "write gate and read route", "help ==
implemented", "kill the server" first part, "direction audit", "no names in the
program"; Decision 17; PLAN-services.md §3 steps 3 (and its 2026-10-13 widening) and
7). Size 80–130k (3–5u) for the skeleton and write half plus the read half, **unknown**
(PLAN-hub.md §9: no declaration it rests on exists yet), a local `deep-work` job, plus
~1u of harness for the hook. Not dispatchable as one job until the read half is costed;
over 200k, the read half splits off as H1a-0b. Done when: `hub up|down|status` and the
token check work; `POST /write-request` allows exactly a declared verb on a repo the
role may write (derived from `owners` at render time, Decision 17; no per-role `writes`
list) and denies the rest with the verb to use; `POST /read-request` answers a
declared-prefix id with its store's `get`, allows a declared file and denies the rest
with the verb to use; `hub hook gate` sees every tool call and a Read of an unowned
path makes no server call; the hook denies writes and routable reads with the server
killed; every §8 "write gate and read route" clause passes in `tests/`. The hook is registered in the planner
window only after `setup plans edit|add` and todo's import exist.

1. **H1a-1, the program with no routing yet** (PLAN-hub.md §9 row H1a-1; §2 for the
   registry, §3 step list for `hub up`, §7 for `status --json`, §8 rows "help ==
   implemented", "vocabulary", "registry", "kill the server" first half, "direction
   audit", "no names in the program", "services as data" audit, "owners both ways"
   schema). Size 80–130k (3–5u): the server skeleton is H1a-0's, so this item extends
   what H1a-0 left rather than starting it. Inputs: PLAN-hub.md §1–§3, §7, §8; PLAN-routing-tree.md
   §2, §7, §14.6–§14.8; `docs/inputs/PLAN-group-servers.md` §1a (the no-names audit);
   `docs/inputs/PLAN-portable-env.md` §3.1 (`local.env` through the loader). Done when:
   `hub init` (the `setup` component's alias, PLAN-hub.md Decision 2) writes a starter
   that passes `hub check`; the example registry in §2 passes `hub check` with no child
   registered, `limits` and `stores` included; a `warm` mode fails `hub check`
   (Decision 1); `hub up` binds, writes `.hub/server.json`, answers `/health` and
   `/status` with the token and refuses without it; `hub status --json` reports
   `{"up": false}` within one second after a kill and `hub up` restores
   held/dead-letter/ledger state from `.hub/`; `hub --help` == the subcommands and
   `docs/API.md` == the served routes, both ways, in a test; nothing under `tools/hub/`
   reads `.claude/` or names a repo, path or command (two audits, run by `./dev.sh
   check`).
2. **H1a-2, the relay through the server** (PLAN-hub.md §9 row H1a-2; §1 the moved
   pieces and the user-prompt hook, §3 the Dispatch section's path and the admission
   list, §8 rows "determinism", "kill the server" hook half, "origin", "admission" gate
   half, "limits both ways" budget and stub, "references by id" `ctx:` half, "failures
   are messages" stamp and `delivery`, "agent last" counts, "fails open, every hook").
   Size 140–200k (5–7u). Inputs: PLAN-hub.md §1, §3, §8, §12 (the `ctx:` entry);
   `docs/inputs/PLAN-auto-relay.md` §2–§4, §9 (the behaviour to keep item for item);
   `docs/inputs/PLAN-question-routing.md` §3–§4 (the gate);
   `docs/inputs/PLAN-usage-reporting.md` §3 (the gate admission asks);
   PLAN-routing-tree.md §3, §6, §13.3, §14.3, §14.7. The shell and jq sources of
   `dispatch-section.sh`, `relay-gate.sh`, `question-gate.sh`, `peer-cap.sh`'s stamping
   and `relay-ledger.tsv`'s format are in `.claude/` at the top level, which no input
   copies (PLAN-cloud-offload.md §8 forbids copying `.claude/`): the session rebuilds
   them from the plans' contracts and their documented tests, and the planner diffs
   behaviour against the originals at review. Done when: `/route` stamps `origin` from a
   fixture transcript (forged `jacob` → `model`; a Jacob turn carries `origin_id` and
   its stub line, never the text, and `hub get ctx:<id>` returns the prompt a fixture
   `ctx:` CLI stored through `hub hook user-prompt`; a body carrying the prompt's text
   past `stub_chars` is flagged `pasted`), applies admission (identical dropped,
   invalid dead-lettered with notice, `budget_per_conversation` + 1 model-starting
   messages held with free results in between not counted, released by a fixture Jacob
   prompt once), asks a fixture `usage` CLI (exit 0 goes; `warn` holds a job without a
   checkpoint; `hold` queues with the time and produces one line); the server's limits
   export equals `hub.json`'s `limits` keys both ways and a budget of 1 holds on the
   second model message with the ledger row naming `budget_per_conversation: 1`; `hub
   hook planner-stop` and `dispatcher-stop` parse the two sections, forward through
   `/route`, and with the server killed relay direct or block once locally with the
   notice; `hub hook user-prompt` with the server killed still stores the prompt and
   keeps the id in the state file; a `delivery` failure reaches the `owners` row and the
   dispatcher gets nothing; 100 fixture envelopes route identically twice; every hook
   exits 0 on malformed input. **Beside it, local, harness:** `gen` renders
   `.claude/hub-roles.json` and never `hub.json`; the three hook files become one-line
   callers and the user-prompt hook is installed for the two windows;
   `dispatch-guard.sh` reads `hub status --json`. **Beside it, local, tools/setup:**
   the `hub` component reads the role list and writes `hub.json` from it, and its
   idempotent check says `drift` when the file no longer matches (Decision 2).
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
   `claude -p --agent <role>` read-only, its hook (PLAN-hub.md §4) the gate and its
   flags a default only (`--allowedTools` Read, Grep, Glob, `Bash(hub send *)`;
   `--disallowedTools Edit,Write,NotebookEdit`;
   `dontAsk`; `--permission-prompts none`) with the `origin_id` stub line in its
   prompt, reads the stream to its `result` line, records its `usage` in the ledger,
   and returns a `report`; the role's `write-request` runs the fixture CLI's declared
   verb and an undeclared verb is refused and answered, never run; a Bash write inside
   the role's sandbox fails and the same write as a `write-request` succeeds; a commit
   `write` makes for the role carries `Agent: <role>`; two `task`s to one `dir` run one
   after the other; three spawns with two failing on different steps report each
   outcome; `hub log --usage` shows the spawn in 1u. **Probe first, local, H0**
   (PLAN-hub.md §9 row H0): this item assumes H0's `hub send` from inside a cold role
   and `dontAsk` honouring the tool list passed; if H0 has not run, the session runs
   those two probes against a fixture and records the result in this file. H0's third
   probe, the coder's Edit rule, is H2's and may wait.
5. **R1, references by id** (PLAN-hub.md §12; §9 row R1; §8 row "references by id").
   Size 120–170k (4–6u). Inputs: PLAN-hub.md §2 (`stores`, `limits.stub_chars`), §12,
   §8; `docs/inputs/PLAN-todo-tool.md` §3 (`todo get ID`, the second store) and §4
   step 4 (ids and tags); PLAN-routing-tree.md §14.1 (no store of the hub's own) and
   §14.8 (declared, never registered). Done when: a fixture repo's `services.json`
   `ids` entry appears in `stores` at `hub up` and `hub reload`; a planted `todo:` id
   in a body renders a stub (id, the fixture store's line cut at `stub_chars`, source,
   date) on the line after it; `hub get <id>` and `GET /refs/<id>` return the fixture
   store's `get` output byte for byte; `hub send --ref x:1` with an undeclared prefix
   is refused naming the declared prefixes; a sender's `refs` is overwritten; a body
   with more than `stub_chars` of a referenced record's text is flagged `pasted: <id>`
   and answered with a `report`, and `hub log --pasted` counts it; a store whose `get`
   is missing makes `hub check` red on `stores` and every stub for its prefix
   `unchecked`; an id the store cannot find renders `unresolved: not found` in the
   delivered text; a record changed between send and expand renders `changed since
   cited` with the cited line kept; two repos declaring one prefix fail `hub check`.
6. **H2, agent to agent** (PLAN-hub.md §9 row H2; §4 "The coder's exception"; §5
   "Cross-repo claims"; §8 rows "lease", "loops", "claims", "limits both ways" hops and
   ping-pong, "failures are messages" proposal). Size 160–200k (6–7u); if the fixtures
   push it over, the lease and `routes --proposed` split off as H2b. Inputs:
   PLAN-hub.md §2 (`@owner`, `limits`), §3, §4, §5, §8; PLAN-routing-tree.md §3, §6,
   §9, §10 phase 2, §13.5 (the lease as a coder's write-requests), §14.7 (the third
   re-route proposes a row); `docs/inputs/PLAN-interim-rules.md` §4 (the three rules
   this retires: `cross-repo-claims`, `one-writer`, `held-not-lost` relay half). Done
   when: a `report` from fixture node A naming B's path arrives at B as `bug-report`
   and B's `report` closes the conversation with the top dispatcher's inbox receiving
   neither; a claim with no owner dead-letters with notice; a fixture ping-pong is held
   at `pingpong_hold` and a hop-limit message dead-letters, each read from `limits`, in
   the export, and biting at a value of 1 with the ledger row naming the limit; two
   `task`s to one repo's coder run in turn and the second's `report` says it queued;
   **the coder's Edit rule:** a coder spawned under the lease with `Edit(<repo>/**)`
   edits inside its repo with Edit and with a Bash `echo >`, and both fail outside it;
   its green edit is committed by `write` with `Agent: <role>` and its red edit comes
   back as `check-red` with nothing committed; a coder spawned without the lease has no
   Edit rule; the third identical dispatcher re-route of an unowned kind appears in
   `hub routes --proposed`. **Probe first, local, H0:** the Edit-rule clause (a `-p`
   role with that rule under `dontAsk` cannot edit outside its repo, with the `claude
   --version`); if H0 has not run it, this session runs it on the fixture and records
   the result here.
7. **G1, the `check` and `hook` services** (PLAN-hub.md §9 row G1; §1 last row; §8 rows
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
8. **H3, hierarchy** (PLAN-hub.md §9 row H3; §5; §6 S3 and S4; §8 rows "hierarchy",
   "conformance" child half, "vocabulary" with children, "limits both ways" heartbeat,
   "sync" last three clauses). Size 160–200k (6–7u); making site-scrapers the first
   live child node is a local follow-up (1–2u). Inputs: PLAN-hub.md §5, §6, §8;
   PLAN-routing-tree.md §1, §7, §8, §9 "Hierarchy", §12 (classes, `vocab`, S3–S4);
   `docs/inputs/PLAN-repo-setup.md` §7.5 and §7.8 (`setup --node`, the two-level
   fixture tree, who owns rendered files). Done when: a child posts `/register` on `hub
   up` with the parent's token, the parent heartbeats it every `limits.heartbeat_s`
   seconds and marks it `down` after `limits.heartbeat_misses` misses (both in the
   export; one miss at a value of 1), and `hub down` de-registers it; a three-level
   fixture tree leaves no grandchild in any parent's `.hub/children/`; a de-registered
   child's tags route to the parent's dispatcher with notice; a child advertising a
   parent's tag is refused with the tag named; `hub up --tree` and `hub status --tree`
   cover the fixture tree; a node with no `HUB_PARENT_URL` runs as a root and says so;
   `hub sync --propose` sends drift as a `sync` message; a `vocab` entry is inherited
   and a child cannot redefine it; a `write-request` for a rendered file in a child is
   served by the child's server with no message in the parent's ledger (repo-setup
   §7.8's gate).
9. **D1, driven sessions** (PLAN-hub.md §11; §9 row D1; §8 row "driven session"). Size
   120–180k (4–6u). **After D0, local** (§9 row D0, 20–40k): the probe's clauses, each
   mechanism's pass or fail with `claude --version`, decide which of M1, M2, M3 this
   item builds; if D0 has not run, this item is not dispatchable (its scope is D0's
   result). Inputs: PLAN-hub.md §4 (the cold flags), §11, §12 (the `ctx:` id the
   rebuild comes from), §8; the D0 result file in `tools/hub/probes/`. Done when, on a
   fixture role: `hub session start` runs the stream-json process with
   `--replay-user-messages`, and the hub's list equals the acknowledged messages plus
   the `result` lines; the idle point holds (no rebuild lands while a fixture
   background subagent sleeps past its turn's `result`, one lands within a poll of its
   `tool_result`); a rebuild from a `ctx:` id by the chosen mechanism leaves the next
   answer knowing Y and not X (same pid for the block edit; `cache_read_input_tokens`
   at least the unchanged prefix for the resume); after a rebuild `hub origin` says
   `model`; a rebuild file with a recorded `tool_result` line is refused; every message
   of the pre-rebuild list is in the snapshot the ledger names; `hub session` from a
   role's Bash is refused and answered; no committed registry names a `driven` role
   (Decision 14, 2026-10-13: D0 runs on a fixture before anything touches the planner
   window).

After these, the local phases in PLAN-hub.md §9 (H0 and D0 the probes, S2, V0–V3 in
PLAN-hub-view.md, H4, R2) are `deep-work` jobs and Jacob's own hours, not cloud items;
and any item above may become one too (Decision 9).

## For the local handoff (Jacob, 2026-10-05)

- **Docs of every external tool go into the knowledge base, never the tool's code into
  context.** Jacob: "we want the docs for every external tool put into the knowledge
  base, rather than storing the entirety of the code in context." For the hub and its
  view that means: Wave Terminal's docs and tmux's manual before V1 (PLAN-hub-view.md
  §4, V0); Claude Code's `agent-sdk/streaming-input` page, which the review found
  missing from the mirror and the 2026-10-13 pass read live (PLAN-hub.md §11 cites it;
  `kb check` cannot confirm it until the page is mirrored); and the same for any host,
  library or CLI a later phase adopts. A builder asks `kb q`, not `cat` on a vendored
  tree. Owner: knowledge-base, in "Reported to other owners".

## Own bugs

- **The leak audit's terms are three shapes** (email, home-folder path, phone); the
  credential half is tools/checks `no-secrets`. Names of people and of private repos
  are not caught: `claudeTest-CLAUDE.md` names private repos, as it did in the first
  copy. Unconfirmed whether that matters for a public repo; Jacob's call if it does.

## Open decisions

- **The 12 hook registrations are applied locally but not committed** (Jacob's step).
  Jacob's `wiring --apply` on 2026-10-09 left the local `main` checkout's
  `.claude/settings.json` byte-equal to `.claude/settings.proposed.json` (`cmp` equal,
  checked 2026-10-09): 15 hook registrations, against 3 in the committed file (`main`
  03f33d2: no-inline-blobs, troubleshooting, prefer-recipes). The change is uncommitted,
  so a session started in that checkout reads all 15, but a clone (the cloud pass, this
  branch) still gets the committed 3. Committing it is Jacob's step; no agent touches
  settings.json. setup also installed `.githooks/{pre-commit,commit-msg,check-pass}`,
  but `core.hooksPath` is still unset (checked 2026-10-09) and `githooks.checks` has
  no checks CLI, so those gates are off (setup reports `needs-jacob`).
- **When to refresh `docs/inputs/` again.** `./dev.sh check` prints drift as a note,
  never a fail: the copies are snapshots, and a top-level plan edit must not block a
  hub commit. Refresh before handing the cloud a new pass (`./dev.sh refresh`). Last
  refresh 2026-10-12 on `plan/hub` (REVIEW §5.12: the brief and claudeTest-CLAUDE.md
  had drifted; docs/inputs/README.md), with `docs/REVIEW-2026-10-09.md` re-copied.
  The local `main` checkout's copies are older still (2026-10-09 refresh is on
  `plan/hub` only); they arrive with the merge. The 2026-10-13 cloud pass could not
  run `drift` (no originals in a clone).
- **PLAN-hub.md Decisions: none open after 2026-10-13.** 9 (the 1.7–2.5M re-cost,
  against the $156 balance), 14 (D0 on a fixture before anything touches the planner
  window), 16 and 17 (writable repos derived from `owners`, no per-role `writes` list)
  answered; 12 and 15 dissolved (the hook routes every call, no tool list is the gate;
  PLAN-services.md §3 step 3 "Widened"). H1a-0's read half came after the Decision 9
  yes and is unknown in size (§9).
- **H1a-0's read rule has nothing to read yet** (2026-10-13). PLAN-services.md §3 step
  3: "a read of a file an owner declares is served as that file". No key in PLAN-hub.md
  §2 declares an owned file path (`repos` rows hold check, cli, verbs, tags, ids), and
  the first declared prefix, `ctx:`, lands in H1a-2. Until one is named, the read half
  is built on fixture declarations only and its size is unknown. Planner's to name.
- **"Denied" versus "plain Read" for unowned paths** (PLAN-services.md §3 step 3, two
  bullets): "a call that names nothing any owner declares is denied with the verb to
  use" and "the agent's Read on a path nothing owns stays plain Read". PLAN-hub.md §3
  reads them as: a Read of an unowned path never reaches the server; other calls
  naming nothing declared are denied. Unconfirmed that this is the planner's meaning.
- **The coder's lease under a hook on every call** (PLAN-hub.md §4): the hook now sees
  the leased coder's Edit, so the server must answer it with allow inside the repo, or
  Decision 13's Edit rule never takes effect. Written into §4; H2's "lease" row should
  carry a clause for it when H2 is next touched.
- **How a role's writable repos derive from `owners` is unstated** (Decision 17,
  2026-10-13). `owners` (PLAN-hub.md §2) maps a seam kind to an owner role
  (`check-red: {repo}/coder`, `unowned: dispatcher`); no row names the planner, yet
  H1a-0's planner must be allowed `setup plans edit|add` and todo's importer. Read off
  §2's example as written, the derivation gives the planner no writable repo. H1a-0
  needs the mapping (which rows, or which ownership relation, yields role -> repos) and
  where the rendered result lives in `hub.json`, plus a both-ways gate on it, before
  code. Planner's or Jacob's to state; only the text was updated, no code built.
- **The role list's shape is wider than REVIEW §5.8's wording.** 5.8 described
  `.claude/hub-roles.json` as each role's name, mode, `dir` and tools plus the routes;
  PLAN-hub.md §2 also puts `children`, `server` (port, keep-alive from
  `servers.<group>`) and the `owners` defaults in it, because `gen` no longer writes
  `hub.json` and those facts have no other path from the manifest to `setup`. The
  planner confirms the shape with harness before the H1a-2 harness job; the
  alternative is `setup` flags, which would make the port a per-machine argument
  against Decision 10.
- **The brief's §5 still says "eleven questions"** (lines "§4's eleven questions
  answered in order" and "answers all eleven questions"), while §4 has twelve and
  PLAN-hub.md now answers twelve (§11, §12, 2026-10-13). Reported to the planner
  (2026-10-12), whose original it is; an edit here would be undone by the next refresh.
  No gate counts §4's questions against §5's number; `brief_numbering` checks only that
  the items count without repeat or gap. Unconfirmed whether a gate is worth it (the
  number appears in prose, twice).
- **The planner's `kb check` on the 2026-10-13 citations.** The cloud pass read these
  pages live from code.claude.com and quoted them; the anchors are the pages' headings
  slugged and are unverified offline: `prompt-caching#how-the-cache-is-organized`,
  `#cache-lifetime`, `#check-cache-performance`; `headless#auto-approve-tools`,
  `#continue-conversations`, `#stream-responses`, `#follow-subagent-messages`,
  `#background-tasks-at-exit`; `cli-reference#cli-flags`,
  `#system-prompt-flags-in-resumed-conversations`; `hooks#userpromptsubmit`, `#stop`;
  `permissions#read-and-edit`; `sandboxing#permission-rules`;
  `agent-sdk/overview#compare-the-agent-sdk-to-other-claude-tools`;
  `agent-sdk/streaming-input#benefits`. An anchor that does not resolve is a wrong
  pointer to a right quote; the quote is still the page's.
- **Merging `plan/hub` back into `main`** (REVIEW-2026-10-09 §5.11 step 3, after the
  planner's re-read). `origin/main` (03f33d2) was merged into `plan/hub` on 2026-10-09
  for the next cloud pass; the one conflict, TODO.md, was resolved with `plan/hub`'s
  file as the base, dropping the two own bugs `main` had closed (the UNCHECKED hook test
  counted as FAIL, fixed 2026-10-08; hand-copied hook reinstalls, dropped in 94dea2b).
  A merge back conflicts again only if `main`'s TODO.md moves meanwhile: probe with
  `git merge-tree --write-tree origin/main origin/plan/hub` first. `plan/hub` also
  carries a code fix `main` lacks until then: 995bc61, `./dev.sh leaks FILE` printed ok
  for a file it could not read (a relative path, since `dev.sh` cds to the repo). The
  2026-10-13 pass rewrote this file again, so the probe is not optional.

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
- **`kb check` cannot run in the cloud** (docs/inputs/README.md): the docs mirror is
  private and local. The fix pass wrote every citation as `"quote" (url#anchor)` from
  the live pages read on 2026-10-05, and the 2026-10-13 pass did the same for §4
  (Decision 1's caching claims, the coder's Edit rule), §11 and §12 (the list is in
  "Open decisions"); only the planner's `kb check --all PLAN-hub.md PLAN-hub-view.md`
  settles them (review §4 step 4). Still marked unverified in the text: the Wave
  Terminal and Tabby quotes (PLAN-hub-view.md §4, outside Claude Code's docs;
  docs.waveterm.dev was blocked from the container, so its source files on GitHub were
  read instead). The streaming-input claim that was unverified on 2026-10-05 is now
  cited (PLAN-hub.md §11) and still unrun (D0).

- **`sealed` is red on a fresh clone** (2026-10-09, PLAN-architecture-review.md §4 U1):
  git keeps no mode bits, so a clone (the cloud pass) and any checkout or merge that
  rewrites a copy leave it 0644, and `./dev.sh check` fails until `./dev.sh seal`. Each
  FAIL line names that command. The mode is a marker only (W6: Edit/Write replace a
  0444 file and keep 0444); the guard is `inputs` against SHA256SUMS
  (`TestSealed.test_the_mode_is_not_the_guard_inputs_is` holds that). Not sealed:
  README.md and SHA256SUMS (refresh rewrites SHA256SUMS in place). Seen again
  2026-10-13: red on the clone, green after `seal`.

## Unconfirmed suspicions

- **Context persists across stream-json turns in one `-p` process**: cited now
  (`agent-sdk/streaming-input#benefits`, "Context persistence: maintain conversation
  context across multiple turns naturally", read live 2026-10-13; PLAN-hub.md §11),
  not yet run. Probe: D0's first clause (message A "remember X", message B "what was
  X", B's `result` contains X, with a `result` line between them).
- **A turn's `result` line may precede a background subagent's completion in a
  stream-json session** (PLAN-hub.md §11, the idle point). The headless page says the
  run stays open for background subagents at exit; whether a mid-session turn's
  `result` waits is not said. Probe: D0's fourth clause, a fixture background subagent
  sleeping 20 s; record whether `result` arrives before its `tool_result`. The hub
  waits for the `tool_result` either way, so a `yes` costs nothing but the record.
- **`--resume <path>` accepts a transcript the hub wrote** (PLAN-hub.md §11, M2). The
  flag is documented for a session's own transcript; the line format is not. Probe:
  D0's M2 clause, with the `claude --version`; a fail leaves M3 as the rebuild.
- **An `Edit(<repo>/**)` allow rule under `dontAsk` in a `-p` role denies an edit
  outside the repo, and the sandbox's writable set follows the rule** (PLAN-hub.md §4,
  Decision 13). Both are documented (`permissions#read-and-edit`;
  `sandboxing#permission-rules`: "`Edit` allow rules | Grant write access to specific
  paths, the same way `sandbox.filesystem.allowWrite` does"); neither is run. Probe:
  H0's Edit-rule clause, with Edit and with a Bash `echo >`, inside and outside.

## Reported to other owners

Per review finding 9, the hub's requests to other owners go out **after Jacob's yes on
PLAN-hub.md's Decisions**, each once, from this list. None sent yet (2026-10-05;
re-checked 2026-10-13: the cloud pass sends nothing, so this list is the record).

- **cron-scheduler**, to send: `chron.py list --json` returning `[{job, next_run,
  schedule, enabled}]` (PLAN-hub.md §7; PLAN-hub-view.md §2, V2); and reading the
  server list from `hub status --json --tree` instead of the manifest (PLAN-hub.md §7,
  Decision 5, approved 2026-10-09; changes group-servers decision 4's data source, not
  its owner).
- **harness**, to send: `gen` renders `.claude/hub-roles.json` (a generic role list:
  roles with their default tools, routes, children, `server` from `servers.<group>`,
  `owners` defaults, its source hash) and **never `hub.json`** (PLAN-hub.md §2,
  Decision 2); `auto-relay.sh`, `question-gate.sh` and `record-session.sh` become
  one-line callers of `hub hook`; a `UserPromptSubmit` hook for the two windows,
  `hub hook user-prompt`, stores each typed prompt in `ctx:` (Decision 3);
  `dispatch-guard.sh` reads `hub status --json`; `quote-words.sh` injects the
  `origin_id` stub through `hub origin`, not the text (PLAN-hub.md §1, §2; beside
  H1a-2 and in H4).
- **tools/setup**, to send: the `hub` component is **the one writer of `hub.json` at
  every node**, reading `.claude/hub-roles.json` where it exists and writing the
  starter where it does not, with `drift` in its idempotent check (PLAN-hub.md §2,
  Decision 2); the rest of the component (PLAN-hub.md "Setup component":
  `services.json` with `verbs`, `tags` and `ids`, `cli.json` skeletons,
  `registry.proposed.json`, `--node`, `local.env` keys, `.gitignore` lines, `checks
  run .` as the last step).
- **context-hygiene**, to send (new 2026-10-13): the `ctx:` store takes a typed prompt
  from `hub hook user-prompt` through its own CLI and answers `get <id>` with one line
  and the text (PLAN-hub.md §1, §12; its write verb is that plan's to name); its CLI
  calls `hub session rebuild <id> --from ctx:<id>` when its monitor says it is time,
  with the rendered list as a `ctx:` record (§11); and a question: are `ctx:` records
  immutable, so a cited snapshot never changes (§12 "changed since cited")?
- **todo**, to send (new 2026-10-13): `todo get ID` is read as is as the second store
  (PLAN-hub.md §12, R1); the todo repo's `services.json` declares `ids` for `todo:`
  when the component installs it.
- **tools/checks**, to send: `rules-in-sync` and `hooks-installed` read `hub sync
  --check --json` after S1 (PLAN-hub.md §6); and the four contract checks of
  routing-tree §14.8 (`check-json`, `accessor`, `services-valid`, `registry-matches`)
  that PLAN-hub.md depends on and does not build.
- **knowledge-base**, to send: add to the mirror Claude Code's
  `docs/en/agent-sdk/streaming-input` page (the review found it absent; PLAN-hub.md §11
  now cites it from a live read), `docs/en/prompt-caching` (PLAN-hub.md §4 and §11 cite
  it), Wave Terminal's documentation (docs.waveterm.dev: `customwidgets`,
  `wsh-reference`, layouts and config at least) and tmux's manual, so `kb q` and `kb
  check` cover every external tool the hub and its view use (Jacob's directive above;
  PLAN-hub-view.md §4 and V0).
- **tools/usage**, to send: `usage gate <estimate>` with exit code 0 = go and the words
  `warn` / `hold` with a hold time on non-zero (PLAN-hub.md §3; PLAN-usage-reporting.md
  §3).
- **planner** (via the dispatcher, 2026-10-04): PLAN-hub-review.md §4a's prompt should
  say "read `docs/inputs/` from `origin/main`" (or `main` be merged into `plan/hub`
  first), and should expect the TODO.md conflict. **Resolved by the fix pass
  2026-10-05:** it merged `origin/main` into `plan/hub` first (commit 0e779c1), so the
  new inputs were read from the branch and this file was edited from `main`'s version;
  `git merge-tree` of the two heads is the probe before the merge back.
- **planner** (via the dispatcher, 2026-10-09): PLAN-architecture-review.md §4 U1 cites
  "its TODO.md:541 says 0444", but hub's TODO.md has no such line (94 lines); 541 is
  claudeTest's top-level TODO.md, Decision 39 (open), which proposes that the TOP-level
  `PLAN-hub-brief.md` become a 0444 copy of hub's brief, gated by hub's check. The
  docs/inputs copies are now 0444 anyway (`sealed`). Decision 39's own gate (top copy
  differs or is writable) is not built: it waits on that decision. **2026-10-09:**
  Jacob answered "no flip" (REVIEW §5.10, 5.6), which closes Decision 39 at the top;
  the hub item for it is deleted here.
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
- **dispatcher** (2026-10-04): the top-level `CLAUDE.md` tools row for `tools/hub/`
  said its `./dev.sh check` was setup's stub. Settled: that row says hub's check is a
  real gate since 47eea1a (read 2026-10-08).
