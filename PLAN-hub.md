# The hub: one portable node program, and a terminal view over it

> **Status: plan, written in the cloud from PLAN-hub-brief.md, 2026-10-04; revised in the
> cloud 2026-10-05 on `plan/hub`** from `docs/REVIEW-2026-10-04.md` (citations as quotes,
> findings 1–8) and from the brief's fixed points 9 and 10, which were decided after the
> review and which the plan places without reopening. Nothing is built. Sections 1–10
> answer the brief's §4 in order; the terminal front end Jacob described on 2026-10-04 is
> PLAN-hub-view.md (review finding 7). The planner reviews this file with Jacob and runs
> `kb check` on it; the cloud phases of §9 are built from `TODO.md`'s items once approved.
>
> **Owners:** `deep-work` for `tools/hub/` (server, CLI, view, gates); `harness` for what
> stays in `.claude/` and for rendering the registry from the manifest (§2); the
> `cron-scheduler` agent for `chron.py`'s side of §7; the dispatcher for the CLAUDE.md
> rewrite in phase H4; Jacob for `settings.json`, the terminal host (§11) and the
> Decisions table.
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
> PLAN-knowledge-base.md, PLAN-applications.md. Where this plan needs them it says so and
> does not guess their content.

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
definitions or `.claude/lib`; harness renders the registry from the manifest the way
`gen` renders agent definitions.

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
| `quote-words.sh` | **stays** | it is policy over roster spawns (row B). On a server spawn the same fact (Jacob's words, human-origin only) arrives through the envelope: the origin stamp that classifies a turn `jacob` already reads that prompt, so the server attaches it as `origin_text` on `origin: jacob` envelopes and the cold role's prompt carries it. One transcript reader, `hub origin`, serves both; `quote-words.sh` calls it for the text instead of keeping its own jq (Decision 5) |
| `dispatch-guard.sh`, `grant`, the manifest, `gen`, `check`, `doctor`, `wiring` | **stay** | the roster and the policy over it (tools-folder §7). The guard gains two facts from the hub: `hub status --json` says whether the server is up (§3), and a model's Bash call to `hub routes accept` is blocked the way `agents.sh grant` is |
| PLAN-group-servers.md's per-group server (`/touched`, `/stop`, `/audit`) | **becomes the `check` and `hook` services of this process**, not a second program (routing-tree §14.6, fixed point 10) | its endpoints become `check` requests (`{repo, scope}`); the stateful halves of `troubleshooting.sh` (host history), `agent-watch.sh` (staleness), `quote-words.sh` (the words) and `record-session.sh` (the sockets) become `hook` service lookups answered from the ledger, while each hook's **blocking** half stays a command hook (group-servers §2). Lands as phase G1 (§9) |

Two things harness renders into hub data rather than the hub reading them: the
registry (§2) and the role hooks' install declarations (fixed point 5). Both carry the
rendering's source hash so `agents.sh check` can say "stale" the way it does for agent
definitions.

→ Built across H1a-2 (relay, gates, ledger), H1b (origin text, spawns), H4 (the two
"until H4" rows).

## 2. The registry file

**One committed file per node, `hub.json` at the repo root: the registry, the server's
one input** (routing-tree §14.6). Beside it, two keys in the gitignored
`.claude/local.env` (portable-env §3.1): `HUB_TOKEN` and `HUB_PARENT_URL` (empty at a
root). The port and keep-alive are node facts in the registry, rendered from the
manifest's `servers.<group>` entry where harness exists (§14.6, settled by the planner
2026-10-05), as the manifest commits them today; a port clash on a machine is a `hub
check` finding, not a reason to move the port. Nothing in `hub.json` names a machine, an
owner or an account.

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
    "unowned": "dispatcher"
  },
  "children": [ { "name": "site-scrapers", "path": "site-scrapers" } ],
  "parent": null,
  "limits": { "hops": 8, "budget_per_conversation": 10, "pingpong_hold": 4,
              "warm_context_restart": 120000 },
  "sync": [], "classes": {},
  "rendered_from": { "source": ".claude/agents.manifest.json", "hash": "sha256:…" }
}
```

- **`server`.** The port the server binds on 127.0.0.1 and how it is kept alive (§7).
- **`roles`.** Name, `mode` (`window` | `cold` | `warm`, §4), the `--agent` name the
  server passes, the `dir` it runs in (relative to the node root; default the root),
  and the allowlisted tools the server passes with `--allowedTools`. **Every role is
  read-only** (routing-tree §13.2, fixed point 9): the list never holds Edit, Write or
  NotebookEdit, `Bash` appears only as `Bash(hub send *)` and, for a tester, the
  runner its repo's `services.json` declares; a role with any other entry fails `hub
  check`. `fallback: true` marks the node's dispatcher (routing-tree §3 rule 4).
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
  the sender.
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
- **`rendered_from`.** Present only where harness renders the file; absent in a
  hand-written one.

**Who writes it.**

| node | writer | how |
|---|---|---|
| with harness (today: the top level) | `agents.sh gen` | `roles` from agents that have a `dir` plus the two windows, with the read-only tool list; `tags` from the manifest's routes and `questions.types`; `children` from agents whose `dir` is a git repo; `server` from the manifest's `servers.<group>` entry (port, keep-alive); `owners` from the manifest's defaults (§14.7's table, `unowned: dispatcher`); `rendered_from` stamped. One more rendered file beside `.claude/agents/*.md`; the same read-only, same staleness check |
| every repo, with or without harness | `setup` (the `hub` component, Setup component below) | writes the repo's `services.json` skeleton (its name and its `check` command; `cli` and `verbs` empty until the repo declares them), `cli.json`, and a `registry.proposed.json` row for its node; never the node's `hub.json` itself. The repo's agent fills `verbs` and `tags` by editing `services.json` in its own repo, through its own check and commit (§14.8: no agent adds a service by acting) |
| the `repos` key, at every node | the server, mechanically | the union of the children's and the node's own `services.json`, read at `hub up` and `hub reload`; `registry-matches` goes red when the committed `repos` differs from the declarations, and `gen` (with harness) or `hub init --refresh` (without) rewrites it |
| without harness (a tool repo, a cloned repo, the conformance fixture) | `hub init` once, then by hand | writes a starter: `dispatcher` (window, fallback) and `coder` (cold, `--agent` unset so the default agent runs, read-only tools), empty tags, `services` with `route` and `write` on, `owners` with only `unowned: dispatcher`, a free port, no children, `parent` from `setup`'s argument |

**The gates that it matches the manifest and every repo's `services.json` where they
exist** are split across the seam, each side checking what it can read:

- `hub check` (hub side, no roster): `hub.json` validates against `hub.schema.json`;
  every role's `dir` exists and is inside the node; every role's tools are read-only;
  every tag resolves (§8 vocabulary gate); every seam kind in the vocabulary has an
  `owners` row or the explicit `unowned` default, and every row's key is a kind (both
  ways); every `repos` row names an executable `cli` and a `check`; `rendered_from.source`,
  if present, is a path that exists; `local.env` holds the two keys and no key or value
  shaped like a credential (portable-env §5).
- `agents.sh check` (harness side): re-renders `hub.json` from the manifest and diffs;
  a difference is "stale, run `gen`", the same message as for a stale agent definition;
  `rendered_from.hash` equals the manifest's hash.
- `registry-matches`, `services-valid`, `check-json`, `accessor` (tools/checks, §14.8):
  the node's `repos` equals the repos' declarations; every declared verb exists on the
  CLI; each repo's `check --json` conforms; nothing reads a store around its CLI. This
  plan depends on them and does not build them.
- `setup` refuses to write a starter where a manifest exists and prints the `gen`
  command instead, so the file never has two writers (Decision 4).

→ Built in H1a-1 (schema, `hub init`, `hub check`), with the `gen` rendering as a
`harness` job alongside H1a-2.

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
  text is attached as `origin_text`;
- **routes by rule 3**: `dispatch` → `dispatcher`, a `window` role → delivers to the
  dispatcher's inbox socket recorded in `/sessions`, as the message line auto-relay's
  probe established (`{"type":"user","message":{"role":"user","content":"…"}}`);
- **applies admission** (identical, invalid, runaway → dropped, dead-letter, held, each
  with a notice back to the planner window);
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
The server starts the cold role (§4) in `site-scrapers/`, pipes the brief and
`origin_text`, reads the stream to its `result` line, and sends a `report` envelope
back to `@from`. The role is read-only, so when its task needs a write it sends `hub
send --tag write-request --tool site-scrapers --verb register -- <args>`; the `write`
service looks the tool up in `repos`, refuses a verb not declared, runs the CLI with
the gates PLAN-hard-gates.md §3 lists, and answers with the CLI's own stdout and exit
as a `report` (routing-tree §14.6: "the server adds nothing"). Routing-tree §14.6's
build order, "phase 1 builds `route` and `write` for cold roles", is this phase. The
dispatcher's Agent-tool path stays available as the fallback until H4. Both paths
record a ledger row, so `agents.sh dispatches` keeps answering the planner.

→ H1a-1 (`hub up`, status, the fallback test), H1a-2 (the relay through the server),
H1b (the first spawn).

## 4. Roles and modes

Cold by default (routing-tree §11 decision 2). Three modes:

| mode | what the server does | state the view sees (§11) |
|---|---|---|
| `window` | never spawns; delivers to the recorded inbox socket; learns busy/idle from `claude agents --json`: `kind` is "`interactive` or `background`" and `pid`, `status` are present "While the process is alive" as "Process ID and one of `busy`, `waiting`, or `idle`" (<https://code.claude.com/docs/en/agent-view#list-sessions-as-json>), joined on `sessionId` ("the full session UUID", same anchor) with `/sessions` | green busy, yellow idle or waiting, red no session |
| `cold` | per message: `claude -p --agent <role> --permission-mode dontAsk --allowedTools <read-only list> --disallowedTools Edit,Write,NotebookEdit --permission-prompts none --output-format stream-json --verbose --max-budget-usd <cap>` in the role's `dir`, brief on stdin, inside a sandbox whose writable set is the role's scratchpad only (routing-tree §13.2 quotes the sandboxing docs: these paths are "enforced at the OS level, so all commands running inside the sandbox, including their child processes, respect them", <https://code.claude.com/docs/en/sandboxing#configure-sandboxing>; quoted there, not re-verified in this pass). **The role is read-only** (fixed point 9): it writes only by sending a `write-request`, which the `write` service runs (§3). A `--disallowedTools` bare name "removes the matching tools from Claude's context" (<https://code.claude.com/docs/en/cli-reference#cli-flags>); parses the stream and takes the final `result` line as the report: "The last line of the stream is a `result` message with the final response text, cost, and session metadata" (<https://code.claude.com/docs/en/headless#stream-responses>). `dontAsk`: "If you set `dontAsk` mode, Claude Code auto-denies every tool call that would otherwise prompt you" and "It also denies the built-in `AskUserQuestion` tool even if your allow rules match it" (<https://code.claude.com/docs/en/permission-modes#allow-only-pre-approved-tools-with-dontask-mode>). `--permission-prompts none`: "Pass `--permission-prompts none` when nobody is available to answer permission prompts" and "Claude is told that nobody can approve the request and not to retry it" (<https://code.claude.com/docs/en/headless#turn-off-permission-prompts-in-unattended-runs>). No approval through auto mode, by construction (fixed point 8). A role's final report can be forced to a shape: "To get output conforming to a specific schema, use `--output-format json` with `--json-schema` and a JSON Schema definition" (<https://code.claude.com/docs/en/headless#get-structured-output>); the `report` envelope's `body` is that object's one summary line. `--max-budget-usd`: "Maximum dollar amount to spend on API calls before stopping (print mode only)" (<https://code.claude.com/docs/en/cli-reference#cli-flags>); **a kill switch against a runaway role, never a cost measure.** Cost here is tokens: the server reads the `result` line's `usage` and writes it to the ledger row per spawn, and `hub log --usage` shows it in units of 1u (review finding 2). Stopping a cold role is SIGINT to end the turn, then SIGTERM: "If you stop a `claude -p` run with SIGTERM, for example with `kill` or from a process supervisor, Claude Code exits with code 143" and "Claude Code then runs `SessionEnd` hooks and exits" (<https://code.claude.com/docs/en/headless#stop-a-run-with-sigterm>) | green while the process runs; red otherwise (a cold role between messages is not spawned) |
| `warm` | a role kept alive between messages. Two mechanisms, chosen by the probe below (Decision 3) | green busy, yellow idle, red not started |

**Warm roles wait for the sandbox probe** (routing-tree §13.2: "warm roles need the
sandbox probe first (does a long-lived `claude -p` keep the sandbox across
messages)"). That probe is in H0; until it passes, no role is `warm`.

**Warm, two candidate mechanisms.**

- **W1, the supervisor.** `claude --bg --agent <role> --name <node>/<role>
  --permission-mode dontAsk --settings '{"crossSessionInbound":"accept"}'` in the role's
  `dir`. Claude Code's own supervisor hosts it: "Claude Code starts it the first time
  you background a session or open agent view, and you don't need to manage it
  yourself" (<https://code.claude.com/docs/en/agent-view#the-supervisor-process>).
  "`claude agents --json` is the supported way to read session state from outside
  Claude Code, for example from a status bar, a scheduler, or another Claude session
  that supervises background work"
  (<https://code.claude.com/docs/en/agent-view#read-session-state-from-a-script>); its
  `state` is "One of `working`, `blocked`, `done`, `failed`, or `stopped`" and its
  `status` "one of `busy`, `waiting`, or `idle`"
  (<https://code.claude.com/docs/en/agent-view#list-sessions-as-json>). The server
  delivers each message to the session's inbox socket: "Claude Code binds an inbox
  socket for a `claude -p` session like an interactive one, so a long-running `-p`
  worker can receive messages and appears in the listing", and "To let a `-p` worker
  take messages unattended, start it with `crossSessionInbound` set to `accept` in its
  `--settings` value"
  (<https://code.claude.com/docs/en/cross-session-messaging#non-interactive-sessions>).
  `claude attach <id>`, "Attach to a background session in this terminal"
  (<https://code.claude.com/docs/en/cli-reference#cli-commands>), puts it in a tab of
  the view. **Restart at the context threshold is `claude stop <id>` then a fresh
  `claude --bg`, never `claude respawn <id>`**, which restarts a session "with its
  conversation intact" (<https://code.claude.com/docs/en/cli-reference#cli-commands>)
  and so would fail the probe's third clause by design. `--bg` with `-p`: "These flags
  are mutually exclusive" (<https://code.claude.com/docs/en/errors#conflict-between-bg-and-print>),
  so the report comes from `claude logs <id>`, "Print recent output from a background
  session" (<https://code.claude.com/docs/en/cli-reference#cli-commands>), or the
  session's own `hub send --tag report`, not from a stdout stream.
- **W2, the stdin pipe.** `claude -p --input-format stream-json --output-format
  stream-json`, one process per role, messages written to stdin as
  `{"type":"user","message":{"role":"user","content":"…"}}`. `--input-format`:
  "Specify input format for print mode (options: `text`, `stream-json`)", and the
  `--max-turns` row shows one process taking several messages: "With `--input-format
  stream-json`, a message still queued when the limit ends a turn stays queued and
  starts a new turn with its own limit" (<https://code.claude.com/docs/en/cli-reference#cli-flags>).
  **Unverified:** that context persists across those turns and that each turn ends
  with its own `result` line. The SDK's streaming-input page says so, but that page is
  not in the knowledge-base mirror (review §2), so the claim stands only as H0's probe
  result. The server owns the process and restarts it at the threshold.

**The probe (H0), pass condition stated before it runs.** For each mechanism, in a
fixture repo: start the role; send message A ("remember the word X"); send message B
("what was the word?"); pass if B's result contains X **and** the role was reported
idle between A and B (W1: `claude agents --json` `status: idle`; W2: a `result` line
before B was written) **and** a third message after a forced restart does *not*
contain X (the restart really clears context). A mechanism that fails any clause is
not used. If both pass, W1 is recommended: its process state is a documented
interface and it needs no pipe to keep alive; W2 is the fallback.

**When a role goes warm** (routing-tree §11 decision 2, "only where the token numbers
show a saving"): per role, over seven days of `tokens --agents`, warm is adopted when
`messages × 1u (the cold start paid per message) > Σ warm turn input tokens + restarts
× 1u`. The inequality is computed by `tools/transcripts` once it exists, by hand with
`tokens --agents` until then, and recorded in the role's `hub.json` entry as
`"mode": "warm", "measured": "2026-…"`. A warm role with no `measured` date fails
`hub check`.

**Role hooks.** Routing-tree §12 renders per-class hooks into agent frontmatter.
"Frontmatter hooks in a project subagent run only after you accept the workspace trust
dialog for the folder the agent file came from. A `-p` session doesn't count as
accepting it" (<https://code.claude.com/docs/en/hooks#hooks-in-skills-and-agents>), so
for cold roles they would silently not run. Role hooks therefore install through
`setup hooks` into the repo's settings proposal (fixed point 5), which a `-p` session
does load: "Without `--bare`, a `-p` session runs the hooks in a project's
`.claude/settings.json` and connects the servers in its `.mcp.json`, even in a folder
you've never trusted" (<https://code.claude.com/docs/en/headless#start-faster-with-bare-mode>).
Frontmatter is used only for window roles Jacob has trusted. Decision 13.

→ H0 probe; H1b cold; H5 warm.

## 5. Children

- **Registration.** On `hub up`, a node with `HUB_PARENT_URL` set POSTs `/register`
  to its parent: `{name, path, port, token, roles: [...], tags: [...]}`,
  authenticated with the parent's token that `setup` placed in the child's
  `local.env`. The parent stores it under `.hub/children/<name>.json`, polls the child's
  `/health` every 30 s, and marks it `down` after two misses. `hub down` DELETEs the
  registration. The parent stores nothing about grandchildren: a child advertises its
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
  server increments `hops` and dead-letters at the limit.
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
| the view's cron panel (§11) | `hub cron --json`: the hub shells out to `chron.py list --json` and returns `[{job, next_run, schedule, enabled}]`. This needs a `list --json` on `chron.py`; it is a request to the `cron-scheduler` agent (Risks) |

**One change to report to `cron-scheduler`:** group-servers §3.5 has `chron.py` read
its server list from the manifest. Under this plan the list is `hub status --json
--tree` from the top node, because the manifest no longer knows the tree (a child
node's children are the child's business). Gate unchanged in spirit: the servers
`chron.py` shows == the nodes `hub status --tree` reports, both directions (Decision 7).

→ H1a-1 (`status --json`, `/health`), H3 (`--tree`), V2 (`hub cron`).

## 8. Gates, in the same change as each part

Each gate names the phase that must land it. "Fixture" means a temp git repo made by
the test, never claudeTest or any repo of ours.

| gate | proves | phase |
|---|---|---|
| **help == implemented** | `hub --help` lists exactly the subcommands the dispatcher implements, both ways; every endpoint in `docs/API.md` is served and every served route is documented (the server exports its route table; the test diffs) | H1a-1 |
| **vocabulary** | every tag in `hub.json` resolves to a role, a child, or a reserved target (`@from`, `@owner`, `@dir`); every route's tag is declared; an addressed envelope (`to` set) routes without a tag row. **Run against the root's own `hub.json` on day one**, with no child registered, and green there (review finding 1) | H1a-1, H3 |
| **determinism** | 100 fixture envelopes routed twice against the same registry give identical decisions; a ledger row replays to the same decision | H1a-2 |
| **kill the server** | with the server killed mid-run: `hub hook planner-stop` relays direct and prints the notice; `dispatch-guard.sh` lets a roster spawn through; `hub hook session-start` writes the state file; the dispatcher's question gate still blocks once. The first half (`hub status --json` says down within one second; `hub up` after a kill restores state) lands in H1a-1, the hook half in H1a-2 | H1a-1, H1a-2 |
| **origin** | a forged `origin: jacob` is overwritten to `model`; a `jacob` envelope carries `origin_text`; an irreversible tag from `origin: model` never spawns | H1a-2 |
| **admission** | identical → dropped; invalid → dead-letter with notice; budget + 1 → held; a Jacob prompt releases the held message and it is delivered once, never pasted; **the usage gate**: a fixture `usage` CLI exiting 0 lets a `task` spawn, one printing `warn` holds a job without a checkpoint and lets one with a checkpoint through with the note in its prompt, one printing `hold` queues the envelope with the hold time and produces exactly one line to the dispatcher window; a `services.usage` row whose executable is missing refuses the spawn with a reason | H1a-2 (gate), H1b (spawn) |
| **conformance** | a fixture repo set up from its path alone (`setup`, then `hub up`) receives a `task`, spawns a cold role, and returns a `report`; **a commit made by that server-spawned role carries the trailer `Agent: <role>`**, because the role runs as `--agent <role>` and `git-stamp.sh` reads `agent_type` from the hook input (PLAN-hard-gates.md §2; review finding 4); with `HUB_PARENT_URL` set, it registers and its tags route from the parent | H1b, H3 |
| **direction audit** | nothing under `tools/hub/` reads `.claude/`, names a roster agent, or imports from `.claude/lib`; the view included (tools-folder §1) | H1a-1, every phase |
| **no names in the program** | no repo name, path or command in `tools/hub/` source; they live in `hub.json` (group-servers §1a) | H1a-1 |
| **per-branch report** | when N spawns or N deliveries run together, the result names each one's outcome (`Promise.allSettled`), tested with a fixture where two of three fail on different steps | H1b |
| **lease** | two `task` envelopes to one repo's cold role run one after the other, never together; the second's `report` says it queued | H2 |
| **loops** | a fixture ping-pong (A → B → A …) is held at `pingpong_hold`; a hop-limit message dead-letters; both notify | H2 |
| **claims** | a `report` from A naming B's path arrives at B as `bug-report` and B's `report` closes the conversation; the top dispatcher's inbox receives neither; a claim with no owner dead-letters with notice | H2 |
| **hierarchy** | a parent stores no grandchild (the children dir holds only direct children after a three-level fixture); a de-registered child's tags route to the parent's dispatcher with notice | H3 |
| **dispatcher can't act** | an Edit, Write or non-`hub` Bash call from the dispatcher is blocked (harness's guard, tested against the restricted manifest) | H4 |
| **warm probe** | the three-clause probe in §4, per mechanism; a role may be `warm` only with a `measured` date | H0, H5 |
| **sync** | every declared source exists; every target holds its artifacts; an edit inside a block is caught; an undeclared override fails; a child cannot redefine a parent's tag; a root with no children says so | S1–S3 |
| **registry** | schema valid; `agents.sh check` re-renders and diffs where a manifest exists; `setup` refuses to write a starter beside a manifest; the whole row runs against the root's own `hub.json` on day one | H1a-1 |
| **view contract** | the view consumes only endpoints in `docs/API.md` (a static scan of the client source); the agent panel's three states are driven by fixtures (`/agents` says busy/idle/absent and the rendered page shows green/yellow/red); a toggled switch changes the feed; a pinned block changes when its source changes; the view never writes outside `hub-view.json` | V1–V3 |
| **fails open, every hook** | each installed hook copy exits 0 on malformed input and on a dead server; tested, not promised | H1a-2 |
| **services as data** (routing-tree §14.2, §14.6) | the program contains no tool's command and no repo's path (the no-names audit extended to service names); every `repos` row names its CLI; a fixture node with a different CLI gets every service working; `check` runs only the command the row names | H1a-1 (audit), H1b (`write`), G1 (`check`, `hook`) |
| **read-only roles** (routing-tree §13.4) | a fixture role with tools lacking Edit and Write and a sandbox allowing only the scratchpad: a Bash `echo > repo/file` inside it fails, and the same write sent as a `write-request` succeeds through the CLI, both directions; a `plan`-mode role spawned from a `bypassPermissions` window still cannot write; a `write-request` whose verb is not on the tool's declared list is refused at the server and answered, never run | H1b |
| **failures are messages** (routing-tree §13.3, §14.7) | kill a role process mid-delivery: `harness`'s inbox gets a `delivery` failure with the message id and the dispatcher gets nothing; remove `harness`'s `owners` row in a fixture: the dispatcher gets it, logged `routed_by: dispatcher`, and nowhere else; the third identical re-route proposes the row; a relay sent while the receiving window's hook sleeps 11 s is stamped and in the ledger | H1a-2 (stamp, `delivery`), H2 (proposal) |
| **owners both ways** (routing-tree §14.7) | every seam kind in the vocabulary has an `owners` row or the explicit `unowned` default; a row whose key is not a kind fails; flipping a check's own fixture in a fixture node moves the message from `check-red` (the repo) to `check-broken` (`tools/checks`) | H1a-1 (schema), G1 (the flip) |
| **agent last** (routing-tree §14.3) | `hub status` counts model turns by the step that caused them (validate, gate, route, model); a fixture where a routable cause recurs three times yields a proposed rule; `doctor` flags a node whose step-4 turns rise without step-3 findings | H1a-2 (counts), G1 (checks) |

→ Each row lands with its phase; a phase with a row missing is not done.

## 9. Phases with token costs

Order: every step leaves the system working; interim rules retire as their replacements
land (interim-rules §5 phase 4: "no interim rule outlives its replacement by more than
one harness job"). Costs are in tokens with the 29k unit; the ranges are wide because
the server is new code and the probes may fail once. **No phase is over 200k**, because
a job can die at a usage limit and a smaller job loses less (PLAN-check-progress.md §7;
review finding 5); H1a is therefore two phases, each leaving the system working.

**Where each phase runs** (review finding 8; PLAN-cloud-offload.md §3 and §8). A phase
is **cloud** when every input is in this public repo or a fixture, the output is a
branch, and nothing touches a browser, Gmail, the crontab or `.claude/`: the Node code
with fixture repos and offline tests. A phase is **local** when it probes this machine
(H0), opens a terminal on it (V1–V3), rewrites top-level prose (H4), or measures a week
of real sessions (H5). S2 is nine owners' edits in their own repos, so local. A cloud
phase is one cloud session Jacob starts from its `TODO.md` item while the cloud-only
credits last; when the credits are out, the same item runs as a `deep-work` job.

| # | phase | where | contents | retires | cost |
|---|---|---|---|---|---|
| **H0** | probes | local | the §4 warm probe (W1 and W2, three clauses each); `hub send` from inside a cold `-p` role (Bash allowlisted); `dontAsk` honouring a roster definition's tools; `claude agents --json` listing an interactive `--agent planner` session with `sessionId`; a long-lived `claude -p` keeps its sandbox across messages (routing-tree §13.2, the warm read-only question). Each probe is a script in `tools/hub/probes/` with its pass condition in the file, run by hand, result recorded in `TODO.md` | — | 60–120k (2–4u) |
| **H1a-1** | the program, no routing yet | cloud | `hub.json` schema and `hub.schema.json`; `hub init|check|up|down|status|routes`; `/health`, `/status`, `/routes`; `.hub/` state dir and `server.json`; the token check on every request; `docs/API.md` and the help-equals-implemented gate; the registry and vocabulary gates run against the root's own file; the direction and no-names audits; `./dev.sh check` runs them all. **Leaves the system working:** nothing calls the server yet; `hub status --json` is what `dispatch-guard.sh` will read | — | 110–170k (4–6u) |
| **H1a-2** | the relay through the server | cloud | the moved parser, gate, origin and ledger under `tools/hub/lib/` with their tests; `/route`, `/sessions`, `/ledger`, `/dead-letter`, `/held`; admission with the usage gate (§3); `hub send|log|hook|origin|grammar`; `hub hook planner-stop`, `dispatcher-stop`, `session-start` with the kill-the-server gates; the determinism and origin gates. **Harness job beside it, local** (~1–2u): `gen` renders `hub.json`; the three hook files become one-line callers; `dispatch-guard.sh` reads `hub status --json` | `relay-origin`, `question-kinds` (both `manifest:nodes` → the retire check becomes `file:hub.json`, a one-word addition to interim-rules §3's vocabulary) | 140–200k (5–7u) |
| **S1** | sync, files | cloud | `hub sync --check|--apply`, file mode, no server; the hook copies and the plan copy as declarations at the root; `tools/checks` `hooks-installed` reads it | the two `check-hooks.sh` after the same-verdict test | 120–180k (4–6u) |
| **H1b** | first spawn | cloud | cold roles: spawn, stream, `result` → `report` with its `usage` in the ledger, `origin_text`, `--json-schema` report shape, the lease's first half (one spawn per `dir` at a time), per-branch report; `hub send --tag task` from the dispatcher; the guard blocks a direct roster spawn while the server is up; the `Agent:` trailer on a role's commit in the conformance fixture | `stale-spawn` for server spawns (the hook stays for Agent-tool spawns until H4) | 150–200k (5–7u) |
| **H2** | agent to agent | cloud | tags between folder agents, loop control (hold, hop limit), the write lease (a coder's `write-request`s to its own repo, routing-tree §13.5), `bug-report` routing of cross-repo claims, `routes --proposed` from the dispatcher's choices and from the third re-route of an unowned kind | `cross-repo-claims`, `one-writer`, `held-not-lost` (relay half) | 160–200k (6–7u); if the fixtures push it over, the lease and `routes --proposed` split off as H2b |
| **G1** | the `check` and `hook` services (PLAN-group-servers.md phase 1 as services of this process, fixed point 10) | cloud (code and fixture); the site-scrapers pilot local | `check` requests `{repo, scope}` from a PostToolUse hook, the cron audit, or a `check-request`; `/touched`, `/stop`, `/audit` as those requests; a red result as one `check-red` per finding to the `owners` row with the suite output kept in the ledger; a check that raises as `check-broken`; the `stop_gate.max_blocks` return (group-servers §3.2); `hook` answering host history, staleness, words and sockets from the ledger with a short timeout; the model-turn counts by step. **Pilot, local** (~1–2u): site-scrapers, whose `dev.sh check --json` already meets the contract | group-servers' phase 1 as a separate program (never built); `report-shape`'s check half | 150–200k (5–7u) + 1–2u local |
| **H3** | hierarchy | cloud | `/register`, heartbeat, advertisement, down-child routing, `hub up --tree`, `status --tree`, the standalone case, S3 (`vocab`, classes) and S4 (`--propose`); the fixture tree three levels deep. Making site-scrapers the first live child node is the local follow-up (one `deep-work` job, ~1–2u). Roles inside a repo beyond `coder` stay gated on agent-groups (routing-tree §11 decision 4) | — | 160–200k (6–7u) + 1–2u local |
| **S2** | sync, blocks | local | marked blocks in the nine CLAUDE.md copies: one dispatch per owner, each ~0.5–1u, through the dispatcher | the three `dev.sh sync`, `test_doc_claims.py`'s rule half, `cmd_plan`'s copy half, after the same-verdict test | 9 × 15–30k (5–9u total) |
| **V1–V3** | the view | local | PLAN-hub-view.md, built after H3 | — | there |
| **H4** | relegate the dispatcher | local | restrict its tools to Read, Grep, `hub send`, `SendMessage`; the `operator` role; the dispatch ledger and `agent-watch` merge into `hub log`; `quote-words` reads `hub origin`; window-to-window `SendMessage` goes through `hub send`. **Dispatcher job**: rewrite "How work is split here" after Jacob approves the text | `held-not-lost` (cap half), `stale-spawn`, `report-shape` once roles exist | 150–200k (5–7u) + the dispatcher's edit |
| **H5** | warm roles | local | the chosen mechanism from H0, `claude stop` then a fresh `claude --bg` at the threshold, `measured` dates per role from seven days of `tokens --agents` | — | 100–150k (3–5u) + measurement |

Total for the hub proper, excluding measurement, the dispatcher's prose and the view
(costed in PLAN-hub-view.md): roughly 1.4–1.9M tokens (47–67u), of which about 1.0–1.4M
is cloud. Order of dispatch: H0 → H1a-1 → H1a-2 (+ harness) → S1 → H1b → H2 → G1 → H3
→ S2 → V1–V3 → H4 → H5. G1 sits after H2 because a `check-red` message needs the loop
controls and the write lease to exist before checks start sending roles work, and
before H3 because the pilot is one repo at the top node. The cloud phases are
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
  `hub.json`, which harness renders from the manifest.
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
- **No write path of a role's own** (fixed point 9). A role's tools are read-only and
  its sandbox writes only to its scratchpad; every write is a `write-request` the
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

## 11. The view: a terminal front end over the hub

> Jacob, 2026-10-04 (quoted in the brief's absence of this section): "take an open
> source terminal software, and add some features to it to make specifically managing
> all these agents and tasks easier. [...] pin blocks of text to the top and bottom of
> the terminal view. [...] a section maybe 1/5 the screen width to the right. [...] a
> list of agents in the active directory [...] a list of the folders in that directory
> [...] upcoming chron jobs [...] a gear icon in the top left [...] adding folders,
> changing the directory, adding or removing tabs to the main view (which should by
> default have a Planner agent tab, and my dispatcher agent tab). Change the icons for
> any of the status colors."

### 11.1 What it is, in the hub's terms

The view is a **client**. It reads `/agents`, `/folders`, `/cron`, `/held`,
`/dead-letter` and the `/events` stream from the current node's server, and `claude
agents --json` for session state; it writes only `hub view` commands (`hub send`, `hub
up`, `setup <path>`) and its own `hub-view.json`. It never spawns, never reads the
manifest, never touches `.claude/settings.json`. That keeps it portable (any node, any
machine), keeps the server the one source of truth, and lets the host terminal be
swapped without rewriting the panels.

The three panels and the pinned blocks are **served by the hub as small local web
pages** (`GET /view/agents`, `/view/folders`, `/view/cron`, `/view/pin/top`,
`/view/pin/bottom`, `/view/feed`), plain HTML and a few hundred lines of JS, updated
over `/events`. Circles, toggles, a spinning cross and a gear are trivial in HTML and
awkward in text cells, so this is the one implementation; the terminal host only has
to show a local URL beside a terminal. A text-only fallback, `hub view --tui`, draws
the same panels in the terminal for SSH and cloud sessions, from the same JSON.

### 11.2 The panels

**Agents panel (top third).** One row per role of the current node, from `/agents`:

| glyph | state | source |
|---|---|---|
| green circle | working | `cold`/`warm`: the server's own process state (running); `window`: `claude agents --json` `status: busy` for the session recorded in `/sessions` |
| yellow circle | awaiting commands | `window`/`warm`: `status: idle` or `waiting` (with `waitingFor` shown as a tooltip: `permission prompt`, `input needed`) |
| red circle | in the registry, not spawned | the role exists in `hub.json` and no process or session is known |

To the left of each circle, an **on/off switch** controlling whether that agent's events
appear in the **feed**: the single scrolling block of one-line events the server
emits (`spawned`, `tool: Bash`, `report: …`, `held`, `dead-letter`) for every agent
whose switch is on. Interactive tabs (planner, dispatcher) are always available in the
tab bar; the switch does not close a tab (Decision 2 asks Jacob to confirm this
reading). Clicking an agent's name opens its tab: `claude attach <id>` for a warm or
window session, `hub log --role <name>` for a cold role.

**Folders panel (middle third).** One row per direct subfolder of the node root, from
`/folders`:

| glyph | state | source |
|---|---|---|
| white circle, green cross | a node with its server up (registered child, `/health` answering) and at least one session or process alive there | the parent's children state plus the child's `/agents` |
| white circle, yellow cross | a node (git repo with `hub.json`) whose server is down, or up with nothing alive | same |
| white circle, red cross | a folder managed by this node: no git repo, or a git repo with no `hub.json` | the filesystem |

Clicking a folder rotates the cross to an X and shows that folder's agents in the same
shape as the agents panel, fetched from **the child's own** `/agents`, one level at a
time. The parent's server still stores no grandchild; the view walks the tree by
following links. A red folder has nothing to expand; its row offers "set up as a node"
(runs `setup <path>`, §Setup component).

**Cron panel (bottom third).** The next N runs from `hub cron --json` (§7), each as
`HH:MM  job-name  (schedule)`, with disabled jobs greyed. Read-only in V2; enable and
disable through `chron.py` is a later request to cron-scheduler, not this plan.

**Gear (top left) → settings.** Writes `hub-view.json` next to `hub.json` (gitignored,
per machine). Keys: `node` (the root whose server the view talks to; "changing the
directory"), `tabs` (`[{name, command, cwd}]`, default `[{Planner, "claude --agent
planner"}, {Dispatcher, "claude"}]` run at the node root), `folders` (extra roots to
show), `icons` (per state: glyph, colour), `pins` (§11.3), `feed.default_on`.
"Adding a folder" runs `setup <path>` and then `hub register`; `--github` is outward
facing and asks first. Settings never touch `.claude/settings.json`, which stays
Jacob's.

### 11.3 Pinned blocks

Two blocks, above and below the terminal area, each bound to a **source**: a file
path, a hub endpoint (`/held`, `/status`, the planner's last `## Decisions` table from
`hub log`), or literal text; configured in `hub-view.json` and editable from the gear.
A block re-renders when its source changes (SSE for endpoints, a file watch for files).
The gate: a change in the source changes the block; a block whose source is missing
shows "source missing: <path>", never stale text.

### 11.4 The host terminal

Three ways to put these panels beside a terminal, with what each costs. Jacob chooses
(Decision 1); the panels are the same in all three.

| host | how the view arrives | fits the request | risk |
|---|---|---|---|
| **A. Wave Terminal** (Apache-2.0; Go backend, Electron/React front end, <https://github.com/wavetermdev/waveterm>) | no fork at first. Wave's unit is the **block** in a per-tab layout with tabs and a right **widget sidebar** configured in `widgets.json` ("By adding a widget to this file, it is possible to add widgets to the widget bar", <https://docs.waveterm.dev/customwidgets>), and `wsh` creates and places blocks from the shell: "The run command creates a new terminal command block and executes a specified command within it", blocks can be opened magnified or placed, `wsh web` opens a URL in a web block, `wsh badge` marks a block or tab header, `wsh notify` raises a desktop notification (<https://docs.waveterm.dev/wsh-reference>). `hub view` writes a `widgets.json` entry per panel (a `web` block at the hub's URL), lays out the default tab (planner terminal, pinned `web` blocks above and below, the sidebar column), and badges a tab when its agent needs input | tabs, blocks and a configurable sidebar are native; pinned blocks are literally blocks; the gear is a widget | **docs.waveterm.dev was unreachable from this container** (egress blocked); the quotes above come from the docs' source files on GitHub and must be probed on Jacob's machine before V1 starts. Young project; layout persistence across restarts to confirm |
| **B. Tabby** (MIT; Electron, TypeScript, xterm.js, <https://github.com/Eugeny/tabby>) | a plugin: "A plugin should only provide a default export, which should be a `NgModule` class", loaded from the user's plugins directory or `TABBY_PLUGINS` (<https://github.com/Eugeny/tabby/blob/master/HACKING.md>). The plugin adds the sidebar and pinned blocks as Angular components around the terminal tab and a settings tab for the gear; the panels are the same hub-served pages in webviews | tabs and split panes native; a mature plugin API | Angular; whether a plugin can wrap the terminal tab's DOM without a fork is unverified: probe, else fork |
| **C. No fork: a tmux layout in the terminal Jacob already uses** | `hub view --tui` opens a tmux session: main pane (`claude --agent planner`), thin top and bottom panes (`hub pin top|bottom`), a right column of three panes (`hub panel agents|folders|cron`), one tmux window per tab. iTerm2 renders tmux panes natively (Claude Code's own `--tmux` flag "Uses iTerm2 native panes when available", <https://code.claude.com/docs/en/cli-reference#cli-flags>) | works over SSH and in a cloud session; one language; zero dependency on a host's API | glyphs not icons, no spin, no gear; panes not overlays. This is the fallback that ships with every host anyway |

**Recommendation:** A, with C always present as the fallback. Wave's native concepts
(blocks, tabs, sidebar, `wsh`) are the request's nouns, so V1 needs no fork; a fork of
Wave is considered only when a feature cannot be reached through `widgets.json`, `wsh`
and web blocks, and that is a decision then, not now. Rendering the panels as
hub-served pages is what makes the host swappable: if A disappoints, B shows the same
pages in a plugin and nothing in the hub changes.

### 11.5 What the view needs from the server that nothing else does

`/agents` (roles joined with process and session state), `/folders` (children state
plus a filesystem scan of the node root, one level), `/events` (SSE of ledger rows and
state changes), `/view/*` (the pages), `hub cron --json`. All documented in
`docs/API.md`, all under the help-equals-implemented gate. `claude agents --json` is
polled every 3 s while a view is attached and not at all otherwise, since it "is the
supported way to read session state from outside Claude Code" and "The files under
`~/.claude/jobs/<id>/` are not a stable interface"
(<https://code.claude.com/docs/en/agent-view#read-session-state-from-a-script>).
`Notification` hooks with the matchers "`agent_needs_input`, `agent_completed`"
(<https://code.claude.com/docs/en/hooks#notification>)
are installed as telemetry-only HTTP hooks posting to `/hooks/notification`, so a
needs-input state reaches the panel at once rather than at the next poll; HTTP hooks
fail open ("Connection failure: non-blocking error, execution continues",
<https://code.claude.com/docs/en/hooks#http-response-handling>), which is correct for
telemetry and is why no enforcing hook is HTTP (group-servers §2).

→ V1, V2, V3.

---

## Gates

The table in §8 is the gate list; it is repeated here only as the four rules the brief
asks for by name, each pointing at its rows:

1. **Every documented command exists and every command is documented**: §8 "help ==
   implemented" (CLI and HTTP), landed in H1a-1 and run by `hub check` thereafter.
2. **Every declared tag has a route and every route a tag**: §8 "vocabulary", H1a-1
   (against the root's own file, day one) and H3.
3. **A kill-the-server test**: §8 "kill the server" and "fails open, every hook",
   H1a-1 and H1a-2.
4. **A conformance fixture that is not claudeTest**: §8 "conformance", H1b and H3.

Plus the direction audit (every phase), the per-branch report (H1b), and the view
contract (V1–V3). `./dev.sh check` in this repo runs `hub check` on the fixture, the
unit suite, the direction audit, the no-names audit and `checks run .` once
`tools/checks` exists; until the first phase lands it stays the failing stub, and its
first real content is the inputs check `TODO.md` already describes (SHA256SUMS, the
brief's §2 list, the README table).

## Phases

§9 is the phase table with costs, where each phase runs (cloud or local) and the
interim rules each phase retires. A cloud phase is one cloud session Jacob starts on
this repo by PLAN-cloud-offload.md §8's procedure, from its `TODO.md` item, while the
cloud-only credits last; a local phase is one `deep-work` job. Outside both: the harness
job beside H1a-2 (`gen` renders `hub.json`, hooks become callers, the guard reads
status), the cron-scheduler half of V2 (`chron.py list --json`), the dispatcher's prose
in H4, and S2's nine per-owner dispatches.

## Setup component

Required by PLAN-repo-setup.md §1. `setup`'s `server` component (repo-setup §2,
left to harness by tools-folder §4 step 1) becomes the **`hub` component**, portable,
owned by `tools/setup`:

| step | what it installs | idempotent check |
|---|---|---|
| `services.json`, `cli.json` (every repo, routing-tree §14.8) | the contract skeletons: `services.json` with the repo's name and its `check` command, `cli.json` as `{store, cli, verbs: []}`; the repo's agent fills `verbs` and `tags` later in its own commits | present and valid (`services-valid`) → `unchanged`; a hand edit that breaks the shape → `drift` |
| `registry.proposed.json` | a proposed `repos` row for the node this repo belongs to, as `settings.proposed.json` is today; the copy into the node's registry is the node owner's step (with harness, `gen` renders it) | row present → `unchanged` |
| `hub.json` (a node only, `setup <path> --node`, repo-setup §7.5) | `hub init` starter (dispatcher window + coder cold, read-only tools, `services` route and write on, `owners` with only `unowned`, a free port, empty tags, `parent` from the invoking node) **unless** `.claude/agents.manifest.json` exists, in which case it prints `needs harness: ./.claude/agents.sh gen` and writes nothing | file present and schema-valid → `unchanged`; present and invalid → `drift` |
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
  plan uses them for warm roles (W1) and for the view's state, which is cheaper than
  owning stdin pipes, but several flags carry version requirements: "`claude --help`
  does not list every flag, so a flag's absence from `--help` does not mean it is
  unavailable" (<https://code.claude.com/docs/en/cli-reference#cli-flags>). Mitigation: H0's probes record the
  `claude --version` they passed on; `hub doctor` refuses to use W1 below it.
- **Frontmatter hooks do not run for `-p` roles in untrusted folders**: "A `-p`
  session doesn't count as accepting it"
  (<https://code.claude.com/docs/en/hooks#hooks-in-skills-and-agents>). Routing-tree
  §12 planned per-class hooks in frontmatter. §4 moves role hooks to settings via `setup
  hooks`; if Jacob prefers frontmatter, each role folder must be trusted once
  interactively, and `hub doctor` must check that it was (Decision 13).
- **Wave's documentation could not be read from this container.** The §11 claims about
  `widgets.json` and `wsh` come from the docs' source files on GitHub, not the rendered
  site, and from Wave's README (license, stack, platforms). V1 starts with a one-hour
  probe on Jacob's machine: a `web` block at `http://127.0.0.1:$HUB_PORT/view/agents`,
  a `wsh run -m` placement, a `wsh badge`. If any fails, B or C (§11.4).
- **Two writers of `hub.json`.** Harness renders it at the top; a repo without harness
  writes it by hand. `setup` refusing to write beside a manifest, and `rendered_from`
  marking the rendered kind, keep the two apart; the gate is in §2.
- **Fixed points 9 and 10 were placed after the review, without the planner's
  re-read.** The brief gained them on 2026-10-04 and 2026-10-05; this pass placed them
  (§2 `server`, `services`, `repos`, `owners`; §3 the `write` service and failure
  routing; §4 read-only roles; §8 five gate rows; §9 phase G1; the Setup component's
  contract files) from routing-tree §13–§14 and repo-setup §7.8 as decided. Two
  readings are the pass's own and are Decisions 15 and 16: the port in the registry
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
- **Cold starts make chatty routing expensive.** Every cold message pays ~1u. The
  budget per conversation and the ping-pong hold bound it; H5's measurement decides
  which roles go warm; `hub log --usage` (from the `result` line, whose payload
  "includes metadata about the request (session ID, usage, etc.)",
  <https://code.claude.com/docs/en/headless#get-structured-output>) shows the tokens
  per conversation in units of 1u, so the number is seen, not assumed.
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
  from `hub status --json --tree` instead of the manifest (§7, Decision 7); `harness`:
  `gen` renders `hub.json`, three hooks become one-line callers of `hub hook`, the guard
  reads `hub status --json`, `quote-words.sh` reads `hub origin` (H1a-2, H4);
  `tools/setup`: the `hub` component (Setup component: `services.json`, `cli.json`,
  `registry.proposed.json`, `--node`, `checks run .` last); `tools/checks`:
  `rules-in-sync` and `hooks-installed` read `hub sync --check --json` after S1, and
  the four contract checks of routing-tree §14.8 (`check-json`, `accessor`,
  `services-valid`, `registry-matches`) that this plan depends on; `tools/usage`: the
  `usage gate <estimate>` command with its exit codes (§3). Per review finding 9 these
  go out after Jacob's yes, from `TODO.md`'s "Reported to other owners", each once.
- **The output contract named a branch, `plan/hub`.** This session was directed to
  `claude/determined-edison-tx5h9v` and may not push elsewhere; the planner renames
  or merges. Nothing else in the repo was changed, per the brief.

## Decisions

| # | decision (§n pointer first) | hinges on | recommend |
|---|---|---|---|
| 1 | §11.4: the terminal host for the view: A (Wave Terminal, no fork, hub-served panels in web blocks), B (a Tabby plugin), or C (tmux layout only) | whether the request's icons, switches and spin need a DOM, and whether Wave's `widgets.json`/`wsh` work as its docs source says on Jacob's machine (probe) | A, with C as the fallback that ships in every case |
| 2 | §11.2: the on/off switch controls an agent's membership in the feed block, not whether its tab exists | what Jacob meant by "what I am seeing in the single terminal view" | yes |
| 3 | §4: warm mechanism W1 (`claude --bg --agent`, supervised by Claude Code, addressed by inbox socket) over W2 (the server owns a stdin stream-json pipe) | both passing H0's three-clause probe | W1 |
| 4 | §2: at a node with harness, `agents.sh gen` renders `hub.json` and `setup` refuses to write a starter there | accepting one more rendered file in harness, and a `harness` job beside H1a-2 | yes |
| 5 | §1: the server attaches Jacob's prompt text as `origin_text` on `origin: jacob` envelopes and cold roles receive it; `quote-words.sh` reads `hub origin` instead of its own jq | whether the quote on roster spawns may come from the envelope rather than the Agent-tool prompt | yes |
| 6 | §5: `hops` 8, heartbeat 30 s with two misses to `down`, `budget_per_conversation` 10, `pingpong_hold` 4 | none of these has evidence yet; they are starting values the ledger will correct | yes, as starting values |
| 7 | §7: `chron.py` reads its server list from `hub status --json --tree` instead of the manifest (changes group-servers decision 4's data source, not its owner) | whether cron-scheduler takes the change in its next job | yes |
| 8 | §9: the view (V1–V3) is built after H3, as review finding 7 places it, not between H1b and H2 as the first draft had it | whether seeing the agents and folders early outranks finishing the hub's routing while the cloud credits last | after H3 |
| 9 | §11.1: the view lives in `tools/hub/view/`, same repo and CLI (`hub view`), not a separate `tools/hub-view/` | keeping the API and its only client in one commit against the cost of a larger repo | yes |
| 10 | §3: H1b (the server spawns cold roles for `task` from the dispatcher) stays in phase 1 rather than moving to H2 | whether one phase may both relay and spawn; the fallback path stays either way | yes |
| 11 | §11.2: red in the agents panel means "in `hub.json`, not spawned", where Jacob said "in the manifest.json"; `hub.json` is rendered from the manifest so the set is the same, and the view never opens the manifest | the fixed point that the hub reads no roster | yes |
| 12 | §11.2: the gear's "add folder" runs `setup <path>` and asks before `--github`; "change directory" switches the node the view talks to | whether settings may run `setup` from the view | yes |
| 13 | §4: role hooks install through `setup hooks` into settings proposals rather than agent frontmatter, because frontmatter hooks need an interactive trust grant that `-p` roles never give | whether Jacob prefers trusting each role folder once by hand | settings via `setup hooks` |
| 14 | §9: the total, 1.4–1.9M tokens over twelve hub phases (the view costed separately), is acceptable as the hub's price before H5's savings can be measured, with about three quarters of it on the cloud credits | the cloud credit balance and the order in §9 | yes, in the order given |
| 15 | §2: the server's port lives in the committed registry (`server.port`, rendered from the manifest's `servers.<group>` entry), not in `local.env`; a clash on a machine is a `hub check` finding | routing-tree §14.6 as settled 2026-10-05 against portable-env §1's "machine-specific location" rule; the manifest already commits ports | registry, as §14.6 says |
| 16 | §9: G1 (the `check` and `hook` services) runs after H2 and before H3, with its site-scrapers pilot as a local follow-up | whether a `check-red` message may flow before the loop controls and the lease exist | after H2 |
| 17 | §4: a role's read-only tool list is exactly Read, Grep, Glob and `Bash(hub send *)`, plus a test runner only where its repo's `services.json` declares one for a tester | routing-tree §13.2's list, which also names the runner; whether `Glob` is worth listing beside Grep | yes, with `Glob` |
