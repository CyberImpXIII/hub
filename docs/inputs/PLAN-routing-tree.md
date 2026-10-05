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
on a localhost port or a Unix socket named in `.claude/local.env`. It is configured by
two data files and nothing else: the node's **registry** (roles with their `claude -p`
arguments, tags, children, the four services with the CLI each one runs, the owner
table of §14.7) and the manifest's `servers.<group>` entry. It contains no tool's
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
instead of being found by the planner in a transcript. The hub brief's duplicate item
number (2026-10-04 22:10): a `bug-report` from the planner with `ref` tools/hub, rule 2,
straight to hub; today it went planner to dispatcher to hub by `SendMessage`, and
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
