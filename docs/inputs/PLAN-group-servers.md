# Group servers: hooks, tests and audits run by a server per agent group

> **Status: plan, requested by Jacob 2026-10-02.** His words: "now that we know how to
> make hooks programatic and dispatch things without passing it around via agents. How
> would we go about implementing this for our current active hooks and for our audits
> and test suite. I think every group of proposed agents should have its own server."
>
> **Owners:**
> - `harness`: the server program, the manifest schema, `gen`, the doctor, and the
>   tests (`.claude/`).
> - `cron-scheduler`: server control in `chron.py` (§3.5).
> - Each folder's agent: its own `dev.sh check --json`, shared with
>   PLAN-agent-groups.md §4.4 and built once.
>
> **Builds on:**
> - TODO.md, Confirmed, "HTTP hooks are native".
> - PLAN-auto-relay.md §3 option A, the inbox socket.
> - PLAN-agent-groups.md §4.1 groups and §4.4 role reports.

## 1. What it does

- **Each group gets its own local HTTP server,** one per folder now and one per group
  once groups exist:
  - site-scrapers;
  - emailTools;
  - scripts;
  - data-bridge;
  - chronjobScheduler;
  - harness (`.claude/`).
- **Hook events reach that server directly** as `type: "http"` hooks. The server runs
  the group's tests and audits and answers in hook JSON. No model is involved until
  something is red, and then the model reads a few lines, not a suite's output.
- **One program, one config per group.** "Its own server" means its own process, port,
  state directory and config. It does not mean its own code. Six servers that differ
  only in data would be the near-duplicate that CLAUDE.md's "Don't duplicate procedure"
  forbids.
- **The server never reimplements a check.** It runs the repo's own
  `dev.sh check --json` (or the subset for a test file) and renders the role view from
  PLAN-agent-groups.md §4.4. The repo's command stays the source of truth, and it still
  works without the server: for Jacob, for cron, and for a fresh clone.

## 1a. A portable framework, not built per folder (Jacob, 2026-10-02)

site-scrapers is the pilot, not the design target. Nothing in the server program may
name site-scrapers, its commands or its paths.
- **The contract a group has to meet is all it needs:**
  1. a `dev.sh check --json` (and `test --json --file`) whose output validates against
     the one schema (PLAN-agent-groups.md §4.4);
  2. one `servers.<group>` entry in the manifest.

  `gen`, `chron.py` and the doctor pick up the rest.
- **Adopting it is a queued item per group** (TODO.md). The group's own agent builds
  item 1 whenever usage allows; nothing else changes.
- **Gate: a conformance test.** A fixture repo that isn't site-scrapers, with only a
  conforming `check --json` and a manifest entry, gets every endpoint working. If the
  pilot only works in site-scrapers, this test fails.
- **Gate: no group names in the program.** An audit fails if the server's code
  contains a group name, a repo path or a repo command. Those belong in the manifest.

## 1b. Setup component (directive in PLAN-repo-setup.md §1)

`agents.sh setup <repo>`'s `server` component adds the `servers.<group>` manifest
entry with a free port, and installs the `check` stub if it's missing. The repo is
served once its `check --json` stops failing as a stub. Nothing else is per-repo.

## 2. The constraint that shapes it: enforcing hooks stay command hooks

When a server is down, an HTTP hook allows everything. A failed connection or a
non-2xx response is a non-blocking error
(<https://code.claude.com/docs/en/hooks#http-response-handling>, "Connection failure:
non-blocking error, execution continues"). A guard that depends on a server is
therefore off whenever the server is down, which CLAUDE.md calls the worst state
available. So:

| hook | what it does | in this plan |
|---|---|---|
| `dispatch-guard.sh` | blocks | **stays a command hook** |
| `peer-cap.sh` | blocks | **stays a command hook** |
| `no-inline-blobs.sh` | blocks | **stays a command hook** |
| `prefer-recipes.sh` | blocks | **stays a command hook** |
| `troubleshooting.sh` | blocks; also prints the host's failure history | the block stays a command hook; the history moves to the site-scrapers server (§3.4) |
| `session-doctor.sh` | SessionStart report | stays a command hook, and gains "which servers are down" (§5) |
| `planner-role.sh` | SessionStart note | stays a command hook |
| `agent-watch.sh` | alerts on a silent agent | **moves**: per-agent last-seen state is what a server holds well |

**What "block" means, and how Jacob sees it (his concern, 2026-10-02).** A
`PreToolUse` deny is not a warning that the model chooses to follow. Claude Code
refuses to run the call, so the action does not happen. What the model does *next* is
not deterministic: it may try another route to the same thing. Advice
(`additionalContext`) is just text the model may ignore. So:
- **Where it matters, the record of what happened comes from the program, never from
  the model's account of it.** Every block, and every server verdict, goes to an
  append-only log. `agents.sh blocks` summarizes it for Jacob: what was blocked, in
  which agent, and the agent's next tool call. A model's report can say anything; the
  log says what happened.
- **A gate the model can get around is caught by the log, not trusted.** If an agent
  that was blocked then reaches the same target another way, that shows up in the log
  as a finding.

**So the existing hooks change little.** Most of the gain is new work that nothing
does today (§3): tests and audits that run on their own, and a red result that reaches
the right agent with no one carrying it there. This plan doesn't remove the six hook
copies. That needs a separate fix, and it isn't this one.

## 3. Mechanism

### 3.1 Where the hooks are registered: agent frontmatter, not settings.json
- **A subagent's own frontmatter can declare hooks.** "Claude Code runs them only while
  that subagent is running and removes them when it finishes," and a `Stop` hook there
  becomes `SubagentStop`
  (<https://code.claude.com/docs/en/hooks#hooks-in-skills-and-agents>).
- **`gen` renders each group's HTTP hooks into its agents' definitions,** from the
  manifest. The hooks then apply exactly when that group's agent runs. That gives:
  - no settings.json change, so no step for Jacob;
  - no copies in other repos;
  - scoping by agent, with no `agent_type` filtering inside the server.
- **Sessions started inside a repo, and fresh clones, don't get these hooks.** They
  fall back to running `dev.sh check` by hand, as they do now. That's acceptable: those
  hooks are advisory (§2).

### 3.2 Endpoints, the same for every group
| event (frontmatter) | endpoint | what the server does |
|---|---|---|
| `PostToolUse` on `Edit\|Write` | `/touched` | Records the file and starts that file's tests in the background. Answers at once with an empty body (allow). |
| `PostToolUse` (any) | `/touched` | If a background run finished red since the last call, returns `additionalContext` with the code view: failing assertions with file:line, at most 1,500 chars. Otherwise an empty body. |
| `SubagentStop` | `/stop` | Runs the full `dev.sh check --json`, synchronously (wall clock isn't a cost). Red: `{"decision":"block","reason":<code view>}`, so the agent keeps working instead of reporting done. Green: an empty body. |
| cron, via chronjobScheduler | `/audit` | Runs the scheduled audit, writes the report file, and notifies only when the result changes (§3.3). |

- **Two ways the server answers, both deterministic:**
  - **Await:** the hook holds the agent until the server responds; an HTTP hook waits
    up to its `timeout`, 600 s by default
    (<https://code.claude.com/docs/en/hooks#common-fields>). `/stop` works this way:
    the agent can't finish until the check has run and the verdict is recorded.
  - **Silent until the next event:** the server answers at once with an empty body,
    works in the background, and delivers on the next hook call. `/touched` works this
    way.
- **The verdict travels from the server, not through the agent.** `/stop` writes the
  verdict to the log and the report file. A red verdict goes to the dispatcher
  (§3.3), whatever the agent's report says.
- **Send it back to fix, at most `stop_gate.max_blocks` times** (1 suggested; Jacob's
  decision 3), guarded on `stop_hook_active`. Continuing costs fewer tokens than a
  fresh dispatch, which starts at about 29k. After the cap, the agent stops and the
  server's red verdict stands.
- **This enforces the CLAUDE.md rule "A claim is earned, never asserted."** "Done" is
  the server's verdict, not the agent's word.

### 3.3 Dispatching without an agent carrying it
- **A result that changes from green to red** (from cron or `/stop`) produces one line
  for the dispatcher, through the inbox socket that PLAN-auto-relay.md §3 option A
  sets up: `site-scrapers-tests: 2 failing in test/x.test.js`. That line is the
  dispatcher row of §4.4's table.
- **This reuses the relay's socket code and its probe.** It doesn't build a second
  sender. Until that probe passes, the line goes to the group's report file and to
  `agents.sh doctor`.
- **Only changes are sent,** never "still red," and duplicates are dropped by hash, as
  in the relay. Each line sent costs a dispatcher turn; a green result costs nothing.

### 3.4 What moves out of the existing hooks
- **agent-watch:** its last-seen state moves into the server that owns the agent's
  group. The alert itself stays as it is.
- **troubleshooting:** the site-scrapers server's `/history?host=` produces the failure
  history. The command hook calls it, and if the server is down, the hook still blocks
  and only the history is missing.

### 3.5 Running the servers
- **Server control goes in `chron.py`, the tool that already manages scheduled jobs**
  (Jacob, 2026-10-02). It gets a servers menu: status, start, stop, restart, logs, and
  keep-alive across reboots. Owner: `cron-scheduler`. The keep-alive mechanism is its
  call: a launchd agent with `KeepAlive`, or a cron `@reboot` entry plus a watchdog.
- **`chron.py` reads its server list from the manifest.** It never keeps its own copy.
  Gate: the servers in `chron.py status` match the manifest, in both directions.
- **Each server binds to 127.0.0.1 only,** on a port from the manifest.
- **The program:** one Node file, standard library only (`node:http`). harness picks
  the details.

## 4. Manifest shape (harness finalizes it)

```json
"servers": {
  "defaults": { "stop_gate": { "max_blocks": 1 }, "context_cap_chars": 1500 },
  "site-scrapers": { "port": 47101, "dir": "site-scrapers", "check": "./dev.sh check --json",
                     "test_for": "./dev.sh test --json --file", "audit": "./dev.sh audit --json",
                     "audit_cron": "0 6 * * *" }
}
```

## 5. Gates (in the same change)

- **No enforcing hook is HTTP.** `check` fails if a hook in the blocking list is
  registered with any type other than `command`. This turns §2 from a sentence into a
  check.
- **Manifest == rendered output:** each group's frontmatter hooks, a unique port,
  and `chron.py`'s server list. Uses `check`'s existing staleness pattern.
- **Up, or loudly down.** `session-doctor.sh` and `agents.sh doctor` hit `/health` on
  every server and name any that are down. A down server is never silent.
  `session-doctor` has to be a command hook because it is the thing reporting the
  servers.
- **Fails open, tested.** With a server stopped, an agent's tool call goes through,
  and the doctor reports the server.
- **The input changes the output.** A fixture repo whose check is red gets a block from
  `/stop`; green gets an empty body; a red background run surfaces at the next
  `/touched`. Every response validates against the hook output schema for its event.
- **Bounded.** No response's `additionalContext` exceeds the cap. A suite with 200
  failures still yields at most 1,500 chars, ending with the count.
- **No reimplementation.** An audit confirms that the server runs only the commands
  the manifest names.

## 6. Phases

0. **Prerequisite, shared with agent-groups:** the pilot repo's `dev.sh check --json`
   and `test --json --file`. Owner: the site-scrapers agent.
1. **harness:**
   - the server program, the manifest block, and `gen` for frontmatter hooks;
   - the block log and `agents.sh blocks` (§2);
   - the doctor check and the §5 tests;
   - **`cron-scheduler`, in the same phase:** the servers menu in `chron.py` (§3.5).
   - piloted on site-scrapers, with `/touched` and `/stop` only.
2. **Measure:** `tokens --agents --since <pilot date>` for site-scrapers dispatches,
   against before. Expected saving: agents stop typing check chains and stop reading
   full suite output. Expected cost: extra turns when `/stop` blocks. **Keep it only if
   the numbers say it helped,** by the usual rule.
3. **Queued, one item per group** (TODO.md): each group meets the §1a contract when
   usage allows. Cron `/audit` is enabled for a group once its contract is met.
4. **Notify the dispatcher of red** (§3.3), once the auto-relay socket probe passes.
5. **Move what §3.4 lists.**

## 7. Risks

- **Cloud sessions have no local servers.** In a `claude --cloud` run
  (PLAN-cloud-offload.md), every frontmatter HTTP hook fails to connect. That's
  harmless, since it's a non-blocking error, but the gates are absent and the errors
  are noisy. Fix: `gen` skips these hooks when `$CLAUDE_CODE_REMOTE` is `"true"`. Only
  if frontmatter allows a condition; *probe*. Otherwise accept it, and say so in the
  cloud plan.
- **The `/stop` block costs turns.** Each block is another round for the agent. The cap
  bounds it, and phase 2 measures it.
- **Local trust.** Any local process can POST to 127.0.0.1. The servers only run
  manifest commands and send one-line notices. They have no write endpoint that takes
  arbitrary input. Socket messages "assert no permission class" (auto-relay §3), so a
  spoofed notice is a nuisance, not a privilege.

## 8. Decisions for Jacob

1. **Priority: #3.** *Decided 2026-10-02.* It ships through setup
   (PLAN-repo-setup.md §6 decision 1 proposes the order within #3).
2. **Enforcing hooks stay command hooks** (§2). *Agreed 2026-10-02, with the concern
   that a block's effect on the model is invisible.* §2 answers that with the block log
   and `agents.sh blocks`.
3. **At finish, the server awaits the check and its verdict stands. A red verdict sends
   the agent back to fix it once** (`stop_gate.max_blocks` = 1). *Decided 2026-10-02.*
4. **Server control lives in `chron.py`.** *Decided 2026-10-02* (§3.5).
5. **Pilot on site-scrapers, built as a portable framework.** The other groups are
   queued and adopt it as usage allows (§1a). *Decided 2026-10-02.*
