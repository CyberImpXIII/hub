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
| `PLAN-routing-tree.md` | all; §11-§16, §18, §19 and §21 are decided; §17 is pending dt-5 row 4, §20 is pending dt-5 row 5, and §22-§23 are pending dt-5 rows 7-9 (none of them the plan's to settle) | **the approved design**: envelope (§2), deterministic routing (§3), the dispatcher as call center (§4), cold and warm roles (§5), invariants (§6), the one command (§7), gates (§9), phases (§10), declared sync (§12), read-only roles and failures as messages (§13), one server with four services, an owner per seam kind and services declared as data (§14, fixed point 10), the roster settings page: each agent's model and effort, changed only through `agents.sh set`, with its four gates (§15, Jacob 2026-10-19; owner hub; question 15), Fable 5.1 at max where the account allows it (§16), read and run dispatches sharing a folder, and fan-out (§17, pending dt-5 row 4), the audit agent (§18), replies as records, with the hub's inbox view (§19; question 16), warm roles: the agent that owns the knowledge, visible and addressable (§20, pending dt-5 row 5; its step 4 is the hub's), the objective every view and reply is measured against (§21, fixed point 11; its improvement rows 1-6 are pending dt-5 row 6) |
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
| `PLAN-context-hygiene.md` | §0 | the launcher that restarts a whole session, its rebuild guards, its Later paragraph (a session a program runs) and the `ctx:` store: question 11, and the `ctx:` ids of question 12 (routing-tree §10.3 step 1, added 2026-10-19) |
| `PLAN-services.md` | §1; §3, its three store rules (next column); §4 step 10 | the architecture rules the hub serves, each a §3 subsection: every record has an id and tags, and enters context as its id (question 12); every data store is gated and read-only, written only through its owner's CLI (the write gate H1a-0 builds); every store is static or dynamic, with references by id through the owner (ST1-ST5; the `ctx:` store) (routing-tree §10.3 step 1, added 2026-10-19) |

The inputs are copies in `docs/inputs/` of this repo, taken 2026-10-04; `PLAN-routing-tree.md` and this file were re-copied 2026-10-19 for §15, and again the same day for §16-§23, questions 15-16 and fixed point 11; every copy was refreshed 2026-10-19 (later) and `PLAN-context-hygiene.md` and `PLAN-services.md` became inputs (routing-tree §10.3 step 1; the second once the leak audit passed on its original, the same evening) (sums in `SHA256SUMS`; the top-level `CLAUDE.md` is stored as `claudeTest-CLAUDE.md` so it is read as an input, not loaded as instructions). The originals
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
      per node, configured by one data file, the registry; no model runs in it and its
      code holds no tool's command and no repo's path. Its services are `route`,
      `check`, `hook` and `write`, each a registry row naming the CLI it runs. There is no separate check
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

    This widens fixed point 2's registry by `services`, `owners` and the server's own
    port and keep-alive. The registry is the server's one input (§14.6, settled by the
    planner 2026-10-05): harness's `gen` renders the manifest's `servers.<group>` entry
    into it as it renders roles, so fixed point 2 stands and the hub never opens the
    manifest. The plan says who writes which part of the registry.
11. **The objective: Jacob uses Claude Code better** (routing-tree §21, Jacob
    2026-10-19: "The objective of this app is to make it so I can use claude code
    better. Miss less of what you say, and see less output that is unnecessary for the
    human aspects of the decision making process. This is why being efficient with
    screen real estate is so important."). Every view and every reply the hub makes is
    measured against one test: *did Jacob miss a thing he had to act on, and did he read
    a line he did not need?* Two numbers answer it, both read from stores, never
    estimated: what he missed (replies not marked read after N days, from the reply
    ledgers of question 16, and decisions open past their table, from `todo
    decisions`) against what he read (lines printed for him per day: the reply ledger's
    `bytes` and the hooks' notices). The two numbers are the hub page's first line
    (routing-tree §21 step 4). The plan says where the page reads each one, through its
    owner's CLI (fixed point 10), and gates that the line equals what the stores hold;
    it does not reopen the objective. The improvements §21 proposes (its rows 1-6) are
    pending dt-5 row 6 and belong to other owners; the plan cites them where they touch
    the hub (row 4 in question 16) and builds none of them.

## 4. What the plan must settle

Answer each with a section, and where it is Jacob's call, a row in the Decisions table.

1. **The split with harness.** For each of these, say whether it moves into the hub,
   stays in harness, or is rendered by harness into hub data: `auto-relay.sh`,
   `peer-cap.sh`, `record-session.sh`, `planner-role.sh`, `question-gate.sh`, the relay
   kinds, `dispatch-section.sh`, `relay-gate.sh`, the relay and dispatch ledgers,
   `agent-watch.sh`, `quote-words.sh`. PLAN-tools-folder.md §7 says row D is the hub and
   the ledger stays until the hub exists; confirm or correct with reasons.
2. **The registry file.** Its schema (fixed point 2's roles, tags, children, parent and
   mode, and fixed point 10's `services`, `owners`, port and keep-alive), who writes each part at a node
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
11. **A session the hub runs.** PLAN-context-hygiene.md §0 ("Later", made a hub
    requirement by Jacob 2026-10-08; that plan is a §2 input since 2026-10-19, and the
    requirement stays stated here whole) wants a session a program drives, through `-p --input-format
    stream-json --output-format stream-json` or the Agent SDK
    (<https://code.claude.com/docs/en/cli-reference#cli-flags>). The program holds the
    message list, so it clears and rebuilds the context on its own, with no keystroke
    and no restart, and can edit one block while the session continues. It takes the
    idle point (the turn and every agent it started have finished) from the event
    stream, not from ledgers. Settle: whether the hub runs these sessions, and through
    stream-json or the SDK, with the probe that decides and its pass condition; which
    events make the idle point, and the test that no rebuild lands while an agent runs;
    what the hub exposes to clear, rebuild and address one block, and who may call it;
    how it relates to the context-hygiene launcher that restarts a whole session; and
    how that plan's rebuild guards hold here (no tool output in the system prompt, a
    rebuild never read as Jacob's prompt, nothing lost).
12. **References by id, shown as a stub and expanded on demand** (Jacob, 2026-10-12:
    "make it so that the hub can reference anything in the knowledge store by ID and
    have it show up with the stub, and expandable to the full text, without the agent
    that is sending that information having to output the entirety of that
    information"). No plan records it, so the requirement is stated here whole.

    **The sender writes an id, never the record.** Records come from any store that
    hands out ids:
    - a kb section (its `url#anchor`);
    - research (`rs-<n>`);
    - todo items;
    - context-hygiene's `ctx:` store;
    - data-bridge records.

    PLAN-services.md §3 ("Every record a service holds has an id and tags") already
    gives each of these stores `get <id>` and a short readable line per record. Its
    "Context carries ids" paragraph holds that a record enters context as its id and
    that line, never as a copy.

    **The hub does the rest:**
    - it resolves the id's prefix through the prefix registry to the store's `get`;
    - it renders a stub: the id, the store's own one-line summary, its source and date;
    - it expands the stub to the full text only when asked. For Jacob in the view, that
      is a click. For a model recipient, it is one `get` call, so the full text costs
      tokens only for a recipient that reads it.

    The stub's line comes from the store, never from the sender. A sender therefore
    cannot misdescribe a record, and it spends nothing on it.

    **Settle:**
    - which stores are in the first phase;
    - the reference syntax inside a message, and how the envelope carries it beside
      the body;
    - the stub's fields and its size cap;
    - how expanding works for a model recipient (a tool, an MCP resource, or a CLI
      call) and for the view;
    - a record that changed since it was cited: does the stub show what the sender saw
      (the `ctx:` snapshot) or the current text, and how is the difference shown;
    - a dangling or unreachable id: shown as unresolved, never dropped. An unreachable
      store is UNCHECKED, not a pass;
    - its gates:
      - a planted id renders a stub within the cap;
      - expanding returns exactly the store's `get` output;
      - an unknown prefix fails;
      - an envelope whose body carries more than the cap of a record's text it could
        have referenced is flagged.

13. **Questions to Jacob go through the wizard, not the chat** (Jacob, 2026-10-12: "the
    hub should be able to put questions in front of me through the wizard tool on
    occasion, but again, I think this should be offloaded rather than necessarily a
    direct interaction every time"). *Added after the cloud pass of 2026-10-12 started
    from 82aab8c. That pass does not see it, so the merge carries it as an open
    question for the hub's owner.*

    **What exists.** `tools/wizard` asks Jacob a definition's questions at a terminal,
    one at a time or all at once, and stores his answers for any tool to read back
    (`wizard answers <definition> --json`). `wizard due` lists what is waiting. A
    definition's source is either fixed questions or a todo store's items.
    PLAN-architecture.md §7 already sends the architecture questions this way.

    **The hub's part:**
    - a message that needs Jacob's answer and is not urgent becomes a wizard question,
      never a prompt in a window;
    - the answer comes back to the asker as a reference by id (question 12), not a
      copy.

    **Settle:**
    - how the hub tells "needs Jacob now" from "can wait for the wizard". The default
      is that everything waits, except an item that blocks work already running;
    - how a question reaches a definition: a todo item with a `waiting-jacob` status
      (the wizard's existing `todo` source), or a new hub source;
    - how the hub learns an answer landed, and how it routes it back to the asker;
    - batching and cadence: how many due questions before Jacob is told, and how
      (a status-line count, `wizard due`, never a push per question);
    - its gates:
      - a planted non-urgent question lands in a definition and never in a window;
      - a planted answer reaches its asker;
      - the credential guard stays on for every hub-made definition.

14. **Every project's assurance, as a view** (Jacob, 2026-10-12, quoted in
    PLAN-architecture.md §6a). *Added after the cloud pass started, like question 13.*
    For any project or service the hub shows five lists:
    - its gates, tests and audits;
    - its practice cells;
    - its design decisions with their gates or `prose: <why>`.

    Each line is a question-12 stub that expands, and it links to exactly what it is
    about. **The hub renders stored records and generates nothing.** The records are
    written procedurally by `checks ledger` (PLAN-architecture.md §6a), and each
    justification carries its author and an evidence pointer.

    **Settle:**
    - how the view finds a project's records (through the prefix registry, as in
      question 12);
    - how `stale`, `not run`, `unjustified` and `unknown` are shown, so a gap is never
      hidden;
    - its gates: the view's text equals the records' text, and a planted gap shows.

15. **The roster settings page** (routing-tree §15, Jacob 2026-10-19: "I would also
    like to be sure there is a settings page for changing what each agent is set at in
    the hub app (e.g. opus 5.5. max effort."; owner hub). *Added 2026-10-19, after the
    cloud pass, like questions 13 and 14.*

    **What it shows.** One row per roster agent, plus the dispatcher and the planner.
    Each row shows:
    - the agent's model and effort, and whether each comes from the agent's own
      override or from `coders`;
    - its `model_reason`, when the model is not Opus;
    - its maxTurns.

    The `coders` defaults are their own row, so one change covers every agent that
    inherits them. A pinned effort is shown next to the session's own, so the two are
    never mistaken for each other. `.claude/settings.json` (the dispatcher's own model
    and the hooks) is Jacob's file: the page shows it and never writes it.

    **One write path, which already exists.** A change on the page asks the server to
    run, in order:
    1. `agents.sh set <agent> <key> <value>`, the manifest's one writer;
    2. `gen`;
    3. `check`;
    4. a commit inside `.claude/`.

    The page holds no copy of the roster and no second writer (fixed point 10). A change
    `check` refuses (a non-Opus model without a `model_reason`, an effort outside the
    allowed values) shows its message and changes nothing. The model allowlist is read
    from the manifest's list of known models, never typed into the page. Only Jacob
    changes a value; a role that reaches the server gets the page read-only (fixed point
    9). After a change the page shows `agents.sh tokens --agents --since <the change's
    date>` for that agent, so a change is kept only if the numbers say it helped.

    **A dependency, not the plan's to build:** routing-tree §15 step 0, harness's `set`
    accepting `planner` and `dispatcher` (on 2026-10-19 `agents.sh set planner effort`
    failed: "no agent 'planner' in the roster").

    **Settle:**
    - how the page reads its rows without opening the manifest (fixed point 2):
      through harness's CLI, the way fixed point 10 reads every tool's facts, and what
      the page shows at a node without harness;
    - how the server runs the four steps as one `write` request, and what the page
      shows while they run and when one fails;
    - its four gates (routing-tree §15):
      - the page's rows equal `agents.sh list`, both ways;
      - a change made on the page and the same `agents.sh set` from a shell leave
        identical manifests (fixture);
      - a refused change leaves the manifest's hash unchanged (fixture);
      - the server refuses a write from a read-only role (fixture).

16. **The inbox view of replies** (routing-tree §19, Jacob 2026-10-19: "These should be
    able to be 'marked as read' in the hub once we get there."). *Added 2026-10-19, like
    question 15.*

    **What harness builds first** (routing-tree §19 step 1). A Stop hook in both windows
    writes one row per final reply to `.claude/state/replies.jsonl` and the reply's text
    to `.claude/state/replies/<key>.md`. Read marks are a second, append-only ledger,
    `replies-read.jsonl`: a reply is unread until a row names it, and a `by: undo` row
    takes the mark back. The CLI:
    - `agents.sh replies [--unread] [--since DATE] [--json]` lists, newest first;
    - `agents.sh replies --read <key> [--all-before DATE]` marks;
    - `agents.sh replies show <key>` prints the text.

    **The hub's part.** The inbox view lists unread replies by window (the
    dispatcher's and the planner's). It marks a reply read only through `agents.sh
    replies --read` (fixed point 10: the ledgers stay the truth and the server is the
    only path). Jacob marks; every other role reads (fixed point 9). The todo store is
    not touched: a reply that carries work gets an item through `todo add --tags
    ref:reply:<key>`, by whoever reads it.

    **Settle:**
    - how the view reads the ledgers (through `agents.sh replies --json`, never the
      files), and the bound on what it lists;
    - marking one reply, marking all before a date, and undo, each through the CLI;
    - whether a reply shows as a question-12 stub that expands to `agents.sh replies
      show <key>`;
    - how "unread" stays apart from "awaiting your answer" if dt-5 row 6 lands
      (routing-tree §21 row 4: a reply whose row carries `table: dt-N`);
    - its gates:
      - a planted reply shows unread under its window;
      - a mark made in the view and the same `agents.sh replies --read` from a shell
        leave identical ledgers (fixture);
      - a mark from a read-only role is refused (fixture);
      - a reply whose text file is missing (`path: null`) shows as unresolved, never
        dropped.

## 5. Output contract

`PLAN-hub.md`, at the top of this repo, in the house shape:

- a `> **Status:**` header with the date, "plan, written in the cloud from
  PLAN-hub-brief.md", the owners, and a "Builds on" list;
- numbered `## N.` sections, every §4 question answered in order, then `## Gates`,
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

**Done when:** the file exists on a branch named `plan/hub`, answers every §4 question,
has the four closing sections, and every platform claim has a URL. Nothing else in the
repo is changed.

## 6. Setup component

None in the brief itself: a brief installs nothing. The plan it produces carries the
component (PLAN-hub.md "Setup component", reviewed in PLAN-hub-review.md).
