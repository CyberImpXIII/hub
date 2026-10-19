# Routing tree: a server routes tagged messages, the dispatcher only takes what it can't

> **Status: approved by Jacob 2026-10-03** (§11 all yes, 6–9 later the same day). Phases 0–2 dispatched, each after the one before; §12 S1 queued after phase 1. His words:
>
> > "Coding agents, test writing and executing agents, tooling agents, auditing agents,
> > etc, should be able to route necessary communication to each other through the
> > relay server for things 'tagged' correctly. [...] heirarchical to keep it modular
> > and dynamic [...] The server acts as a dispatcher for deterministic programmatic
> > decisions of routing and the dispatcher acts as the agent 'sits at the call
> > center' [...] it should theoretically not have the ability to run tools and change
> > code outside of what it needs to get messages to the correct agent in its area.
> > Any git repo, that is afforded its own set of agents and server, should recieve
> > messages from the parent server (or agent) and distribute accordingly. [...] able
> > to be run via a command so that it is portable and modular"
>
> **Builds on:**
> - PLAN-group-servers.md: one server program per group, configured only by data;
> - PLAN-auto-relay.md: the parser, ledger, origin labels, dedupe and budget, all
>   reused here;
> - PLAN-agent-groups.md: roles inside a repo;
> - PLAN-repo-setup.md and PLAN-portable-env.md: how it ships, and the one command.
>
> **Owners:** `harness` for the server program, the CLI and the gates; each folder's
> agent for its own node config; the dispatcher for the CLAUDE.md rewrite (§6 phase 4).

## 1. The shape

```
claudeTest (node)          planner · dispatcher (call center) · operator · server
├── site-scrapers (node)   dispatcher · coder · tester · auditor · server
├── scripts (node)         dispatcher · coder · server
├── applications (node)    ...
└── <any repo set up>      the same, from config alone
```

- **A node is a git repo set up with `agents.sh setup`.** It has a server, a set of
  agent roles and a dispatcher. The top level is a node too.
- **The server decides routing, with no model involved.** The same message and the same
  registry always give the same route, and every decision is logged with the registry
  version that produced it.
- **The dispatcher is the fallback at its own level:** it gets only messages the server
  can't route (no tag, an unknown tag, an ambiguous match). It picks a destination and
  re-sends through the server. It never edits code or runs tools (§4).
- **A node knows only its parent, its own roles and its direct children.** It never
  knows a grandchild. Swapping a subtree means changing one registration.

## 2. Messages

One envelope, validated at every hop. A message that fails validation is never
forwarded; it goes to the dead-letter queue, with a notice.

| field | holds |
|---|---|
| `id`, `conversation` | ids; replies keep the conversation |
| `from`, `to` | paths like `claudeTest/site-scrapers/tester`. `to` may be empty when a tag is given |
| `tag` | from the declared vocabulary, e.g. `task`, `bug-report`, `test-request`, `review-request`, `report`, `question` |
| `ref` | a pointer (`PLAN-x.md §n`, `TODO.md "..."`, a commit, a file:line), never pasted plan text |
| `body` | one short paragraph |
| `origin` | `jacob` or `model`, stamped by the server, never by the sender (PLAN-auto-relay §4) |
| `approval` | Jacob's approval ref, when the task needs one |
| `hops` | incremented at each server; over the limit means dead-letter |

**The tag vocabulary is data:** declared in the manifest at each node, with the role
that takes each tag. Gate: every declared tag has a route, and every route's tag is
declared.

## 3. Routing (deterministic)

At each server, in order:
1. **Addressed here:** `to` names one of this node's roles, so deliver it.
2. **Addressed below:** `to` starts with a direct child's path, so forward it down.
3. **Tagged:** this node's tag table names a role or a child, so deliver or forward.
   Children advertise their tags when they register.
4. **Otherwise:** the address is outside this node, so forward it up. With no parent,
   or still unresolved, it goes to **this node's dispatcher.**

The dispatcher's choice is logged. When it re-routes the same pattern N times (3), the
server proposes a tag-table rule for Jacob to accept with `agents.sh routes accept`. Then
the judgement becomes a procedure (memory: procedural over judgement).

**Replies come back the way they went.** A leaf agent's final result becomes a `report`
to `from`, recorded in the ledger (PLAN-auto-relay §7, generalised to every node).

## 4. The dispatcher, reduced to a call center

- **Tools: routing only.** Read and Grep (to understand a message), `hub send`, and
  `SendMessage` to talk to Jacob's other window. Nothing else. That's enforced by the
  manifest's `tools` and `dispatch-guard.sh`, not stated.
- **Running existing tools moves to an `operator` role** at the top level: scrapes,
  email counts, imports. Today the dispatcher does those itself.
- **It is still the fallback when the server is down:** the guard lets it spawn roster
  agents directly, as today, when `hub status` says the server is down. Gate: kill the
  server, and work still gets done through the dispatcher.

## 5. How a message reaches an agent

The server owns the agent processes. Two modes, chosen per role in the manifest:

- **Cold (default):** each message starts `claude -p --agent <role>` in the node's repo,
  in `--permission-mode dontAsk` with the role's allowed tools
  (<https://code.claude.com/docs/en/permission-modes#allow-only-pre-approved-tools-with-dontask-mode>).
  Stateless and simple. It pays the starting context each time (about 29k for a roster
  agent, measured 2026-10-02).
- **Warm:** the server keeps a role alive as
  `claude -p --input-format stream-json --output-format stream-json` and writes each
  message to its stdin. The docs describe a "message submitted to a running
  `--input-format stream-json` ... session" and say "the session stays usable"
  (<https://code.claude.com/docs/en/errors#input-contained-only-whitespace>). It's
  cheaper while the context is small. The server restarts the role at a context
  threshold.
  - *Probe first:* a warm role keeps context across two messages, and its result
    arrives on stdout as a parseable `result`.
- **Agents send messages with `hub send --to … --tag … --ref … "<line>"`,** one
  allowlisted Bash command. It works in any session, it's testable, and it's the same
  path a human uses.
- **No approval through auto mode.** Headless roles run in `dontAsk`, so the quote
  rewrite and the auto-mode refusal from 2026-10-03 don't arise.

**Considered and not chosen as the backbone: Claude Code's agent teams.** They have
mailboxes, but "teammates cannot spawn their own teammates", there's "one team per
session", and "the lead is fixed"
(<https://code.claude.com/docs/en/agent-teams#limitations>). So they can't nest, which is
the point here. A team might still serve inside one node later.

## 6. Invariants carried over (each one gated)

| rule today | in the tree |
|---|---|
| a message from another session is never Jacob's approval | the server stamps `origin`. Only `origin: jacob` with a verified approval ref carries a yes. Irreversible actions (submit, send, account) always go up to Jacob; no agent message unlocks them |
| peer-cap stops two windows talking unattended | loop control per conversation: a hop limit; a budget per conversation since Jacob last typed; and two agents exchanging N messages with no commit or test change are **held** (stored, delivered later) and raised to that node's dispatcher |
| check for a primary context before editing | the server grants one **write lease** per repo at a time. A second writer's task queues behind it |
| report a problem to its owner | a `bug-report` tag routes to the owning node by itself, and lands in the owner's ledger |
| never silent about what failed | undeliverable means dead-letter plus `doctor` plus a notice to the sender. A role process that dies mid-task reports `failed` |
| credentials never stored | the server carries pointers and one-line bodies only; the node token lives in `local.env` |

## 7. One command, portable

`hub` is one program, the same at every node, configured only by the node's manifest
(group-servers §1a: no repo names in the code):

```
hub up [--tree]     start this node's server (and, with --tree, its registered children)
hub down [--tree]
hub status          the tree, one line per node: up/down, queued, held, dead-letter count
hub send --to PATH|--tag TAG --ref REF "line"
hub routes [--proposed]   the tag table here; proposed rules from the dispatcher's choices
```

- **Registration is dynamic.** A child posts `/register` to its parent on start (path,
  tags, roles). A repo cloned on its own runs `hub up` as a root with no parent, so
  every node works standalone.
- **Keep-alive** goes through `chron.py` (group-servers decision 4). `init.sh`
  (portable-env) runs `hub up --tree` at the end.
- **Transport:** HTTP on 127.0.0.1, with a token generated by `init` into `local.env`.

## 8. Setup component

`agents.sh setup <repo>` writes the node config:
- the roles, from the agent-groups defaults;
- an empty tag table;
- the parent path;
- a free port.

It also registers the node with its parent. That's content-agnostic: a repo it knows
nothing about becomes a node with a dispatcher and a coder role.

## 9. Gates (in the same change as each part)

- **Determinism:** the same envelope and registry route the same way, 100 out of 100.
  The logged route replays to the same result.
- **Conformance:** a fixture repo that isn't any of ours, set up from its path alone,
  receives, routes and replies.
- **No names in the program:** an audit (group-servers §1a).
- **Hierarchy:**
  - a parent never stores a grandchild;
  - removing a child's registration routes its tags to the parent's dispatcher, not
    nowhere.
- **Loops:** a fixture ping-pong is held at N; a hop-limit message dead-letters; a held
  message is delivered after Jacob types, without being pasted again.
- **Origin:** a forged `origin: jacob` from a sender is overwritten; an irreversible tag
  from `origin: model` never executes.
- **Lease:** two concurrent `task` messages to one repo's coder run one after the other,
  never together.
- **The fallback works:** with the server down, a dispatcher spawn still runs.
- **The dispatcher can't act:** a dispatcher Edit, Write or non-`hub` Bash call is
  blocked.
- **Vocabulary:** declared tags == routed tags, at every node.
- **Cross-repo claims (phase 2):** a fixture `report` from repo A that names repo B's
  commit, file or behaviour is routed to B as a `bug-report` and B's `report` closes
  the conversation; the top dispatcher's inbox receives neither. A claim with no
  owning node dead-letters with a notice, never silently.

## 10. Phases

0. **Finish the harness job in flight** (PLAN-auto-relay: quote fix, relay, ledger).
   Its parser, ledger, origin stamping and dedupe move into the server unchanged.
   **Probes, cited:**
   - a warm stream-json role across two messages;
   - `dontAsk` with a roster definition honouring its tools;
   - `hub send` from inside a `claude -p` role.
1. **One node, the top:**
   - the server with `/route`, cold roles only, using today's folder agents as
     addresses (`claudeTest/site-scrapers` = the `site-scrapers` agent);
   - the planner's Dispatch section goes to the server instead of the dispatcher;
   - the dispatcher becomes the fallback.
2. **Agent to agent:** tags, loop control, the write lease, and `bug-report` routing.
   - **Evidence for this phase (2026-10-03, Jacob's observation in the dispatcher
     window):** the `applications` agent's report said site-scrapers' commit fd81cf2
     "isn't in its log". It was. The claim reached the top-level dispatcher as a bare
     assertion, and the dispatcher settled it by running `git log` in site-scrapers
     itself, which is neither its role nor a good use of that window. Today every
     roster agent edits its own repo, checks its own work and reports straight up, so
     a claim about *another* repo has no place to be answered except the top. Under
     this phase it is a `bug-report` (or `question`) to that repo's address, routed by
     rule 3 or 4 in §3, and the owner's answer comes back as a `report` on the same
     conversation. The dispatcher never sees it as a question to adjudicate.
   - **What changes because of it:** not the order (phase 1's server is the
     prerequisite) and not phase 3's tester role, which stays gated on agent-groups
     (§11 decision 4); one case does not un-gate it. What changes is phase 2's scope:
     a *claim* about another repo is a first-class use of `bug-report`, with the gate
     below, and the interim rule in TODO.md "Cross-repo claims" holds until then.
3. **Hierarchy:** site-scrapers becomes the first child node, with its own server and
   dispatcher, and roles once PLAN-agent-groups.md allows.
4. **Relegate the dispatcher:**
   - restrict its tools;
   - add the `operator` role;
   - rewrite "How work is split here" in CLAUDE.md (the dispatcher's edit, after Jacob
     approves the text).
5. **Warm roles** where `tokens --agents` shows they're cheaper. The other repos join
   through setup.

### 10.1 The five decisions of the cloud plan (Jacob, 2026-10-19)

The hub brief's open items (`tools/hub/PLAN-hub-brief.md` §4) were put to Jacob as
D1-D5 (tl-323..327, dt-3 rows 2-6). His answers:

| decision | Jacob, 2026-10-19 | what follows |
|---|---|---|
| D1 refresh the stale inputs | **refresh** | hub refreshes the seven stale copies and `SHA256SUMS` before the cloud session |
| D2 the cloud session's model | **Fable 5.1 at max** | Jacob starts the session on Fable; the brief's §9 token costs are restated at Fable's price (the manifest's prices table) |
| D3 the hub drives sessions | **drive** ("yes yes yes yes") | brief item 11 is a requirement; the probe decides stream-json or the SDK; §20 orders the roles |
| D4 questions wait; the todo store is the one list | asked again with the elaboration (reply of 2026-10-19) | recommend `todo-source`: the wizard reads `waiting-jacob` items and nothing else; only an item that blocks running work reaches a window |
| D5 keep-alive | asked again ("every 5 minutes feels extreme") | options now `launchd` (restart on exit, nothing runs while healthy), `cron-15`, `cron-5`; recommend `launchd` with chron.py as the portable fallback at 15 min (group-servers decision 4 named chron.py; the cadence changes, not the tool) |

## 11. Decisions (all answered "yes" by Jacob, 2026-10-03)

1. **One server program per node, doing both checks (group-servers) and routing.**
   Not two servers. *Recommended: yes.*
2. **Cold roles first; warm roles only where the token numbers show a saving.**
   *Recommended: yes.*
3. **The dispatcher gets routing tools only, and running existing tools moves to an
   `operator` role.** *Recommended: yes.* The alternative is to let it keep read-only
   tool runs (scrape, count).
4. **Does agent-groups' token condition gate this?** Agent-groups only gets built "if
   the audit has shown that the changes [...] reduce token usage". *Recommended:*
   - routing between today's folder agents (phases 1–2) doesn't wait for it;
   - splitting a repo into coder, tester and auditor roles (phase 3 onward) still does.
5. **Priority:** phase 0 is already running. Phases 1–2 go next, ahead of group-servers'
   remaining work, since group-servers becomes part of this. *Recommended: yes.*
6. **Sync is a section of this plan (§12), not a plan of its own.** Nodes, parents and
   inheritance are this plan's concepts. *Recommended: yes.*
7. **Shared rules become verbatim marked blocks** in every CLAUDE.md copy, with
   repo-specific wording outside the markers. *Recommended: yes.* The alternative is to
   keep paraphrased copies, which only a person can compare.
8. **Sync proposes and the owner applies;** nothing writes into another owner's repo.
   *Recommended: yes.* The alternative is to auto-apply verbatim files such as hooks.
   It's faster, but it skips the owner's check and commit.
9. **Priority: S1 goes straight after routing-tree phase 1.** It needs no server, and
   it replaces three bespoke checks. *Recommended: yes.*

## 12. What flows down: declared sync instead of bespoke copy checks

> **Jacob, 2026-10-03, relayed by the dispatcher (his words, quoted):** "Ideally we want
> more than just delegation to pass top down. Hooks for different agent classes,
> relevant documents and tags, and other things that require managed programmatic
> syncing across nodes." **Approved 2026-10-03** (§11 decisions 6–9).

**Today every copy has its own check, written separately:**
- 8 hook copies, compared by `site-scrapers/check-hooks.sh`, plus a second
  `check-hooks.sh` in knowledge-base;
- 7 CLAUDE.md rule copies:
  - checked by `./dev.sh sync` in three repos and `test_doc_claims.py`;
  - cron-scheduler reports that whether paraphrased wording means the same thing
    can't be checked mechanically;
- `knowledge-base/docs/PLAN.md`, checked by `cmd_plan` (PLAN-knowledge-base.md §8);
- "Constraints that don't bend", copied verbatim by `gen`.

Each one works. Together they're the near-duplicate procedure CLAUDE.md warns about,
and every new copy needs one more.

**The design:**
- **One declaration per node:** a `sync` list in the node manifest. Each entry holds:
  - an artifact id;
  - its source here: a file, or a marked block in a file;
  - its targets: all children, children of a class, or named ones;
  - a mode:
    - `file`: a verbatim file, such as a hook;
    - `block`: a marked section inside a file the target owns;
    - `vocab`: tags and classes, which a child may extend but never redefine.
- **Shared prose becomes marked blocks.** A shared rule sits verbatim between
  `<!-- shared:<id>@<hash> -->` and `<!-- /shared -->` in each copy, and a repo's own
  wording goes outside the markers. "Same meaning" becomes "same bytes", which is
  checkable, and that settles cron-scheduler's point by construction.
- **Agent classes.** The node manifest declares classes (dispatcher, coder, tester,
  auditor, operator) and, for each, its hooks and the documents it reads first. `gen`
  renders them into each role's frontmatter (hooks in subagent frontmatter:
  sub-agents#hooks-in-subagent-frontmatter). A child inherits its parent's classes and
  adds its own. An override is allowed only where the parent marks an item
  overridable, and `sync status` lists every override.
- **Down only, never across owners.**
  - `hub sync --check` (also `agents.sh sync --check`, which needs no server) prints,
    per node and artifact, one of `ok`, `behind N`, `missing`, `edited locally` or
    `override`. It reads the hash in each marker.
  - Drift sends a `sync`-tagged message to the child node's owner, who runs
    `hub sync --apply <id>` in its own repo, with its own check and commit. Applying is
    mechanical, so a cold role does it cheaply.
  - A child's edit inside a block is reported upward as a proposal, never pushed
    sideways.
- **The old checks are retired, never dropped.** A bespoke check goes only once
  `sync --check` gives the same verdicts on that check's own fixtures, with drift
  injected into each.

**Gates (in the same change):**
- every declared source exists, and every target that should hold an artifact holds it;
- declared == implemented, both ways: every marker in a target is declared, and every
  declaration is present;
- an edit inside a block is caught;
- an undeclared override fails;
- a child can't redefine a parent's tag;
- a node with no parent (a standalone clone) checks only itself, and says so.

**Phases:**
- **S1:** file-only `agents.sh sync --check`, with no server. It takes over the hook
  copies, the plan copy and the rules-sync list.
- **S2:** the shared rule sections in all seven CLAUDE.md copies become marked blocks.
  That's one dispatch per owner.
- **S3:** classes and per-class hooks, with phase 3 (hierarchy, agent groups).
- **S4:** propagation as `sync` messages through the hub.

## 13. Read-only roles, receipts, and where a failed send goes (Jacob, 2026-10-04)

> Jacob: "is there a way to make agents read only? With the hard gating and the per
> agent siloing we have planned for harness I feel like it might make it easier to
> delegate more to the server. Since we are running HTTP you should receive a response
> from the server no? [...] If something fails to send it should be sent to the agent in
> charge of that, and in lieu of programmatic knowledge of where something should go
> [...] it is sent to dispatch."

Prompted by the 21:27 relay on 2026-10-04 that reached the dispatcher unstamped
(TODO.md "Relay gate timed out and failed open"): the admitting hook timed out at 10 s
under load, and because it fails open the message arrived with no `origin:` and no
ledger row. Three corrections to the premise, then the design.

**13.1 What runs today is a socket, not HTTP.** `auto-relay.sh` posts to the
dispatcher's inbox socket with `nc -U`; the only receipt is `nc` exiting 0, which says
the socket took the bytes, not that the gate admitted them. The hub and the group
servers are plans (§10 phase 0 is still in flight; PLAN-group-servers.md is "Status:
plan"). Under HTTP the hook-side failure is the same: a connection failure or a non-2xx
is a non-blocking error and a timeout cancels the hook
(<https://code.claude.com/docs/en/hooks#http-response-handling> "non-blocking error,
execution continues"), which is why PLAN-group-servers.md §2 keeps
enforcing hooks as command hooks. What a 2xx JSON body does give is a response in the
same schema as command output, so a server *can* answer a hook. The fix is not the
transport. It is **who stamps**: today the receiver's 10-second hook does; under §2 the
server does ("`origin` ... stamped by the server, never by the sender"). A stamp
written by the process that routes cannot be lost to a timeout in the window that
reads.

**13.2 Read-only roles exist in a soft form today and a hard form only with the
server.** Three mechanisms, each cited:

| mechanism | what it holds | what it misses |
|---|---|---|
| `tools` / `disallowedTools` in the agent definition (how `Explore` is built: no Edit, Write, NotebookEdit) | the file tools | Bash writes; `write-targets.sh` says of itself "bash_write_targets IS HEURISTIC" |
| `permissionMode: plan`, "Plan mode (read-only exploration)" (<https://code.claude.com/docs/en/sub-agents#permission-modes> "Plan mode (read-only exploration)") | everything, as a permission | ignored when the spawning window is in `bypassPermissions`, `acceptEdits` or auto mode; honoured under `default`, `dontAsk`, `plan`, and in a cold `claude -p` role (§5), which has no parent window |
| the OS sandbox: `sandbox.allowWrite` paths, "enforced at the OS level, so all commands running inside the sandbox, including their child processes, respect them" (<https://code.claude.com/docs/en/sandboxing#configure-sandboxing> "These paths are enforced at the OS level") | every process the role starts | it cannot tell a write made through the gated CLI from one made by hand, because both run inside the role's sandbox |

The last row is the point. A hard read-only role cannot run the gated CLI itself, so
**the write moves to the server**: the role sends a `write-request` (tag, `ref`, the
CLI verb and its arguments as data), the node's server runs that tool's CLI with the
gates PLAN-hard-gates.md §3 lists, and answers with the CLI's own result as a `report`.
That is the site-scrapers pattern (read-only generated files, a gated store, one way
in) applied to the roles themselves, and it is why read-only roles make delegating to
the server *easier*, as Jacob suspected: a role that can only read and send has no
seam to guard. Roles keep `dontAsk`, their `tools` list (Read, Grep, Glob, `hub send`,
and a test runner where the role is a tester), and a sandbox whose writable set is the
scratchpad only. Cold roles get this at phase 1; warm roles need the sandbox probe
first (does a long-lived `claude -p` keep the sandbox across messages).

**13.3 A failed send is a message, not a log line.** §6 already says undeliverable
means dead-letter plus `doctor` plus a notice to the sender. Jacob's rule sharpens it:
the dead-letter queue is where a failure *rests*, not where it *ends*. Every failure the
server detects becomes a tagged message routed by §3 like any other:

| failure | tag | goes to |
|---|---|---|
| a message fails validation, the hop limit, or delivery to a role process | `delivery-failure` | the owner of the failing seam: at the top level `harness`; inside a child node, that node's server owner from its registry |
| a `write-request` the gated CLI refuses | `report` with the CLI's output | back to `from`, by §3 "replies come back the way they went" |
| a check or a function call with no route (the registry has no owner for its tag) | the original tag, `routed_by: dispatcher` | the node's dispatcher, by §3 rule 4; after 3 of the same pattern the server proposes a rule, as §3 says, so this stays rare |

A failure that cannot be routed at all (the server itself is down) is the one case
left to the hook layer: the sender's command hook prints a notice, as `auto-relay.sh`
does today, and `doctor` reports a day whose relays sent ≠ got (TODO.md "Relay gate
timed out and failed open", item 3). Nothing reaches Jacob's screen except that notice.

**13.4 Gates, in the same change as each part.**
- A role fixture with `tools` lacking Edit and Write and a sandbox allowing only the
  scratchpad: a Bash `echo > repo/file` inside it fails, and the same write sent as a
  `write-request` succeeds through the CLI. Both directions, or the role is not
  read-only.
- A `plan`-mode role spawned from a `bypassPermissions` window still cannot write,
  because the sandbox holds when the permission mode is ignored (the docs say the mode
  is ignored; this test is what makes that harmless).
- Kill a role process mid-delivery: `harness`'s inbox gets a `delivery-failure` with
  the message id; the dispatcher gets nothing. Remove `harness` from the registry's
  tag table: the dispatcher gets it, logged `routed_by: dispatcher`.
- A `write-request` whose CLI verb is not on that tool's declared list is refused at
  the server and answered, never run.
- The receipt test from this incident: a relay sent while the receiver's window is
  under load (a fixture that sleeps 11 s in the hook) is still stamped and in the
  ledger, because the server stamped it before the window saw it.

**13.5 What changes elsewhere.** `tools/hub/PLAN-hub-brief.md` §3 fixed points gain
this section as a ninth (a dispatch to `hub`, who owns the brief). §4 "restrict its
tools" and §5 "the role's allowed tools" now mean the 13.2 table. PLAN-agent-groups.md
§4 silos become read-only roles by default; a silo that must write (a coder) is one
whose `write-request`s the server honours for its own repo, which is the write lease of
§10 phase 2. Until phase 1 exists, the interim fix is the harness item in TODO.md
"Relay gate timed out and failed open" (decision 30).

**Decisions for §13.** 31 (read-only roles, server-run writes): yes, Jacob 2026-10-04 ("I think so yes, its not hard to determine quickly what the necessary gates are if routing falls back quickly"). Decision 30, the interim harness fix: yes, same day. 32 (failures to the seam owner) he reframed as the question §14 answers: owner is decided by the registry, per seam kind. Hub brief fixed point 9 is dispatched from here;
the remaining decisions are in §14.

## 14. Stores are the truth, the server is the only path (Jacob, 2026-10-04)

> Jacob: "checks should only be working when the checks aren't falling through
> programatically, responding to the server, and being routed to where they need to go.
> We want an agent to in ALL circumstances be the last line of defence. [...] should
> routing servers be the only source of truth? Since we are moving more towards gated
> dbs seeding the docs that the ai work with, should we also have a check server, hook
> server etc?"

**14.1 Truth and path are different things, and the server is only one of them.** The
source of truth for a fact stays the gated store of the tool that owns it: recipes in
site-scrapers' database, items in `todo.json`, the roster in the manifest, checks in
`tools/checks/source/`, hooks in `tools/hooks/source/` (PLAN-one-source.md §1). The
server owns exactly one store of its own: the **ledger of what moved**, messages,
routes taken, origin stamps, leases, failures, with the registry version that produced
each decision. It never holds a copy of a tool's facts; it reads them through that
tool's CLI (PLAN-one-source.md §2.4) and renders nothing of its own except `hub status`.
So: the server is the only *path* a message, a check result or a write may take, and no
store is the only *truth* for anything but its own facts. A server that became the
truth for recipes or checks would be a second copy, and "a second copy of anything" is
the first seam in CLAUDE.md's table.

**14.2 One server program per node, many services; not a check server and a hook
server.** PLAN-group-servers.md §1a already fixes the program as one portable process
per group with `/touched`, `/stop` and `/audit` (its §3.2), and §2 keeps enforcing hooks
as command hooks because a server that is down lets everything through. Jacob's "check
server, hook server" is right about the *services* and wrong about the *count*. Each
extra server is a seam: its own port, its own down state, a second ledger, a second
doctor, a second loop control. The node's server instead declares services as data in
the registry, each backed by a CLI and nothing else:

| service | what it runs | who calls it |
|---|---|---|
| `route` | §3, the registry | every message |
| `check` | the repo's `dev.sh check --json` and `tools/checks/checks run .` (the §1a contract) | PostToolUse hooks, the cron `/audit`, a `check-request` message |
| `hook` | the decision side of a hook that may be stateful (history, budgets, leases) | HTTP hooks from roles; **a hook that blocks stays a command hook** (PLAN-group-servers.md §2) and asks the server only for context |
| `write` | a tool's gated CLI on behalf of a read-only role (§13.2) | `write-request` messages |

Gate for 14.2: the no-group-names audit of PLAN-group-servers.md §1a extended to
service names: the program contains no tool's command; every service row names its CLI
in the registry, and a fixture node with a different CLI gets every service working.

**14.3 The agent is the last line, by an ordering the server enforces.** Everything
that can be decided without a model is decided first, in this order, and a model turn is
spent only when a step says so:

1. **Validate** the envelope (§2). Malformed never reaches anyone: dead-letter and a
   `delivery-failure` (§13.3).
2. **Run the gate.** A `write-request` runs the CLI; a `check-request` or a touched file
   runs the checks. A green result is a `report` to `from`. A red result is a message
   tagged `check-failed` whose `ref` is the failing check and the file:line, with the
   suite output kept in the ledger, never in the message body.
3. **Route by the registry** (§3 rules 1-3). A `check-failed` goes to the owner the
   registry names for that seam kind (14.4), who is a role, not the dispatcher.
4. **Only now a model:** the role that owns the seam reads the finding and makes the
   change (a coder), or the dispatcher gets what no rule routed (§3 rule 4).

"Checks only work when they aren't falling through programmatically" is step 2 before
step 4: an agent never sees a suite's output, it sees the finding the suite produced,
and it sees it only because a programmatic step could not act on it. Gate: `hub status`
counts model turns by the step that caused them; a cause the registry could have routed
that recurs 3 times proposes a rule, generalising §3's dispatcher rule from routing to
every step. A node where step-4 turns rise without a matching rise in step-3 findings is
a node where models are doing the server's work, and `doctor` says so.

**14.4 The owner of an issue is a registry row, not a judgment (answers decision 32).**
Jacob: "this may depend on the owner of an issue". It does, and the dependence is data:
the registry names one owner per **seam kind**, and `delivery-failure`, `check-failed`
and `bug-report` all route by it:

| seam kind | owner |
|---|---|
| a route, a lease, a stamp, a delivery | the node's server owner (`harness` at the top; a child node's from its registry) |
| a check that is itself broken (raises, wrong fixture) | the checks source repo (`tools/checks`) |
| a red check result in repo R | R's coder role; until roles exist, R's folder agent |
| a hook that is itself broken | the hooks source repo (`tools/hooks`) |
| an action a hook blocked | the caller's own role, which gets the block text |
| a tool's wrong result | that tool's repo |
| anything the table does not name | the node's dispatcher, logged `routed_by: dispatcher` |

Gate: every seam kind in the message vocabulary has an owner row, or the registry
fails `check`; removing a row in a fixture sends that kind to the dispatcher and
nowhere else; the 3-times rule proposes the missing row.

**14.5 Siloed agents in every repo behave as site-scrapers does today.** Site-scrapers
leans this way because its store is gated and its `dev.sh check` is one command with
JSON output. That is exactly the §1a contract. So "the agents in other repos act
similarly once siloed" is not a new design: it is each repo meeting the contract (its
queued item per group), after which the node's server runs its checks and gates, and
its roles are read-only by §13. PLAN-hard-gates.md §3 is the inventory of which rules
already have a gate the server can run and which still need one.

**Decisions for §14.** 37 (agent-last ordering): yes, Jacob 2026-10-04. 36, elaborated as §14.6: yes, Jacob 2026-10-04 ("1) yes", the first row of the table numbered from 1). 38, elaborated as §14.7: yes, Jacob 2026-10-05 ("I'm not sure what the alternative is. So yes?"; the alternative was the dispatcher routing every failure by judgment, §14.3). §14.8 (contract files as setup components, each with a check): yes, Jacob 2026-10-05, **sequential**: setup renders, then runs `checks run .` itself as its last step; the two never run concurrently, and the check output is setup's report. Ownership of the rendered files: PLAN-repo-setup.md §7.8. From 2026-10-04 22:20 decision numbers restart at 1 in every planner reply; the pointer is the identity, so §11 records them by pointer once
answered.

**14.6 Decision 36 in exact terms: one process, four services, and what each does.**
Jacob: "I want to be sure I understand EXACTLY what you mean, so please elaborate."

*The process.* `hub up` starts **one** server process for this node (the claudeTest top;
later one more for site-scrapers when it becomes a child node, §10 phase 3). It listens
on the localhost port its registry names (`server.port`; corrected 2026-10-05 at the re-read in PLAN-hub-review.md §5, this sentence said "a localhost port or a Unix socket named in `.claude/local.env`", which holds only the token and the parent URL). It is configured by
one data file and nothing else: the node's **registry** (roles with their `claude -p`
arguments, tags, children, the four services with the CLI each one runs, the owner
table of §14.7, and the server's own port and keep-alive, which harness's `gen` renders into the registry from the manifest's `servers.<group>` entry: the hub never opens the manifest, PLAN-hub-brief.md §3 fixed point 2). It contains no tool's
command and no repo's path (PLAN-group-servers.md §1a's audit). No model runs inside
it, ever.

*The four services, concretely.*

| service | request | what the server does | answer |
|---|---|---|---|
| `route` | an envelope (§2), from `hub send` or a role's final result | validates; **stamps `origin`** by reading the sender's transcript turn as `relay-gate.sh` does today; applies §3; writes the ledger row; delivers: a cold role is spawned `claude -p --agent <role>`, the dispatcher gets its inbox socket, a child node gets its server | the message id, and later the `report` that comes back the same way |
| `check` | `{repo, scope}` where scope is `touched`, `all` or `audit`; from a PostToolUse hook, the cron audit, or a `check-request` message | runs that repo's `dev.sh check --json` (and `checks run . --json`) in a subprocess; keeps the full output in the ledger | green: a `report` to `from`. Red: one `check-failed` per finding, `ref` = check name and file:line, routed to the owner (§14.7) |
| `hook` | a hook's JSON input, from an HTTP hook on a role, for hooks whose decision needs state: the host failure history `troubleshooting.sh` prints, `quote-words.sh`'s words, `agent-watch.sh`'s staleness, `record-session.sh`'s sockets | answers from the ledger | `additionalContext`, or a non-blocking decision |
| `write` | `{tool, verb, args}` from a read-only role (§13.2) | looks the tool up in the registry: its CLI path and its declared verbs; refuses a verb not declared; runs the CLI | the CLI's own stdout and exit as a `report`; the server adds nothing |

*What stays outside the process, and why.* Every hook that **blocks** (`dispatch-guard`,
`no-inline-blobs`, `prefer-recipes`, `troubleshooting`'s block, `peer-cap`'s hold) stays
a command hook registered in settings, enforcing from local data, because a down server
would otherwise mean "allow everything" (PLAN-group-servers.md §2). Such a hook may ask
the `hook` service for *context* with a short timeout and go on without it.

*When the server is down.* The system degrades to today's, not to nothing: command
hooks still block; the dispatcher spawns roster agents directly (§4, "still the
fallback"); checks run by hand through `dev.sh check`; the planner's Dispatch section
falls back to the inbox socket it uses now. Gate: kill the server, and the day's work
still gets done, with `doctor` saying the server is down.

*What "no separate check server, hook server" changes in the existing plans.*
PLAN-group-servers.md's per-group server **is** this process's `check` and `hook`
services (its `/touched`, `/stop`, `/audit` endpoints become `check` requests), not a
second program; PLAN-auto-relay.md's `relay-gate.sh` stamping and `peer-cap.sh`'s budget
become the `route` service's stamping and loop control; the `write` service is new, from
§13. Build order: §10 phase 1 builds `route` and `write` for cold roles; `check` and
`hook` arrive as services of the same process in PLAN-group-servers.md phase 1, piloted
on site-scrapers.

*What it is not.* Not one server for the whole tree (one per node, §1). Not a store of
any tool's facts (§14.1). Not a replacement for a repo's `dev.sh check`: it calls it.
Not a place where a model decides anything.

**14.7 Decision 38 in exact terms: the owner table, and how a failure finds its row.**
Jacob: "Maybe, lets elaborate on this a bit."

*The data.* The registry has an `owners` table keyed by **seam kind**, an enum in the
message vocabulary. The **server** sets a failure message's seam kind from where it
detected the failure; a sender never does (as with `origin`). Rows may be templates
over the message's `ref`:

| seam kind | set when | owner row |
|---|---|---|
| `delivery` | a message cannot be delivered, validated or stamped | `harness` (top); a child node's server owner from its own registry |
| `lease` | a write lease conflict or expiry | same |
| `check-broken` | a check raised, or failed its own fixture | `tools/checks` |
| `check-red` | a check ran and returned findings in repo R | `{R}/coder` until roles exist, then `{R}/coder`; today `{R}`'s folder agent |
| `hook-broken` | a hook exited with an error (not a block) | `tools/hooks` |
| `hook-block` | a hook blocked a call | the caller's own role; the block text is the message |
| `tool-result` | a `write` ran and the CLI refused or returned non-zero | back to `from` (§3, replies return the way they went) |
| `bug-report` (sent by a role, kind not set by the server) | a role reports a problem in repo R | `{R}` by §3 rule 2; the dispatcher never sees it |
| any kind with no row | | the node's dispatcher, logged `routed_by: dispatcher` |

*Worked examples, from this week.* Last night's relay: the stamp did not happen, so
kind `delivery`, owner `harness`; it would have reached harness's queue as a message
instead of being found by the planner in a transcript. The planner's false report of a duplicate item
number in the hub brief (2026-10-04 22:10; two lists, one "9." each, read as one list): a `bug-report` with `ref` tools/hub, rule 2,
straight to hub, which would have answered "no such defect" to the planner by the same path; today it went planner to dispatcher to hub by `SendMessage`, and
`peer-cap.sh` held the second hop because two windows were talking. A red
`hooks-installed` in tools/todo: `check-red`, owner `tools/todo`. `hooks-installed`
raising on a malformed `settings.json`: `check-broken`, owner `tools/checks`.

*How a missing row is filled.* An unowned kind goes to the dispatcher and is logged.
When the dispatcher re-routes the same kind to the same owner 3 times, the server
proposes the row and Jacob accepts it with `agents.sh routes accept` (§3). So the table
starts small and grows only from evidence, and judgment becomes procedure one row at a
time.

*Gates.* The vocabulary's seam kinds and the owner table's keys are checked both ways
(a kind without a row is allowed only as the explicit `unowned` default; a row without a
kind fails). A fixture that removes `harness`'s row sends a `delivery` failure to the
dispatcher and nowhere else. A fixture that flips a check's fixture result moves the
message from `check-red` to `check-broken` and from the repo to `tools/checks`.

**14.8 What makes the architecture the default, and who declares the services (Jacob,
2026-10-04).** Jacob: "if checks does not enforce design decisions, what tells new apps
to build with this type of architecture as a default not as the exception. Also does
this mean that setup will have a server that registers services? The route should
determine TYPES of routes, but the services should be determined ahead of time and not
guessed by an agent right?"

*Three jobs, three tools, in that order.* The plans decide the architecture once.
**`setup` installs it** into every new or adopted repo as the starting state, so a repo
meets the contract before anyone writes a line of its own: that is what makes it the
default rather than the exception. **`checks` keeps it**: a repo that stops meeting the
contract goes red, and `rules-gated` ties each rule to its check. Setup and checks are
both data-driven, so the architecture is a template plus a fixture, not a habit. What
setup installs today (`setup components`): the rules block, the hooks and settings
proposal, TODO.md, a `dev.sh check` stub that **fails until filled in**, the ignore
entries, the commit, the remote. Its `agent` and `server` components print "nothing"
because the roster and the server entry had no defined shape. §14.6 defines the shape,
so the contract becomes the next setup components, each with a check beside it:

| contract item | setup installs | checks enforces |
|---|---|---|
| `dev.sh check --json` in the one schema (PLAN-agent-groups.md §4.4) | the stub, failing | `check-json`: the output conforms, red and green fixtures |
| one gated CLI per store, declared verbs | `cli.json` skeleton: `{store, cli, verbs: []}` | `accessor`: nothing in the repo reads the store around its CLI |
| `checks.json` (which generic checks apply, their params) | the baseline list | `todo-valid`, `rules-in-sync`, etc., as now |
| `services.json` (below) | the skeleton with the repo's name and its `check` command only | `services-valid`: every entry names an existing executable and verb; nothing undeclared |
| the registry entry at the node | a proposed row in `registry.proposed.json`, as `settings.proposed.json` is today | `registry-matches`: the node's registry agrees with every repo's `services.json` |

*No, setup has no server, and nothing registers at run time.* Setup writes **data**: a
repo's `services.json` declares, ahead of time, what the server may do with that repo:
its check command, its CLI and the verbs the `write` service may run, the tags it owns
for `route`. The node's server reads the registry at start and on `hub reload`, and the
registry is the union of the repos' declarations, which `registry-matches` keeps equal
to them. A verb that is not declared is refused by the `write` service (§14.6), and a
tag with no declaring repo has no owner and falls to the dispatcher (§14.7). No agent
ever adds a service by acting; it adds one by editing `services.json` in the repo it
owns, which goes through that repo's check and commit. The server's `route` knows the
**kinds** of route (the vocabulary of message types and seam kinds) and nothing about
any repo; which repo answers a kind is the registry's data. So Jacob's reading is
exactly right: the server determines types of routes, the services are declared in
advance, and no agent guesses either.

*Gates.* Setup's conformance fixture (PLAN-group-servers.md §1a): a fresh folder after
`setup <path>` passes `checks run .` on every contract check, red fixtures and all. A
`services.json` that names a verb the CLI does not implement fails `services-valid`
(fixture). A registry row with no matching `services.json` fails `registry-matches`
(fixture). Removing `cli.json` from a repo that has a store fails `accessor`. Each is a
tools/checks item, installed by a setup component, so the set of components and the set
of contract checks are compared both ways by `help-matches`'s sibling for setup.

## 15. The roster settings page (Jacob, 2026-10-19)

> "I would also like to be sure there is a settings page for changing what each agent
> is set at in the hub app (e.g. opus 5.5. max effort."

Nothing planned had one. Neither the hub brief nor this plan lists a page for the
roster's knobs.

**The page shows one row per roster agent, plus the dispatcher and the planner.**
Each row shows the agent's:
- model and effort, read from `.claude/agents.manifest.json`, and whether each one
  comes from the agent's own override or from `coders`;
- `model_reason`, when the model is not Opus;
- maxTurns.

The `coders` defaults (today `claude-opus-5-5`, effort `high`) are their own row, so
one change covers every agent that inherits them.

**It writes through one path, and that path already exists.** A change on the page
asks the hub's server to run:
1. `agents.sh set <agent> <key> <value>`, the manifest's one writer;
2. `gen`;
3. `check`;
4. a commit inside `.claude/`.

So the page holds no copy of the roster and no second writer (§14).

**`set` does not reach the two windows yet.** On 2026-10-19, Jacob's
`agents.sh set planner effort '"max"'` failed: "no agent 'planner' in the roster".
- The planner's and dispatcher's knobs live in the manifest's top-level `planner` and
  `dispatcher` blocks, not in `.agents`, and nothing writes them but a hand edit.
- **Step 0, harness:** `set` accepts `planner` and `dispatcher`, writing those blocks
  under the same checks, with a test for each, before the page is built.
- Jacob's first use of it sets `planner.effort` to `max` (approved: Jacob 2026-10-19).
  It takes effect at the planner window's next start. A change `check`
refuses shows its message and changes nothing:
- a non-Opus model without a `model_reason`;
- an effort outside the allowed values.

**Effort is pinned per agent on purpose.** The manifest's comment says so: it keeps a
dispatcher at `/effort max` from silently running every agent at max. The page shows
the pinned value next to the session's own, so the two are never mistaken for each
other.

**Who may change it:** Jacob, from the page. A role that reaches the server gets the
page read-only (§13).

**The model allowlist** is read from the manifest's list of known models, never typed
into the page.

**The page shows each change's cost.** After a change, it shows
`agents.sh tokens --agents --since <the change's date>` for that agent: CLAUDE.md
keeps a change only if the numbers say it helped.

**Settings stay out:** `.claude/settings.json` (the dispatcher's own model and the
hooks) is Jacob's file. The page shows it and never writes it.

**Gates, in the change that builds it:**
- the page's rows equal `agents.sh list`, both ways;
- a change made on the page and the same `agents.sh set` from a shell leave identical
  manifests (fixture);
- a refused change leaves the manifest's hash unchanged (fixture);
- the server refuses a write from a read-only role (fixture).

**Owner:** hub, from this section. It is added to the hub brief's inputs.

track: TODO.md "Roster settings page"

## 16. Fable 5.1 at max, where the account allows it (Jacob, 2026-10-19)

> "I'd also like to set Research, and Planning to default to Max effort fable 5.1
> conditional upon the user being able to run Fable (so a plan that allows it or usage
> credits, plus fable usage if that is what they have)."

Approved: Jacob 2026-10-19. The audit agent (§18) joins the list by his next message
("that should also be conditionally fble 5.1 and max").

**The policy.** The roles that think rather than build, the planner, `research` and
`audit`, prefer `claude-fable-5-1` at effort `max`. Their fallback is what they run
today: the `coders` default, Opus 5.5 at `high`. Every other agent stays on `coders`.
Jacob ended the 2026-10-03..05 Fable trial for the planner and harness himself; this
section reinstates it for the planner only because he raised it again.

**The manifest shape.** An agent, or the `planner` block, gains one key:

```
"prefer": {"model": "claude-fable-5-1", "effort": "max", "when": "fable"}
```

`model` and `effort` stay the fallback. `check` requires a `model_reason` beside any
`prefer` whose model is not Opus, as it does for `model` today.

**The condition `fable`, in one place.** `usage can-run <model>` answers `ok`, `hold
<until>`, `credits`, `refused` or `unknown`, from a record in `~/.claude/usage/
models.json` (`model`, `checked_at`, `result`, `evidence`):

- **A probe,** at most once per `probes.model_ttl_hours` (24): one `claude -p` call
  with `--model <model>` and `--max-turns 1` on a one-word prompt. `ok` is a reply;
  anything else is recorded with its exit code and stderr. What a credits-only plan or
  a plan without Fable prints is unknown here: Jacob's plan has Fable. Research
  settles it (step 1) or the record says `unverified` and the probe treats every
  non-reply as `refused`.
- **Jacob's own answer:** `usage can-run --set <model> ok|no "<reason>"`, dated,
  for the case the probe cannot tell. A wizard question can ask it.
- **The meter.** The status line's `rate_limits` carries `five_hour` and `seven_day`
  only (code.claude.com/docs/en/statusline#rate-limit-usage, kb mirror of
  2026-10-09), so a separate Fable window cannot be read there today, though the
  desktop app shows one (seen 2026-10-03). Until the status line carries it, a
  rate-limit `StopFailure` in a session on that model sets `hold` until the reset
  time the failure names, through the reporter `usage-failure.sh` already runs. When
  the platform adds the window, `usage gate --model` reads it and this paragraph is
  retired.
- **Fail-safe:** every answer but `ok` resolves to the fallback. A wrong `ok` fails
  loudly at the spawn, never silently.

**Where it is resolved.**
- `agents.sh gen` renders each definition with the resolved model and effort, and a
  line `resolved: prefer|fallback, checked <time>` so the choice is visible in the
  file.
- `agents.sh run planner` resolves at launch and passes `--model` and `--effort` (the
  frontmatter does not set a main thread's effort, as the header of the planner
  definition records).
- `doctor` says when a definition's resolution is older than the TTL or no longer
  matches `can-run`, and names `gen`.
- `check` fails a rendered definition whose model is neither its `prefer` nor its
  fallback.
- The settings page (§15) shows all three: preferred, fallback and resolved.

**The measure.** `agents.sh tokens --agents --since 2026-10-19` per agent, and the
re-runs avoided, judged after a week, as CLAUDE.md asks of every model change. The
price table already holds a `claude-fable-5-1` row, so `tokens --prompts` prices it.

**Gates, in the same change:** a record past the TTL is never used (test); `credits`
and `refused` resolve to the fallback (fixtures); a `prefer` without `model_reason`
fails `check` (fixture); `gen` writes the `resolved:` line and `run --dry-run` prints a
matching `--model` and `--effort` (tests); a Fable rate-limit hit sets `hold` (fixture);
a hand edit of `models.json` to a stale `ok` is caught by the TTL, not trusted.

### Steps

1. **`research`:** the probe question, recorded and answered: what `claude -p --model
   claude-fable-5-1` returns on a plan without Fable and on one where Fable bills
   usage credits (exit code, stderr), from the docs through kb, else `unverified`.
   track: TODO.md "Fable where allowed"
2. **`usage`:** `can-run`, `--set`, the TTL, the hold from a hit; tests.
   track: TODO.md "Fable where allowed"
3. **`harness`:** `prefer` in the manifest, `check`, `gen`, `run`, `doctor`; the
   planner and `research` set to prefer Fable at max, `audit` when §18 lands; after
   step 2. track: TODO.md "Fable where allowed"
4. **`research`:** answers as well as records, on the model preferred here, and R3
   (PLAN-services.md §3) is amended to say so: `deep-work` answers only a question no
   research dispatch holds. Jacob chose (a) of: (a) `research` answers too; (b) a new
   `researcher` agent; (c) `deep-work` keeps answering on Opus (approved: Jacob
   2026-10-19, "research-answers"). Step 3's harness brief carries it: `research`
   gets `prefer` like the planner, and its definition says it answers.
   track: TODO.md "Fable where allowed"

## 17. Read and run dispatches share a folder (Jacob, 2026-10-19)

> "I know that we have coding agents that we have limited to having only one making
> changes at a time. This makes sense. But in terms of running site scraping
> agents/tools in parallel, or research agents in parallel, I think there is no reason
> not do this with this type of agent. Can we be sure we have a framework that allows
> for this type of work/agents to be non-blocking when it needs to be?"

**No, not today.** `dispatch-guard.sh` treats every dispatch as a writer: a second
dispatch into a folder is refused with "one writer -- X is already running" whatever
the second one does (its line 384). So two scrape runs, or two research questions, run
one after the other. `deep-work` has no folder and is not held (unverified: from the
guard's folder rule -- settle: `bash .claude/hooks/test-dispatch-guard.sh`). Inside one
run, `site-scrapers` already loads many pages at once; the serial part is the dispatch.

**Three modes, declared on the brief** (`mode: write|run|read`; the default is
`write`, today's behaviour):
- **`write`:** edits code, recipes, docs or settings. One per folder, as now.
- **`run`:** produces records only through the folder's own CLI (a scrape, a research
  answer, an audit finding), and commits them. Any number at once.
- **`read`:** writes nothing. Any number at once.

Neither `run` nor `read` blocks a `write`, and a `write` blocks neither. What keeps
them apart is the store, not the lock: each store's CLI is safe under concurrent
writes (site-scrapers: WAL and a busy timeout, recorded in its CLAUDE.md), and a run
records the recipe version it used (unverified: site-scrapers -- settle:
`node query.js --help`, the run record's fields). Only writers exclude writers.

**One contention class, from PLAN-check-progress.md §10's vocabulary:** `uses:
browser`. Two dispatches that declare it do not overlap: the guard holds the second
and names the first. CLAUDE.md records why ("Contention produces failures
indistinguishable from real ones": five recipes failing under two sweeps that passed
alone). A single-recipe run does not declare it; a sweep (verify, health) does. A sweep
that ran without declaring it is found afterwards by the ledger audit, not prevented.

**What a `run` or `read` dispatch must not do is edit code.**
- **Enforced** where the guard can tell, from inside the subagent, which dispatch it
  belongs to: then the dispatcher's own write block applies to that agent for the
  length of the dispatch. Whether a PreToolUse call inside a subagent carries a key the
  spawn record holds is harness's first probe.
- **Detected** otherwise: at `SubagentStop`, the folder's working tree before and after
  (`lib/dirty-files.sh`, which knows the dispatch even though it cannot name a writer,
  hx-94) flags a `run` or `read` dispatch that changed a file outside its CLI's
  stores.
- The ledger records `mode` and `uses`; `agents.sh dispatches` prints them.

**What the owners need first:** `research` is safe under two `answer` calls at once,
and its commit retries on `index.lock` (a test with two concurrent answers, both
landing); `site-scrapers` names which of its verbs are sweeps in `services.json`, so a
brief that omits `uses: browser` for one is caught. Each is a report to that owner.

**Gates:** two `run` dispatches into one folder are both admitted (test); a `write`
while a `run` runs is admitted (test); two `write` are refused, as now (test); the
second of two `uses: browser` is held (test); a `read` dispatch that wrote a file is
flagged (fixture); malformed `mode` passes as `write` (test, fails open to the strict
case).

### 17.1 Fan-out: who starts parallel work, and what keeps it apart (Jacob, 2026-10-19)

> "I DO want to be sure that agents and services are not competing with each other,
> and that this is gated/impossible to do by mistake. [...] if there was a
> sub-dispatch for every service that was capable of routing things necessary for the
> code agent to the code agent, spinning up as many site scraping agents as necessary
> to do all tasks that do not block each other in parallel. This should be possible
> for research, planner, and MOST of the services/agents we've created."

**A sub-dispatcher cannot be an agent.** `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`
(`.claude/settings.json`): a spawned agent cannot spawn. What can start parallel
work is the dispatcher (one message, several `Agent` calls, which Claude Code runs at
once: it is already every folder's sub-dispatcher), a program (the hub, D3; cron; a
CLI that starts processes), and a tool that fans out inside itself (a promise
combinator, as site-scrapers' `lib/fillForm.js` does; its sweeps do not yet). So the sub-dispatch per
service is **a table, not an agent**: every verb in a repo's `services.json` declares
its `mode` (§17) and its `uses`, and the brief's `mode:` and `uses:` lines are read
from the verb the brief names, never typed. A line that disagrees with the table is
refused. The dispatcher decides nothing here; the hub inherits the same table.

**The unit is the cheapest one that does the work:** a process before a dispatch, a
`run` before a `write`.
- **Scraping:** N recipe runs are N processes under one dispatch, or under none (a
  cron line through chron.py). An Opus agent enters only when a recipe is broken,
  which is a `write`. "As many scraping agents as necessary" is "as many scraper
  processes as the browser class allows", which costs no tokens.
- **Research and audits:** judgement per item, so N `run` dispatches, each one
  question or one audit's row set, each writing records through the CLI.
- **The planner:** parallel plans are cloud sessions, one per plan
  (PLAN-cloud-offload.md §8), and `Explore` for reads; a planner window stays one.
- **Code:** one writer per folder. A large write is split into checkpoints (`todo
  split`) and run in order; writes in different folders already run at once.
- **Services' CLIs:** parallel by their store's proof, below.

**The competition classes, each with its gate.** Forgetting one can only make work
slower, never collide: an undeclared verb is `write` and `serial`; an unknown `uses`
value fails `check`.

| class | what collides | the gate |
|---|---|---|
| folder | two writers of one repo | dispatch-guard today; the hub's write lease (§6) |
| browser | two sweeps | `uses: browser` held by the guard on the model path, **and** a lock inside site-scrapers for its sweep verbs (`verify`, `health`), like `dev.sh check`'s `.check.lock`: a second sweep is refused whoever started it (cron, a shell, an agent). Single-recipe runs are not sweeps. Unverified: `verify` and `health` take no lock today (a grep of `dev.sh`, `verify.js`, `lib/*.js` found only the check lock); probe: start two `./dev.sh verify`, the second must refuse |
| store | two writers of one store | a proof per store: its CLI is safe under N writers at once. todo: `Store.lock()`, an flock on the repo folder (`todolib/store.py`); site-scrapers: WAL and a busy timeout; `research.json`: none found, unverified, probe two `research answer` at once; PLAN-services.md §4 step 10 moves every dynamic store to SQLite, which settles it. A store without the proof is `uses: store:<name>` and runs alone. `checks` gate `store-concurrency`: every store a `cli.json` names has a passing concurrency test named in `services.json`, or is declared `serial` |
| git index | two commits in one repo | `run` dispatches commit only their records' paths, through one helper that retries on `index.lock` (`lib/commit-records.sh`); a `write` commits as today |
| tokens | N dispatches draining the 5h window | the gate on the sum: `usage gate $((N * median))` before a fan-out, median from `agents.sh tokens --agents`; `fanout.max_run` in the manifest (default 4) caps N |
| the dispatcher's context | N reports | ten lines each, as today, and one batch summary in `allSettled` form: k of N, the failures named |

**The directive,** one paragraph for CLAUDE.md "Parallelism" (the dispatcher writes
it on approval): "Parallel work is declared, never improvised. A dispatch runs beside
another only in a mode and class its verb table allows; a store is written in
parallel only with its concurrency proof; the browser is one sweep at a time, in the
tool; fan out by the cheapest unit, processes before dispatches and runs before
writes." The per-repo part is not prose: it is the `store-concurrency` gate.

### Steps

1. **`harness`:** the guard's modes and the `uses: browser` class, the ledger fields,
   the brief shape (`mode:` and `uses:` lines, like `todo:`), the tests above, the
   `dispatches` columns. track: needs-yes PLAN-routing-tree.md §17
2. **`research`:** `answer` safe under two calls at once and a commit that retries on
   `index.lock`, with the test; reported to it from here.
   track: needs-yes PLAN-routing-tree.md §17
3. **`site-scrapers`:** its sweep verbs named in `services.json`, so a brief that
   omits `uses: browser` for one is caught; reported to it from here.
   track: needs-yes PLAN-routing-tree.md §17
4. **`hub`:** carries the modes and the classes into its `route` (§6 invariants: the
   write lease becomes a lease per class value, unbounded for `run` and `read`).
   track: needs-yes PLAN-routing-tree.md §17
5. **`checks`:** per-verb `mode` and `uses` in the `services.json` schema, the
   `store-concurrency` gate, fixtures for an undeclared verb (strict default) and an
   unknown `uses` value (fails). track: needs-yes PLAN-routing-tree.md §17
6. **`site-scrapers`:** the sweep lock in the tool, after the probe above; two
   single-recipe runs at once stay allowed, with the test.
   track: needs-yes PLAN-routing-tree.md §17
7. **`harness`:** `mode:` and `uses:` derived from the verb table at spawn (a
   disagreeing line refused), `fanout.max_run`, the gate on the sum, the batch
   summary, `lib/commit-records.sh`; after 5.
   track: needs-yes PLAN-routing-tree.md §17
8. **`dispatcher`:** the directive paragraph into CLAUDE.md "Parallelism".
   track: needs-yes PLAN-routing-tree.md §17

## 18. The audit agent (Jacob, 2026-10-19)

> "I also think we need to have programatic audits as well as an auditing agent, that
> should also be conditionally fble 5.1 and max."

Approved: Jacob 2026-10-19.

**What exists.** The programmatic audits are built and run on demand: `checks all`,
`checks practices` (97 live rows on 2026-10-19, baseline 774 red cells), `hooks
copies`, `hooks audit`, site-scrapers' `audit.js`, `research audit`, the route
guard's `unrouted` audit, `agents.sh dispatches`. No agent audits, and nothing runs
the audits on a schedule. PLAN-architecture.md §10's two audits named `deep-work`
because no audit agent existed.

**The agent: `audit`.** A roster agent with no folder, `deep-work`'s shape, that:
- prefers Fable 5.1 at max (§16), with the roster default as its fallback;
- **cannot edit:** `disallowedTools` removes Edit, Write and NotebookEdit, and `check`
  asserts it on the rendered definition; Bash writes are caught as the dispatcher's
  are. Every dispatch of it is `mode: run` (§17);
- **writes findings only through CLIs:** `checks ledger` (PLAN-architecture.md §9
  step 6: rule, `path:line`, owner, evidence, state), `todo report` to each owner,
  `research answer` when a finding answers a recorded question. The readable report
  (`RESEARCH-<audit>.md`) is rendered from the ledger by `checks ledger render`, so
  the report's text equals the ledger's, as PLAN-architecture.md §10 already requires
  of the hub view. No finding without a `path:line` is accepted;
- **reads the programmatic audits first,** and judges only what they cannot: the
  `unknown` and `unchecked` cells, and whether a rule with no check could have one.
  Each such rule comes back to Jacob as a candidate gate, in a Decisions row through
  the planner.

**The programmatic audits on a schedule.** A job through `chron.py`
(scriptingTools/chronjobScheduler), nightly, runs the programmatic set above with
`--json` into the ledger; the hub's assurance view shows the latest; `doctor` prints
"last audit <n> days ago" past two days. A scheduled job is Jacob's yes, given on
2026-10-19 ("a cron job on my machine! This is good! We are using the tools we have
built to build out more tools and features!").

**Gates, in the same change:** a Write by `audit` is refused (test against the
rendered definition); a finding without `path:line` is refused by `checks ledger`
(fixture); the rendered report equals the ledger records (test); a finding for another
owner lands in that owner's store (test, through `todo report`); the definition's
model is its `prefer` or its fallback (§16's check).

### Steps

1. **`harness`:** `audit` in the manifest (no folder, `model_reason`, `prefer` per
   §16, `disallowedTools`), `gen`, `check`, commit; after §16 step 3.
   track: TODO.md "The audit agent"
2. **`checks`:** `ledger add` and `ledger render`, if §9 step 6 did not build them.
   track: TODO.md "The audit agent"
3. **`audit`:** PLAN-architecture.md §10's two audits, its first runs, in that order,
   under the `usage gate` rule there. track: TODO.md "The audit agent"
4. **`cron-scheduler`:** the nightly job, through `./dev.sh try` first, then the real
   crontab (approved: Jacob 2026-10-19); after step 3's first run passes, and under
   `usage gate` before each run. track: TODO.md "The audit agent"

## 19. Replies are records (Jacob, 2026-10-19)

> "Do we have a way to keep track of comments that are returned by you or the
> dispatcher in the same way we keep track of todos and decisions? These should be
> able to be 'marked as read' in the hub once we get there."

**No.** A window's final reply exists in its transcript and nowhere else. The one row
per reply that `question-gate.sh` writes (`.claude/state/question-gate.jsonl`) holds
the reply's hash and the gate's verdict, not its text; `agents.sh rebrief` shows a
text can be read back from a transcript, which is what a lost one costs.

Approved: Jacob 2026-10-19.

**The record.** A Stop hook in both windows, `reply-ledger.sh`, writes one row per
final reply to `.claude/state/replies.jsonl` (`key`, `t`, `role`, `session`, `turn`,
`sha`, `bytes`, `title`, `path`) and the reply's text to
`.claude/state/replies/<key>.md`. The unit is the reply, every reply, because that is
the only rule that needs no judgement: a reply that was only "done" is one row Jacob
marks read in a second. `title` is the reply's first heading, else its first line,
cut at 80 characters. The ledger goes through `lib/append.sh` like the others, so a
row it cannot write is kept and said, never dropped. Nothing is captured from Jacob's
own prompts, and nothing from a subagent's report: those are already the
dispatcher's reply once relayed.

**Read is a second ledger,** `replies-read.jsonl` (`key`, `t`, `by`), append-only
like `relay-receipts.jsonl`: a reply is unread until a row names it, and the mark can
be undone by a `by: undo` row. `agents.sh replies [--unread] [--since DATE] [--json]`
lists newest first, 15 lines in text, unread first; `agents.sh replies --read <key>
[--all-before DATE]` marks; `agents.sh replies show <key>` prints the text. The hub's
inbox view (§13 roles: Jacob writes, every other role reads) lists unread replies by
window and marks them read only through that CLI (§14: the server is the only path).
The todo store is not touched: a reply that carries work gets a todo item through
`todo add --tags ref:reply:<key>` as today, by whoever reads it.

**Gates, in the same change:** malformed hook input exits 0 and writes nothing
(test); a text file that cannot be written leaves a row with `path: null` and is said
(test); a read mark for an unknown key is refused (test); `--unread` after a mark
drops the reply and an `undo` row brings it back (test); the listing is bounded
(test); `replies/` is rotated past `spawn_watch`'s own horizon rule, 90 days, and a
rotated reply's row stays (test); `wiring.json` names the hook for both windows and
`doctor` says when it is not wired.

### Steps

1. **`harness`:** the hook, the two ledgers, `agents.sh replies`, the tests, the
   `wiring.json` entry; Jacob applies the settings change (`wiring --apply`).
   track: TODO.md "Replies are records"
2. **`hub`:** the inbox view in `PLAN-hub.md`, from this section, added to the brief's
   inputs. track: TODO.md "Replies are records"

## 20. Warm roles: the agent that owns the knowledge, visible and addressable (Jacob, 2026-10-19)

> "I wonder if de-abstracting sub agents might be better, as this would allow us to
> more easily view what's going on/interact directly if I want to talk to an agent."
> "This is exactly the sort of thing service level dispatch would prevent. It can have
> all the relevant info in context and ready to run without running commands."
> "EVERYTHING can be sent to an agent that owns the requisite knowledge, and we don't
> have to be wasting compute on relearning stuff over and over and over."
> "There is obviously a balance between space and time efficiency, but we should be
> able to determine what works best."

**Right, and it is one thing, not two.** A role the hub drives (brief item 11, D3:
"drive") is a de-abstracted agent: a `claude` process of its own, started in its
folder, that stays up between requests. Because it stays up, it holds its service's
knowledge once (its CLAUDE.md, `cli.json`, the CLI's help, the store's shape) and
answers each request from that, so nobody relearns it: the planner that ran `todo
decisions -h` on 2026-10-19 to record three answers would instead send "dt-3: 2)
refresh 3) fable 4) drive" to the `todo` role. Because it is a process, Jacob can see
it (its window or transcript) and talk to it (`SendMessage` by name, or type in its
window). Today's subagent has neither property: it starts cold (`tokens --agents`:
every roster agent starts near 30k tokens, half of it CLAUDE.md), does one job, and
reports ten lines into the dispatcher's context.

**The rule.** A request carries facts, never procedure: what to record, what to
answer, what to check. The role that owns the service runs its CLI. This is "one way
in" (PLAN-services.md §3) applied to agents as it is to code: the store's CLI is its
only writer, and the service's role is the only thing that runs that CLI on another
role's behalf. The planner's own CLI use (the top-level todo store) ends when the
`todo` role is warm; until then it stays, and the planner reads no `-h`: the commands
it needs, verified, are in `PLANNER-HANDOFF.md`.

**Warm or cold is decided by the knowledge, not the task.** Warm when the knowledge
is stable and reused: a service's CLI and store (`todo`, `research`, the `checks`
ledger, `usage`), a folder's code for its owner. Cold and siloed when the knowledge
is the job's input: an audit of one plan, a migration check of one store (§21.1). A
warm role whose knowledge changed is wrong, so it restarts when its folder's HEAD
moves or its context passes `roles.context_budget` (brief item 11's rebuild).

**Space against time is measured, not argued.** A warm role keeps context between
requests; a cold dispatch pays the start again. Which is cheaper per request is a
number per role: `tokens --agents --roles` reports tokens per request warm against
cold, and lines printed for Jacob per request, from the ledgers. A role stays warm
only while its number says so; the order below is a hypothesis the numbers confirm.

**What it costs.** Nothing while idle. Per request, the message and the turn; the
start context is paid once per restart instead of once per dispatch.

**What moves.** The folder lock stays where it is until the hub's write lease (§6)
exists, so the first warm roles are the ones that write only records (`mode: run`,
§17): `todo`, `research`, the `checks` ledger. Folder writers follow the lease. A
role window started inside its folder runs that folder's hooks and sees no roster
definitions, so it cannot spawn roster agents: the silo is a fact of where it starts.
`peer-cap.sh`'s two-message rule is for the two windows; a role gets a daily request
budget (`roles.daily_budget`) instead, and its requests are ledger rows like any
dispatch.

**Visible on demand, not always.** §21's objective asks for less on screen, so a
role's window is a tab Jacob opens, and the hub's page shows one line per role: name,
state, the request it is on, its last reply's key.

**Gates:** a request to a warm role appears in the ledger with mode and class; the
role's reply is a record (§19) and reaches the sender; a role whose HEAD moved is
restarted before its next request (test: commit in the folder, send, the role's start
time is later); a role never spawns a roster agent (test: it has none to spawn);
`tokens --agents --roles` reports per-request tokens warm against cold.

### Steps

1. **`research`:** the probe of brief item 11, with the measurement: one `todo answer`
   request through a warm `todo` session (`claude -p` stream-json, or a pair window)
   against one cold dispatch, tokens for each.
   track: needs-yes PLAN-routing-tree.md §20
2. **`harness`:** `agents.sh pair --role <agent>` opens a roster agent as a session in
   its folder (iTerm2, as `pair` does), recorded by `record-session.sh`, with the daily
   budget in `peer-cap.sh`, the HEAD-moved restart, the ledger rows, and `tokens
   --agents --roles`; `agents.sh roles` lists the open ones.
   track: needs-yes PLAN-routing-tree.md §20
3. **`dispatcher`:** sends a `run` request to an open role (`agents.sh roles`) and
   spawns only when none is open. track: needs-yes PLAN-routing-tree.md §20
4. **`hub`:** PLAN-hub.md orders the roles: record services, then `audit`, then folder
   writers after the lease; the role line on its page.
   track: needs-yes PLAN-routing-tree.md §20

## 21. The objective, and what it changes (Jacob, 2026-10-19)

> "The objective of this app is to make it so I can use claude code better. Miss less
> of what you say, and see less output that is unnecessary for the human aspects of
> the decision making process. This is why being efficient with screen real estate is
> so important."

**A fixed point for the hub** (brief §3, copied there by the hub), and the test every
view and every reply here is measured against: *did Jacob miss a thing he had to act
on, and did he read a line he did not need?* Two numbers, both from stores: replies
not marked read after N days (§19) and decisions open past their table (`todo
decisions`), against lines printed for him per day (the reply ledger's `bytes`, the
hooks' notices).

**What already serves it:** §19 (every reply a record, with read marks); §13 and
PLAN-question-routing.md (questions typed and routed, decisions as one table); brief
item 12 (ids shown as stubs, expanded on demand); §15 (the roster page); §17.1's batch
summary (N results, one table).

**Improvements proposed, each with its gate (needs-yes):**

| # | improvement | where | gate |
|---|---|---|---|
| 1 | **The four counts in the status line now,** before the hub: open decisions, steps for Jacob, unread replies, running dispatches, each from its CLI (`todo decisions --json`, `agents.sh replies --unread`, `dispatches --open`) | context-hygiene's `statusline.sh` | fail-open; a count that cannot be read prints `?`, never nothing |
| 2 | **Notices print one line and a pointer.** A hook that prints for Jacob (plan-drift's twelve items at session start, doctor, the relay notices) prints the count and the command that lists them past `notices.max_lines` (3) | `.claude/lib/notice.sh`, every hook that prints | a test per hook that a long list is one line |
| 3 | **A reply budget for the planner.** `question-gate.sh` already checks the planner's reply shape; it gains a notice (never a block) when a reply passes `reply.max_lines` (60) outside its tables, naming the plan section the prose belongs in | harness | the notice fires on a fixture over budget, not under |
| 4 | **Unread and unanswered are different.** A reply whose Decisions table is `dt-N` carries `table: dt-N` in its ledger row, so the hub shows "awaiting your answer" apart from "unread", and `todo answer` marks the reply answered | §19 step 1 | a reply with a table is not "read" by `--read` alone |
| 5 | **The objective review of every plan,** by siloed `audit` dispatches (§21.1): one plan each, filing proposals as records; the planner reads the render, never the plans again | `audit`, after §18 steps 1-2 | each dispatch's start context under `audit.start_budget` (12k), by `tokens --agents` |
| 6 | **The dispatcher's reply after a fan-out is one table** (§17.1): k of N, failures named, each with its report key | §17 step 7 | a fixture of three reports renders three rows |

### 21.1 Silos: cold, scoped audits beside the warm roles

> "We may need audit subagents for tasks like this in the future. Migrating data, but
> also making changes that subscribe appropriately to our design and architecture
> decisions. This way you, the planner does not need to have a continuously ballooning
> context, and neither does an audit agent need to have context that contains things it
> is no longer auditing and/or never will. Silos!"

Yes, and §18's `audit` is the agent; what makes it a silo is the brief and the start
context. **The brief names its inputs and nothing else:** the objective or the
decision it checks against (a section pointer), the one plan, store or repo it reads,
and the record it files (`checks ledger add --kind proposal|finding`, or a research
record). **The start context is small:** `omitClaudeMd` with "Constraints that don't
bend" copied in, as the folder agents with their own CLAUDE.md already get, and
`maxTurns`; the measure is `tokens --agents`, start under 12k against today's 30k.
**Apply and verify are two agents:** the owner applies a decision or migrates a store
(its folder, `mode: write`); an audit verifies it afterwards with only the two things
to compare (the decision's text and the diff; the old store and the new one) and files
the result. One agent doing both would carry both contexts and grade its own work.
The planner reads renders: `checks ledger render --kind proposal` for the review, and
the dispatcher's table for the rest.

### Steps

1. **`audit`:** the objective review (table row 5), one dispatch per live plan in `run`
   mode, after §18 steps 1-2; the render goes to the planner as one list.
   track: needs-yes PLAN-routing-tree.md §21
2. **`harness`:** `omitClaudeMd` and `maxTurns` for `audit` with the start-context line
   in `check`; `lib/notice.sh` and the cap in every hook that prints for Jacob (row 2);
   the reply budget notice (row 3); `table:` in the reply ledger (row 4, into §19 step
   1 if it has not landed). track: needs-yes PLAN-routing-tree.md §21
3. **`context-hygiene`:** the four counts in the status line (row 1).
   track: needs-yes PLAN-routing-tree.md §21
4. **`hub`:** the objective as a §3 fixed point of the brief, and the two numbers as
   the page's first line (Jacob's words of 2026-10-19 are the approval).
   track: TODO.md "The objective in the hub"

## 22. Answers without the model: the answer tag and the wizard sitting (Jacob, 2026-10-19)

> "Are there hooks for when I text to you? Is there a way I could programmatically
> return more decisions without you digesting them by tagging my answers to you while
> you are thinking? This way if you are doing work, I can still do more work at the
> same time."

**Yes, and the hook exists.** `UserPromptSubmit` runs on every prompt submitted in a
window, before the model sees it. On exit 0 it may add context; it may also block the
prompt, and a blocked prompt is erased from context with its reason shown to Jacob
(https://code.claude.com/docs/en/hooks#userpromptsubmit-decision-control, fetched
2026-10-09; `kb show` that anchor for the text). Three of ours already run there:
`agent-watch.sh`, `peer-cap.sh`, `record-session.sh` (`wiring.json`).

**The answer tag.** A prompt that starts with a table id, `dt-3: 2) refresh 3) fable
4) drive`, is an answer, not a message. A fourth hook on that event, `answer-tag.sh`
(harness), parses exactly that shape, applies it through `todo answer --table dt-N
'…'` (the one way in), and blocks the prompt with todo's own output as the reason:
Jacob sees `answered dt-3: 3 row(s)` and the rows; the model never reads the prompt
and pays nothing for it. A line that does not parse passes to the model as an ordinary
prompt (fail-open) with the parser's reason printed first, so a typo is visible. Only a
prompt Jacob typed qualifies: a relay arrives by the inbox socket, not as a prompt, and
`peer-cap.sh` already tells the two apart. What the model learns: one line at its next
turn from `record-session.sh`'s prompt context ("answered since your last turn: dt-3
rows 2-4"), and the whole state from `todo decisions` when it acts. The id Jacob types
is the one `todo decisions` gives the reply's table.

**Mid-turn is the probe.** Whether the hook fires when the line is typed or when the
queued line is consumed at the turn's end is not in the docs (the kb has no section on
queued prompts). Either way the model never digests it: the block happens before the
prompt would enter context. What differs is when the row lands, and whether `todo` runs
while the planner's own todo command runs (the store's lock, `Store.lock()`, covers
that). Step 1 settles it.

**The sitting is the batch path.** For more than a few answers there is no window at
all: `wizard due` in a third terminal asks every waiting-jacob item one at a time and
writes each answer through the todo CLI (D4, `todo-source`); the planner reads `todo
decisions` at its next turn. Nothing here passes through a model until the planner acts
on an answer, which is the only part that needs one.

**Gates:** a tagged prompt never reaches the model (test: the transcript holds no line
with the tag's text after a blocked prompt); a line that does not parse passes through
unchanged (fixture); the hook exits 0 on any error (the fail-open test); an answer the
hook applied is indistinguishable in the store from one typed at the terminal (`todo
history`); `agents.sh questions` counts answers by channel (tag, wizard, reply).

### Steps

1. **`harness`:** the probe: a tagged line typed while the planner is mid-turn;
   `todo history` timestamps against the turn's end; the transcript checked for the
   text; one line in this section with the result.
   track: needs-yes PLAN-routing-tree.md §22
2. **`harness`:** `answer-tag.sh` on both windows (`wiring.json`; Jacob applies), the
   one-line notice in `record-session.sh`, the channel column in `agents.sh questions`,
   tests as the gates above. track: needs-yes PLAN-routing-tree.md §22
3. **`wizard`:** a definition over the top-level store's waiting-jacob decisions that
   writes through `todo answer`; confirm it exists, else add it.
   track: needs-yes PLAN-routing-tree.md §22
4. **`todo`:** `todo answer --by tag|wizard|reply`, stored on the row, for the channel
   count. track: needs-yes PLAN-routing-tree.md §22

## 23. Jev in the dispatch process, and where else a decision model fits (Jacob, 2026-10-19)

> "Please also do what is necessary research/plan wise to incorporate jev into the
> dispatch process. Or any other services/processes that may benefit from it. Research
> what would be good for this."

**What is known, and from when.** PLAN-async-routing-questions.md §2 holds the facts,
from GitHub READMEs and the OpenRouter listing on 2026-10-05 (docs.typesafe.ai was
unreachable from the cloud session): Jev (TypeSafe AI) answers a typed question over a
context of at most 32k tokens with a calibrated confidence, in tens of milliseconds for
about $0.00002 a decision against Opus's seconds and cents; early access since
2026-09-15; no self-hosting; `jev-gateway` sits between a coding agent and its API with
a threshold per call and a `passthrough` mode. That plan's decisions A1.1, A1.6 and A3.4
(recommended yes, not yet answered) are the rules below. None of the facts is verified
against the vendor's docs, and the fact this section needs most is missing: **what the
vendor retains, and trains on, of what it is sent.** Step 1 is that verification.

**The rules (A1, restated for dispatch).**
- **Jev never gates.** A `decide` call returns the answer, its confidence, the rule's
  answer when a rule exists, and whether they agree. The caller acts on the rule's
  answer when there is one, on Jev's only above the seam's threshold, else
  `needs-review`: never a silent answer (A3.4).
- **The deterministic path runs on every call** (A1.6). Every call is a ledger row with
  both answers; the disagreements are the labelled set (A1.3), and each seam's
  threshold is measured from it, never chosen.
- **Unreachable or slow** (`jev-gateway`'s timeout defaults to 4,000 ms) is the rule's
  answer, or `needs-review`.
- **Nothing credential-shaped goes out, and nothing of Jacob's own data** until the
  retention fact is known and Jacob has said yes per data class (the decision rows in
  the reply of 2026-10-19). Every input passes the leak audit `applications` already
  runs, before the call.
- **One way in:** `tools/decide/` is the only client, a service of its own
  (PLAN-services.md §3 shape), with `seams.json` as its table: seam, question type,
  threshold, fallback, the data class it may send. No hook calls Jev inline.

**Where it fits in dispatch.** The test for a seam: a rule exists, so not a Jev seam; a
classification over a small context where the rule table runs out, a Jev seam; a
judgment over the workspace, the `audit` agent with Jev as its pre-screen.

| # | seam | today | with Jev | the measure |
|---|---|---|---|---|
| 1 | **plan drift:** `todo stale-plans` flags an item "changed" when its section's text changed at all; 15 flagged on 2026-10-19, four of them by one amended sentence (R3) that touched none | the planner reads all 15 | the diff and the item: "does this change touch the item?"; above threshold "untouched", the CLI re-pins and logs the row; else the notice as today | notices per session before and after; disagreements |
| 2 | **routing a brief:** which service, verb and mode (§17.1) | the dispatcher's model, in context at full price; the hub's rule table (§3) later | the rule table first (a folder, a todo id, a plan pointer); Jev for a brief with none; below threshold it goes back as a `[dispatch]` question | the share of briefs the rule table resolves; Jev against the dispatcher's recorded choices on the rest |
| 3 | **typing a question** (`question-gate.sh`) | the model types it; an untyped one is blocked once | Jev types an untyped question; below threshold the block stands | blocks per day; agreement with the model's own type |
| 4 | **a report's outcome** (`dispatches`): done, failed, waiting, unclosed | markers parsed; markerless free text reads as `waiting` | Jev reads a markerless report: the outcome, and whether it claims more than its check output shows (the earned-claim rule) | markerless reports per week; disagreement with the dispatcher's reading |
| 5 | **Jacob's free-text answer** (§22): "drive, yes yes yes yes. Though I wonder…" | the planner reads it | the tag stays deterministic; a free-text reply to a table maps to an option with a confidence, and a reply that holds a new question is `needs-review`, never an answer | answers mapped per week; Jacob's corrections |
| 6 | **the audit's pre-screen** (§21.1): does this change satisfy the decision's text? | an audit dispatch per change | Jev screens first; only "no" or below threshold goes to `audit` | audit dispatches avoided; misses the nightly run finds |

Not Jev: relay admission (a line parses or it does not), fan-out modes (the verb table),
the write lease, anything `checks` runs. A rule that exists is kept.

**Elsewhere in the workspace, by the same test.** Value against the class of data each
would send, which is the privacy question above:

| service | the question | data sent | note |
|---|---|---|---|
| `site-scrapers` | a page's text: results, empty, login, a wall | page text | a wall stays a wall and is reported; Jev names it sooner, never routes around it |
| `applications` | which stored answer fits this form field; none fits stays `missing` | **Jacob's own data** | the highest value and the clearest privacy question; dry fill only, as today |
| `job-import-scripts` | is this job for Jacob, before import | job text, **his profile** | today every scraped job imports |
| `emailTools` | sender to company | **sender addresses** | string match today |
| `data-bridge` | an unmapped source field's likely target, filed as a `needs-review` mapping step | schema names, sample values | the mapping stays data; Jev proposes, `verify.js` decides |
| `knowledge-base` | does this section answer the question (re-ranking FTS hits) | docs text | public text, no privacy question |
| `todo` | kind and owner of a free-text finding in a report | report text | triage |
| `wizard` | a free-text answer to an option | Jacob's answers | as seam 5 |

**Gates:** `decide` refuses a seam absent from `seams.json`; a call without a rule
answer is allowed only for a seam whose entry says `rule: none`; a result below
threshold carries `needs-review` (fixture); a redacted input is what the ledger shows
(the leak audit's fixtures); the key is read from the environment and `check` fails on
one in any file; `decide bench` prints accuracy and calibration per seam from a labelled
set, and a seam goes live only with that number in this section.

### Steps

1. **`research`:** verify §2's facts against docs.typesafe.ai and the listing (access
   today, question types, context limit, price, rate limits, timeout, SDKs) and record
   data retention and training use for what is sent; one research record,
   `recheck_after` 30 days. Before anything else here.
   track: needs-yes PLAN-routing-tree.md §23
2. **`research`:** the labelled sets from the ledgers, no Jev call: the last 30 days of
   stale-plans flags with what became of each item (re-pinned unchanged, or edited), of
   briefs with the agent chosen, of question-gate rows, of markerless reports; sizes,
   and the rule table's share for seam 2. track: needs-yes PLAN-routing-tree.md §23
3. **`deep-work`:** `tools/decide/` as a service (`cli.json`, `seams.json`, the ledger,
   the leak audit before every call, the key from the environment), `decide ask <seam>
   --json` and `decide bench <seam> <set>`, its `./dev.sh check` with the gates above;
   the roster entry is harness's. track: needs-yes PLAN-routing-tree.md §23
4. **`research`:** `decide bench` on step 2's sets for seams 1-4: accuracy, calibration,
   the threshold per seam, cost; the numbers into this section decide which seams go
   live. track: needs-yes PLAN-routing-tree.md §23
5. **`todo`:** seam 1 behind `stale-plans --decide`, off by default until step 4's
   number. track: needs-yes PLAN-routing-tree.md §23
