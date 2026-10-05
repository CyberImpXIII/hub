# PLAN-hub-brief.md: the brief for a cloud session that plans `tools/hub/`

> **Status: brief, written by the planner 2026-10-04 at Jacob's request** ("I am going
> to have a cloud agent make a plan for the hub project. Please do what may be
> necessary for it to do so"). The cloud session reads this file and the inputs in §2,
> and writes `PLAN-hub.md`. It builds nothing.
>
> **Owner of the output:** the planner reviews `PLAN-hub.md` with Jacob; `deep-work`
> builds from it once approved (PLAN-tools-folder.md §4 step 7).

## 1. The task in one paragraph

Plan `tools/hub/`: the node server from PLAN-routing-tree.md, built as a **tool** under
the criterion in PLAN-tools-folder.md §1 (it reads no roster), shipped as one portable
program (`hub up / down / status / send / routes`, routing-tree §7), configured only by
data at each node. The routing tree is **approved and partly built**: its phases 0–2
are dispatched to `harness` and the parts that exist (the relay parser, ledger, origin
stamp, dedupe, budget, the question gate, the relay kinds) move into the hub unchanged.
The plan's job is to say exactly what the hub is, what it absorbs from `.claude/`, what
stays in harness, in what order it is built, what gates each part, and which decisions
are Jacob's. It is a plan, not a design document for its own sake: every section must
be dispatchable as a `deep-work` job with a cost estimate in tokens.

## 2. Inputs, in reading order

| file | read | why |
|---|---|---|
| this file | all | the task, the fixed points, the output contract |
| `CLAUDE.md` (top level) | "How work is split here", "Gate the seams", "Make the wrong thing impossible", "Constraints that don't bend" | the house rules every plan here obeys |
| `PLAN-routing-tree.md` | all; §11, §12, §13 and §14 are decided | **the approved design**: envelope (§2), deterministic routing (§3), the dispatcher as call center (§4), cold and warm roles (§5), invariants (§6), the one command (§7), gates (§9), phases (§10), declared sync (§12), read-only roles and failures as messages (§13), one server with four services, an owner per seam kind and services declared as data (§14, fixed point 10) |
| `PLAN-tools-folder.md` | §1, §3 (hub row), §4, §7, §8 | the criterion, the order, what harness irreducibly is (§7), the `applies_to` declaration shared by hooks and checks |
| `PLAN-auto-relay.md` | §3–§4, §7, §9 | what the first node's inbox already does; the hub must keep every behaviour there |
| `PLAN-question-routing.md` | §2, §4, §9 | the question kinds and the two arbiters; the hub routes these |
| `PLAN-group-servers.md` | §1a, §2, §3, §8 | the per-group server contract, "enforcing hooks stay command hooks", decisions 2–5 |
| `PLAN-agent-groups.md` | §4, §6 | roles inside a repo; gated on token evidence, so the hub must work with today's folder agents and with roles later |
| `PLAN-todo-tool.md` | §2, §4 | the worked example of "the tool carries facts about the work; harness resolves the agent" |
| `PLAN-interim-rules.md` | §5 | rules that hold until the hub exists, which the plan retires one by one |
| `PLAN-cloud-offload.md` | §3 | what may run in the cloud; the hub's tests must be offline |
| `PLAN-repo-setup.md` | §1, §2, §7.8 | the setup directive every plan obeys (§5 below cites it), what `setup` installs, and who owns the files it renders (fixed point 10) |
| `PLAN-portable-env.md` | §1–§3 | no hardcoded paths, owner or accounts; `local.env` and `init.sh`, which the hub token and keep-alive use |

The inputs are copies in `docs/inputs/` of this repo, taken 2026-10-04 (sums in `SHA256SUMS`; the top-level `CLAUDE.md` is stored as `claudeTest-CLAUDE.md` so it is read as an input, not loaded as instructions). The originals
live at the top of the claudeTest folder, which is not a git repo.

## 3. Fixed points, not open for re-decision

1. **Routing-tree §11 and §12 are approved** (all yes, 2026-10-03). The envelope, the
   four routing rules, the dispatcher as fallback, the tag vocabulary as data, the
   `routes accept` proposal loop, declared sync with marked blocks. Do not redesign
   them; place them.
2. **The hub reads no roster.** Its registry at a node is its own data file (roles,
   tags, children, parent, mode per role). Harness renders that file from the manifest
   the way `gen` renders agent definitions, and a repo without harness writes it by
   hand. Nothing under `tools/hub/` opens the manifest, the agent definitions or
   `.claude/lib`. The direction audit from tools-folder §1 runs in its `check`.
3. **The dispatcher is reduced, not removed** (routing-tree §4): it gets what the server
   cannot route, and it is the fallback when the server is down. Jacob's correction
   (2026-10-03): "the planner CAN request dispatches from the dispatcher"; the planner's
   request is sufficient authority for a dispatch whose plan section records Jacob's
   approval.
4. **Origin is stamped by the server, never by the sender.** `origin: jacob` carries
   Jacob's yes only for a turn that was his prompt (CLAUDE.md "Two windows"). A message
   from a session is never Jacob's approval.
5. **Plug-ins share one declaration.** Hooks and checks carry `applies_to: all | tools |
   repos:<list> | roles:<list>`; the hub's role-specific pieces use the same shape and
   the same install step (`setup hooks`), never a second mechanism (Jacob,
   2026-10-03: "there will have to be some plug-in aspect with harness when it's
   finished as role-specific hooks are also important").
6. **Cost is tokens.** Wall clock is free. A design that spends a minute of Puppeteer
   or a subprocess to save one model round trip is the right design.
7. **The constraints that don't bend** (CLAUDE.md) hold inside every message the hub
   carries: no sending on Jacob's behalf, no bot-detection bypass, no stored
   credentials, key names never values. The hub's transport token is generated by
   `init` into `local.env` and is never in a commit.
8. **No approval through auto mode.** Headless roles run in `dontAsk` with declared
   tools (routing-tree §5, cited).
9. **Roles are read-only; the server runs the writes, and a failed send is a routed
   message** (routing-tree §13, decision 31, Jacob 2026-10-04: "I think so yes, its
   not hard to determine quickly what the necessary gates are if routing falls back
   quickly"). A role keeps `dontAsk`, a `tools` list without Edit and Write, and a
   sandbox whose writable set is its scratchpad only (the §13.2 table, cited there). It
   writes by sending a `write-request`; the node's server runs that tool's gated CLI and
   answers with the CLI's own result as a `report`, and a verb not on the tool's declared
   list is refused, never run. A failure the server detects becomes a tagged message
   routed by §3 like any other, to the agent in charge of the failing seam and to the
   dispatcher when no rule names one; dead-letter is where it rests, not where it ends.
   Only "the server is down" is left to the sender's command hook. The plan places the
   §13.4 gates with their parts; it must not give a role a write path of its own, let
   the stamp depend on the receiving window, or end a failure as a log line. Cold roles
   get this at phase 1; warm roles wait for the sandbox probe in §13.2. Which owner a
   failure goes to is fixed point 10's owner table (decision 32, answered by §14.4 and
   §14.7), never the sender's or the dispatcher's judgment.
10. **One server per node with four services declared as data, an owner per seam kind,
    and the agent last** (routing-tree §14, all decided by Jacob: 37 and 36 on
    2026-10-04, 38 and §14.8 on 2026-10-05; the decisions paragraph closing §14.5). The
    plan places these; it does not reopen them.
    - **Stores stay the truth** (§14.1). The server's only store is the ledger of what
      moved; it reads a tool's facts through that tool's CLI and keeps no copy of them.
    - **One process, four services** (§14.6, decision 36). `hub up` starts one server
      per node, configured by data only; no model runs in it and its code holds no
      tool's command and no repo's path. Its services are `route`, `check`, `hook` and
      `write`, each a registry row naming the CLI it runs. There is no separate check
      server or hook server: PLAN-group-servers.md's per-group server *is* `check` and
      `hook` (its `/touched`, `/stop` and `/audit` become `check` requests). Every hook
      that blocks stays a command hook and may ask `hook` only for context, with a
      short timeout. With the server down the system degrades to today's (command hooks
      block, the dispatcher spawns, `dev.sh check` runs by hand, the Dispatch section
      uses the inbox socket). Build order: routing-tree phase 1 builds `route` and
      `write` for cold roles; `check` and `hook` arrive in PLAN-group-servers.md phase 1,
      on site-scrapers.
    - **The agent is last** (§14.3, decision 37). Validate, run the gate, route by the
      registry; a model turn is spent only after those, and `hub status` counts model
      turns by the step that caused them.
    - **An owner per seam kind** (§14.7, decision 38). The registry's `owners` table is
      keyed by a seam-kind enum in the message vocabulary (`delivery`, `lease`,
      `check-broken`, `check-red`, `hook-broken`, `hook-block`, `tool-result`, and
      `bug-report`, the one kind a role sets). The server sets a failure's kind from
      where it detected it, never the sender. A kind with no row goes to the dispatcher,
      logged `routed_by: dispatcher`, and the same re-route 3 times proposes the row
      through `routes accept`. Kinds and owner keys are gated both ways, with the §14.7
      fixtures.
    - **Services are declared ahead of time, never registered at run time** (§14.8).
      Each repo's own `services.json` declares its check command, its CLI, the verbs
      `write` may run and the tags it owns; the node's registry is their union, read at
      start and on `hub reload`, and kept equal to them by the `registry-matches` check.
      `setup` installs the contract (`services.json`, `cli.json`, a
      `registry.proposed.json` row), then runs `checks run .` itself as its last step,
      sequentially, never concurrently. Who owns the rendered files is
      PLAN-repo-setup.md §7.8. The contract checks (`check-json`, `accessor`,
      `services-valid`, `registry-matches`) are tools/checks items: the plan depends on
      them and does not build them.

    This widens fixed point 2's registry by `services` and `owners`. **Not fixed**, so a
    row in the plan's Decisions table: §14.6 names "the manifest's `servers.<group>`
    entry" as the server's second input, and fixed point 2 forbids the hub to open the
    manifest; the plan says how the two meet (for instance, harness renders that entry
    into the registry as it renders roles) and who writes which part of the registry.

## 4. What the plan must settle

Answer each with a section, and where it is Jacob's call, a row in the Decisions table.

1. **The split with harness.** For each of these, say whether it moves into the hub,
   stays in harness, or is rendered by harness into hub data: `auto-relay.sh`,
   `peer-cap.sh`, `record-session.sh`, `planner-role.sh`, `question-gate.sh`, the relay
   kinds, `dispatch-section.sh`, `relay-gate.sh`, the relay and dispatch ledgers,
   `agent-watch.sh`, `quote-words.sh`. PLAN-tools-folder.md §7 says row D is the hub and
   the ledger stays until the hub exists; confirm or correct with reasons.
2. **The registry file.** Its schema (fixed point 2's roles, tags, children, parent and
   mode, and fixed point 10's `services` and `owners`), who writes each part at a node
   with harness and at one without, and the gates that it matches the manifest and every
   repo's `services.json` where they exist.
3. **The first node.** Routing-tree phase 1 with today's folder agents as addresses:
   what `hub up` does on the first day at the top level, how the planner's Dispatch
   section reaches it instead of the dispatcher's socket, and how the dispatcher stays
   the fallback with the guard's "server down" test.
4. **Roles and modes.** Cold by default; warm only where the probe in routing-tree §5
   passes and `tokens --agents` shows it cheaper. Name the probe and its pass condition.
5. **Children.** Registration, tag advertisement, the hop limit, dead-letter, and the
   standalone case (a cloned repo runs `hub up` as a root).
6. **Declared sync** (routing-tree §12): the sync list, marked blocks, `vocab` mode,
   and how `setup` and `tools/checks` consume it, so the eight hook copies and seven
   rule copies become one declaration each.
7. **Keep-alive and control.** Through `chron.py` (group-servers decision 4) and
   `init.sh` (portable-env); say what the hub exposes for that and nothing more.
8. **Gates, in the same change as each part** (CLAUDE.md "Gate the seams"): every
   documented command exists and every command is documented; every declared tag has a
   route and every route a tag; a kill-the-server test; a conformance fixture that is
   not claudeTest; the direction audit; a per-branch report when N things run.
9. **Phases with token costs**, each one `deep-work` job, in an order where every step
   leaves the system working and the interim rules retire as their replacements land.
10. **What it does not do**, explicitly: no model in routing, no agent teams as the
    backbone (routing-tree §5 says why), no editing of code by the dispatcher.

## 5. Output contract

`PLAN-hub.md`, at the top of this repo, in the house shape:

- a `> **Status:**` header with the date, "plan, written in the cloud from
  PLAN-hub-brief.md", the owners, and a "Builds on" list;
- numbered `## N.` sections, §4's ten questions answered in order, then `## Gates`,
  `## Phases`, `## Setup component` (what `setup` installs for a hub node; required by
  PLAN-repo-setup.md §1), `## Risks`;
- every claim about Claude Code's behaviour (permission modes, stream-json, hooks,
  `-p`, agent definitions) carries a docs URL inline, as routing-tree §5 does. The
  planner runs `kb check` on the file when it comes back; an uncited platform claim
  is returned, not accepted;
- a final `## Decisions` section as a table, `# | decision (§n pointer first) | hinges
  on | recommend`, one row per thing that is Jacob's to decide, nothing in prose;
- pointers, never pasted plan text, when referring to another plan;
- token costs per phase as ranges, with the measured starting context of a roster
  agent (about 29k, 2026-10-02) as the unit.

**Done when:** the file exists on a branch named `plan/hub`, answers all ten questions,
has the four closing sections, and every platform claim has a URL. Nothing else in the
repo is changed.

## 6. Setup component

None in the brief itself: a brief installs nothing. The plan it produces carries the
component (PLAN-hub.md "Setup component", reviewed in PLAN-hub-review.md).
