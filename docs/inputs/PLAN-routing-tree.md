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
