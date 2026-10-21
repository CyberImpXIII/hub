# The hub: one portable node program, and a terminal view over it

> **Status: plan, written in the cloud from PLAN-hub-brief.md, 2026-10-04; revised in the
> cloud 2026-10-05 on `plan/hub`** from `docs/REVIEW-2026-10-04.md` (citations as quotes,
> findings 1–8) and from the brief's fixed points 9 and 10, which were decided after the
> review and which the plan places without reopening; **revised again in the cloud
> 2026-10-13 on `plan/hub`** from `docs/REVIEW-2026-10-09.md` §5.8–§5.12, Jacob's answers
> to every Decision (warm roles dropped, `setup` the one writer of `hub.json`, his words
> by id, every limit a registry value, the coder's lease-scoped Edit rule, cloud phases
> as defaults) and from the brief's §4 questions 11 and 12 (§11, §12). Nothing is built.
> Sections 1–12 answer the brief's §4 in order, and §15 its question 15 (written locally
> 2026-10-19; questions 13, 14 and 16 are open); the terminal front end Jacob described on
> 2026-10-04 is PLAN-hub-view.md (review finding 7). The planner reviews this file with
> Jacob and runs `kb check` on it; the cloud phases of §9 are built from `TODO.md`'s
> items once approved.
>
> **Owners:** `deep-work` for `tools/hub/` (server, CLI, view, gates); `harness` for what
> stays in `.claude/` and for rendering the registry from the manifest (§2); the
> `cron-scheduler` agent for `chron.py`'s side of §7; the dispatcher for the CLAUDE.md
> rewrite in phase H4; Jacob for `settings.json`, the terminal host (PLAN-hub-view.md)
> and the Decisions table.
>
> **Builds on:** PLAN-routing-tree.md (the approved design, placed here, not redesigned);
> PLAN-tools-folder.md §1, §3, §7 (the criterion and the home); PLAN-auto-relay.md §3–§4,
> §7, §9 (the first node's inbox, kept behaviour for behaviour); PLAN-question-routing.md
> §2, §4 (the kinds the hub routes); PLAN-group-servers.md §1a, §2, §3 (one program,
> enforcing hooks stay command hooks, control through `chron.py`); PLAN-agent-groups.md
> §4, §6 (roles, gated on tokens); PLAN-todo-tool.md §2, §4 (the tool carries facts,
> harness resolves the agent); PLAN-interim-rules.md §5 (what retires when);
> PLAN-cloud-offload.md §3 and §8 (tests offline; which phases run in the cloud);
> PLAN-repo-setup.md §1–§2 and §7.8 (how it ships; who owns rendered files) and
> PLAN-portable-env.md §1–§3 (`local.env`, `init.sh`); routing-tree §13–§14 (read-only
> roles, one server with four services, an owner per seam kind: fixed points 9 and 10);
> PLAN-usage-reporting.md §3 (the usage gate admission asks); PLAN-hard-gates.md §2 (the
> `Agent:` commit stamp); PLAN-check-progress.md §7 (why no phase is over 200k).
>
> **Open pointers** (inputs cited by the brief's inputs but not copied): PLAN-context-hygiene.md,
> PLAN-knowledge-base.md, PLAN-applications.md, PLAN-services.md. Where this plan needs
> them it says so and does not guess their content; §11 and §12 lean on the first and the
> last and name the verbs the brief names, no others.

**The hub in one paragraph.** `tools/hub/` is one Node program, `hub`, the same at every
node, configured only by a data file at that node, the registry (§2), and by
`local.env`. Its server (`hub up`) is **one process with four services declared as
data** (routing-tree §14.6, fixed point 10): `route` carries tagged envelopes between
roles and nodes with no model involved, stamps origin and keeps the ledger; `write`
runs a tool's gated CLI on behalf of a **read-only role** (routing-tree §13, fixed point
9), so no role has a write path of its own; `check` runs a repo's own `dev.sh check
--json`; `hook` answers stateful hook questions from the ledger. The server's only
store is that ledger of what moved; every other fact stays in the tool that owns it
(§14.1). A failure the server detects is a message routed to the owner of the failing
seam kind, never a log line that ends there (§13.3, §14.7). Its CLI is also the body of
every hook the hub absorbs from `.claude/`, so the blocking decisions run locally and
keep working with the server down. Its view (PLAN-hub-view.md) is a client of the API
and of `claude agents --json`. Nothing under `tools/hub/` opens the manifest, the agent
definitions or `.claude/lib`; harness renders a generic role list from the manifest the
way `gen` renders agent definitions, and `setup` writes the registry from it at every
node (Decision 2). Every limit the server enforces is a value in that registry
(Decision 4); a role is cold or a window, never warm (Decision 1); Jacob's words reach a
role as an id, never as text (Decision 3, §12); and a session the hub keeps alive is a
`driven` session whose context the hub rebuilds at a measured idle point (§11).

**Cost unit.** One roster agent's starting context, about 29k tokens (measured
2026-10-02), written "1u". Costs below are ranges in tokens with the unit beside them.

---

## 1. The split with harness

Rule applied: a piece moves into the hub when it reads no roster (tools-folder §1); it
stays in harness when it is policy over the roster (tools-folder §7 rows A and B); and
when a piece is harness data the hub consumes, harness renders it into hub data. "Moves"
means the existing shell and jq implementation and its tests move under
`tools/hub/lib/` **unchanged** in behaviour, called by the Node program through a
subprocess; a rewrite in JavaScript is a later job only if a measurement asks for it
(brief §1: "move into the hub unchanged").

| piece | verdict | reasons, and what it becomes |
|---|---|---|
| `dispatch-section.sh` (the relay parser, `grammar`) | **moves** | pure function over a reply's text; becomes `hub lib section` with its tests and the §2 example-matches-grammar gate. `planner-role.sh` prints `hub grammar` instead of calling the lib |
| `auto-relay.sh` (planner Stop hook) | **moves**; the hook file becomes a one-line installed copy | its body is `hub hook planner-stop`, reading the hook JSON on stdin. The parser, dedupe and delivery live in the hub. Behaviour kept item for item (auto-relay §3, §4, §9): no section sends nothing, malformed lines go as `dispatch-malformed`, items dedupe by hash, a failed send is a one-line notice, never a block. Installed by `setup hooks` from a declaration `applies_to: roles:planner` (fixed point 5) |
| `relay-gate.sh` (admission: identical, invalid, runaway) | **moves** into the server's `/route` | these are routing-tree §6 loop controls generalised: identical → dropped; invalid → dead-letter with notice; runaway → **held** and delivered after Jacob's next prompt. The `grant` budget (auto-relay §4 reason 4) is read from a file harness owns and `agents.sh grant` writes; the hub reads the grant file by path given in `local.env`, never the manifest |
| `peer-cap.sh` | **splits**: the relay stamping and the hold-and-deliver move; the free-form cap stays until H4 | origin stamping is `hub origin <session> <turn>` (a transcript read, no roster). The cap on free-form `SendMessage` between the two windows is a `UserPromptSubmit` block, so it stays a command hook in harness (group-servers §2) until phase H4 replaces window-to-window `SendMessage` with `hub send`; then the interim rule `held-not-lost` retires |
| `record-session.sh` | **stays in form, body moves** | still a `SessionStart` command hook harness installs; its body is `hub hook session-start`, which posts `session_id`, `agent_type`, `cwd`, `permission_mode` and `CLAUDE_CODE_MESSAGING_SOCKET` to `/sessions`. The hook input carries `agent_type`, "Present when the session uses `--agent` or the hook fires inside a subagent" (<https://code.claude.com/docs/en/hooks#common-input-fields>), and `permission_mode` (same anchor); the socket variable is exported first: "In a session that starts with messaging on, Claude Code exports the variable before any hook runs, including `SessionStart`" (<https://code.claude.com/docs/en/cross-session-messaging#the-sessions-inbox-socket>). With the server down it writes the same state file it writes today (fail open, tested) |
| `planner-role.sh` | **stays** | it is the planner's role note, policy about one roster agent; it calls `hub grammar` for the one line that moved |
| `question-gate.sh` (dispatcher blocks once, planner notices) | **moves**; the hook file becomes an installed copy | `hub hook dispatcher-stop` and `hub hook planner-stop` run the gate **locally** in the hub program, so the one block still happens with the server down. Forwarding a `[plan]` item is a `question`-tagged envelope through `/route`; with the server down it posts to the planner's recorded socket as today. The three question types are vocabulary in the registry (§2), not in the manifest; harness renders them there from `questions.types` until the manifest drops the key |
| the relay kinds (`item`, `dispatch-malformed`, `question`, later `sync`) | **move** as tags | they are the first entries of the node's tag vocabulary (§2). `agents.sh relays` becomes a view over `hub log` |
| the relay ledger (`relay-ledger.tsv`) | **moves** | becomes the hub's conversation ledger, one JSON line per routing decision with the registry hash that produced it (routing-tree §1, §3), and per spawn the `result` line's `usage` tokens. `hub log [--since] [--kind] [--usage]` reads it, `--usage` in units of 1u; `agents.sh relays` calls that |
| the dispatch ledger (`dispatches.jsonl`, Agent-tool spawns) | **stays until H4, then merges** | it records roster spawns through the Agent tool and reads agent types (tools-folder §7 row E). Spawns the server makes are hub ledger rows from H1b on; when H4 removes the Agent-tool path, `agents.sh dispatches` becomes a view over `hub log --kind spawn` and the file retires. Tools-folder §7's "the ledger stays until hub" is confirmed, with the date fixed at H4 |
| `agent-watch.sh` (stale alerts) | **stays until H4**; its function for server-owned processes is the server's | per-role last-seen is server state (group-servers §3.4): the server reports a role process that dies or goes silent as `failed`/`stale` in `hub status` and as a `report` envelope to the sender. The hook keeps watching Agent-tool spawns until H4; interim `stale-spawn` retires then |
| `quote-words.sh` | **stays**; its text becomes an id | it is policy over roster spawns (row B). Jacob's words travel **as an id, never as text** (Decision 3, approved 2026-10-09 with his refinement): a `UserPromptSubmit` command hook harness installs for the two windows (`hub hook user-prompt`; the hook "receive[s] the `prompt` field containing the submitted text", <https://code.claude.com/docs/en/hooks#userpromptsubmit>) stores each typed prompt in context-hygiene's `ctx:` store through that tool's own CLI (one store, not a new one; its write verb is PLAN-context-hygiene.md's to name, not guessed here) and records the returned id against `session_id` and turn in the ledger (`/sessions/<id>/prompts`). The server's origin stamp (`hub origin`, the transcript read that classifies a turn `jacob` or `model`) then attaches `origin_id` (`ctx:<id>`) to `origin: jacob` envelopes, with the §12 stub line, and nothing else. A cold role reads the words with one `get` (§12, `hub get ctx:<id>`) only when it needs them, so Jacob's words cost output tokens once, at the hook, and input tokens only in a role that reads them. `quote-words.sh` injects the id and its stub line into an Agent-tool spawn instead of the text, through the same `hub origin`; one transcript reader, no jq of its own. With the server down the hook still stores the prompt and keeps the id in the state file `record-session.sh` writes (fail open, tested) |
| `dispatch-guard.sh`, `grant`, the manifest, `gen`, `check`, `doctor`, `wiring` | **stay** | the roster and the policy over it (tools-folder §7). The guard gains two facts from the hub: `hub status --json` says whether the server is up (§3), and a model's Bash call to `hub routes accept` is blocked the way `agents.sh grant` is |
| PLAN-group-servers.md's per-group server (`/touched`, `/stop`, `/audit`) | **becomes the `check` and `hook` services of this process**, not a second program (routing-tree §14.6, fixed point 10) | its endpoints become `check` requests (`{repo, scope}`); the stateful halves of `troubleshooting.sh` (host history), `agent-watch.sh` (staleness), `quote-words.sh` (the words) and `record-session.sh` (the sockets) become `hook` service lookups answered from the ledger, while each hook's **blocking** half stays a command hook (group-servers §2). Lands as phase G1 (§9) |

Two things harness renders into hub data rather than the hub reading them: the role
list `.claude/hub-roles.json`, from which `setup` writes the registry (§2, Decision 2),
and the role hooks' install declarations (fixed point 5). Both carry the rendering's
source hash so `agents.sh check` can say "stale" the way it does for agent definitions.

→ Built across H1a-2 (relay, gates, ledger, the user-prompt hook), H1b (origin id,
spawns), H4 (the two "until H4" rows).

## 2. The registry file

**One committed file per node, `hub.json` at the repo root: the registry, the server's
one input** (routing-tree §14.6). Beside it, two keys in the gitignored
`.claude/local.env` (portable-env §3.1): `HUB_TOKEN` and `HUB_PARENT_URL` (empty at a
root). The port and keep-alive are node facts in the registry, rendered by harness into
the role list from the manifest's `servers.<group>` entry where harness exists (§14.6,
settled by the planner 2026-10-05) and written into `hub.json` by `setup` from there, as
the manifest commits them today; a port clash on a machine is a `hub check` finding, not
a reason to move the port. Nothing in `hub.json` names a machine, an owner or an
account. **`setup` is the only writer of `hub.json`, at every node** (Decision 2,
approved: Jacob 2026-10-09, REVIEW §5.10): `agents.sh gen` writes a role list, never
the registry, and `hub init` is the same `setup` component run where no role list
exists.

```json
{ "hub": 1,
  "node": "claudeTest",
  "server": { "port": 47100, "keep_alive": "launchd" },
  "roles": {
    "planner":    { "mode": "window",  "agent": "planner" },
    "dispatcher": { "mode": "window",  "agent": "dispatcher", "fallback": true },
    "site-scrapers": { "mode": "cold", "agent": "site-scrapers", "dir": "site-scrapers",
                       "tools": ["Read","Grep","Glob","Bash(hub send *)"] },
    "operator":   { "mode": "cold",    "agent": "operator",
                    "tools": ["Read","Grep","Glob","Bash(hub send *)"] }
  },
  "tags": {
    "dispatch": "dispatcher", "dispatch-malformed": "dispatcher",
    "question": { "dispatch": "dispatcher", "plan": "planner" },
    "task": "@dir", "report": "@from", "bug-report": "@owner",
    "write-request": "@write", "check-request": "@check"
  },
  "services": {
    "route": { "on": true },
    "write": { "on": true },
    "check": { "on": false },
    "hook":  { "on": false },
    "usage": { "cli": "usage gate" }
  },
  "repos": {
    "site-scrapers": { "check": "./dev.sh check --json", "cli": "./scrape.sh",
                       "verbs": ["register", "mark", "import"], "tags": ["scrape-request"] }
  },
  "owners": {
    "delivery": "harness", "lease": "harness",
    "check-broken": "tools/checks", "check-red": "{repo}/coder",
    "hook-broken": "tools/hooks", "hook-block": "@from", "tool-result": "@from",
    "unowned": "dispatcher",
    "workspace": { "paths": ["PLAN-*.md", "TODO.md", "todo.json"],
                   "roles": ["planner", "dispatcher"] }
  },
  "children": [ { "name": "site-scrapers", "path": "site-scrapers" } ],
  "parent": null,
  "limits": { "hops": 8, "budget_per_conversation": 10, "pingpong_hold": 4,
              "heartbeat_s": 30, "heartbeat_misses": 2, "stub_chars": 200 },
  "stores": { "ctx": "context-hygiene", "todo": "todo" },
  "sync": [], "classes": {},
  "rendered_from": { "source": ".claude/hub-roles.json", "hash": "sha256:…" }
}
```

- **`server`.** The port the server binds on 127.0.0.1 and how it is kept alive (§7).
- **`roles`.** Name, `mode` (`window` | `cold` (§4) | `driven` (§11); `warm` is not a
  value, Decision 1), the `--agent` name the
  server passes, the `dir` it runs in (relative to the node root; default the root),
  and the tools the server passes with `--allowedTools`, **as a default, never the
  gate**. **Every role is read-only** (routing-tree §13.2, fixed point 9), and the
  PreToolUse hook is what makes it so, not the list (Jacob 2026-10-13, PLAN-services.md
  §3 step 3 "Widened"; Decisions 12 and 15 dissolved): every call a role makes passes
  the hook, which sends it to its owner as a `read-request` or `write-request` (§3
  H1a-0 and H1a-0b, §4), so a call the list lets through is still the hook's to route or deny.
  `fallback: true` marks the node's dispatcher (routing-tree §3 rule 4).
  What a role may ask the server to write (H1a-0, §3) is derived from `owners` at
  render time; there is no per-role `writes` list (Decision 17, Jacob 2026-10-13). The
  planner and the dispatcher have the `workspace` row and nothing else (the planner's
  answer, PLAN-services.md §3 step 3, "The hub owner's four questions" 1); no `repos`
  row names either. A repo's own role (the one whose `dir` is that repo, which `owners`
  names through `{repo}/coder`) has that repo: it writes the repo's stores through
  their verbs and its non-store paths under H2's lease, and no other role writes there
  (confirmed by the planner: PLAN-services.md §3 step 3, "Two more from the hub owner"
  2, approved: Jacob 2026-10-13; first used in H1b). It is no write tool:
  the role stays read-only, and a derived name that is neither a `repos` key nor
  `workspace` fails `hub check`.
  `window` is this plan's one addition to routing-tree §5: a role Jacob talks to, which
  the server never spawns and reaches through the inbox socket that `/sessions`
  recorded.
- **`services`.** The four services of §14.6, each on or off at this node, plus the
  `usage` gate's CLI (§3). `route` and `write` are on from H1b; `check` and `hook` come
  on in G1. The program holds no tool's command: what a service runs for a repo is that
  repo's row in `repos`.
- **`repos`.** The union of each repo's `services.json` (§14.8): its check command, its
  gated CLI, the verbs `write` may run, and the tags it owns for `route`. Read at start
  and on `hub reload`; `registry-matches` (a tools/checks item this plan depends on and
  does not build) keeps the union equal to the declarations. A verb not declared is
  refused by `write`, never run.
- **`owners`.** One owner per seam kind (§14.7), keyed by the enum in the message
  vocabulary: `delivery`, `lease`, `check-broken`, `check-red`, `hook-broken`,
  `hook-block`, `tool-result`, and `bug-report` (the one kind a role sets; it routes by
  `@owner`, so it has no row here). `{repo}` is a template over the message's `ref`;
  `@from` returns to the sender. `unowned` is the explicit default and the only way a
  kind may lack a row. The server sets a failure's kind from where it detected it, never
  the sender. **One row is not a seam kind: `workspace`** (PLAN-services.md §3 step 3,
  "The hub owner's four questions" 1), the node's top-level stores, which belong to no
  repo since the top is not one: its `paths` (globs at the node root: `PLAN-*.md`,
  `TODO.md`, `todo.json` at the top level) and the `roles` that write them, the planner
  and the dispatcher, through the stores' declared verbs (`setup plans edit|add`,
  `todo`), never by Edit. A node whose top holds no store has no `workspace` row.
  **Which paths are owned needs no new key** (answer 2): a `repos` row's path is the
  directory it owns and every path under it is that owner's, and `workspace` lists the
  top's files by glob. Which of an owner's paths are stores is not in `hub.json` at all:
  it is the owner's `cli.json` `store` field, and **`setup` renders the node's list of
  them into `stores.json`**, read-only, beside `hub.json`, whenever it runs at any repo
  (PLAN-services.md §3 step 3, "Two more from the hub owner" 1, approved: Jacob
  2026-10-13). The hook and the server both read that file, so the hook never needs the
  server to tell a store path from a non-store one (§3 H1a-0b). It is `setup`'s to
  write (the table below), and not built yet (TODO.md).
- **`tags`.** Tag → role, or tag → child name, or a reserved target: `@from` (back to
  the sender, for `report`), `@owner` (the node whose path the `ref` names, for
  `bug-report`; unresolvable → dead-letter with notice, routing-tree §9), `@dir` (the
  role whose `dir` contains the path the `ref` names, for `task`; at the top level that
  is the folder agent), and the two service targets `@write` and `@check`, which hand
  the envelope to that service instead of a role (§3, G1). An envelope with `to` set needs no tag route at
  all (routing-tree §3 rules 1 and 2 come first), so `hub send --to claudeTest/
  site-scrapers --tag task` routes on day one whatever the tag table says. Every value
  in `tags` must resolve to a role, a child or a reserved target; `null` is not a
  value, so the root's own `hub.json` passes `hub check` from H1a-1 on, with no child
  registered (review finding 1). A nested object routes by the envelope's `kind` (the
  three question kinds, question-routing §2).
- **`children`.** Expected children by name and relative path, so `hub up --tree` knows
  what to start and `hub status` can say "expected, not registered". The live
  registration (port, token, advertised tags, last heartbeat) is runtime state under
  `.hub/` (gitignored), never in the committed file.
- **`parent`.** The parent's node name, or `null`. Its URL is machine-specific and lives
  in `local.env`.
- **`limits`.** **Every limit the server enforces is a value here, never a constant in
  code** (Decision 4, approved: Jacob 2026-10-09 "but I want to be sure that this can
  be easily changed if we bump into issues"). `hops` (§5), `budget_per_conversation`
  (§3: messages since Jacob last typed that **start a model turn**; route, check and
  write results cost no tokens and do not count), `pingpong_hold` (§5, H2),
  `heartbeat_s` and `heartbeat_misses` (§5), `stub_chars` (§12). Changing one is a
  manifest edit and `gen` where harness exists, else an edit of this file; the ledger
  row for every hold, dead-letter or flag names the limit and its value, so the one to
  change is obvious. The §8 row "limits both ways" holds the seam: each limit the
  server enforces is read from here, and each key here is enforced.
- **`stores`.** Prefix → the repo whose declared CLI answers `get <id>` for it (§12),
  derived from the `repos` rows' `ids` declarations the way `repos` is derived from
  `services.json`; the server adds no store of its own.
- **`rendered_from`.** Present where `setup` wrote the file from a rendered role list
  (its path and hash); absent where it wrote the starter.

**Who writes it.**

| what | writer | how |
|---|---|---|
| the role list `.claude/hub-roles.json`, where a manifest exists (today: the top level) | `agents.sh gen` | generic data, no roster semantics: each role's name, `mode`, `dir` and default tool list (from agents that have a `dir` plus the two windows); the routes (`tags` from the manifest's routes and `questions.types`); `children` from agents whose `dir` is a git repo; `server` from the manifest's `servers.<group>` entry (port, keep-alive); `owners` from the manifest's defaults (§14.7's table, `unowned: dispatcher`, and the `workspace` row, which the manifest does not carry yet: TODO.md); its own source hash. One more rendered file beside `.claude/agents/*.md`; the same read-only, same staleness check. **It never writes `hub.json`** |
| `hub.json`, at every node, with or without harness | `setup` (the `hub` component, Setup component below), **the only writer** | where a role list exists, `hub.json` from it, `rendered_from` stamped with the list's path and hash; where none exists, the starter: `dispatcher` (window, fallback) and `coder` (cold, `--agent` unset so the default agent runs, the default tools), empty tags, `services` with `route` and `write` on, `owners` with only `unowned: dispatcher`, `limits` at the defaults above, a free port, no children, `parent` from `setup`'s argument. `hub init` is this component by another name. Setup reads the role list the way it reads any declaration and still reads no roster, so its `no-roster` check holds. The owner of a starter node fills `tags`, `children` and `sync` by hand afterwards; those keys are the owner's and setup's idempotent check does not compare them |
| `services.json`, `cli.json`, `registry.proposed.json`, in every repo | `setup` (the same component) | the repo's `services.json` skeleton (its name and its `check` command; `cli`, `verbs` and `ids` empty until the repo declares them), `cli.json`, and a `registry.proposed.json` row for its node. The repo's agent fills `verbs`, `tags` and `ids` by editing `services.json` in its own repo, through its own check and commit (§14.8: no agent adds a service by acting) |
| `stores.json`, beside `hub.json`, read-only | `setup` (the same component), whenever it runs at any repo | the node's store paths, from every owner's `cli.json` `store` field (the `workspace` stores among them); the hook and the server read it to tell a store path from a non-store one (§3 H1a-0b). Not the `stores` key below, which maps an id prefix to the repo whose `get` answers it. Its gates: setup's idempotent check says `drift` when the file no longer matches the `cli.json` files (setup's to build and test, TODO.md), and a missing file is reported by `hub status` (§8 "read route") |
| the `repos` and `stores` keys, at every node | the server, mechanically | the union of the children's and the node's own `services.json`, read at `hub up` and `hub reload`; `registry-matches` goes red when the committed `repos` differs from the declarations, and `setup <path> --node` run again rewrites them |

**The gates that it matches the manifest and every repo's `services.json` where they
exist** are split across the seam, each side checking what it can read:

- `hub check` (hub side, no roster): `hub.json` validates against `hub.schema.json`;
  every role's `dir` exists and is inside the node; every tag resolves (§8 vocabulary gate); every seam kind in the vocabulary has an
  `owners` row or the explicit `unowned` default, and every row's key is a kind or
  `workspace` (both ways); `workspace`'s `roles` are `roles` keys and none of its
  `paths` falls under a `repos` row's directory; every `repos` row names an executable `cli` and a `check`; `rendered_from.source`,
  if present, is a path that exists; `local.env` holds the two keys and no key or value
  shaped like a credential (portable-env §5).
- `agents.sh check` (harness side): re-renders `.claude/hub-roles.json` from the
  manifest and diffs; a difference is "stale, run `gen`", the same message as for a
  stale agent definition; and `gen` writes no `hub.json` (a test over its own output
  paths).
- `setup`'s idempotent check (setup side): `unchanged` when `hub.json` matches what the
  component would write from its inputs (the role list's hash in `rendered_from`, or
  the starter's keys), `drift` when it no longer does, named key by key; the one-writer
  rule is therefore a run, not a comment.
- `registry-matches`, `services-valid`, `check-json`, `accessor` (tools/checks, §14.8):
  the node's `repos` equals the repos' declarations; every declared verb exists on the
  CLI; each repo's `check --json` conforms; nothing reads a store around its CLI. This
  plan depends on them and does not build them.
- `hub check` (hub side) refuses a `rendered_from.source` that is not a role list, and
  the §8 row "limits both ways" holds `limits`.

→ Built in H1a-1 (schema, `hub init` as the component's alias, `hub check`), with the
role-list rendering as a `harness` job and the component's role-list reading as a
`tools/setup` job alongside H1a-2.

## 3. The first node

**`hub up` at the top level, day one.**

1. Reads `hub.json` and `local.env`; refuses with one line if either is missing or
   invalid (`hub check` runs first).
2. Binds `127.0.0.1:<server.port>`; every request carries `Authorization: Bearer
   $HUB_TOKEN` or is refused. Writes `.hub/server.json` (pid, port, started, registry
   hash).
3. Loads state: held messages, dead-letter, the ledger tail, recorded sessions; reads
   the `repos` declarations.
4. Starts nothing else: all roles at the first node are `window` or `cold`, and cold
   roles start per message. Prints one line: `claudeTest up :47100, services: route
   write, 0 queued, 0 held, 0 dead-letter, parent: none`.

**The order inside the server, for every request** (routing-tree §14.3, "the agent is
the last line"): validate the envelope; run the gate (`write` runs the CLI, `check`
runs the checks, admission asks the usage gate); route by the registry; **only then a
model**, and only when a step says so. `hub status` counts model turns by the step that
caused them, and a cause the registry could have routed that recurs three times
proposes a rule through `routes --proposed`.

**H1a-0, before any routing: the write gate; H1a-0b beside it, the read route** (PLAN-services.md §3, "What this is
waiting on" steps 3 and 7; Jacob 2026-10-13: "You should be writing through the server,
which can be the programmatic gate that prevents you from doing what you are not
supposed to. Commands that are unallowed will be sent to the server via hooks and
denied."). **Widened by Jacob the same day to every tool call, reads included**
(PLAN-services.md §3 step 3, "Widened by Jacob, 2026-10-13"): "read only is enforced
via hooks. While every agent and service acts as though they can call tools, our hooks
intercept ALL of them, determine where the agent, or service, or cli that is in charge
of those are, and then are sent via hooks, programmatically rather than via output."
It is routing-tree §13.2's `write-request`, and a `read-request` beside it (H1a-0b,
below), applied to the planner window first, so the planner is incapable of a direct
write rather than told not to make one, and no tool list is the gate (§4; Decisions 12
and 15 dissolved). It is the first thing the server does, and the smallest:

- **the server half** (this repo): the skeleton of steps 1-2 above (`hub up|down|status`,
  the token check, `.hub/server.json`, `/health`, `/status`) and two routes:
  - `POST /write-request`, with `{role, tool, file?, cli?, verb?, args?}`. Its rule:
    **allow only a declared verb on a store that role may write**. The verb must be one
    the store's owner declares (its `cli.json`, §2: `repos.<repo>.verbs`), and the
    store must lie in what the role may write, derived from `owners` at render time
    (§2; Decision 17: there is no per-role `writes` list): for the planner and the
    dispatcher, the `workspace` row's paths. An Edit, Write or NotebookEdit of any file
    is denied; H2's lease adds the one exception, a non-store path inside the leased
    repo (§4). So is a Bash write that names no declared verb. Each deny carries the
    verb to use instead where one is declared for that file's store, e.g. an Edit of a
    `PLAN-*.md` is answered with `setup plans edit <FILE> §<n> --from <file>`. To name
    it, the server resolves the path to its owner (a `repos` row's directory, or a
    `workspace` glob, §2), reads `stores.json` (§2) for whether the path is a store,
    and takes the verb from that owner's `cli.json`;
  - `POST /read-request` is H1a-0b's (below): H1a-0 builds the write half and passes
    every read untouched, which costs nothing, since reads are never denied for being
    unowned.

  Every answer is a ledger row. H1a-0 reads only `owners` (the `workspace` row and the
  derivation, §2), `repos.<repo>.cli|verbs` and `stores.json`, validated by the part of
  the schema those keys need (on fixtures until `setup` renders `stores.json`); H1a-1 completes the schema
  around them;
- **the hook half** (harness's, local, beside it): one PreToolUse hook in the planner
  window, on **every tool call** (not only Edit, Write, NotebookEdit and the Bash calls
  `lib/write-targets.sh` sees as writes). It is a one-line caller of `hub hook gate`,
  which classifies the call against `hub.json` (a file it reads without the server),
  POSTs a write to `/write-request`, and returns the server's answer as the tool
  decision. **Nothing is decided in the harness hook.** A Bash command the write
  classifier does not see as a write is classified as a read, and in H1a-0 every read
  passes with no server call. The classifier's reach is stated in `hub hook gate
  --help` and tested on its fixtures;
- **when the server is down, the hook denies** a write, with one line naming `hub
  status`. The purpose is incapability, so this path **fails closed for writes**; a
  read still passes, so a down server does not strand a session reading its own repo.
  It is the one exception to "every hook fails open" (CLAUDE.md; §8 "fails open, every
  hook" names it), recorded in CLAUDE.md when it is built. A call the hook cannot parse
  is denied too;
- **not in H1a-0**: the server running the verb or the `get` itself. A write's verb is
  the `write` service, built for cold roles in H1b; a store's `get` run through the
  server is `hub get`, H1a-2 for `ctx:` and R1 for the rest. Until then an allowed call
  runs as the planner's own tool call, which the gate has just allowed, and a denied
  one names the verb to use. The gate goes live in the planner window
  only once the verbs it names exist: `setup plans edit|add`, and `todo`'s importer
  fix with the top-level import (PLAN-services.md §3 steps 1-2). Before that, the
  server half and its fixtures are built and green, and the hook stays unregistered.

**H1a-0b, the read route** (split off H1a-0 for size, §9; cloud by default, after it). `POST
/read-request`, with `{role, tool, path?, id?}`, and `hub hook gate`'s read
classification. Its rule: **reads are never denied for being unowned; only writes are**
(PLAN-services.md §3 step 3, "The hub owner's four questions" 3, which corrects the
first "Widened" bullet). A read is one of three cases:

- a **store**, an id with a prefix in `stores` (§12) or a path `stores.json` lists
  (§2): answered with that store's `get` (§12: `hub get <id>`). **Store-ness is on
  disk** (PLAN-services.md §3 step 3, "Two more from the hub owner" 1): the hook reads
  `stores.json` itself and the server reads the same file, so the hook never needs the
  server to tell a store path from a non-store one. In H1a-0b the declared prefixes
  are those `hub.json` holds, none until H1a-2's `ctx:` (§12), and `stores.json` is a
  fixture until `setup` renders it, so the store case is built and gated on fixtures,
  and the `get` runs as the role's own call until `hub get` exists (H1a-2, R1);
- an **owned non-store path**: plain Read, with no server call;
- an **unowned path**: plain Read, with no server call.

With the server down, a store read (a declared-prefix id, or a path `stores.json`
lists) is denied with the `hub status` line, as a write is, and any other Read is plain
Read, so neither rule of PLAN-services.md §3 step 3 breaks: a down server strands no
session reading its own repo, and no store is read past its `get`. **A missing
`stores.json`** means every Read of a path is plain Read, and `hub status` reports the
file missing, which `session-doctor.sh` (harness's) surfaces.

**How the planner's Dispatch section reaches it.** The planner's `Stop` hook is
`hub hook planner-stop`. It reads `last_assistant_message` from the hook input, the
documented source for a Stop hook's final text (auto-relay §3): "Hooks that need the
final assistant text of the current turn should use `last_assistant_message` on Stop
and SubagentStop instead of reading the transcript"
(<https://code.claude.com/docs/en/hooks#common-input-fields>), guards on `stop_hook_active`,
parses the `## Dispatch` section with the moved parser, and for each line builds one
envelope: `tag: dispatch` (or `dispatch-malformed` with the parser's reason and the
grammar), `ref` the pointer, `body` the one-line summary, `approval` the date, `from:
claudeTest/planner`. It POSTs them to `/route` in one connection. The server:

- **stamps `origin`** by reading the planner transcript for the turn that produced the
  reply (`hub origin`): a prompt Jacob typed → `jacob`, else `model`. A sender's own
  `origin` field is overwritten, never trusted (fixed point 4). On `jacob`, the prompt's
  id in the `ctx:` store is attached as `origin_id` with its stub line (§1
  `quote-words.sh`, §12); the text never travels (Decision 3);
- **routes by rule 3**: `dispatch` → `dispatcher`, a `window` role → delivers to the
  dispatcher's inbox socket recorded in `/sessions`, as the message line auto-relay's
  probe established (`{"type":"user","message":{"role":"user","content":"…"}}`);
- **applies admission** (identical, invalid, runaway → dropped, dead-letter, held, each
  with a notice back to the planner window; runaway is `limits.budget_per_conversation`
  model-starting messages since Jacob last typed, §2, and the hold's ledger row names
  the limit and its value);
- **asks the usage gate** before any admission that would spawn a role (a `task`, a
  `write-request` that runs a long CLI): one command, `usage gate <estimate>`, with the
  role's estimate in tokens (its measured starting context plus the task's stated cost,
  1u when nothing better is known); **exit code 0 means go.** A non-zero exit carries
  the gate's word: `warn` holds every job but one whose brief names a checkpoint
  (PLAN-check-progress.md §7, the resumable check) and says so in the spawn's prompt;
  `hold` queues the envelope with the hold time the gate printed and tells Jacob once,
  through the dispatcher window. Nothing running is interrupted (PLAN-usage-reporting.md
  §3; review finding 3). The gate is a `services` row (§2) naming the `usage` CLI; a
  node whose registry has no row runs without the gate and `hub status` prints `usage
  gate: off`; a row whose executable is missing refuses every spawn and says why, never
  silently lets them through;
- **routes its own failures by seam kind** (routing-tree §13.3, §14.7; fixed point 9): a
  message that fails validation, the hop limit, stamping or delivery to a role process
  becomes a message of kind `delivery` to the `owners` row (`harness` at the top); a
  `write-request` the CLI refused goes back to `from` as `tool-result`; a kind with no
  row goes to the dispatcher, logged `routed_by: dispatcher`, and the third identical
  re-route proposes the row. The server sets the kind from where it detected the
  failure; a sender's kind is overwritten like a sender's origin. Dead-letter is where
  the message rests, with its id in the failure message, not where it ends. The one
  failure left to the hook layer is "the server is down" (the fallback below);
- **logs** the decision with the registry hash.

The hook prints one line to the planner on failure, and nothing on success. The
delivered text is the same text the relay delivers today, so the dispatcher's job is
unchanged (auto-relay §4). **The receipt that the 2026-10-04 incident lacked** (a relay
reached the dispatcher unstamped because the receiver's hook timed out at 10 s,
routing-tree §13.1) exists by construction: the server stamps and logs before the
window sees anything, so a relay sent while the receiving window is under load is still
stamped and in the ledger (§8 "failures are messages").

**The fallback, and the guard's "server down" test.** Two paths fail open, both tested
by killing the server (§8):

- `hub hook planner-stop` cannot connect → it posts straight to the dispatcher's
  socket from the state file `record-session.sh` still writes (today's path), stamps
  origin locally, and tells the planner `hub down; relayed direct`.
- `dispatch-guard.sh` asks `hub status --json`; `{"up": false}` or a connection error
  within one second means down, and the guard lets the dispatcher spawn roster agents
  through the Agent tool as today. `{"up": true}` means a `task` goes through
  `hub send` (from H1b) and a direct roster spawn is blocked with the `hub send` line
  to use. Until H1b, the guard only reads the status and changes nothing, so the
  "server down" branch is exercised on day one.

**H1b, still phase 1: the first server spawn, and the `write` service.** The dispatcher
sends `hub send --to claudeTest/site-scrapers --tag task --ref "PLAN-x.md §n" "brief"`.
The server starts the cold role (§4) in `site-scrapers/`, pipes the brief and the
`origin_id` stub line, reads the stream to its `result` line, and sends a `report` envelope
back to `@from`. The role is read-only, so when its task needs a write it sends `hub
send --tag write-request --tool site-scrapers --verb register -- <args>`; the `write`
service looks the tool up in `repos`, refuses a verb not declared, runs the CLI with
the gates PLAN-hard-gates.md §3 lists, and answers with the CLI's own stdout and exit
as a `report` (routing-tree §14.6: "the server adds nothing"). Routing-tree §14.6's
build order, "phase 1 builds `route` and `write` for cold roles", is this phase. The
dispatcher's Agent-tool path stays available as the fallback until H4. Both paths
record a ledger row, so `agents.sh dispatches` keeps answering the planner.

→ H1a-0 (the server skeleton, `hub up`, status, the write gate), H1a-0b (the read route), H1a-1 (the
registry, routes and the fallback test), H1a-2 (the relay through the server), H1b
(the first spawn).

## 4. Roles and modes

Cold by default (routing-tree §11 decision 2). Two modes here, and a third, `driven`,
in §11:

| mode | what the server does | state the view sees (PLAN-hub-view.md §2) |
|---|---|---|
| `window` | never spawns; delivers to the recorded inbox socket; learns busy/idle from `claude agents --json`: `kind` is "`interactive` or `background`" and `pid`, `status` are present "While the process is alive" as "Process ID and one of `busy`, `waiting`, or `idle`" (<https://code.claude.com/docs/en/agent-view#list-sessions-as-json>), joined on `sessionId` ("the full session UUID", same anchor) with `/sessions` | green busy, yellow idle or waiting, red no session |
| `cold` | per message: `claude -p --agent <role> --permission-mode dontAsk --allowedTools <default list> --disallowedTools Edit,Write,NotebookEdit --permission-prompts none --output-format stream-json --verbose --max-budget-usd <cap>` in the role's `dir`, brief on stdin, inside a sandbox whose writable set is the role's scratchpad only (routing-tree §13.2 quotes the sandboxing docs: these paths are "enforced at the OS level, so all commands running inside the sandbox, including their child processes, respect them", <https://code.claude.com/docs/en/sandboxing#configure-sandboxing>; quoted there, not re-verified in this pass). **The role is read-only** (fixed point 9): it writes only by sending a `write-request`, which the `write` service runs (§3), and its PreToolUse hook, not these flags, is the gate (below). A `--disallowedTools` bare name "removes the matching tools from Claude's context" (<https://code.claude.com/docs/en/cli-reference#cli-flags>); parses the stream and takes the final `result` line as the report: "The last line of the stream is a `result` message with the final response text, cost, and session metadata" (<https://code.claude.com/docs/en/headless#stream-responses>). `dontAsk`: "If you set `dontAsk` mode, Claude Code auto-denies every tool call that would otherwise prompt you" and "It also denies the built-in `AskUserQuestion` tool even if your allow rules match it" (<https://code.claude.com/docs/en/permission-modes#allow-only-pre-approved-tools-with-dontask-mode>). `--permission-prompts none`: "Pass `--permission-prompts none` when nobody is available to answer permission prompts" and "Claude is told that nobody can approve the request and not to retry it" (<https://code.claude.com/docs/en/headless#turn-off-permission-prompts-in-unattended-runs>). No approval through auto mode, by construction (fixed point 8). A role's final report can be forced to a shape: "To get output conforming to a specific schema, use `--output-format json` with `--json-schema` and a JSON Schema definition" (<https://code.claude.com/docs/en/headless#get-structured-output>); the `report` envelope's `body` is that object's one summary line. `--max-budget-usd`: "Maximum dollar amount to spend on API calls before stopping (print mode only)" (<https://code.claude.com/docs/en/cli-reference#cli-flags>); **a kill switch against a runaway role, never a cost measure.** Cost here is tokens: the server reads the `result` line's `usage` and writes it to the ledger row per spawn, and `hub log --usage` shows it in units of 1u (review finding 2). Stopping a cold role is SIGINT to end the turn, then SIGTERM: "If you stop a `claude -p` run with SIGTERM, for example with `kill` or from a process supervisor, Claude Code exits with code 143" and "Claude Code then runs `SessionEnd` hooks and exits" (<https://code.claude.com/docs/en/headless#stop-a-run-with-sigterm>) | green while the process runs; red otherwise (a cold role between messages is not spawned) |
**Read-only is the hook's, not a tool list's** (Jacob 2026-10-13, PLAN-services.md §3
step 3 "Widened": "read only is enforced via hooks. While every agent and service acts
as though they can call tools, our hooks intercept ALL of them"). Every role, window or
cold, carries the PreToolUse hook of §3 H1a-0, and the hook sees every call it makes:
it sends a write to its owner as a `write-request` and a store read as a
`read-request` (H1a-0b), and returns the owner's answer as the tool result or the deny.
Any other read is plain Read: reads are never denied for being unowned, only writes
are (PLAN-services.md §3 step 3, "The hub owner's four questions" 3). The tool
list in `roles.<r>.tools` and the cold flags above are a default the server passes, and
nothing rests on them: a call the list lets through is still the hook's to route or
deny. So **Decisions 12 and 15 dissolve**: there is no read-only tool list to fix
(12) or to widen by `Bash(hub get *)` (15), because the list is not the gate. `hub get
<id>` stays as the server's read route (§12), and the hook calls it when a role reads a
store, whatever tool the role used. Cold roles get the hook through `setup hooks` (Role
hooks, below), from H1b; the planner window gets it first, in H1a-0.

**Warm roles are dropped** (Decision 1, approved: Jacob 2026-10-09, REVIEW §5.10:
"I thought we determined this wasn't necessary [...] specifically because the 29k
happens either way"). The 2026-10-05 draft kept a role alive between messages so it
would not pay the ~29k-token start each time. That saving does not exist: "Claude Code
re-sends the full context: the system prompt, your project context, every prior message
and tool result, and your new message" on every request, and "The API caches by
matching the start of each request, called the prefix, against content it recently
processed" (<https://code.claude.com/docs/en/prompt-caching#how-the-cache-is-organized>),
so the starting prefix is sent on every message, warm or cold, and read from cache
either way while it is recent ("Cached prefixes expire after a period of inactivity.
Each request that hits the cache resets the timer",
<https://code.claude.com/docs/en/prompt-caching#cache-lifetime>). A warm role saves no
start and adds a history that grows with each message, which is what context-hygiene
exists to cut. So: no `warm` value in `hub.json`, no supervisor or stdin-pipe
mechanism, no warm probe in H0, no `measured` date, no H5. A later plan may bring warm
roles back only on measured token numbers, as routing-tree §11 decision 2 always said.
What survives of the stream-json mechanism is §11's `driven` session, which is kept
alive to control its context, not to save a start.

**The coder's exception: a lease-scoped Edit rule** (REVIEW §5.5, approved: Jacob
2026-10-09, "This will be even more thoroughly gated once we have the
linter/architecture services running"). Every role is read-only (fixed point 9), and a
coder's writes to its own repo are the write lease of routing-tree §13.5 (H2). How an
edit travels under that lease is not a patch through `write` but one extra permission
rule the server passes when it spawns the coder under the lease:

- **The rule:** `--allowedTools 'Edit(<its repo>/**)'` beside the default list, and
  without `Edit`, `Write`, `NotebookEdit` in `--disallowedTools` for that spawn. "`Edit`
  rules apply to all built-in tools that edit files"
  (<https://code.claude.com/docs/en/permissions#read-and-edit>), so Edit and Write are
  both held to the repo; a path outside it would prompt, and `dontAsk` "denies every
  call that would otherwise prompt"
  (<https://code.claude.com/docs/en/headless#auto-approve-tools>), so it is refused.
- **The sandbox follows the rule:** "`Edit` allow rules | Grant write access to specific
  paths, the same way `sandbox.filesystem.allowWrite` does" and "Paths and domains from
  both sandbox settings and permission rules are merged into the final sandbox
  configuration"
  (<https://code.claude.com/docs/en/sandboxing#permission-rules>), so the writable set is
  the repo plus the scratchpad, enforced at the OS level for every process the role
  starts. Its other calls pass the hook like any role's: a `git commit` is a write
  naming no verb the coder may run, so the hook denies it and the coder cannot commit.
  Under the lease the hook still sends the coder's Edit to the server, whose write rule
  carries the lease clause (PLAN-services.md §3 step 3, "The hub owner's four
  questions" 4): an Edit or Write of a **non-store path inside the leased repo** is
  allowed; a **store inside it** (its `todo.json`, whatever its `cli.json` names) still
  goes through its declared verb and is denied with that verb, which `store-guard.sh`
  and the 0444 seal enforce regardless of the hub. H2's §8 "lease" row tests both.
- **Commit on green only:** when the coder's `result` arrives, the `write` service runs
  the repo's `dev.sh check --json`; green commits with the `Agent: <role>` trailer
  (PLAN-hard-gates.md §2; the service writes the trailer, since the commit is its
  own), red goes back to the coder as `check-red` and nothing is committed. The lease
  releases on the commit or on the `check-red`.
- **Why not a patch:** a diff in the scratchpad applied through `write` gives no
  stronger gate, because check-then-commit is the gate in both, and it makes every edit
  a hand-built diff, the failure the inline-blob rule exists for.
- **The probe (H0):** a `-p` role spawned with that rule and `dontAsk` cannot edit a file
  outside its repo and can edit one inside it. Recorded with the `claude --version` it
  passed on, and repeated as the §8 "lease" row's test in H2.

**Role hooks.** Routing-tree §12 renders per-class hooks into agent frontmatter.
"Frontmatter hooks in a project subagent run only after you accept the workspace trust
dialog for the folder the agent file came from. A `-p` session doesn't count as
accepting it" (<https://code.claude.com/docs/en/hooks#hooks-in-skills-and-agents>), so
for cold roles they would silently not run. Role hooks therefore install through
`setup hooks` into the repo's settings proposal (fixed point 5), which a `-p` session
does load: "Without `--bare`, a `-p` session runs the hooks in a project's
`.claude/settings.json` and connects the servers in its `.mcp.json`, even in a folder
you've never trusted" (<https://code.claude.com/docs/en/headless#start-faster-with-bare-mode>).
Frontmatter is used only for window roles Jacob has trusted. Decision 8 (approved:
Jacob 2026-10-09, "by setup").

→ H0 probe (the Edit-rule clause); H1b cold; H2 the coder's rule; §11 driven.

## 5. Children

- **Registration.** On `hub up`, a node with `HUB_PARENT_URL` set POSTs `/register`
  to its parent: `{name, path, port, token, roles: [...], tags: [...]}`,
  authenticated with the parent's token that `setup` placed in the child's
  `local.env`. The parent stores it under `.hub/children/<name>.json`, polls the child's
  `/health` every `limits.heartbeat_s` seconds (30), and marks it `down` after
  `limits.heartbeat_misses` (2); the heartbeat runs between servers over HTTP and costs
  no model and no tokens. `hub down` DELETEs the registration. The parent stores nothing about grandchildren: a child advertises its
  own roles and tags and a `has_children: true` flag, no more (routing-tree §1).
- **Tag advertisement.** A child's advertised tags enter the parent's route table as
  `tag → child` for the parent's rule 3. A child may not advertise a tag the parent's
  vocabulary declares for one of the parent's own roles (`vocab` sync, §6, "a child may
  extend but never redefine"); the registration is refused with the clashing tag named.
- **Down child.** While a child is `down`, a message tagged for it goes to **this node's
  dispatcher** with a notice naming the child, never nowhere (routing-tree §9
  "Hierarchy"). A message addressed by path below a down child dead-letters with the
  same notice.
- **Hop limit.** `limits.hops`, default 8 (three levels down and back with slack),
  inherited from the root by `vocab` sync; a node may lower it, never raise it. Each
  server increments `hops` and dead-letters at the limit. A hop counts servers, not
  agents or steps: top to site-scrapers is 1, into a grandchild 2; planner, dispatcher
  and a coder at one node never cross a server boundary, so the limit catches only a
  message forwarded in a circle between servers (REVIEW §5.8 decision 4).
- **Every limit is a registry value** (Decision 4; §2 `limits`): the server reads
  `hops`, `pingpong_hold`, `budget_per_conversation`, the heartbeat pair and
  `stub_chars` from `hub.json` and from nowhere else, and the ledger row for a hold, a
  dead-letter or a flag names the limit and its value. None of the starting values has
  evidence yet; a limit that bites on real work shows up in the ledger with its count,
  and changing it is a manifest edit and `gen` (or an edit of a starter node's file),
  never a code change.
- **Dead-letter.** `.hub/dead-letter/<id>.json` plus a `/dead-letter` listing and the
  count in `hub status`. Every dead-letter sends a `report` to the original `from` with
  the reason (`no route`, `hop limit`, `invalid envelope`, `child down`,
  `unresolvable owner`); if `from` is a window, that is one line in its socket; if a
  cold role that has already exited, the row is in the ledger and `hub status --doctor`
  names it. Never silent (routing-tree §6).
- **Standalone.** No `HUB_PARENT_URL` → the node is a root: it registers nowhere,
  `hub status` prints `root (no parent)`, rule 4 ends at its own dispatcher, and `hub
  sync --check` checks only itself and says so. A cloned tool repo therefore works
  alone, which is the conformance fixture's whole premise (§8).
- **Cross-repo claims (routing-tree §10 phase 2).** A `report` from node A whose `ref`
  names a path inside node B is re-tagged `bug-report` by A's server and routed to
  `@owner`; B's `report` on the same `conversation` closes it. The top dispatcher sees
  neither. Interim rule `cross-repo-claims` retires when this gate passes.

→ H2 (claims, loops, lease), H3 (registration, hierarchy).

## 6. Declared sync

The design is routing-tree §12; this section places it in the hub's data and says who
consumes it.

- **The declaration** is the `sync` list in `hub.json`: `{ "id", "source": {"file"} |
  {"file", "block"}, "targets": "children" | "class:<name>" | ["name", …], "mode":
  "file" | "block" | "vocab", "overridable": false }`. `vocab` entries name a key of
  `hub.json` (`tags`, `classes`, `limits`) that children inherit and may extend.
- **Marked blocks**: `<!-- shared:<id>@<sha256-12> -->` … `<!-- /shared -->` around a
  verbatim copy; the hash is of the source block's bytes. "Same meaning" becomes "same
  bytes" (routing-tree §12).
- **`hub sync --check`** needs no server and no parent connection: it reads its own
  declaration, walks its expected children's paths on disk, and prints per child and
  artifact one of `ok | behind N | missing | edited locally | override |
  undeclared`. At a root with no children it prints `nothing to sync (root, no
  children)`. `hub sync --apply <id>` writes the verbatim file or block into **this**
  node only (an owner applies in its own repo; nothing writes across owners,
  routing-tree §11 decision 8). `hub sync --propose` sends drift as a `sync`-tagged
  envelope to the child's dispatcher (S4).
- **How `setup` consumes it.** `setup`'s `rules` and `hooks` components become callers of
  `hub sync --apply` for the artifacts the parent declares (`shared-rules` block,
  `no-inline-blobs.sh`, `prefer-recipes.sh`, `troubleshooting.sh`, `write-targets.sh`
  as `file` entries). Until the hub exists, `setup` keeps its own templates; the
  switch is one commit in `tools/setup` after S1, and the templates are deleted only
  after both paths have reported zero drift on every repo together once (tools-folder
  §8's add-beside-then-delete rule).
- **How `tools/checks` consumes it.** `rules-in-sync` and `hooks-installed` become
  thin: each runs `hub sync --check --json` and fails on anything but `ok` and
  `override`. The eight hook copies and the seven rule copies become one `file` and
  one `block` declaration at the root.
- **Retiring the bespoke checks**: `check-hooks.sh` (two copies), the three `dev.sh
  sync`, `test_doc_claims.py`'s rule half, `cmd_plan`'s copy half: each goes only after
  `hub sync --check` has given the same verdicts on that check's own fixtures with drift
  injected into each (routing-tree §12).

→ S1 (file mode, `--check`/`--apply`, no server), S2 (blocks, one dispatch per owner),
S3 (classes and `vocab`, with H3), S4 (`--propose` through the hub, with H3).

## 7. Keep-alive and control

What the hub exposes, and nothing more:

| for | the hub provides |
|---|---|
| `chron.py` (group-servers decision 4) | `hub up [--tree] [--foreground]`, `hub down [--tree]`, `hub status --json [--tree]` (one object per node: `name, up, port, pid, queued, held, dead_letter, children[]`), exit 0 when every node asked about is up, 1 otherwise; a pidfile in `.hub/server.json`; `GET /health`. `--foreground` is for a supervisor (launchd `KeepAlive`, or cron `@reboot` plus a watchdog, cron-scheduler's call) |
| `init.sh` (portable-env §3.2) | `hub up --tree` as its last step before `agents.sh check`, as routing-tree §7 says |
| the view's cron panel (PLAN-hub-view.md §2) | `hub cron --json`: the hub shells out to `chron.py list --json` and returns `[{job, next_run, schedule, enabled}]`. This needs a `list --json` on `chron.py`; it is a request to the `cron-scheduler` agent (Risks) |

**One change to report to `cron-scheduler`:** group-servers §3.5 has `chron.py` read
its server list from the manifest. Under this plan the list is `hub status --json
--tree` from the top node, because the manifest no longer knows the tree (a child
node's children are the child's business). Gate unchanged in spirit: the servers
`chron.py` shows == the nodes `hub status --tree` reports, both directions (Decision 5).

→ H1a-0 (`status --json`, `/health`), H3 (`--tree`), V2 (`hub cron`).

## 8. Gates, in the same change as each part

Each gate names the phase that must land it. "Fixture" means a temp git repo made by
the test, never claudeTest or any repo of ours.

| gate | proves | phase |
|---|---|---|
| **help == implemented** | `hub --help` lists exactly the subcommands the dispatcher implements, both ways; every endpoint in `docs/API.md` is served and every served route is documented (the server exports its route table; the test diffs) | H1a-0 (its subcommands and routes), H1a-1 on |
| **vocabulary** | every tag in `hub.json` resolves to a role, a child, or a reserved target (`@from`, `@owner`, `@dir`); every route's tag is declared; an addressed envelope (`to` set) routes without a tag row. **Run against the root's own `hub.json` on day one**, with no child registered, and green there (review finding 1) | H1a-1, H3 |
| **determinism** | 100 fixture envelopes routed twice against the same registry give identical decisions; a ledger row replays to the same decision | H1a-2 |
| **kill the server** | with the server killed mid-run: `hub hook planner-stop` relays direct and prints the notice; `dispatch-guard.sh` lets a roster spawn through; `hub hook session-start` writes the state file; the dispatcher's question gate still blocks once. `hub status --json` saying down within one second lands in H1a-0 (the write gate reads it), `hub up` after a kill restoring state in H1a-1, the hook half in H1a-2 | H1a-0, H1a-1, H1a-2 |
| **origin** | a forged `origin: jacob` is overwritten to `model`; a `jacob` envelope carries `origin_id` and its stub line, never the text, and `hub get` on that id returns the prompt the fixture hook stored; a body carrying the prompt's text past `stub_chars` is flagged (§12's paste gate); an irreversible tag from `origin: model` never spawns | H1a-2 |
| **admission** | identical → dropped; invalid → dead-letter with notice; `budget_per_conversation` + 1 model-starting messages → held, while route, check and write results in between do not count (a fixture of ten free results and one more model message is not held); a Jacob prompt releases the held message and it is delivered once, never pasted; **the usage gate**: a fixture `usage` CLI exiting 0 lets a `task` spawn, one printing `warn` holds a job without a checkpoint and lets one with a checkpoint through with the note in its prompt, one printing `hold` queues the envelope with the hold time and produces exactly one line to the dispatcher window; a `services.usage` row whose executable is missing refuses the spawn with a reason | H1a-2 (gate), H1b (spawn) |
| **conformance** | a fixture repo set up from its path alone (`setup`, then `hub up`) receives a `task`, spawns a cold role, and returns a `report`; **a commit made for that server-spawned role carries the trailer `Agent: <role>`**: the `write` service writes it when it commits the coder's green edit (§4), and a window's own commit gets it from `git-stamp.sh`, which reads `agent_type` from the hook input (PLAN-hard-gates.md §2; review finding 4); with `HUB_PARENT_URL` set, it registers and its tags route from the parent | H1b, H3 |
| **direction audit** | nothing under `tools/hub/` reads `.claude/`, names a roster agent, or imports from `.claude/lib`; the view included (tools-folder §1) | H1a-0, every phase |
| **no names in the program** | no repo name, path or command in `tools/hub/` source; they live in `hub.json` (group-servers §1a) | H1a-0, every phase |
| **per-branch report** | when N spawns or N deliveries run together, the result names each one's outcome (`Promise.allSettled`), tested with a fixture where two of three fail on different steps | H1b |
| **lease** | two `task` envelopes to one repo's cold role run one after the other, never together; the second's `report` says it queued; **the coder's Edit rule** (§4): a coder spawned under the lease edits a file inside its repo and a Bash `echo >` inside the repo succeeds, while an Edit and an `echo >` outside the repo both fail; **the lease clause** (§4; PLAN-services.md §3 step 3, "The hub owner's four questions" 4): with the hook on every call, the server allows the leased coder's Edit of a source file inside its repo and denies its Edit of the repo's `todo.json` with the declared verb, and the same coder without the lease has both denied; its green edit is committed by `write` with `Agent: <role>` and its red edit comes back as `check-red` with nothing committed; a coder spawned without the lease has no Edit rule | H2 |
| **loops** | a fixture ping-pong (A → B → A …) is held at `pingpong_hold`; a hop-limit message dead-letters; both notify | H2 |
| **claims** | a `report` from A naming B's path arrives at B as `bug-report` and B's `report` closes the conversation; the top dispatcher's inbox receives neither; a claim with no owner dead-letters with notice | H2 |
| **hierarchy** | a parent stores no grandchild (the children dir holds only direct children after a three-level fixture); a de-registered child's tags route to the parent's dispatcher with notice | H3 |
| **dispatcher can't act** | an Edit, Write or non-`hub` Bash call from the dispatcher is blocked (harness's guard, tested against the restricted manifest) | H4 |
| **limits both ways** (Decision 4) | the server exports the table of limits it enforces (name, where read); the test diffs its keys against `hub.json`'s `limits` both ways; a numeric literal on a limit's code path fails the no-names audit extended to limits; a fixture that sets each limit to 1 sees it bite (one hop dead-letters, one model message holds, one exchange holds the ping-pong, one missed heartbeat marks the child down, a two-character stub cap cuts the stub); every hold, dead-letter and flag row in the ledger names the limit and its value; a `warm` value anywhere in `roles` fails `hub check` | H1a-2 (budget, stub), H2 (hops, ping-pong), H3 (heartbeat) |
| **sync** | every declared source exists; every target holds its artifacts; an edit inside a block is caught; an undeclared override fails; a child cannot redefine a parent's tag; a root with no children says so | S1–S3 |
| **registry** | schema valid; `agents.sh check` re-renders and diffs where a manifest exists; `setup` refuses to write a starter beside a manifest; the whole row runs against the root's own `hub.json` on day one | H1a-1 |
| **view contract** | in PLAN-hub-view.md "Gates"; the one row this plan keeps: every endpoint the view consumes is in `docs/API.md` and served (the help-equals-implemented row, applied to the client's source by a static scan) | V1–V3, there |
| **fails open, every hook** | each installed hook copy exits 0 on malformed input and on a dead server; tested, not promised. **One exception, the write gate**, which fails closed for writes and for reads by a declared-prefix id (next two rows) | H1a-2 |
| **write gate** (§3 H1a-0; PLAN-services.md §3 step 3, its widening and "The hub owner's four questions") | on a fixture node: a fixture planner's Edit of a `PLAN-*.md` is denied with the declared verb to use (`setup plans edit`); a Bash call naming a declared verb on a store in the planner's `workspace` row is allowed; the same verb from a role the row does not name, an undeclared verb, and a Bash write naming no verb are each denied; **the list is not the gate**: a fixture role whose default tool list allows Edit still has its Edit denied; every read passes with no server call; **with the server killed, the hook denies** a write with the `hub status` line, a read still passes, and an unparseable call is denied; every answer is one ledger row; a `workspace` role that is not a `roles` key, a `workspace` path under a `repos` row's directory, and a derived name that is neither a `repos` key nor `workspace` each fail `hub check` | H1a-0 |
| **read route** (§3 H1a-0b; PLAN-services.md §3 step 3, "The hub owner's four questions" 2 and 3 and "Two more from the hub owner" 1) | on a fixture node with a fixture `stores.json`: a read naming an id with a fixture-declared prefix is answered with that store's `get`; a Read of a path `stores.json` lists is answered with its `get`; a Read of an owned non-store path and a Read of an unowned path are both plain Read, never denied, with no server call; **with the server killed**, a read by a declared-prefix id and a Read of a listed store path are each denied with the `hub status` line, and a Read of an unlisted path is allowed; **with `stores.json` removed**, every Read of a path is plain Read and `hub status` reports the file missing; every answer is one ledger row | H1a-0b |
| **services as data** (routing-tree §14.2, §14.6) | the program contains no tool's command and no repo's path (the no-names audit extended to service names); every `repos` row names its CLI; a fixture node with a different CLI gets every service working; `check` runs only the command the row names | H1a-1 (audit), H1b (`write`), G1 (`check`, `hook`) |
| **read-only roles** (routing-tree §13.4) | a fixture role carrying the hook (§4), its default list with and without Edit and Write (the hook, not the list, decides: an Edit is denied either way), and a sandbox allowing only the scratchpad: a Bash `echo > repo/file` inside it fails, and the same write sent as a `write-request` succeeds through the CLI, both directions; a `plan`-mode role spawned from a `bypassPermissions` window still cannot write; a `write-request` whose verb is not on the tool's declared list is refused at the server and answered, never run; the one exception, the coder under the lease, is the "lease" row | H1b |
| **failures are messages** (routing-tree §13.3, §14.7) | kill a role process mid-delivery: `harness`'s inbox gets a `delivery` failure with the message id and the dispatcher gets nothing; remove `harness`'s `owners` row in a fixture: the dispatcher gets it, logged `routed_by: dispatcher`, and nowhere else; the third identical re-route proposes the row; a relay sent while the receiving window's hook sleeps 11 s is stamped and in the ledger | H1a-2 (stamp, `delivery`), H2 (proposal) |
| **owners both ways** (routing-tree §14.7) | every seam kind in the vocabulary has an `owners` row or the explicit `unowned` default; a row whose key is neither a kind nor `workspace` fails; flipping a check's own fixture in a fixture node moves the message from `check-red` (the repo) to `check-broken` (`tools/checks`) | H1a-1 (schema), G1 (the flip) |
| **agent last** (routing-tree §14.3) | `hub status` counts model turns by the step that caused them (validate, gate, route, model); a fixture where a routable cause recurs three times yields a proposed rule; `doctor` flags a node whose step-4 turns rise without step-3 findings | H1a-2 (counts), G1 (checks) |
| **references by id** (§12) | a planted `todo:` id in a fixture body renders a stub of the id, the store's line cut at `stub_chars`, its source and date; `hub get <id>` and `GET /refs/<id>` return exactly the fixture store's `get` output, byte for byte; `hub send --ref x:1` with an undeclared prefix is refused naming the declared prefixes; a body carrying more than `stub_chars` of a referenced record's text is flagged `pasted: <id>` in the ledger and answered with a `report`; a store whose `get` is missing makes `hub check` red on `stores` and every stub for its prefix `unchecked`, never `ok`; an id the store cannot find renders `unresolved: not found`, still in the delivered text; a record changed since the send renders `changed since cited` with the cited line kept; a sender's own `refs` field is overwritten like `origin`; every prefix in `stores` has an executable `get` and every `ids` declaration is in `stores`, both ways | H1a-2 (`ctx:` for `origin_id`), R1 (the rest) |
| **driven session** (§11) | the D0 probe's clauses, per mechanism, recorded with `claude --version`; in D1 as tests on a fixture: a message written to stdin is acknowledged on stdout and the hub's list equals the acknowledged messages plus the `result` lines; no rebuild lands while a fixture background subagent sleeps past its turn's `result` line (the `parent_tool_use_id` run is open), and it lands within one poll of that run's `tool_result`; a rebuild from a `ctx:` id leaves the next answer knowing Y and not X, with the same process alive for the block edit and a `cache_read_input_tokens` ≥ the unchanged prefix for the resume; after a rebuild `hub origin` never says `jacob`; a rebuild file containing a line from a recorded `tool_result` is refused; every message of the pre-rebuild list is in the snapshot the ledger names; `hub session` verbs are refused from a role's Bash (the hook denies them: no owner grants them to a role) and accepted from the context-hygiene CLI and the view | D0, D1 |
| **roster settings** (§15; routing-tree §15's four gates) | on a fixture node whose fixture repo declares `settings` with a fixture CLI: **rows both ways**: the panel's rows equal the `list` verb's rows, no row added or dropped, a blank field shown as `not set` or `unknown`, never empty; at the top node a local audit compares the served rows with `agents.sh list`'s names plus `coders`, both ways, and is UNCHECKED where harness is absent; **page equals shell**: the fixture CLI records its argv and its store, and a change made on the panel and the same `set` line run from a shell give identical argv and byte-identical stores (that the real `set` gives one manifest for one argv is harness's test, Risks); **a refusal changes nothing**: a fixture verb exiting non-zero leaves the store's sha256 unchanged, the panel shows its `FAIL` lines and the row as re-read, and a timeout shows `unchecked`, never `unchanged` (that a `check` refusal rolls back is harness's test of its all-or-nothing verb); **roles are refused**: a `write-request` for the `settings.set` verb stamped with any role is refused, answered and logged, never run, including a fixture role whose declaration lists the verb; also: a model not in `models` is never offered, a missing `models` makes the field read-only, and a key not in `settable` has no control; every outcome is one ledger row | RS (rows both ways with V1) |

→ Each row lands with its phase; a phase with a row missing is not done.

## 9. Phases with token costs

Order: every step leaves the system working; interim rules retire as their replacements
land (interim-rules §5 phase 4: "no interim rule outlives its replacement by more than
one harness job"). Costs are in tokens with the 29k unit; the ranges are wide because
the server is new code and the probes may fail once. **No phase is over 200k**, because
a job can die at a usage limit and a smaller job loses less (PLAN-check-progress.md §7;
review finding 5); H1a is therefore four phases (H1a-0, the write gate, added
2026-10-13, and H1a-0b, the read route, split off it the same day), each leaving the
system working.

**Where each phase runs** (review finding 8; PLAN-cloud-offload.md §3 and §8). A phase
is **cloud** when every input is in this public repo or a fixture, the output is a
branch, and nothing touches a browser, Gmail, the crontab or `.claude/`: the Node code
with fixture repos and offline tests. A phase is **local** when it probes this machine
(H0, D0), opens a terminal on it (V1–V3), rewrites top-level prose (H4), or is an
owner's edit in its own repo (S2, R2). **"Cloud" is a default, not a commitment**
(Decision 9, approved: Jacob 2026-10-09, "though we can move stuff back to local
if/when necessary"): a cloud phase is one cloud session Jacob starts from its `TODO.md`
item while the cloud-only credits last; when the credits run low or a cloud phase
stalls, the same item runs locally as a `deep-work` job, and the next pass of this plan
says so in this table.

| # | phase | where | contents | retires | cost |
|---|---|---|---|---|---|
| **H0** | probes | local | `hub send` from inside a cold `-p` role (Bash allowlisted); `dontAsk` honouring a roster definition's tools; `claude agents --json` listing an interactive `--agent planner` session with `sessionId`; **the coder's Edit rule** (§4: a `-p` role with `Edit(<repo>/**)` under `dontAsk` edits inside the repo and not outside it, with Edit and with Bash). The warm probe and the warm sandbox clause are gone with Decision 1. Each probe is a script in `tools/hub/probes/` with its pass condition in the file, run by hand, result and `claude --version` recorded in `TODO.md` | — | 40–90k (1–3u) |
| **H1a-0** | the write gate (§3) | local (Decision 9: on the critical path to the planner's incapability, PLAN-services.md §3 step 7; its hook half is in `.claude/`) | the server skeleton: `hub up|down|status`, `/health`, `/status`, `.hub/` and `server.json`, the token check; `POST /write-request` and its rule (a declared verb on a store the role may write, derived from `owners` at render time, the planner's and dispatcher's from the `workspace` row, else deny with the verb to use); the path-to-owner resolution (a `repos` row's directory, a `workspace` glob), `stores.json` read for store-ness (a fixture until `setup` renders it) and the owner's `cli.json` read to name the verb; that derivation and the part of the schema it, `workspace` and `repos.<repo>.cli|verbs` need; `hub hook gate`, classifying every tool call against `hub.json` and passing every read; the ledger row per answer; `docs/API.md` and the help-equals-implemented gate for what it ships; the direction and no-names audits; §8 "write gate" with the server killed. **Harness job beside it, local** (~1u): the one-line PreToolUse caller in the planner window, on every tool call, registered only once `setup plans edit|add` and todo's import exist (PLAN-services.md §3 steps 1-2). **Leaves the system working:** with the hook unregistered nothing changes; registered, the planner's direct writes are denied and its verbs allowed, and its reads pass untouched | the planner's Edit and Write on plans and `TODO.md` (`dispatch-guard.sh` allows them today) | 80–130k (3–5u) + ~1u local |
| **H1a-0b** | the read route (§3) | cloud (default: every input is in this repo or a fixture, and the classifier it extends is `hub hook gate`, not `.claude/`); after H1a-0, and not on the incapability path, so it may slip without holding H1a-1 | `POST /read-request` and its rule (a store, by declared-prefix id or by a path `stores.json` lists, answered with its `get`; an owned non-store path and an unowned path plain Read, never denied), on fixture declarations and a fixture `stores.json`; `hub hook gate`'s read classification (which calls name a store id or a listed store path, read from `stores.json` without the server); `hub status` reporting a missing `stores.json`; the ledger row per answer; `docs/API.md` and help-equals-implemented for the route; §8 "read route" with the server killed and with `stores.json` removed. No harness job: the caller H1a-0 registered already sees every call. **Leaves the system working:** store reads go to their owners and every other read passes as before | — | 50–90k (2–3u), an analogy (§9 below) |
| **H1a-1** | the program, no routing yet | cloud (default) | `hub.json` schema and `hub.schema.json` completed around H1a-0's part (`limits` and `stores` included; `warm` not a mode); `hub init|check|routes`; `/routes`; held, dead-letter and ledger state restored by `hub up` after a kill; the registry and vocabulary gates run against the root's own file; `./dev.sh check` runs them all. **Leaves the system working:** nothing but the write gate and the read route calls the server yet; `hub status --json` is what `dispatch-guard.sh` will read | — | 80–130k (3–5u) |
| **H1a-2** | the relay through the server | cloud (default) | the moved parser, gate, origin and ledger under `tools/hub/lib/` with their tests; `/route`, `/sessions`, `/ledger`, `/dead-letter`, `/held`; admission with the usage gate (§3) and the budget counting model-starting messages only; the `limits` export and its both-ways gate for the budget and `stub_chars`; `hub send|log|hook|origin|grammar|get`; `hub hook planner-stop`, `dispatcher-stop`, `session-start`, `user-prompt` (the `ctx:` id per typed prompt, §1) with the kill-the-server gates; `origin_id` and the `ctx:` stub as the first `stores` entry (§12); the determinism and origin gates. **Harness job beside it, local** (~1–2u): `gen` renders `.claude/hub-roles.json`; the three hook files become one-line callers and the user-prompt hook is installed for the two windows; `dispatch-guard.sh` reads `hub status --json`. **Setup job beside it, local** (~1u): the `hub` component reads the role list and writes `hub.json` from it (Decision 2) | `relay-origin`, `question-kinds` (both `manifest:nodes` → the retire check becomes `file:hub.json`, a one-word addition to interim-rules §3's vocabulary) | 140–200k (5–7u) |
| **S1** | sync, files | cloud (default) | `hub sync --check|--apply`, file mode, no server; the hook copies and the plan copy as declarations at the root; `tools/checks` `hooks-installed` reads it | the two `check-hooks.sh` after the same-verdict test | 120–180k (4–6u) |
| **H1b** | first spawn | cloud (default) | cold roles: spawn, stream, `result` → `report` with its `usage` in the ledger, the `origin_id` stub line in the prompt, `--json-schema` report shape, the lease's first half (one spawn per `dir` at a time), per-branch report; `hub send --tag task` from the dispatcher; the guard blocks a direct roster spawn while the server is up; the `Agent:` trailer on a commit made for a role in the conformance fixture | `stale-spawn` for server spawns (the hook stays for Agent-tool spawns until H4) | 150–200k (5–7u) |
| **R1** | references by id | cloud (default) | §12 past the `ctx:` entry: `stores` derived from the repos' `ids` declarations, the id patterns scanned in a body, `refs` filled by the server, the stub with its cap, `hub get <id>` for a model recipient and `GET /refs/<id>` for the view, the changed-since-cited hash, `unresolved` and `unchecked`, the paste gate, `todo:` as the second store (`todo get ID`, PLAN-todo-tool.md §3); fixture stores for the tests | — | 120–170k (4–6u) |
| **H2** | agent to agent | cloud (default) | tags between folder agents, loop control (hold, hop limit, both read from `limits` and in the export), the write lease with **the coder's Edit rule** (§4: the extra permission rule, the sandbox that follows it, the lease clause in the server's write rule, commit on green by `write`), `bug-report` routing of cross-repo claims, `routes --proposed` from the dispatcher's choices and from the third re-route of an unowned kind | `cross-repo-claims`, `one-writer`, `held-not-lost` (relay half) | 160–200k (6–7u); if the fixtures push it over, the lease and `routes --proposed` split off as H2b |
| **G1** | the `check` and `hook` services (PLAN-group-servers.md phase 1 as services of this process, fixed point 10) | cloud (default; code and fixture); the site-scrapers pilot local | `check` requests `{repo, scope}` from a PostToolUse hook, the cron audit, or a `check-request`; `/touched`, `/stop`, `/audit` as those requests; a red result as one `check-red` per finding to the `owners` row with the suite output kept in the ledger; a check that raises as `check-broken`; the `stop_gate.max_blocks` return (group-servers §3.2); `hook` answering host history, staleness, words and sockets from the ledger with a short timeout; the model-turn counts by step. **Pilot, local** (~1–2u): site-scrapers, whose `dev.sh check --json` already meets the contract | group-servers' phase 1 as a separate program (never built); `report-shape`'s check half | 150–200k (5–7u) + 1–2u local |
| **H3** | hierarchy | cloud (default) | `/register`, the heartbeat from `limits.heartbeat_s` and `heartbeat_misses` (in the export), advertisement, down-child routing, `hub up --tree`, `status --tree`, the standalone case, S3 (`vocab`, classes) and S4 (`--propose`); the fixture tree three levels deep. Making site-scrapers the first live child node is the local follow-up (one `deep-work` job, ~1–2u). Roles inside a repo beyond `coder` stay gated on agent-groups (routing-tree §11 decision 4) | — | 160–200k (6–7u) + 1–2u local |
| **S2** | sync, blocks | local | marked blocks in the nine CLAUDE.md copies: one dispatch per owner, each ~0.5–1u, through the dispatcher | the three `dev.sh sync`, `test_doc_claims.py`'s rule half, `cmd_plan`'s copy half, after the same-verdict test | 9 × 15–30k (5–9u total) |
| **V1–V3** | the view | local | PLAN-hub-view.md, built after H3 | — | there |
| **RS** | the roster settings panel (§15) | local (its panel is a view panel, and its verb reaches `.claude/` through harness; its gates run on fixtures) | **read half, with V1:** the panel from a declared `settings.list` verb, the `settings` entry in the `services.json` schema, the rows-both-ways gate. **Write half, after H1b and P-RS1 (Decision 18: yes, Jacob 2026-10-19):** the `write-request` for the `settings.set` verb, one at a time per repo, the refused and unreachable displays, the cost line, the other three gates. P-RS1 is a script in `tools/hub/probes/` like H0's. **Harness job beside it, local** (~1–2u): `list --json`, a `models` list, `tokens --agents --json`, the all-or-nothing settings verb, and its `cli.json` entry (Decision 18: yes) | — | 60–110k (2–4u) + ~1–2u local; an analogy with H1a-0b (one route, one rule, one panel), not a derivation |
| **H4** | relegate the dispatcher | local | its hook (§4) allows only Read, Grep, `hub send`, `hub get`, `SendMessage` and denies the rest (its tool list a default only, Decisions 12 and 15 dissolved); the `operator` role; the dispatch ledger and `agent-watch` merge into `hub log`; `quote-words.sh` injects the `origin_id` stub through `hub origin`; window-to-window `SendMessage` goes through `hub send`. **Dispatcher job**: rewrite "How work is split here" after Jacob approves the text | `held-not-lost` (cap half), `stale-spawn`, `report-shape` once roles exist | 150–200k (5–7u) + the dispatcher's edit |
| **R2** | the other stores declare their ids | local | one dispatch per owner (knowledge-base for `kb:` section ids, research for `rs-<n>`, data-bridge for its records), each adding an `ids` entry to its `services.json` and checking its `get <id>` prints one record and one line; the hub changes nothing, `stores` picks them up at `hub reload`. After R1, and only once each owner's `get` exists (PLAN-services.md §3, not an input here) | — | 3 × 15–30k (2–3u total) |
| **D0** | the driven-session probe | local | §11's probe: the three rebuild mechanisms, the idle point with a background subagent, each clause pass or fail with `claude --version`, in `tools/hub/probes/`; the result picks the mechanism and sets D1's scope | — | 20–40k (1u) |
| **D1** | driven sessions | cloud (default) | `mode: driven`; `hub session start|stop|rebuild|edit-block|history`, `/sessions/<id>/…`; the hub's message list in the ledger; the idle point from the stream; the rebuild by the mechanism D0 chose, from a `ctx:` id the context-hygiene CLI hands over; the three rebuild guards; the §8 "driven session" row on a fixture. No role is `driven` in a committed registry until Decision 14 names one | the launcher's relaunch for any window that becomes a hub-hosted tab (Decision 14) | 120–180k (4–6u) |

Total for the hub proper, excluding measurement, the dispatcher's prose and the view
(costed in PLAN-hub-view.md): roughly 1.7–2.6M tokens (60–90u), of which about
1.25–1.8M is cloud by default. **Re-costed 2026-10-13 for the read route, twice.**
First for Jacob's widening (PLAN-services.md §3 step 3), from this table's own
numbers: the skeleton that moved out of H1a-1 is 110−80 = 30k to 170−130 = 40k, so
H1a-0's write half (the route, its rule, `hub hook gate`'s write classification and
the §8 clauses) is 80−30 = 50k to 130−40 = 90k (2–3u); the read half was unknown,
since its rule rested on an owned-file declaration no key held. **Then on the
planner's four answers** (same step, "The hub owner's four questions"): no new key
(owned paths are a `repos` row's directory and the `workspace` globs, and which are
stores is the owner's `cli.json`), and only three read cases, two of them plain Read.
That removes the declaration the size waited on, but it removes none of the read
half's four parts (a route, a rule, the hook's classification of reads, the §8
clauses), and it adds one case (a store named by path). The path-to-owner resolution
and the `stores.json` and `cli.json` reads are counted in the write half, which needs
them to name the verb to use. The table gives no finer basis than the write half's, so
**the read half is costed as the write half, 50–90k (2–3u): an analogy, not a
derivation**, with one unknown inside it: how far the read classifier must reach to
see a store id named through Bash. The down-server case for an owned path, the second
unknown at first, is settled by "Two more from the hub owner" 1 (store-ness read from
`stores.json`, §3 H1a-0b); its missing-file clause and `hub status` line are small
beside the route and are taken inside the range, not re-derived. H1a-0
with it would be 80–130k + 50–90k = 130–220k, whose top passes the 200k ceiling, so
**it splits: H1a-0 at 80–130k (3–5u) and H1a-0b at 50–90k (2–3u)**, as H2 would with
H2b; the hub owner's call (PLAN-services.md §3 step 3 leaves it there). The harness job
stays ~1u, all of it H1a-0's (one one-line caller; H1a-0b adds none), not re-derived.
The total rises by H1a-0b, from 58–87u to 58 + 50/29 ≈ 60u and 87 + 90/29 ≈ 90u
(60 × 29k = 1.74M, 90 × 29k = 2.61M). H1a-0b is cloud by the rule above, so the
cloud share rises by the same 50–90k, from 1.2–1.7M to about 1.25–1.8M; it came after
Decision 9's yes, and if the credits are short it runs locally like any cloud phase.
**Re-costed again
2026-10-13 for H1a-0:** the write gate
adds about 80–120k (H1a-0 at 80–130k plus ~1u of harness, local; H1a-1 falls from
110–170k to 80–130k because the skeleton moved into H1a-0), all of it local, so the
cloud share is unchanged within its rounding. **Re-costed 2026-10-13:** Decision 1 removed H5
(100–150k) and the warm half of H0 (about 20–30k); questions 11 and 12 added R1, R2,
D0 and D1 (about 310–490k); the coder's Edit rule and the limits export ride inside H0,
H1a-2, H2 and H3 at no change to their ranges. The rise over the 1.4–1.9M Jacob
approved on 2026-10-09 is the two questions, which were asked after that yes; Decision
9 asks for it again. Order of dispatch: H0 → H1a-0 (+ harness) → H1a-0b → H1a-1 → H1a-2
(+ harness, + setup) → S1 →
H1b → R1 → H2 → G1 → H3 → S2 → V1–V3 (RS's read half with V1, its write half after) → H4 → R2 → D0 → D1. G1 sits after H2 because a
`check-red` message needs the loop controls and the write lease to exist before checks
start sending roles work, and before H3 because the pilot is one repo at the top node.
R1 sits after H1b because a stub's first reader is a cold role and its first id is the
`origin_id` H1b delivers. D0 and D1 sit last because no committed role is `driven`
until Decision 14, and every earlier phase works without them. H1a-0 comes first,
before any routing, because the write gate is what makes the planner incapable of a
direct write rather than told not to (Jacob 2026-10-13, PLAN-services.md §3), with
the read route next as H1a-0b since the hook intercepts every call (step 3 "Widened"),
and nothing in either waits on the registry's routes. H1a-0 runs locally because it is
on that critical path and its hook half is in `.claude/`; H1a-0b is cloud, and it may slip
behind H1a-1 without harm, since until it lands every read passes as it does today. The cloud phases are
`TODO.md`'s items, in that order, each written so a fresh cloud session starts from the
one item.

## 10. What it does not do

- **No model in routing.** The same envelope and registry hash always give the same
  decision, logged and replayable (§8). The dispatcher's judgement enters only as a
  logged choice that `routes --proposed` turns into a rule Jacob accepts.
- **No agent teams as the backbone.** Teams cannot nest: "teammates cannot spawn their
  own teammates", "one team per session", "the lead is fixed"
  (<https://code.claude.com/docs/en/agent-teams#limitations>). A team may still serve
  inside one node later.
- **No editing of code by the dispatcher**, and after H4 no tools but routing ones;
  enforced by the manifest and the guard, not stated.
- **No reading of the roster.** Nothing under `tools/hub/`, the view included, opens
  the manifest or the agent definitions; the red state in the agents panel comes from
  `hub.json`, which `setup` writes from the role list harness renders.
- **No warm role** (Decision 1). A role is a window, a cold process per message, or a
  `driven` session kept for its context (§11), never a process kept to save a start
  that the cache already saves.
- **No limit in code** (Decision 4). Every number the server enforces is a `limits`
  value in `hub.json`.
- **No text where an id will do** (Decision 3, §12). Jacob's words, a todo item, a
  plan section travel as ids with a stub the store wrote; a body that pastes a record's
  text past the cap is flagged.
- **No approval through auto mode, and no message is Jacob's yes** unless the server
  stamped `origin: jacob` for a turn that was his prompt (fixed point 4). `hub send`
  from any session is that session's message.
- **No spawning from the view.** The view sends envelopes and opens tabs; the server
  spawns. A view that could spawn would be a second dispatcher.
- **No credentials in data.** `HUB_TOKEN` and the parent token live in `local.env`,
  generated by `init`, never committed; `hub check` refuses credential-shaped keys in
  `hub.json` or `hub-view.json`.
- **No bot-detection concerns**: the hub carries pointers and one-line bodies between
  local processes; it never fetches a page.
- **No reimplementation of a repo's checks.** A group's `dev.sh check --json`
  (group-servers §1) stays the source of truth; the `check` service runs it when a
  `check-request`, a touched file or the cron audit asks, and reads the result.
- **No write path of a role's own** (fixed point 9). A role's every tool call passes
  the hook (§4), whatever its default tool list holds, and its sandbox writes only to
  its scratchpad; every write is a `write-request` the
  `write` service runs through the tool's declared CLI verbs. A verb not declared is
  refused, never run.
- **No store of a tool's facts** (routing-tree §14.1). The server's only store is the
  ledger of what moved; recipes, items, the roster and the checks stay in the tools
  that own them, read through their CLIs.
- **No failure that ends as a log line** (routing-tree §13.3). Every failure the server
  detects is a message to the owner of its seam kind; dead-letter is where it rests.
- **No service added by acting** (routing-tree §14.8). A repo declares its check, CLI,
  verbs and tags in its own `services.json`, through its own check and commit; nothing
  registers at run time; a second check server or hook server is never built.

**The view.** The terminal front end Jacob described on 2026-10-04 (agents, folders and
cron panels beside the window he types in, pinned blocks, tabs, a gear) is
PLAN-hub-view.md in this repo: a client of this server's API and of `claude agents
--json`, built after H3, with its own phases, gates, setup component and decisions
(review finding 7). What it needs from the server and nothing else does (`/agents`,
`/folders`, `/events`, `/view/*`, `hub cron --json`) is listed there and lands in its
phases, under this plan's help-equals-implemented gate.

## 11. A session the hub runs

The requirement is brief §4 question 11, stated there whole from PLAN-context-hygiene.md
§0 "Later" (not an input here): a session a program drives, where the program holds the
message list, clears and rebuilds the context on its own with no keystroke and no
restart, edits one block while the session continues, and takes the idle point from the
event stream, not from ledgers. The answers, in the brief's order.

**Whether the hub runs these sessions: yes, as a third role mode, `driven`, for a
session the hub starts.** A `driven` session is kept alive for one reason, that its
context is the hub's to shape; it is not a warm role by another name (Decision 1 dropped
those because a kept process saves no start and grows a history, §4). A rebuild is what
cuts that history, so `driven` is used only where a conversation must carry across many
messages and a rebuild is worth more than a cold start. Cold stays the default. Who is
`driven` first is Decision 14; until it is answered, no committed registry names one,
and D1 lands the mode on a fixture.

**Through stream-json, not the SDK.** The server starts `claude -p --input-format
stream-json --output-format stream-json --verbose --replay-user-messages` in the role's
`dir` with the role's default tool list and its hook (§4's cold flags; the Edit rule
where the role holds a lease), and is the only writer to its stdin. `--input-format`: "Specify input format
for print mode (options: `text`, `stream-json`)"; `--replay-user-messages`: "Re-emit
user messages from stdin back on stdout for acknowledgment. Requires `--input-format
stream-json` and `--output-format stream-json`"
(<https://code.claude.com/docs/en/cli-reference#cli-flags>). The SDK is "A library that
runs the Claude Code binary"
(<https://code.claude.com/docs/en/agent-sdk/overview#compare-the-agent-sdk-to-other-claude-tools>),
the same process behind a Node or Python dependency the hub does not need, and the hub
already parses this stream for cold roles. The streaming-input page, which the
2026-10-05 review found absent from the mirror, read live on 2026-10-13: streaming
input "allows the agent to operate as a long lived process that takes in user input,
handles interruptions, surfaces permission requests, and handles session management",
with "Context persistence: maintain conversation context across multiple turns
naturally" (<https://code.claude.com/docs/en/agent-sdk/streaming-input#benefits>). That
is the draft's unverified W2 clause, now cited; the planner's `kb check` settles the
citation, and D0's first clause runs it regardless, because a page is not a run.

**The message list.** The hub writes each message as
`{"type":"user","message":{"role":"user","content":"…"}}` and keeps, per session, the
list of what it wrote (confirmed by the replayed user messages), every `assistant` line
and every `result` line, in the ledger under the session id. The process holds the
conversation too; the hub's list is the one it rebuilds from and the one `hub session
history <id>` prints.

**The rebuild: three mechanisms, one probe (D0), pass conditions stated before it runs.**
Context-hygiene decides *what* the rebuilt context is and hands the hub a `ctx:` id of
the rendered list (§12); the hub decides *when* (the idle point below) and *how*:

- **M1, the recorded prompt, for one block.** "By default, Claude Code builds the system
  prompt once, on a conversation's first request, with the text from any system prompt
  flags applied, and records it in the session. Until the conversation is compacted,
  every later request uses that recorded prompt"; with `--system-prompt-snapshot off`,
  Claude Code "rebuilds the prompt on every request"
  (<https://code.claude.com/docs/en/cli-reference#system-prompt-flags-in-resumed-conversations>).
  So a session started with `--system-prompt-snapshot off --append-system-prompt-file
  <block>` takes a rewrite of that file at its next request, with no restart and no
  keystroke: the edited block. Its cost is a prefix change, "A change to the system
  prompt invalidates everything, because all later content now sits behind a different
  prefix" (<https://code.claude.com/docs/en/prompt-caching#how-the-cache-is-organized>),
  so M1 is for an edit, not for every turn. Pass: after the file is rewritten from X to
  Y, the next answer knows Y and not X, and the pid is unchanged.
- **M2, resume from a transcript the hub writes, for clear-and-rebuild.** `--resume`
  takes "the absolute path to a session's `.jsonl` transcript file, and Claude Code
  continues the conversation stored in that file"
  (<https://code.claude.com/docs/en/headless#continue-conversations>). The hub writes a
  transcript holding the rebuilt list and starts a new `-p` process resumed from it:
  the list is the hub's, the context is shorter, and nothing a person sees restarts,
  since the view's tab is a client of the hub (PLAN-hub-view.md §1). Pass: the resumed
  session's `system/init` line reports the session; the next answer knows Y (in the
  rebuilt list) and not X (dropped from it); the first `result`'s `usage` shows
  `cache_read_input_tokens`, "Tokens served from cache on this turn"
  (<https://code.claude.com/docs/en/prompt-caching#check-cache-performance>), at least
  the size of the unchanged prefix. Risk: the transcript's line format is not a
  documented interface (the docs say where transcripts are stored, not what a line
  holds); D0 records the `claude --version` it passed on and `hub doctor` refuses M2
  below it.
- **M3, the floor.** A fresh `-p` process with the rebuilt list as
  `--append-system-prompt-file` and the new message: a new conversation, always
  available. It is what `agents.sh run <role>` does for a window today, "relaunched with
  `--append-system-prompt-file <rebuild>` only when its restart request carries
  `signalled_at` and its own `launcher_pid`" (`docs/inputs/claudeTest-CLAUDE.md`), with
  the hub doing the relaunch at the idle point and no keystroke. Pass: trivially; it is
  what runs when M2 fails its clause.

Recommendation: M2 for the rebuild, M1 for the block edit, M3 as the floor (Decision
14). The hub holds no threshold of its own: when to rebuild is context-hygiene's
measurement, not the hub's.

**The idle point, from the stream.** Three conditions, all read from the output stream,
none from the ledger's own bookkeeping:

1. the `result` line of the last message the hub wrote has arrived: "The last line of
   the stream is a `result` message with the final response text, cost, and session
   metadata" (<https://code.claude.com/docs/en/headless#stream-responses>);
2. every subagent run is closed. Subagent messages "appear in the stream as `assistant`
   and `user` messages. Their `parent_tool_use_id` field says which run each one belongs
   to. Messages from the main conversation carry `null` in that field"
   (<https://code.claude.com/docs/en/headless#follow-subagent-messages>); a run opens at
   the Agent `tool_use` block and closes at its `tool_result`. A background subagent
   keeps a run open past its turn: "Background subagents and workflows: the run stays
   open until that work completes, because its result is part of the final output"
   (<https://code.claude.com/docs/en/headless#background-tasks-at-exit>). Whether a
   turn's `result` line can precede that completion in a stream-json session is D0's
   fourth clause; the hub waits for the `tool_result` either way;
3. nothing is queued: the hub wrote nothing since.

The test (§8 "driven session"): a fixture turn starts a background subagent that sleeps
20 s; no rebuild lands before its `tool_result`, and one lands within a poll after. The
`Stop` hook's `background_tasks` ("Stop hooks receive `stop_hook_active`,
`last_assistant_message`, `background_tasks`, and `session_crons`",
<https://code.claude.com/docs/en/hooks#stop>) reaches the hub through `hub hook stop` as
a cross-check, never as the only source.

**What the hub exposes, and who may call it.** `hub session start <role> | stop <id> |
send <id> | rebuild <id> --from ctx:<id> (M2) | edit-block <id> <block> --from ctx:<id>
(M1) | history <id>`, and the same over `/sessions/<id>/…` with the token, all in
`docs/API.md` under the help-equals-implemented gate. Callers: the context-hygiene CLI
(its monitor says when, it renders the list and hands the id), and Jacob through the
view. Never a role: `hub session` is not a `write-request` verb any owner grants a
role, so the role's hook (§4) sends the call to the server, which refuses it and
answers as `tool-result`, never run.

**Relation to the context-hygiene launcher.** The launcher restarts a whole window. A
window the hub runs as a `driven` session needs no relaunch: the hub applies the
rebuild at the idle point. Which windows the hub runs is Decision 14: today's two
windows are interactive terminals (`claude --agent planner` in a view tab,
PLAN-hub-view.md §2), and `-p` is print mode, "Print response without interactive mode"
(<https://code.claude.com/docs/en/cli-reference#cli-flags>), so a window becomes
`driven` only when its tab becomes a hub-served page over `/sessions/<id>`, a view phase
after V3, costed there when decided. Until then the launcher stays for the windows, and
it retires per window as each moves.

**The rebuild guards, held here.** (1) No tool output in the system prompt: the hub
refuses a rebuild file (M1, M3) that contains a line of a recorded `tool_result`; M2
carries tool results only as the transcript's own `user` lines, where they belong. (2)
A rebuild is never read as Jacob's prompt: it enters as a system prompt or a
transcript, never as a `user` message on stdin, and `hub origin` says `jacob` only for a
turn whose prompt the user-prompt hook recorded (§1), which a rebuild never does; the
test: after a rebuild, the next `hub origin` is `model`. (3) Nothing lost: the
pre-rebuild list is a `ctx:` snapshot named in the rebuild's ledger row, and `hub
session history <id>` prints both; the test: every message of the old list is in the
snapshot.

→ D0 (the probe, local), D1 (the mode, cloud by default); the view's tab, if Jacob
wants it, after V3.

## 12. References by id, shown as a stub and expanded on demand

The requirement is brief §4 question 12 (Jacob, 2026-10-12): the sender writes an id,
never the record; the hub resolves the id's prefix, renders a stub from the store's own
line, and expands only when asked. PLAN-services.md §3 (not an input here) gives each
store `get <id>` and a short readable line per record; this section uses those two
facts and nothing else of that plan.

**Stores in the first phase.** H1a-2: `ctx:` (context-hygiene), because `origin_id`
needs it (Decision 3). R1: `todo:`, whose `todo get ID` prints "one record by id, as
JSON, with its tags" (PLAN-todo-tool.md §3). R2, by their owners: kb section ids,
research `rs-<n>`, data-bridge records, each when its `get` exists (Decision 16).

**How a store joins.** It declares in its own `services.json` (§2):
`"ids": [{"prefix": "todo:", "pattern": "todo:td-\\d+", "get": "get"}]`: the prefix,
the id's shape, and the verb of its declared CLI that prints one record. The registry's
`stores` is the union, derived like `repos`; the hub holds no store and no prefix of its
own (routing-tree §14.1). `hub check`: every prefix in `stores` has an executable
`get`, and a store that does not answer is `UNCHECKED` with the row red, never ok; every
`ids` declaration is in `stores`; two repos declaring one prefix fail.

**The syntax inside a message.** A reference is the bare id in the body (`ctx:7f3a`,
`todo:td-27`, `rs-<n>`), found by the declared patterns, or named with `--ref` on `hub
send`, which already carries the pointer and takes an id as it takes a path. The server
scans the body at `/route`, fills the envelope's `refs` list beside `body` (`{id,
store, line, source, date, hash, status}`), and overwrites any `refs` a sender set, as
it overwrites `origin`. A `--ref` with an undeclared prefix is refused at `hub send`
with the declared prefixes named; an id-shaped token no pattern claims is prose and is
left alone.

**The stub.** Rendered by the server from the store's `get`, never from the sender: the
id; the store's one line, cut at `limits.stub_chars` (200, §2); the source (the store's
name and the location it reports); the date the store reports; the status. The
delivered text is the body with each reference followed by its stub on the next line,
so a model recipient reads `todo:td-27  "<line>"  (todo, 2026-10-09)` and decides
whether to expand. A sender cannot misdescribe a record, and spends nothing on it.

**Expanding.** For a model recipient: `hub get <id>`, the server's read route, which
resolves the prefix, runs the store's `get`, and prints its output unchanged. A role
does not need it on a tool list: **Decision 15 dissolved with Decision 12** (Jacob
2026-10-13, PLAN-services.md §3 step 3 "Widened"; §4), because the list is not the
gate. The role's hook intercepts every call, and when a role reads a store, by
`hub get` or by any other tool naming the id, the hook sends it as a `read-request`
(§3 H1a-0b) and the answer is that store's `get`; the full text costs tokens only in the session that runs
it. For the view: the stub is a collapsed element, a click fetches `GET /refs/<id>` and
shows the text inline. Both make the same store call; the §8 row holds that the output
equals the store's byte for byte.

**A record that changed since it was cited.** The server keeps the hash of the `get`
output it rendered the stub from (the `hash` in `refs`). On expand it runs `get` again:
equal → the text; different → status `changed since cited`, the text as it is now, and
the cited line kept above it so the difference is visible; the view shows both. A sender
who needs the text as it was cites a `ctx:` snapshot of it; whether a `ctx:` record is
immutable is context-hygiene's to say, and the hub's hash reads either way.

**A dangling or unreachable id.** `get` finds nothing → the stub renders `unresolved:
not found`, still in the delivered text, never dropped. The store's CLI missing or
failing → `unchecked: <store> unreachable`, and `hub status --doctor` names the store.
Neither is a pass: a stub's status is never `ok` by default.

**The paste gate.** For each resolved reference, and for `origin_id`, the server
compares the body against the record's text: more than `stub_chars` of it verbatim and
the envelope is still delivered, but the ledger row carries `pasted: <id>` with the
count and the sender gets a `report` saying so. Not a block, since a message may be
right to carry a quote; `hub log --pasted` shows the count per sender, so the habit is
seen, not assumed.

→ H1a-2 (`ctx:` and `origin_id`), R1 (the rest, with `todo:`), R2 (the other stores by
their owners); gates in §8 "references by id".

*Questions 13 and 14 (the wizard, the assurance view) were added to the brief after
this plan's cloud passes and are not answered yet; their sections keep their numbers
when written. Question 16 likewise.*

## 15. The roster settings page

The requirement is brief §4 question 15 and routing-tree §15 (Jacob, 2026-10-19: "a
settings page for changing what each agent is set at in the hub app (e.g. opus 5.5. max
effort."). Written locally on 2026-10-19 by the hub owner (top-level item tl-310), from
the state of harness's CLI on that day, read from `.claude/agents.sh` and
`.claude/cli.json` by the owner and not copied here. Nothing of it is built.

**What the hub knows about the roster: nothing.** Fixed point 2 holds: the page is a
panel of the view (PLAN-hub-view.md), and like every panel it reads a tool's facts
through that tool's declared CLI (fixed point 10). The hub's code holds no roster word.
A repo offers the panel by declaring, in its own `services.json`, a `settings` entry:
`{"list": "<a read verb of its cli.json>", "set": "<a write verb of its cli.json>"}`.
At the top node that repo is harness. A node whose repos declare no `settings` entry
shows no panel, and `hub status` says `settings: none declared`, never an empty table
that looks like an empty roster.

**Reading the rows** (brief: "how the page reads its rows without opening the
manifest"). The page shows what the `list` verb prints as JSON, row for row. It adds
nothing, sorts nothing and fills no blank. Harness's `agents.sh list` prints text today,
without the facts §15 asks for. So harness owes a `list --json`, `list` being already a
declared verb. Its shape, proposed here and harness's to settle:

```
{"models": [...], "efforts": [...],
 "rows": [{"name", "kind": "coders|agent|planner|dispatcher",
           "model": {"value", "from": "own|coders"}, "effort": {"value", "from"},
           "model_reason", "maxTurns", "prefer", "resolved", "settable": [keys]}],
 "settings_json": {"model"}}
```

- **`coders` is its own row**, so one change covers every agent that inherits it
  (routing-tree §15).
- **`settable`** is what `set` accepts for that row. On 2026-10-19 the planner takes
  `model` and `effort`, and the dispatcher takes `model`, `quote_last` and
  `quote_max_chars` but no effort (harness hx-105, waiting on Jacob). The page offers
  only the listed keys, so it cannot offer a change `set` would refuse by shape.
- **`models` is the allowlist**, read from harness, never typed into the page. §15 says
  "the manifest's list of known models". No such list exists today: the schema accepts a
  pattern (`sonnet|opus|haiku|fable|inherit|claude-…`), and the nearest list is the
  `prices` table. Until harness emits `models`, the model field is shown, not editable,
  and labelled `no model list from harness`. It is never a free-text box.
- **`prefer` and `resolved` are routing-tree §16's** (preferred, fallback, resolved).
  They are shown when present and as `not set` when absent, never left blank.
- **`settings_json.model`** is the dispatcher's own model in `.claude/settings.json`,
  Jacob's file. The page shows it and has no control for it. Harness reads it, so the
  hub never opens `.claude/` (§8 "direction audit").
- **The session's own effort** beside the pinned one. The page shows it only if a
  source reports it, and none is known to: the `claude agents --json` fields quoted in §4
  and PLAN-hub-view.md §2 are `kind`, `pid`, `status`, `waitingFor` and `sessionId`, with no effort. Until
  a probe finds one, the cell reads `session effort: unknown`. The pinned value is
  labelled `pinned`, so neither is mistaken for the other.

**Changing a value** (brief: "how the server runs the four steps as one `write`
request"). The four steps are set, gen, check and a commit inside `.claude/`. The server
does **not** run them as a sequence of its own, because its code holds no tool's command
(fixed point 10, §8 "services as data"). The page sends one `write-request`:

```
{role: "view", tool: <the declaring repo>, verb: <its settings.set verb>,
 args: [<row>, <key>, <value>, ...]}
```

The declared verb runs all four steps in order and is all-or-nothing. Harness owes that
verb. Today `set` does the first two: it validates the change against
`lib/manifest-schema.jq`, writes it, runs `gen`, rolls back if `gen` fails, and prints
`next: ./.claude/agents.sh check, then commit`. A `check` refusal after the write
therefore leaves the manifest changed. Routing-tree §15's gate ("a refused change leaves
the manifest's hash unchanged") holds today only for a refusal by the schema.

`set` is also a `not_verb` in harness's `cli.json`: "a server caller would carry no
agent identity for it to check -- whether the hub may run it is an open decision". That
is Decision 18, answered yes once P-RS1 passes (below). The page sends `model` and `model_reason` in one request, since `set`
moves them only together.

**While it runs and when it fails.** While the verb runs, the row shows `changing:
<key> <old> → <new>` and the panel takes no second change. One write per declaring repo
at a time, the lease's rule applied to one verb. When it ends:
- **ok:** the row is read again from `list` and shows `changed <date>`, plus the cost
  line below.
- **refused:** the verb's `FAIL` lines, verbatim and cut at `limits.stub_chars` with
  the full text one click away. The row is read again from `list`, which shows it
  unchanged, so the page never claims a value the manifest does not hold.
- **unreachable or timed out:** `unchecked: <repo> unreachable`, never "unchanged",
  since the page cannot know.

Every outcome is one ledger row (§3).

**Who may change it.** Only Jacob, from the page (routing-tree §15; fixed point 9). How
the server tells Jacob's click from a role is Decision 18, answered yes once P-RS1
passes, with the read-only page and its `!` line until then (Jacob's words and their
sources: "Jacob's answers" below):
- **What is solid.** A role's call reaches the server through `hub hook gate` (§3
  H1a-0), which stamps the role. The server refuses a `settings.set` verb from any
  stamped role, whatever the verb's declaration says.
- **The gap is the local-trust risk (Risks).** Any local process holding `HUB_TOKEN`
  can POST directly. Unless a role cannot read the token, a role could pose as the
  view.
- **Probe P-RS1, local, before the write half is built.** A cold role in its sandbox
  tries to read `.claude/local.env` with Read, with Bash `cat`, and through a store
  read. Pass: all three fail. The probe records the result with `claude --version`.
  This plan does not claim the sandbox can deny a read: no docs are quoted here for it.
- **If the probe fails,** the page stays read-only. Each row then offers the exact
  `agents.sh set` line for Jacob to run with `!` in a prompt box, where
  `dispatch-guard.sh` already tells his command from a model's.

**The cost of a change.** After an ok, the row shows `tokens --agents --since <the
change's date>` for that row, read through harness's declared `tokens` verb (routing-tree
§15: a change is kept only if the numbers say it helped). It needs a `--json` form, which
harness's usage text does not show today. Until one exists the cell reads `cost: no JSON
from harness`; the page does not parse the text table.

**What the hub builds, and when.** Phase RS (§9) adds:
- the panel;
- the `settings` entry in the `services.json` schema;
- the `write-request` route for one `settings.set` verb;
- the four gates (§8 "roster settings").

RS comes after V1, which brings the view, and H1b, which brings the `write` service.
**The read half is useful alone.** A read-only panel needs only harness's `list --json`.
It can ship once V1 does, before the write half and before P-RS1.

**Jacob's answers to Decisions 18 and 19: both yes** (hb-28, dt-20 row 2; recorded
from routing-tree §15, "The two hub decisions behind that row, with Jacob's words",
tl-454):
- **Decision 19**, the four steps as one all-or-nothing harness verb: "2)Yes", typed in
  the planner window at 22:29 on 2026-10-19, and "Take the decision 19 answer as mine"
  in the dispatcher window (relayed by the dispatcher at 22:40; the words typed there
  are the dispatcher's to hold).
- **Decision 18**, the hub may run that verb for a request from the view and refuses it
  for every role: "3) Yes", in the dispatcher window at about 22:47 on 2026-10-19,
  answering the dispatcher's third open item (its relay, held by the peer cap until
  22:50).

So the read half ships with V1; P-RS1 runs from a role in its sandbox before the write
half is built; the hub calls harness's one verb once P-RS1 passes, and until then the
page is read-only and shows each row's `agents.sh set` line for Jacob to run with `!`.
The verb is harness's to build (top-level tl-442). Order: the merge (tl-432, done), then
the page (tl-310).

→ RS; gates in §8 "roster settings"; harness's part in Risks "Reports owed"; Decisions
18 and 19.

---

## Gates

The table in §8 is the gate list; it is repeated here only as the four rules the brief
asks for by name, each pointing at its rows:

1. **Every documented command exists and every command is documented**: §8 "help ==
   implemented" (CLI and HTTP), landed in H1a-0 and run by `hub check` from H1a-1.
2. **Every declared tag has a route and every route a tag**: §8 "vocabulary", H1a-1
   (against the root's own file, day one) and H3.
3. **A kill-the-server test**: §8 "kill the server", "write gate" and "read route" (their
   fail-closed halves) and "fails open, every hook", H1a-0, H1a-0b, H1a-1 and H1a-2.
4. **A conformance fixture that is not claudeTest**: §8 "conformance", H1b and H3.

Plus the direction audit (every phase), the per-branch report (H1b), the five rows for
fixed points 9 and 10, "limits both ways" (Decision 4), "references by id" (§12),
"driven session" (§11), and the view contract (PLAN-hub-view.md). `./dev.sh check` in
this repo already runs the inputs check (SHA256SUMS, the brief's §2 list, the README
table), the leak audit, the hook tests and `setup plans .` and `checks run .` where the
sibling tools are present (UNCHECKED where they are not); H1a-1 adds `hub check` on the
fixture, the unit suite, the direction audit and the no-names audit to the same
command.

## Phases

§9 is the phase table with costs, where each phase runs (cloud by default, or local) and
the interim rules each phase retires. A cloud phase is one cloud session Jacob starts on
this repo by PLAN-cloud-offload.md §8's procedure, from its `TODO.md` item, while the
cloud-only credits last, and the same item run locally as a `deep-work` job when they
do not (Decision 9); a local phase is one `deep-work` job. Outside both: the harness
job beside H1a-0 (the planner window's one-line `hub hook gate` caller on every tool call, registered once
`setup plans edit|add` and todo's import exist), the harness job beside H1a-2 (`gen` renders the role list, hooks become callers, the user-prompt
hook is installed, the guard reads status), the setup job beside it (the `hub`
component reads the role list), the cron-scheduler half of V2 (`chron.py list
--json`), the dispatcher's prose in H4, S2's nine per-owner dispatches and R2's three.

## Setup component

Required by PLAN-repo-setup.md §1. `setup`'s `server` component (repo-setup §2,
left to harness by tools-folder §4 step 1) becomes the **`hub` component**, portable,
owned by `tools/setup`:

| step | what it installs | idempotent check |
|---|---|---|
| `services.json`, `cli.json` (every repo, routing-tree §14.8) | the contract skeletons: `services.json` with the repo's name and its `check` command, `cli.json` as `{store, cli, verbs: []}`; the repo's agent fills `verbs`, `tags` and `ids` (the id prefixes its store hands out and the `get` verb that resolves them, §12) later in its own commits | present and valid (`services-valid`) → `unchanged`; a hand edit that breaks the shape → `drift` |
| `registry.proposed.json` | a proposed `repos` row for the node this repo belongs to, as `settings.proposed.json` is today; the copy into the node's registry is the node owner's step (`setup <path> --node` run again) | row present → `unchanged` |
| `hub.json` (a node only, `setup <path> --node`, repo-setup §7.5) | **the one writer at every node** (Decision 2). Where `.claude/hub-roles.json` exists (harness rendered it), `hub.json` from it: `roles`, `tags`, `children`, `server`, `owners`, `limits` as the list carries them, `rendered_from` with the list's path and hash. Where it does not, the starter (dispatcher window + coder cold, the default tools, `services` route and write on, `owners` with only `unowned`, `limits` at the defaults, a free port, empty tags, `parent` from the invoking node). `hub init` is this step by another name. Setup reads the list as a generic declaration, never the manifest | from a list: the file matches what the list renders → `unchanged`, else `drift` naming the keys; a starter: the keys setup wrote are unchanged → `unchanged`, a hand edit to one of them → `drift`; `tags`, `children` and `sync` are the owner's and not compared |
| `stores.json` (the node, re-rendered whenever setup runs at any repo; PLAN-services.md §3 step 3, "Two more from the hub owner" 1) | the node's store paths from every owner's `cli.json` `store` field, the `workspace` stores among them, read-only (0444) beside `hub.json`; the hook and the server read it to tell a store path from a non-store one (§3 H1a-0b) | the file matches what the `cli.json` files render → `unchanged`, else `drift` naming the paths; missing → `missing` (and `hub status` reports it) |
| `local.env` keys | `HUB_TOKEN` (generated), `HUB_PARENT_URL` (the invoking node's URL, or empty) through portable-env's loader; declared in `local.vars.json` | keys present → `unchanged`; never printed |
| `.gitignore` | `.hub/`, `hub-view.json`, `.claude/local.env` | lines present → `unchanged` |
| registration | `hub register` with the parent, when `HUB_PARENT_URL` is set and the parent is up; otherwise prints `register later: hub register` | registered → `unchanged` |
| hooks | the hub's role hooks (`planner-stop`, `dispatcher-stop`, `session-start`, `notification`) through the existing `hooks` component, from declarations `applies_to: roles:<list>`, into `settings.proposed.json`; never into `settings.json` | the `hooks` component's own check |
| the last step | `checks run .` itself, sequentially, never concurrently with the render; its output is setup's report (routing-tree §14.8, Jacob 2026-10-05) | green, or the failing check named |

Ownership follows PLAN-repo-setup.md §7.8: the parent owns the template and its
version, the node owns its rendered files, and a role that finds drift sends a
`write-request` naming setup's render verb to **its own node's** server, which runs
`setup <path>` locally with the parent's template version; no role writes a rendered
file at any level, and the parent's ledger shows no message for it. `init.sh` runs `hub
up --tree` as its last step before `agents.sh check`. The conformance fixture (§8) is
exactly "`setup` on an empty git repo, then `hub up`", so the component is tested by the
hub's own gate; the two-level fixture tree of repo-setup §7.5 is H3's.

## Risks

- **The platform moved under the design.** Since routing-tree §5 was written, Claude
  Code gained background sessions, a supervisor and `claude agents --json`, "the
  supported way to read session state from outside Claude Code"
  (<https://code.claude.com/docs/en/agent-view#read-session-state-from-a-script>). This
  plan uses them for the view's window state, and §11 uses `--replay-user-messages`,
  `--system-prompt-snapshot` and `--resume` on a transcript path, all of which carry
  version requirements: "`claude --help` does not list every flag, so a flag's absence
  from `--help` does not mean it is unavailable"
  (<https://code.claude.com/docs/en/cli-reference#cli-flags>). Mitigation: H0's and
  D0's probes record the `claude --version` they passed on; `hub doctor` refuses a
  `driven` role below it.
- **Frontmatter hooks do not run for `-p` roles in untrusted folders**: "A `-p`
  session doesn't count as accepting it"
  (<https://code.claude.com/docs/en/hooks#hooks-in-skills-and-agents>). Routing-tree
  §12 planned per-class hooks in frontmatter. §4 moves role hooks to settings via `setup
  hooks`; if Jacob prefers frontmatter, each role folder must be trusted once
  interactively, and `hub doctor` must check that it was (Decision 8).
- **Two writers of `hub.json`: closed by Decision 2.** The 2026-10-05 draft had harness
  render it at the top and `setup` write it everywhere else, two writers of one file.
  Now `setup` writes it at every node, from a role list where harness rendered one; the
  risk left is a role list and a `hub.json` that drift apart between a `gen` and a
  `setup` run, which `agents.sh check` (stale list) and setup's idempotent check
  (`drift`) each catch from their side (§2).
- **Fixed points 9 and 10 were placed after the review, without the planner's
  re-read.** The brief gained them on 2026-10-04 and 2026-10-05; this pass placed them
  (§2 `server`, `services`, `repos`, `owners`; §3 the `write` service and failure
  routing; §4 read-only roles; §8 five gate rows; §9 phase G1; the Setup component's
  contract files) from routing-tree §13–§14 and repo-setup §7.8 as decided. Two
  readings are the pass's own and are Decisions 10 and 11: the port in the registry
  rather than `local.env`, and G1's place after H2.
- **The `write` service depends on tools that are plans.** PLAN-hard-gates.md §3's
  gates on a tool's CLI, `tools/checks`' `registry-matches`, `services-valid`,
  `check-json` and `accessor`, and `tools/usage`'s `usage gate` are all depended on and
  none is built. Each absence is loud by design (`hub status` prints `usage gate: off`;
  a `repos` row with no executable fails `hub check`), and H1b's conformance fixture
  carries its own stub CLI with declared verbs, so the hub's own gates run without
  them; but the first real `write-request` against site-scrapers waits on
  site-scrapers' `cli.json`.
- **Origin stamping reads transcripts**, and "The transcript file is written
  asynchronously and may lag the in-memory conversation"
  (<https://code.claude.com/docs/en/hooks#common-input-fields>). Auto-relay already lives
  with this; the stamp retries once after 500 ms before defaulting to `model`, and
  `model` is the safe default (a missed `jacob` costs a question, a false `jacob` would
  cost an approval).
- **Chatty routing is expensive whatever the mode.** Every message that starts a
  model turn pays its prefix, cold or not, and a kept process pays a growing history on
  top (§4, Decision 1). The budget per conversation and the ping-pong hold bound it,
  counting only model-starting messages; `hub log --usage` (from the `result` line,
  whose payload "includes metadata about the request (session ID, usage, etc.)",
  <https://code.claude.com/docs/en/headless#get-structured-output>) shows the tokens
  per conversation in units of 1u, with `cache_read_input_tokens` beside them, so the
  number is seen, not assumed.
- **The rebuild without a restart rests on a probe.** §11's M1 and M2 use documented
  flags for a purpose the docs do not describe: a system prompt file rewritten under
  `--system-prompt-snapshot off`, and a transcript the hub wrote passed to `--resume`.
  D0 settles each with a run and a `claude --version`; M3 is the floor and is today's
  launcher behaviour, so a failed probe costs the plan a mechanism, not the mode.
- **The idle point and background subagents.** Whether a turn's `result` line can
  precede a background subagent's completion in a stream-json session is unverified;
  the headless page speaks of exit ("Background tasks at exit"). The hub waits for the
  run's `tool_result` either way, and D0's fourth clause records what the stream does.
- **A stub is only as good as a store's one line.** A store whose `get` prints a page
  makes every stub a cut at `stub_chars`; PLAN-services.md §3's contract (one short
  line per record) is depended on and not built here, and `hub check` can hold only
  that `get` answers, not that its line is short.
- **Local trust.** Any local process can POST to 127.0.0.1. The token in `local.env`
  gates every request; the server runs only `claude` with registry arguments and the
  commands `hub.json` names; a spoofed envelope cannot be `origin: jacob` because the
  server stamps that itself.
- **`hub routes accept` and `grant` are Jacob-only by harness's guard, not by the
  hub.** The hub cannot tell a `!` command from a model's Bash call; `dispatch-guard.sh`
  blocks the model's call (auto-relay §4 reason 4's pattern). A node without harness
  has no such guard, and its `routes accept` is simply a command the owner runs; the
  plan says so rather than pretending otherwise.
- **Reports owed to other owners** (CLAUDE.md "Report a problem…"; this session has no
  `SendMessage`, so they are recorded here and in the final message for the planner to
  relay): `cron-scheduler`: `chron.py list --json` (§7, V2) and reading the server list
  from `hub status --json --tree` instead of the manifest (§7, Decision 5); `harness`:
  `gen` renders `.claude/hub-roles.json` and never `hub.json`, three hooks become
  one-line callers of `hub hook`, a `UserPromptSubmit` hook for the two windows stores
  each prompt in `ctx:` through `hub hook user-prompt`, the guard reads `hub status
  --json`, `quote-words.sh` injects the `origin_id` stub through `hub origin` (H1a-2,
  H4); `tools/setup`: the `hub` component as the one writer of `hub.json`, reading the
  role list (Setup component: `services.json` with `ids`, `cli.json`,
  `registry.proposed.json`, `--node`, `checks run .` last); `context-hygiene`: the
  `ctx:` store takes a typed prompt from the hook and answers `get <id>` with one line
  and the text, and its CLI calls `hub session rebuild` with a `ctx:` id when its
  monitor says it is time (§11, §12); `todo`: `todo get ID` is read as is (§12);
  `tools/checks`:
  `rules-in-sync` and `hooks-installed` read `hub sync --check --json` after S1, and
  the four contract checks of routing-tree §14.8 (`check-json`, `accessor`,
  `services-valid`, `registry-matches`) that this plan depends on; `tools/usage`: the
  `usage gate <estimate>` command with its exit codes (§3). Per review finding 9 these
  go out after Jacob's yes, from `TODO.md`'s "Reported to other owners", each once.
  **Added 2026-10-19 for §15** (sent at once through the dispatcher, since RS's read
  half needs no Decision): `harness`: `agents.sh list --json` in §15's shape, with the
  `coders` row, `from` per key, `settable` per row and a `models` list (§15 assumes "the
  manifest's list of known models", which does not exist); `tokens --agents --since D
  --json`; one settings verb that runs set, gen, check and the `.claude/` commit
  all-or-nothing, rolling back a `check` refusal, with its test; and that verb's
  `cli.json` entry, which Decision 18's yes (Jacob 2026-10-19) allows; the hub calls it
  only once P-RS1 passes.
- **The settings page's write rests on a probe** (§15, P-RS1). If a role can read
  `HUB_TOKEN`, it can pose as the view, and the server's role stamp does not help. In
  that case the page stays read-only and the write is Jacob's `!` line. The plan
  claims no sandbox read-deny it has not run.
- **The output contract named a branch, `plan/hub`.** This session was directed to
  `claude/determined-edison-tx5h9v` and may not push elsewhere; the planner renames
  or merges. Nothing else in the repo was changed, per the brief.

## Decisions

| # | decision (§n pointer first) | hinges on | recommend |
|---|---|---|---|
| 1 | §4: warm roles are dropped: no `warm` mode, no W1/W2 mechanism, no warm probe, no H5; a later plan may bring them back only on measured token numbers | the ~29k prefix is sent on every request and read from cache either way, so a kept process saves no start and grows a history | drop. **Approved: Jacob 2026-10-09** (REVIEW §5.10: "the 29k happens either way") |
| 2 | §2: `setup` is the only writer of `hub.json` at every node; where a manifest exists, `agents.sh gen` renders a generic role list (`.claude/hub-roles.json`) that `setup` reads like any declaration; `hub init` is the same component where no list exists | one more rendered file in harness, a `harness` job and a `tools/setup` job beside H1a-2, and the no-roster check holding on a generic list | yes. **Approved: Jacob 2026-10-09** (REVIEW §5.8, 5.10: "setup should be able to bring up all of this from settings") |
| 3 | §1, §12: Jacob's words travel as an id in context-hygiene's `ctx:` store (`origin_id`), stored by a `UserPromptSubmit` hook, read by a role with `hub get` only when needed; `quote-words.sh` injects the id and its stub, not the text | whether output tokens on his words are worth spending once, at the hook, rather than per spawn | yes. **Approved: Jacob 2026-10-09** with his refinement (REVIEW §5.10: "the ID is sent [...] EVEN if my words need to be read") |
| 4 | §2, §5: `hops` 8, `heartbeat_s` 30 with `heartbeat_misses` 2, `budget_per_conversation` 10 counting model-starting messages only, `pingpong_hold` 4, `stub_chars` 200, every one a `limits` value in `hub.json` with the both-ways gate and the ledger row naming the limit it applied | none has evidence yet; they are starting values the ledger will correct, and the condition is that changing one is a data edit | yes, as starting values. **Approved: Jacob 2026-10-09** ("but I want to be sure that this can be easily changed if we bump into issues"; the condition is in §2) |
| 5 | §7: `chron.py` reads its server list from `hub status --json --tree` instead of the manifest (changes group-servers decision 4's data source, not its owner) | whether cron-scheduler takes the change in its next job | yes. **Approved: Jacob 2026-10-09** ("everything is in charge of itself") |
| 6 | §9: the view (PLAN-hub-view.md) is built after H3, as review finding 7 places it, not between H1b and H2 as the first draft had it | whether seeing the agents and folders early outranks finishing the hub's routing while the cloud credits last | after H3. **Approved: Jacob 2026-10-09** |
| 7 | §3: H1b (the server spawns cold roles for `task` from the dispatcher, and runs their writes through `write`) stays in phase 1 rather than moving to H2 | whether one phase may both relay and spawn; the fallback path stays either way | yes. **Approved: Jacob 2026-10-09** |
| 8 | §4: role hooks install through `setup hooks` into settings proposals rather than agent frontmatter, because frontmatter hooks need an interactive trust grant that `-p` roles never give | whether Jacob prefers trusting each role folder once by hand | settings via `setup hooks`. **Approved: Jacob 2026-10-09** ("by setup") |
| 9 | §9: the total, re-costed 2026-10-13 at 1.7–2.5M tokens over fifteen hub phases (the view costed separately), with about 1.2–1.7M on the cloud credits by default and any cloud phase free to run locally when the credits run low or it stalls | the cloud credit balance and the order in §9; the rise over the approved 1.4–1.9M is questions 11 and 12 (R1, R2, D0, D1) and H1a-0, the write gate (about 80–120k, local), each asked after that yes | yes, in the order given. **1.4–1.9M approved: Jacob 2026-10-09** ("though we can move stuff back to local if/when necessary"); **the 1.7–2.5M re-cost approved: Jacob 2026-10-13**, against the $156 cloud credit balance. H1a-0b, the read route split off H1a-0 (§9: 50–90k, cloud by default), came after that yes and raises the total to about 1.7–2.6M and the cloud share to about 1.25–1.8M; it runs locally if the credits are short |
| 10 | §2: the server's port lives in the committed registry (`server.port`, rendered into the role list from the manifest's `servers.<group>` entry), not in `local.env`; a clash on a machine is a `hub check` finding | routing-tree §14.6 as settled 2026-10-05 against portable-env §1's "machine-specific location" rule; the manifest already commits ports | registry, as §14.6 says. **Approved: Jacob 2026-10-09** |
| 11 | §9: G1 (the `check` and `hook` services) runs after H2 and before H3, with its site-scrapers pilot as a local follow-up | whether a `check-red` message may flow before the loop controls and the lease exist | after H2. **Approved: Jacob 2026-10-09** |
| 12 | §4: a role's read-only tool list is exactly Read, Grep, Glob and `Bash(hub send *)`, plus a test runner only where its repo's `services.json` declares one for a tester | routing-tree §13.2's list, which also names the runner; whether `Glob` is worth listing beside Grep | yes, with `Glob`. **Approved: Jacob 2026-10-09. Dissolved: Jacob 2026-10-13** (PLAN-services.md §3 step 3 "Widened": "read only is enforced via hooks [...] our hooks intercept ALL of them"): the hook routes every call to its owner (§3 H1a-0, §4), so no tool list is the gate; a role's list is a default only |
| 13 | §4: the coder under the write lease gets one extra permission rule, `Edit(<its repo>/**)`, the sandbox follows it, and `write` commits its edit with `Agent: <role>` on green only; no patch route | whether a lease-scoped Edit rule is as strong a gate as a patch through `write` (it is: check-then-commit is the gate in both) | the Edit rule. **Approved: Jacob 2026-10-09** (REVIEW §5.5; "even more thoroughly gated once we have the linter/architecture services running", G1 after H2). Under the hook on every call the server's write rule carries the lease clause: a non-store path inside the leased repo may be edited, a store inside it still goes through its verb (PLAN-services.md §3 step 3, "The hub owner's four questions" 4; §4; §8 "lease") |
| 14 | §11: the hub runs `driven` sessions through stream-json, with M2 (resume from a hub-written transcript) as the rebuild, M1 (the recorded prompt under `--system-prompt-snapshot off`) for a block edit and M3 (a fresh process) as the floor; D0 and D1 land the mode on a fixture now, and the first real `driven` session is a window whose view tab becomes a hub-served page, after V3 | D0's result per mechanism; and whether Jacob wants a window's context rebuilt with no relaunch at the price of the interactive terminal in that tab (print mode is not interactive) | D0 and D1 now; the planner window first, after V3, only if D0 passes M2. **Approved: Jacob 2026-10-13**: D0 runs on a fixture before anything touches the planner window |
| 15 | §12: `Bash(hub get *)` joins the read-only tool list beside `Bash(hub send *)`, widening Decision 12 by one read verb that runs only a store's `get` | the alternative is each store's own CLI on the list, one entry per store, which D3's `hygiene get` wording implied; one verb keeps the list short and the stores' CLIs off every role | **Dissolved with Decision 12: Jacob 2026-10-13** (PLAN-services.md §3 step 3 "Widened"): there is no list to widen; `hub get` stays as the server's read route, and the hook sends a role's store read to it as a `read-request` whatever tool the role used (§4, §12) |
| 16 | §12: the first-phase stores are `ctx:` (H1a-2, for `origin_id`) and `todo:` (R1); kb section ids, research `rs-<n>` and data-bridge records join in R2 by their owners' `ids` declarations, each when its `get` exists | which stores answer `get <id>` today (todo does, PLAN-todo-tool.md §3; the others are PLAN-services.md §3's, not an input) | yes. **Approved: Jacob 2026-10-13** |
| 17 | §3 H1a-0: the write gate is a slice of its own before H1a-1, run locally; a role's writable repos are derived from `owners` at render time, and there is no per-role `writes` list (§2); its hook **fails closed for writes** when the server is down, the one exception to "every hook fails open" (§8); the hook stays unregistered until `setup plans edit|add` and todo's import exist | whether a planner with the server down may be unable to write at all (the answer is `hub up`, named in the deny line); whether writable repos are a declared list or derived from `owners` (answered: derived) | yes. The gate itself: **Jacob 2026-10-13** (PLAN-services.md §3). **Its shape approved: Jacob 2026-10-13** ("Derived from owners"), which drops the per-role `writes` list the 6d2b3f6 draft had. The planner's and the dispatcher's set is the `owners` row `workspace` and nothing else (PLAN-services.md §3 step 3, "The hub owner's four questions" 1, approved: Jacob 2026-10-13; §2) |
| 18 | §15: the hub may run harness's settings write verb for a request from the view, and refuses it for every role; today `set` is a `not_verb` in harness's `cli.json` ("a server caller would carry no agent identity for it to check -- whether the hub may run it is an open decision") | whether the server can tell Jacob's click from a role's direct POST: probe P-RS1 (a sandboxed role cannot read `HUB_TOKEN` by Read, Bash or a store read); if it fails, the page stays read-only and shows each row's `agents.sh set` line for Jacob to run with `!` | yes, once P-RS1 passes; read-only with the `!` line until then. **Approved: Jacob 2026-10-19** ("3) Yes", dispatcher window, about 22:47, its relay held by the peer cap until 22:50; hb-28, dt-20 row 2; routing-tree §15; §15 "Jacob's answers") |
| 19 | §15, §9: the four steps (set, gen, check, the `.claude/` commit) are one harness verb, all-or-nothing, not a sequence the hub runs; RS adds 60–110k (2–4u) plus ~1–2u of harness to Decision 9's total, after its yes | fixed point 10 (the server holds no tool's command); today `set` stops after `gen`, so a `check` refusal leaves the manifest changed and routing-tree §15's third gate would fail on it | yes. **Approved: Jacob 2026-10-19** ("2)Yes", planner window, 22:29; "Take the decision 19 answer as mine", dispatcher window, relayed 22:40; hb-28, dt-20 row 2; routing-tree §15; §15 "Jacob's answers"). The verb is harness's (tl-442) |
