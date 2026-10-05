# The hub: one portable node program, and a terminal view over it

> **Status: plan, written in the cloud from PLAN-hub-brief.md, 2026-10-04.** Nothing is
> built. Sections 1–10 answer the brief's §4 in order; §11 answers Jacob's message of
> 2026-10-04 (the terminal front end), which the brief predates and which this plan
> treats as part of the hub, not a second project. The planner reviews this file with
> Jacob and runs `kb check` on it; `deep-work` builds from it once approved.
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
> PLAN-cloud-offload.md §3 (tests offline); PLAN-repo-setup.md §1–§2 and
> PLAN-portable-env.md §1–§3 (how it ships, `local.env`, `init.sh`).
>
> **Open pointers** (inputs cited by the brief's inputs but not copied): PLAN-context-hygiene.md,
> PLAN-knowledge-base.md, PLAN-applications.md. Where this plan needs them it says so and
> does not guess their content.

**The hub in one paragraph.** `tools/hub/` is one Node program, `hub`, the same at every
node, configured only by a data file at that node (§2) and by `local.env`. Its server
(`hub up`) routes tagged envelopes between roles and nodes with no model involved,
owns the headless role processes, stamps origin, keeps the ledger, and exposes one small
HTTP API on 127.0.0.1. Its CLI is also the body of every hook the hub absorbs from
`.claude/`, so the blocking decisions run locally and keep working with the server down.
Its view (`hub view`, §11) is a client of that API and of `claude agents --json`: a
terminal front end with the agents, folders and cron jobs of the current node beside
the window Jacob is typing in. Nothing under `tools/hub/` opens the manifest, the agent
definitions or `.claude/lib`; harness renders the hub's data file from the manifest the
way `gen` renders agent definitions.

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
| the relay ledger (`relay-ledger.tsv`) | **moves** | becomes the hub's conversation ledger, one JSON line per routing decision with the registry hash that produced it (routing-tree §1, §3). `hub log [--since] [--kind]` reads it; `agents.sh relays` calls that |
| the dispatch ledger (`dispatches.jsonl`, Agent-tool spawns) | **stays until H4, then merges** | it records roster spawns through the Agent tool and reads agent types (tools-folder §7 row E). Spawns the server makes are hub ledger rows from H1b on; when H4 removes the Agent-tool path, `agents.sh dispatches` becomes a view over `hub log --kind spawn` and the file retires. Tools-folder §7's "the ledger stays until hub" is confirmed, with the date fixed at H4 |
| `agent-watch.sh` (stale alerts) | **stays until H4**; its function for server-owned processes is the server's | per-role last-seen is server state (group-servers §3.4): the server reports a role process that dies or goes silent as `failed`/`stale` in `hub status` and as a `report` envelope to the sender. The hook keeps watching Agent-tool spawns until H4; interim `stale-spawn` retires then |
| `quote-words.sh` | **stays** | it is policy over roster spawns (row B). On a server spawn the same fact (Jacob's words, human-origin only) arrives through the envelope: the origin stamp that classifies a turn `jacob` already reads that prompt, so the server attaches it as `origin_text` on `origin: jacob` envelopes and the cold role's prompt carries it. One transcript reader, `hub origin`, serves both; `quote-words.sh` calls it for the text instead of keeping its own jq (Decision 5) |
| `dispatch-guard.sh`, `grant`, the manifest, `gen`, `check`, `doctor`, `wiring` | **stay** | the roster and the policy over it (tools-folder §7). The guard gains two facts from the hub: `hub status --json` says whether the server is up (§3), and a model's Bash call to `hub routes accept` is blocked the way `agents.sh grant` is |

Two things harness renders into hub data rather than the hub reading them: the
registry (§2) and the role hooks' install declarations (fixed point 5). Both carry the
rendering's source hash so `agents.sh check` can say "stale" the way it does for agent
definitions.

→ Built across H1a (relay, gates, ledger), H1b (origin text, spawns), H4 (the two
"until H4" rows).

## 2. The registry file

**One committed file per node, `hub.json` at the repo root,** plus three keys in the
gitignored `.claude/local.env` (portable-env §3.1): `HUB_PORT`, `HUB_TOKEN`,
`HUB_PARENT_URL` (empty at a root). Machine facts in `local.env`, node facts in
`hub.json`; nothing in `hub.json` names a machine, an owner or an account.

```json
{ "hub": 1,
  "node": "claudeTest",
  "roles": {
    "planner":    { "mode": "window",  "agent": "planner" },
    "dispatcher": { "mode": "window",  "agent": "dispatcher", "fallback": true },
    "site-scrapers": { "mode": "cold", "agent": "site-scrapers", "dir": "site-scrapers",
                       "tools": ["Read","Edit","Write","Bash","Grep","Glob"] },
    "operator":   { "mode": "cold",    "agent": "operator" }
  },
  "tags": {
    "dispatch": "dispatcher", "dispatch-malformed": "dispatcher",
    "question": { "dispatch": "dispatcher", "plan": "planner" },
    "task": null, "report": "@from", "bug-report": "@owner"
  },
  "children": [ { "name": "site-scrapers", "path": "site-scrapers" } ],
  "parent": null,
  "limits": { "hops": 8, "budget_per_conversation": 10, "pingpong_hold": 4,
              "warm_context_restart": 120000 },
  "sync": [], "classes": {},
  "rendered_from": { "source": ".claude/agents.manifest.json", "hash": "sha256:…" }
}
```

- **`roles`.** Name, `mode` (`window` | `cold` | `warm`, §4), the `--agent` name the
  server passes, the `dir` it runs in (relative to the node root; default the root),
  and the allowlisted tools the server passes with `--allowedTools`. `fallback: true`
  marks the node's dispatcher (routing-tree §3 rule 4). `window` is this plan's one
  addition to routing-tree §5: a role Jacob talks to, which the server never spawns and
  reaches through the inbox socket that `/sessions` recorded.
- **`tags`.** Tag → role, or tag → child name, or one of two reserved targets: `@from`
  (back to the sender, for `report`) and `@owner` (the node whose path the `ref` names,
  for `bug-report`; unresolvable → dead-letter with notice, routing-tree §9). A `null`
  value declares the tag without a route, which the vocabulary gate (§8) rejects at a
  node that has no child advertising it. A nested object routes by the envelope's
  `kind` (the three question kinds, question-routing §2).
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
| with harness (today: the top level) | `agents.sh gen` | roles from agents that have a `dir` plus the two windows; `tags` from the manifest's routes and `questions.types`; `children` from agents whose `dir` is a git repo; `rendered_from` stamped. One more rendered file beside `.claude/agents/*.md`; the same read-only, same staleness check |
| without harness (a tool repo, a cloned repo, the conformance fixture) | `hub init` once, then by hand | writes a starter: `dispatcher` (window, fallback) and `coder` (cold, `--agent` unset so the default agent runs), empty tags, no children, `parent` from `setup`'s argument |

**The gate that it matches the manifest where both exist** is split across the seam,
each side checking what it can read:

- `hub check` (hub side, no roster): `hub.json` validates against `hub.schema.json`;
  every role's `dir` exists and is inside the node; every tag resolves (§8 vocabulary
  gate); `rendered_from.source`, if present, is a path that exists; `local.env` holds
  the three keys and no key or value shaped like a credential (portable-env §5).
- `agents.sh check` (harness side): re-renders `hub.json` from the manifest and diffs;
  a difference is "stale, run `gen`", the same message as for a stale agent definition;
  `rendered_from.hash` equals the manifest's hash.
- `setup` refuses to write a starter where a manifest exists and prints the `gen`
  command instead, so the file never has two writers (Decision 4).

→ Built in H1a (schema, `hub init`, `hub check`), with the `gen` rendering as a
`harness` job in the same phase.

## 3. The first node

**`hub up` at the top level, day one.**

1. Reads `hub.json` and `local.env`; refuses with one line if either is missing or
   invalid (`hub check` runs first).
2. Binds `127.0.0.1:$HUB_PORT`; every request carries `Authorization: Bearer $HUB_TOKEN`
   or is refused. Writes `.hub/server.json` (pid, port, started, registry hash).
3. Loads state: held messages, dead-letter, the ledger tail, recorded sessions.
4. Starts nothing else: all roles at the first node are `window` or `cold`, and cold
   roles start per message. Prints one line: `claudeTest up :47100, 0 queued, 0 held, 0 dead-letter, parent: none`.

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
- **logs** the decision with the registry hash.

The hook prints one line to the planner on failure, and nothing on success. The
delivered text is the same text the relay delivers today, so the dispatcher's job is
unchanged (auto-relay §4).

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

**H1b, still phase 1: the first server spawn.** The dispatcher sends `hub send --to
claudeTest/site-scrapers --tag task --ref "PLAN-x.md §n" "brief"`. The server starts
the cold role (§4) in `site-scrapers/`, pipes the brief and `origin_text`, reads the
stream to its `result` line, and sends a `report` envelope back to `@from`. The
dispatcher's Agent-tool path stays available as the fallback until H4. Both paths
record a ledger row, so `agents.sh dispatches` keeps answering the planner.

→ H1a and H1b.

## 4. Roles and modes

Cold by default (routing-tree §11 decision 2). Three modes:

| mode | what the server does | state the view sees (§11) |
|---|---|---|
| `window` | never spawns; delivers to the recorded inbox socket; learns busy/idle from `claude agents --json`: `kind` is "`interactive` or `background`" and `pid`, `status` are present "While the process is alive" as "Process ID and one of `busy`, `waiting`, or `idle`" (<https://code.claude.com/docs/en/agent-view#list-sessions-as-json>), joined on `sessionId` ("the full session UUID", same anchor) with `/sessions` | green busy, yellow idle or waiting, red no session |
| `cold` | per message: `claude -p --agent <role> --permission-mode dontAsk --allowedTools <list> --permission-prompts none --output-format stream-json --verbose --max-budget-usd <cap>` in the role's `dir`, brief on stdin; parses the stream and takes the final `result` line as the report: "The last line of the stream is a `result` message with the final response text, cost, and session metadata" (<https://code.claude.com/docs/en/headless#stream-responses>). `dontAsk`: "If you set `dontAsk` mode, Claude Code auto-denies every tool call that would otherwise prompt you" and "It also denies the built-in `AskUserQuestion` tool even if your allow rules match it" (<https://code.claude.com/docs/en/permission-modes#allow-only-pre-approved-tools-with-dontask-mode>). `--permission-prompts none`: "Pass `--permission-prompts none` when nobody is available to answer permission prompts" and "Claude is told that nobody can approve the request and not to retry it" (<https://code.claude.com/docs/en/headless#turn-off-permission-prompts-in-unattended-runs>). No approval through auto mode, by construction (fixed point 8). A role's final report can be forced to a shape: "To get output conforming to a specific schema, use `--output-format json` with `--json-schema` and a JSON Schema definition" (<https://code.claude.com/docs/en/headless#get-structured-output>); the `report` envelope's `body` is that object's one summary line. `--max-budget-usd`: "Maximum dollar amount to spend on API calls before stopping (print mode only)" (<https://code.claude.com/docs/en/cli-reference#cli-flags>). Stopping a cold role is SIGINT to end the turn, then SIGTERM: "If you stop a `claude -p` run with SIGTERM, for example with `kill` or from a process supervisor, Claude Code exits with code 143" and "Claude Code then runs `SessionEnd` hooks and exits" (<https://code.claude.com/docs/en/headless#stop-a-run-with-sigterm>) | green while the process runs; red otherwise (a cold role between messages is not spawned) |
| `warm` | a role kept alive between messages. Two mechanisms, chosen by the probe below (Decision 3) | green busy, yellow idle, red not started |

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

→ H1a (`status --json`, `/health`), H3 (`--tree`), V2 (`hub cron`).

## 8. Gates, in the same change as each part

Each gate names the phase that must land it. "Fixture" means a temp git repo made by
the test, never claudeTest or any repo of ours.

| gate | proves | phase |
|---|---|---|
| **help == implemented** | `hub --help` lists exactly the subcommands the dispatcher implements, both ways; every endpoint in `docs/API.md` is served and every served route is documented (the server exports its route table; the test diffs) | H1a |
| **vocabulary** | every tag in `hub.json` resolves to a role, a child, `@from` or `@owner`; every route's tag is declared; at a node with children, a `null` tag is advertised by at least one child | H1a, H3 |
| **determinism** | 100 fixture envelopes routed twice against the same registry give identical decisions; a ledger row replays to the same decision | H1a |
| **kill the server** | with the server killed mid-run: `hub hook planner-stop` relays direct and prints the notice; `dispatch-guard.sh` lets a roster spawn through; `hub hook session-start` writes the state file; the dispatcher's question gate still blocks once | H1a |
| **origin** | a forged `origin: jacob` is overwritten to `model`; a `jacob` envelope carries `origin_text`; an irreversible tag from `origin: model` never spawns | H1a |
| **admission** | identical → dropped; invalid → dead-letter with notice; budget + 1 → held; a Jacob prompt releases the held message and it is delivered once, never pasted | H1a |
| **conformance** | a fixture repo set up from its path alone (`setup`, then `hub up`) receives a `task`, spawns a cold role, and returns a `report`; with `HUB_PARENT_URL` set, it registers and its tags route from the parent | H1b, H3 |
| **direction audit** | nothing under `tools/hub/` reads `.claude/`, names a roster agent, or imports from `.claude/lib`; the view included (tools-folder §1) | H1a, every phase |
| **no names in the program** | no repo name, path or command in `tools/hub/` source; they live in `hub.json` (group-servers §1a) | H1a |
| **per-branch report** | when N spawns or N deliveries run together, the result names each one's outcome (`Promise.allSettled`), tested with a fixture where two of three fail on different steps | H1b |
| **lease** | two `task` envelopes to one repo's cold role run one after the other, never together; the second's `report` says it queued | H2 |
| **loops** | a fixture ping-pong (A → B → A …) is held at `pingpong_hold`; a hop-limit message dead-letters; both notify | H2 |
| **claims** | a `report` from A naming B's path arrives at B as `bug-report` and B's `report` closes the conversation; the top dispatcher's inbox receives neither; a claim with no owner dead-letters with notice | H2 |
| **hierarchy** | a parent stores no grandchild (the children dir holds only direct children after a three-level fixture); a de-registered child's tags route to the parent's dispatcher with notice | H3 |
| **dispatcher can't act** | an Edit, Write or non-`hub` Bash call from the dispatcher is blocked (harness's guard, tested against the restricted manifest) | H4 |
| **warm probe** | the three-clause probe in §4, per mechanism; a role may be `warm` only with a `measured` date | H0, H5 |
| **sync** | every declared source exists; every target holds its artifacts; an edit inside a block is caught; an undeclared override fails; a child cannot redefine a parent's tag; a root with no children says so | S1–S3 |
| **registry** | schema valid; `agents.sh check` re-renders and diffs where a manifest exists; `setup` refuses to write a starter beside a manifest | H1a |
| **view contract** | the view consumes only endpoints in `docs/API.md` (a static scan of the client source); the agent panel's three states are driven by fixtures (`/agents` says busy/idle/absent and the rendered page shows green/yellow/red); a toggled switch changes the feed; a pinned block changes when its source changes; the view never writes outside `hub-view.json` | V1–V3 |
| **fails open, every hook** | each installed hook copy exits 0 on malformed input and on a dead server; tested, not promised | H1a |

→ Each row lands with its phase; a phase with a row missing is not done.

## 9. Phases with token costs

Order: every step leaves the system working; interim rules retire as their replacements
land (interim-rules §5 phase 4: "no interim rule outlives its replacement by more than
one harness job"). Each phase is one `deep-work` job unless marked. Costs are in tokens
with the 29k unit; the ranges are wide because the server is new code and the probes
may fail once.

| # | phase | contents | retires | cost |
|---|---|---|---|---|
| **H0** | probes | the §4 warm probe (W1 and W2); `hub send` from inside a cold `-p` role (Bash allowlisted); `dontAsk` honouring a roster definition's tools; `claude agents --json` listing an interactive `--agent planner` session with `sessionId`. Each probe is a script in `tools/hub/probes/` with its pass condition in the file, run by hand, result recorded in `TODO.md` | — | 60–120k (2–4u) |
| **H1a** | first node, windows | the program skeleton: `hub.json` schema, `hub init|check|up|down|status|send|routes|log|hook|origin|grammar`; `/health`, `/route`, `/sessions`, `/ledger`, `/dead-letter`, `/held`; the moved parser, gate, origin and ledger with their tests; the planner relay through the server; the dispatcher question gate through `hub hook`; the kill-the-server gates; `docs/API.md`. **Harness job in the same phase** (~1–2u): `gen` renders `hub.json`; the hook files become one-line callers; `dispatch-guard.sh` reads `hub status --json` | `relay-origin`, `question-kinds` (both `manifest:nodes` → the retire check becomes `file:hub.json`, a one-word addition to interim-rules §3's vocabulary) | 250–400k (9–14u) |
| **S1** | sync, files | `hub sync --check|--apply`, file mode, no server; the hook copies and the plan copy as declarations at the root; `tools/checks` `hooks-installed` reads it | the two `check-hooks.sh` after the same-verdict test | 120–180k (4–6u) |
| **H1b** | first spawn | cold roles: spawn, stream, `result` → `report`, `origin_text`, `--json-schema` report shape, the lease's first half (one spawn per `dir` at a time), per-branch report; `hub send --tag task` from the dispatcher; the guard blocks a direct roster spawn while the server is up | `stale-spawn` for server spawns (the hook stays for Agent-tool spawns until H4) | 200–300k (7–10u) |
| **V1** | the view, first cut | §11: `/agents`, `/folders`, `/events` (SSE); the hub-served sidebar page (agents panel with three states and switches, folders panel with three states and expand); the feed; `hub view` opening the host with the default layout (two tabs: planner, dispatcher); the view contract gates | — | 250–400k (9–14u) |
| **H2** | agent to agent | tags between folder agents, loop control (hold, hop limit), the write lease, `bug-report` routing of cross-repo claims, `routes --proposed` from the dispatcher's choices | `cross-repo-claims`, `one-writer`, `held-not-lost` (relay half) | 300–450k (10–16u) |
| **V2** | view, panels two and three | `hub cron --json` (needs `chron.py list --json`, cron-scheduler), the cron panel, settings (gear): add folder (runs `setup`, asks before `--github`), change node, tabs, icons; `hub-view.json` | — | 200–300k (7–10u) |
| **H3** | hierarchy | `/register`, heartbeat, advertisement, down-child routing, `hub up --tree`, `status --tree`, the standalone case, S3 (`vocab`, classes) and S4 (`--propose`); site-scrapers as the first child node. Roles inside a repo beyond `coder` stay gated on agent-groups (routing-tree §11 decision 4) | — | 250–350k (9–12u) |
| **S2** | sync, blocks | marked blocks in the nine CLAUDE.md copies: one dispatch per owner, each ~0.5–1u, through the dispatcher | the three `dev.sh sync`, `test_doc_claims.py`'s rule half, `cmd_plan`'s copy half, after the same-verdict test | 9 × 15–30k (5–9u total) |
| **V3** | view, pinned blocks and polish | top and bottom pinned blocks from sources (file, endpoint, text), per-status icon overrides, click-to-attach on an agent (`claude attach <id>` in a tab), folder expand to a child node's agents via that child's `/agents` | — | 120–200k (4–7u) |
| **H4** | relegate the dispatcher | restrict its tools to Read, Grep, `hub send`, `SendMessage`; the `operator` role; the dispatch ledger and `agent-watch` merge into `hub log`; `quote-words` reads `hub origin`; window-to-window `SendMessage` goes through `hub send`. **Dispatcher job**: rewrite "How work is split here" after Jacob approves the text | `held-not-lost` (cap half), `stale-spawn`, `report-shape` once roles exist | 150–250k (5–9u) + the dispatcher's edit |
| **H5** | warm roles | the chosen mechanism from H0, restart at threshold, `measured` dates per role from seven days of `tokens --agents` | — | 100–150k (3–5u) + measurement |

Total, excluding measurement and the dispatcher's prose: roughly 2.0–3.1M tokens
(70–105u). Order of dispatch: H0 → H1a (+ harness) → S1 → H1b → V1 → H2 → V2 → H3 →
S2 → V3 → H4 → H5. V1 sits before H2 because it needs only H1a's server and `claude
agents --json`, and Jacob's 2026-10-04 message puts the view's value in the present
(Decision 8).

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
  (group-servers §1) stays the source of truth; the hub runs it when a `test-request`
  tag asks, and reads the result.

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
   implemented" (CLI and HTTP), landed in H1a and run by `hub check` thereafter.
2. **Every declared tag has a route and every route a tag**: §8 "vocabulary", H1a and
   H3.
3. **A kill-the-server test**: §8 "kill the server" and "fails open, every hook", H1a.
4. **A conformance fixture that is not claudeTest**: §8 "conformance", H1b and H3.

Plus the direction audit (every phase), the per-branch report (H1b), and the view
contract (V1–V3). `./dev.sh check` in this repo runs `hub check` on the fixture, the
unit suite, the direction audit, the no-names audit and `checks run .` once
`tools/checks` exists; until the first phase lands it stays the failing stub, and its
first real content is the inputs check `TODO.md` already describes (SHA256SUMS, the
brief's §2 list, the README table).

## Phases

§9 is the phase table with costs. Dispatch order and the interim rules each phase
retires are there. Each phase is one `deep-work` job in this repo except: the harness
half of H1a (`gen` renders `hub.json`, hooks become callers, the guard reads status),
the cron-scheduler half of V2 (`chron.py list --json`), the dispatcher's prose in H4,
and S2's nine per-owner dispatches.

## Setup component

Required by PLAN-repo-setup.md §1. `setup`'s `server` component (repo-setup §2,
left to harness by tools-folder §4 step 1) becomes the **`hub` component**, portable,
owned by `tools/setup`:

| step | what it installs | idempotent check |
|---|---|---|
| `hub.json` | `hub init` starter (dispatcher window + coder cold, empty tags, `parent` from the invoking node) **unless** `.claude/agents.manifest.json` exists, in which case it prints `needs harness: ./.claude/agents.sh gen` and writes nothing | file present and schema-valid → `unchanged`; present and invalid → `drift` |
| `local.env` keys | `HUB_PORT` (a free port), `HUB_TOKEN` (generated), `HUB_PARENT_URL` (the invoking node's URL, or empty) through portable-env's loader; declared in `local.vars.json` | keys present → `unchanged`; never printed |
| `.gitignore` | `.hub/`, `hub-view.json`, `.claude/local.env` | lines present → `unchanged` |
| registration | `hub register` with the parent, when `HUB_PARENT_URL` is set and the parent is up; otherwise prints `register later: hub register` | registered → `unchanged` |
| hooks | the hub's role hooks (`planner-stop`, `dispatcher-stop`, `session-start`, `notification`) through the existing `hooks` component, from declarations `applies_to: roles:<list>`, into `settings.proposed.json`; never into `settings.json` | the `hooks` component's own check |
| view | nothing per repo; `hub-view.json` is per machine and written by the gear | — |

`init.sh` runs `hub up --tree` as its last step before `agents.sh check`. The
conformance fixture (§8) is exactly "`setup` on an empty git repo, then `hub up`", so
the component is tested by the hub's own gate.

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
  reads `hub status --json`, `quote-words.sh` reads `hub origin` (H1a, H4);
  `tools/setup`: the `hub` component (Setup component) and `.gitignore` lines, which
  `TODO.md` already reports as missing; `tools/checks`: `rules-in-sync` and
  `hooks-installed` read `hub sync --check --json` after S1.
- **The output contract named a branch, `plan/hub`.** This session was directed to
  `claude/determined-edison-tx5h9v` and may not push elsewhere; the planner renames
  or merges. Nothing else in the repo was changed, per the brief.

## Decisions

| # | decision (§n pointer first) | hinges on | recommend |
|---|---|---|---|
| 1 | §11.4: the terminal host for the view: A (Wave Terminal, no fork, hub-served panels in web blocks), B (a Tabby plugin), or C (tmux layout only) | whether the request's icons, switches and spin need a DOM, and whether Wave's `widgets.json`/`wsh` work as its docs source says on Jacob's machine (probe) | A, with C as the fallback that ships in every case |
| 2 | §11.2: the on/off switch controls an agent's membership in the feed block, not whether its tab exists | what Jacob meant by "what I am seeing in the single terminal view" | yes |
| 3 | §4: warm mechanism W1 (`claude --bg --agent`, supervised by Claude Code, addressed by inbox socket) over W2 (the server owns a stdin stream-json pipe) | both passing H0's three-clause probe | W1 |
| 4 | §2: at a node with harness, `agents.sh gen` renders `hub.json` and `setup` refuses to write a starter there | accepting one more rendered file in harness, and a `harness` job inside H1a | yes |
| 5 | §1: the server attaches Jacob's prompt text as `origin_text` on `origin: jacob` envelopes and cold roles receive it; `quote-words.sh` reads `hub origin` instead of its own jq | whether the quote on roster spawns may come from the envelope rather than the Agent-tool prompt | yes |
| 6 | §5: `hops` 8, heartbeat 30 s with two misses to `down`, `budget_per_conversation` 10, `pingpong_hold` 4 | none of these has evidence yet; they are starting values the ledger will correct | yes, as starting values |
| 7 | §7: `chron.py` reads its server list from `hub status --json --tree` instead of the manifest (changes group-servers decision 4's data source, not its owner) | whether cron-scheduler takes the change in its next job | yes |
| 8 | §9: V1 is dispatched right after H1b, before H2 | whether seeing the agents and folders now outranks agent-to-agent routing | yes |
| 9 | §11.1: the view lives in `tools/hub/view/`, same repo and CLI (`hub view`), not a separate `tools/hub-view/` | keeping the API and its only client in one commit against the cost of a larger repo | yes |
| 10 | §3: H1b (the server spawns cold roles for `task` from the dispatcher) stays in phase 1 rather than moving to H2 | whether one phase may both relay and spawn; the fallback path stays either way | yes |
| 11 | §11.2: red in the agents panel means "in `hub.json`, not spawned", where Jacob said "in the manifest.json"; `hub.json` is rendered from the manifest so the set is the same, and the view never opens the manifest | the fixed point that the hub reads no roster | yes |
| 12 | §11.2: the gear's "add folder" runs `setup <path>` and asks before `--github`; "change directory" switches the node the view talks to | whether settings may run `setup` from the view | yes |
| 13 | §4: role hooks install through `setup hooks` into settings proposals rather than agent frontmatter, because frontmatter hooks need an interactive trust grant that `-p` roles never give | whether Jacob prefers trusting each role folder once by hand | settings via `setup hooks` |
| 14 | §9: the total, 2.0–3.1M tokens over twelve jobs, is acceptable as the hub's price before H5's savings can be measured | the cloud credit balance and the order in §9 | yes, in the order given |
