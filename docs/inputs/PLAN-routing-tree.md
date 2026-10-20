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

The server owns the agent processes. One kind of role (§20): each request starts the
owner in its folder, and how long the process lives is not a design axis (§24).

- **Each request starts the role:** `claude -p --agent <role>` in the node's repo,
  in `--permission-mode dontAsk` with the role's allowed tools
  (<https://code.claude.com/docs/en/permission-modes#allow-only-pre-approved-tools-with-dontask-mode>),
  run with `--input-format stream-json --output-format stream-json`.
- **A running role takes a message on its stdin.** The server writes a further
  message to the stdin of a role still working on its request, which is how Jacob talks
  to a role while it runs (§20). The docs describe a "message submitted to a running
  `--input-format stream-json` ... session" and say "the session stays usable"
  (<https://code.claude.com/docs/en/errors#input-contained-only-whitespace>).
  - *Probe first:* a running role takes a second message on stdin, and its result
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
   - a running stream-json role taking a second message on stdin (§5);
   - `dontAsk` with a roster definition honouring its tools;
   - `hub send` from inside a `claude -p` role.
   track: needs-yes PLAN-routing-tree.md §20
1. **One node, the top:**
   - the server with `/route`, each request starting its owner in its folder (§20),
     using today's folder agents as addresses (`claudeTest/site-scrapers` = the `site-scrapers` agent);
   - the planner's Dispatch section goes to the server instead of the dispatcher;
   - the dispatcher becomes the fallback.
   track: needs-yes PLAN-routing-tree.md §20
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

After phase 4, the other repos join through setup (§8). The phase that once followed,
choosing between role lifetimes by `tokens --agents`, is gone: there is one kind of
role (§20, §24).

### 10.1 The five decisions of the cloud plan (Jacob, 2026-10-19)

The hub brief's open items (`tools/hub/PLAN-hub-brief.md` §4) were put to Jacob as
D1-D5 (tl-323..327, dt-3 rows 2-6). His answers:

| decision | Jacob, 2026-10-19 | what follows |
|---|---|---|
| D1 refresh the stale inputs | **refresh** | hub refreshes the seven stale copies and `SHA256SUMS` before the cloud session |
| D2 the cloud session's model | **Fable 5.1 at max** | Jacob starts the session on Fable; the brief's §9 token costs are restated at Fable's price (the manifest's prices table) |
| D3 the hub drives sessions | **drive** ("yes yes yes yes") | brief item 11 is a requirement; the probe decides stream-json or the SDK; §20 orders the roles |
| D4 questions wait; the todo store is the one list | **todo-source** ("the hub is merely the UI that facilitates easy access to these services, which are capable of existing independently") | the wizard and the hub read `waiting-jacob` items and nothing else; only an item that blocks running work reaches a window; the hub holds no question of its own (§21's second fixed point) |
| D5 keep-alive | asked twice ("every 5 minutes feels extreme"; "elaborate") | the three ways in §10.2; with D4's principle an outage costs only the view, so the recommendation is `session-start` first and `launchd` when the restart count says so |

### 10.2 Keep-alive, elaborated (D5)

The hub is a node server. When its process exits, routing and the page stop until
something starts it again, and nothing else stops: the services and their stores exist
without it (D4's principle), so an outage costs the view, never a record. Three ways to
keep the view up:

| option | what runs | what it costs | where it falls short |
|---|---|---|---|
| `session-start` | `init.sh` runs `hub up --tree` at every session start (§7, already in the design); the status line shows `hub: down` at the next prompt; `hub up` is one command | nothing: no job, no timer | a crash between sessions is unseen until a window opens, which is also the first moment it matters |
| `launchd` | `hub keepalive --launchd` writes a LaunchAgent plist with `KeepAlive` and loads it; macOS restarts the process the moment it exits; `--remove` undoes it | nothing while healthy; no polling | this Mac only, while Jacob is logged in |
| `cron-15` | a chron.py line, `*/15`, running `hub up` (a no-op when healthy) | one process every 15 minutes, zero tokens; up to 15 minutes down | portable, and the tool we built; the only one that runs while nothing is wrong |

Recommendation: `session-start` now, which is built once §7 lands; `hub up` counts its
own restarts in the ledger, and `launchd` follows when that count shows the view was
missed between sessions. This reverses group-servers decision 4 (a chron.py keep-alive,
Jacob's yes of 2026-10-03), which predates the UI-over-services principle.

**Answered `session-start` on 2026-10-19 (tl-327).** Jacob: "Yes I think so. it should
be a command runnable through the cli but with the idea that it will end as a bundled
application." So `hub up` is a CLI command first, run by `init.sh` at session start,
with `hub: down` in the status line when it is not up; where it ends is a bundled
desktop application, a window over the hub's own pages (PLAN-sitegen.md §9 is the
method that makes one page serve both), and `launchd` belongs to that stage, when the
restart count says so. PLAN-hub.md §7 takes this in the cloud pass (§10.3).

### 10.3 The cloud plan: where it stands, and the five questions that unblock it (2026-10-19)

> "Please give me 5 questions to answer that will assist in unblocking the cloud hub
> work."

**Where it stands** (read 2026-10-19, 19:10, from `tools/hub`'s git and TODO.md):
- `plan/hub` (local and origin, head 63cf780, 2026-10-13) carries PLAN-hub.md and
  PLAN-hub-view.md: the cloud session's pass (origin branch
  `claude/determined-edison-tx5h9v`, ddfc670, 2026-10-04, merged into `plan/hub`) plus
  the local pass 6d2b3f6 (H1a-0, the write gate). `main` (762a4fc, 2026-10-19) has
  only the brief and its inputs. Nothing of the hub is built.
- PLAN-hub.md's Decisions carry Jacob's yes in their own rows: 9 (2026-10-09; the
  re-cost 2026-10-13), 14, 16 and 17 (2026-10-13); 15 dissolved with 12. The hub's
  hb-4 ("Decisions 9 and 14-17 await Jacob") is overtaken by those rows. One delta
  came after the last yes: H1a-0b, the read route split off H1a-0, lifts the total to
  about 1.7-2.6M tokens and the cloud share to about 1.25-1.8M.
- The merge of `plan/hub` into `main` (hb-9): on 2026-10-13 it conflicted in TODO.md
  only; the re-run of 2026-10-19 (step 2 below) found ten files, because `main` gained
  the inputs refresh and the brief edits in between. It waits on tl-443, in the
  Decisions table. Requests to other owners wait on the same yes (hb-19).
- Eight inputs have drifted (hb-5); D1 (refresh, approved) is Dispatch 118.
  PLAN-services.md and PLAN-context-hygiene.md are not inputs yet (hb-4): they become
  inputs with that refresh, since §24 step 2 rewrites the second and the first holds
  the architecture rules the hub serves.
- The brief marks §17 and §20 pending (its line 30); PLAN-hub.md §4 "Roles and modes"
  and §7 "Keep-alive and control" are the sections they and D5 change.
- H1a-0 (the write gate, local, about 80-120k tokens, approved by Decision 17 on
  2026-10-13) has no dispatch in the ledger; tl-234 is its hook half, open.

**The five questions** (rows of `todo decisions`; each names what its answer frees):

| | question | frees |
|---|---|---|
| 1 | §20 one kind of role (tl-384) | the brief's §20 mark; PLAN-hub.md §4; the full inputs refresh hb-21 waits for |
| 2 | §17 fan-out by declaration (tl-364) | the brief's §17 mark; the hub's run and read sharing; §17.2 |
| 3 | D5 keep-alive, §10.2 (tl-327) | PLAN-hub.md §7 |
| 4 | Decision 9's delta: H1a-0b on the credits, the total at 1.7-2.6M | H1a-0b's cloud run; the §9 order as costed |
| 5 | merge `plan/hub` into `main` now (hb-9) | the merge; hb-19's requests; H1a-0's dispatch to `hub` on `main` |

**Answered on the evening of 2026-10-19** (dt-12): 1 is asked again in his terms
(tl-384; §20 holds his question and the answer); 2 `declare` (tl-364; §17's steps run
under tl-445); 3 `session-start` (tl-327; §10.2); 4 `credits` (tl-398), Jacob: "after
I upgraded to the 5x max plan, those cloud credits changed from $100 to $250. I have
$150 left", so H1a-0b runs on the credits, the §9 order stands as costed, and $150 is
the balance to plan against (PLAN-cloud-offload.md keeps the line); 5 `merge` under a
condition the re-run did not meet, so it is asked again as tl-443 (step 2).

**The cloud pass and the merge are two different gates.** The merge gates H1a-0
(local, by `hub`, on `main`) and hb-19's requests; it does not gate the cloud pass.
The cloud pass waits on the refresh (118, tl-406) closing and on the brief carrying
this evening's answers (§17 `declare`, D5 `session-start`, §20 as re-asked); Jacob
starts it when hub reports tl-406 done, whatever tl-443's answer.

**What is not a question.** The next cloud pass's scope is the planner's call: one
pass, plan then build. It applies the answers above and §22-§24 to PLAN-hub.md (§4,
§7, the re-cost), then runs H1a-0b and D0 on the credits as §9 orders, and stops when
the credits run short (Decision 9's rule). Jacob starts it (D2: Fable 5.1 at max)
after hub's refresh (118) lands, which is the one step that waits on nothing but the
dispatcher. H1a-0 runs locally, by `hub`, after the merge. hb-8 is settled by §24's
inventory: the brief's original stays at the top level, hub edits it (121) and
refreshes its copy.

**Jacob's steps** in `tools/hub`, outside the questions: hb-2 (the git-side gates:
`core.hooksPath` unset; `setup tools/hub --dry-run` prints the exact lines) and hb-7
(its `.claude/settings.json`, modified on 2026-10-15 and uncommitted, his to commit).

**The merge, in plain words (tl-443; Jacob on 2026-10-19: "I don't understand this
decision").** `tools/hub` has two branches. `main` holds the brief, the copies of the
plans the hub reads (`docs/inputs/`) and the hub's own TODO store; it has moved 22
commits since the branches parted on 2026-10-09 (two inputs refreshes, the brief's
edits, the store). `plan/hub` holds the hub's plan itself, PLAN-hub.md and
PLAN-hub-view.md: the cloud session's draft of 2026-10-04, the local passes of 10-09 and
10-13, and §15's answer today. Nothing joins them, so the plan and the brief it answers
live on different branches, and the hub's first code (H1a-0, the write gate, Decision
17) has no one branch to be built on. Merging joins them into `main`. Git does that
alone except where both branches changed the same lines of one file; there it stops
and asks, and ten files are in that state. The planner read each on 2026-10-19 at
19:45: in all ten, `main`'s last edit is from 2026-10-19 and `plan/hub`'s from 10-09 to
10-13; `main`'s brief carries question 12, which `plan/hub` had added (5 hits to 1);
`main`'s `devtools/hubcheck.py` carries `plan/hub`'s fix (a file it cannot read is a
finding, never a pass) in other words; `CLAUDE.md`'s one differing line is a refresh
date; the five `docs/inputs/` copies, `SHA256SUMS` and `docs/inputs/README.md` are
today's copies of the originals against 10-09's. So for the nine files outside
TODO.md, keeping `main`'s version loses nothing seen; the hub's per-file report in step
2 is the proof, not this reading. TODO.md is rendered from the store and never edited
by hand, so `plan/hub`'s entries (one per phase, written on 10-13) come in through
`todo add` and the file is rendered again. `merge-now`: hub does that, runs `./dev.sh
check`, then builds H1a-0 on `main`. `hold`: the two branches stay, and H1a-0, hb-19's
requests and §10.4's path wait. The cloud pass is unaffected either way.

### Steps

1. **`hub`:** with 118: PLAN-services.md and PLAN-context-hygiene.md added to the
   brief's §2 inputs and `docs/inputs/` (hb-4), `SHA256SUMS` updated.
   track: TODO.md "Hub inputs: services and context-hygiene"
2. **`hub`:** question 5 answered `merge` on 2026-10-19 ("I believe so yes. as long
   as the conflict has been noted correctly"), a condition that meant TODO.md only.
   The re-run found ten conflicting files (TODO.md, CLAUDE.md, PLAN-hub-brief.md,
   devtools/hubcheck.py, SHA256SUMS and five docs/inputs copies: `main` gained the
   refresh 42b8eb7 and the brief edits after `plan/hub` branched), so the hub stopped,
   corrected hb-9 and waits. The condition failed as written, and the merge is asked
   again as tl-443 (`merge-now` | `hold`, recommend `merge-now`): for the nine files
   outside TODO.md `main`'s side is the newer one, so hub takes it, reports per file
   anything on `plan/hub`'s side that `main` lacks (none expected; any line stops the
   merge), brings `plan/hub`'s TODO entries in through `todo add`, runs `./dev.sh
   check` with SHA256SUMS, closes hb-4 by the rows' dates; then H1a-0 (Decision 17).
   With it: hb-28 retitled to the question as §15 words it ("Two decisions came back
   from the hub's plan"), no other change to the item.
   track: needs-yes PLAN-routing-tree.md §10.3

### 10.4 The hub is the goal: the path to its first self-directed request (Jacob, 2026-10-19)

> "Additionally, are we working, and by me I mean you AND I, towards getting the hub
> fleshed out? How soon will it be ready to develop itself? I'd like to dispatch a
> bunch of our todos but I'd like to be focused on that as a goal"

**Where the day went.** Partly towards it: the inputs refresh (tl-406, done at 19:31),
the settings page's plan (§15, on `plan/hub`), the five questions (§10.3) and their
answers. The dispatch ledger for 2026-10-19 shows thirty-six spawns that ran; seven
were the hub's (tl-316, tl-356, tl-379, tl-406 twice, tl-310, tl-432) and the other
twenty-nine went to twelve other agents, because the queue of §26 ran the store's
order, which was by owner, not by the hub's path. From this section on, the hub's path
holds the queue's first slot (§26, "The hub path first").

**"Develops itself" means:** a request such as "tools/hub: build phase R1" goes to the
hub; the hub starts the `hub` role in its folder (§20); the role's writes pass the
write gate; its report lands in the hub's ledger. In PLAN-hub.md §9's order that is the
end of phase **H1b, the first spawn**. The dispatcher stays the front door until H4,
and the view (V1) is not needed for it.

**The path, in order, and whose hand each step is in** (costs from PLAN-hub.md §9 on
`plan/hub`; `u` is 29k tokens):

| # | step | whose hand | cost | state, 2026-10-19 19:50 |
|---|---|---|---|---|
| 1 | the merge (tl-443) | Jacob: one answer | none | Decisions row 1 |
| 2 | the merge, then H0 (the probes) and H1a-0 (the write gate) on `main`; harness's hook half (tl-234) after H1a-0 | `hub`, local; then `harness` | H0 40-90k; H1a-0 80-130k; harness ~1u | tl-432, blocked by step 1 |
| 3 | the brief carries the evening's answers: line 30's marks (§17 `declare`, §20 asked again, §22-§23 pending), question 7 (`session-start`, §10.2), question 15 (PLAN-hub.md §15's Decisions 18-19), and its five warm/cold hits rewritten (§24 step 6, line 121 folded in); the copy refreshed | `hub`, local | 15-30k | Dispatch 204 |
| 4 | §20, one kind of role (tl-384) | Jacob: one answer | none | Decisions row 4; PLAN-hub.md §4 waits on it |
| 5 | the cloud pass: PLAN-hub.md §4, §7 and the re-cost from the answers; then H1a-0b, H1a-1, H1a-2, S1 and H1b in §9's order, as far as the credits go (Decision 9's rule) | Jacob starts it (D2: Fable 5.1 at max) once step 3 reports and step 4 is answered; it runs on the $150 | 50-90k, 80-130k, 140-200k, 120-180k, 150-200k: 540-800k together | waits on steps 3 and 4 |
| 6 | beside it: H1a-2's harness and setup halves; §17 step 1 (tl-445, the modes and classes the hub's `route` reads in §17 step 4) | `harness`, `setup`, local | 1-2u each | tl-445 is line 189 of the queue |

**How soon.** Steps 1 and 4 are two answers. Step 2 is two or three local dispatches,
about 120-220k tokens plus harness's. Step 3 is one small dispatch. Step 5 is one cloud
session: five phases, 540-800k tokens on the credits; Decision 9's rule stops it when
the credits run short, and whatever it leaves runs locally in the same order, one
dispatch per phase. If the credits carry the session to H1b, the hub takes its first
self-directed request at the end of that session. Wall clock is not the cost; the two
usage windows are, which is why the local steps take the first slot rather than
waiting their turn behind the other repos.

**What does not block it:** Decisions rows 2 (phase RS comes after V1) and 3 and 5-17;
every non-hub line of the queue; the merge's `hold` answer slows step 2 only.

## 11. Decisions (all answered "yes" by Jacob, 2026-10-03)

1. **One server program per node, doing both checks (group-servers) and routing.**
   Not two servers. *Recommended: yes.*
2. **One kind of role.** Superseded: by PLAN-hub-review.md §5 D1 on 2026-10-09 (no
   role is kept between tasks) and by §20 (each request starts the owner in its folder;
   how long it lives is not a design axis, §24).
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
    mechanical, so the child's own role does it from the message alone.
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
| `permissionMode: plan`, "Plan mode (read-only exploration)" (<https://code.claude.com/docs/en/sub-agents#permission-modes> "Plan mode (read-only exploration)") | everything, as a permission | ignored when the spawning window is in `bypassPermissions`, `acceptEdits` or auto mode; honoured under `default`, `dontAsk`, `plan`, and in a `claude -p` role started by the server (§5), which has no parent window |
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
scratchpad only. Roles get this at phase 1; the sandbox probe comes first for a role
that takes a further message while it runs (§5): does a running `claude -p` keep the
sandbox across messages.

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
| `route` | an envelope (§2), from `hub send` or a role's final result | validates; **stamps `origin`** by reading the sender's transcript turn as `relay-gate.sh` does today; applies §3; writes the ledger row; delivers: a role is started `claude -p --agent <role>` in its folder (§5), the dispatcher gets its inbox socket, a child node gets its server | the message id, and later the `report` that comes back the same way |
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
§13. Build order: §10 phase 1 builds `route` and `write` for the roles it starts; `check` and
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

**Two decisions came back from the hub's plan (hb-28, one Decisions row; PLAN-hub.md
§15 on `plan/hub`, its Decisions 18 and 19), in plain words.** The page changes an
agent's model or effort by running harness's own command, `agents.sh set`, then `gen`,
`check` and a commit. Today harness's `cli.json` marks `set` as a command the hub's
server may not run, because a request arriving at the server carries no proof of who
sent it. **Decision 18** asks whether the hub may run it at all for a click on the
page, while refusing it for every role. The catch is the local-trust gap: the page
proves itself with `HUB_TOKEN`, a secret in the hub's `local.env`. If a role the hub
started can read that file (through the Read tool, `cat` in Bash, or a store read), it
can send the same request the page sends, and the server cannot tell Jacob's click from
a role's POST. The probe **P-RS1** tries exactly that from a role in its sandbox,
before the write half is built. If the role cannot read the token, the page may write;
if it can, the page stays read-only and shows, per row, the `agents.sh set` line for
Jacob to run himself with `!`. **Decision 19** asks whether the four steps are one
all-or-nothing verb in harness, rolled back when `check` refuses, rather than four
calls the hub makes in turn. Today `set` stops after `gen`, so a refused `check` would
leave the manifest changed and the third gate below would fail; one verb means a
half-applied change cannot exist. It adds 60-110k (the hub's RS phase) and 1-2u of
harness to Decision 9's total. The read half of the page (the rows, from harness's
`list --json`) needs neither decision and ships with V1. **`yes`** answers both: the
hub may write once P-RS1 passes, through one all-or-nothing harness verb; until the
probe passes, the read-only page.

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

**Answered `declare` on 2026-10-19 (tl-364).** The steps below run in the order
written, under one item, tl-445 ("Fan-out by declaration"); step 4 is the cloud
pass's (§10.3) and is written into PLAN-hub.md there, not dispatched here.

### Steps

1. **`harness`:** the guard's modes and the `uses: browser` class, the ledger fields,
   the brief shape (`mode:` and `uses:` lines, like `todo:`), the tests above, the
   `dispatches` columns.
   track: TODO.md "Fan-out by declaration: PLAN-routing-tree.md section 17 steps 1-8"
2. **`research`:** `answer` safe under two calls at once and a commit that retries on
   `index.lock`, with the test; reported to it from here.
   track: TODO.md "Fan-out by declaration: PLAN-routing-tree.md section 17 steps 1-8"
3. **`site-scrapers`:** its sweep verbs named in `services.json`, so a brief that
   omits `uses: browser` for one is caught; reported to it from here.
   track: TODO.md "Fan-out by declaration: PLAN-routing-tree.md section 17 steps 1-8"
4. **`hub`:** carries the modes and the classes into its `route` (§6 invariants: the
   write lease becomes a lease per class value, unbounded for `run` and `read`); the
   cloud pass applies it to PLAN-hub.md (§10.3).
   track: needs-yes PLAN-routing-tree.md §10.3
5. **`checks`:** per-verb `mode` and `uses` in the `services.json` schema, the
   `store-concurrency` gate, fixtures for an undeclared verb (strict default) and an
   unknown `uses` value (fails).
   track: TODO.md "Fan-out by declaration: PLAN-routing-tree.md section 17 steps 1-8"
6. **`site-scrapers`:** the sweep lock in the tool, after the probe above; two
   single-recipe runs at once stay allowed, with the test.
   track: TODO.md "Fan-out by declaration: PLAN-routing-tree.md section 17 steps 1-8"
7. **`harness`:** `mode:` and `uses:` derived from the verb table at spawn (a
   disagreeing line refused), `fanout.max_run`, the gate on the sum, the batch
   summary, `lib/commit-records.sh`; after 5.
   track: TODO.md "Fan-out by declaration: PLAN-routing-tree.md section 17 steps 1-8"
8. **`dispatcher`:** the directive paragraph into CLAUDE.md "Parallelism".
   track: TODO.md "Fan-out by declaration: PLAN-routing-tree.md section 17 steps 1-8"

### 17.2 Service-level dispatchers: what blocks them (Jacob, 2026-10-19)

> "I would also like to try to implement the parallelism via service level
> dispatchers. What is blocking us from doing that?"

**Three things, in the order of who holds them.**

1. **One line in `.claude/settings.json`** (Jacob's file, line 348:
   `"CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "1"`, mirrored by `.claude/wiring.json`
   line 13). Claude Code's default lets a subagent spawn subagents of its own, up to
   three layers below the main conversation; at the limit it withholds the `Agent`
   tool (https://code.claude.com/docs/en/sub-agents#let-subagents-spawn-their-own-subagents,
   kb copy fetched 2026-10-09). The line sets one layer, so no roster agent can spawn,
   and a service-level dispatcher that is an agent is impossible by that setting alone.
   That is why §17.1 made the sub-dispatch a table. Setting `2` is Jacob's step, and
   the hooks in item 3 must be ready first.
2. **§17 is unanswered** (dt row "§17 fan-out", tl-364). Until its modes and classes
   exist, `dispatch-guard.sh` refuses the second dispatch into a folder whatever it
   does, so a service-level dispatcher could start nothing in parallel inside its own
   folder either. §17 steps 1, 5 and 7 come before either path below.
3. **The harness assumes one layer.** `dispatch-guard.sh` reads every spawn as the
   dispatcher's ("Subagents pass"); `quote-words.sh`, `agent-watch.sh`,
   `record-session.sh` and the `dispatches` ledger know one parent. At depth 2 a nested
   spawn would most likely pass the guard unseen, the state CLAUDE.md calls the worst
   (unverified: `test-dispatch-guard.sh` has no depth-2 case; probe: depth 2 in a
   scratch copy of the settings, one nested spawn, the ledger read).

**Two paths, and the one this plan took.**

| | the table (§17.1, as written) | nested agents |
|---|---|---|
| what fans out | the dispatcher's own message with N `Agent` calls, which run at once; later the hub (D3), cron, a promise combinator | a `<service>-dispatcher` roster agent per service that spawns its own runs |
| what it needs | §17; no settings change | §17, depth 2 (Jacob), the guard and four hooks at depth 2 (harness), one agent definition per service (manifest) |
| cost per fan-out | the dispatcher's turn | one more start context per service (about 30k tokens; `omitClaudeMd` and `maxTurns` cut it, §21 row 5), and the reports stack: N runs report to it, it reports to the dispatcher |
| what Jacob sees | N lines in `dispatches` | a tree; `dispatches` must learn depth |
| judgment inside the fan-out | none: the split is the brief's (one `run` per question, per recipe set, per plan) | the sub-dispatcher splits the task itself |

The table gives the parallelism Jacob described ("spinning up as many site scraping
agents as necessary"): N scraper processes under one `run`, N research `run`
dispatches from one dispatcher message, writers one per folder. Nested agents add a
second layer of judgment and cost, and earn it only where the split needs a model: a
research question that becomes sub-questions only after reading, an audit whose row
set is unknown until a first pass. Neither case is in the ledger today.

**Recommendation:** the table now (answer §17 "declare"), and nested agents as a §17
follow-on when a `run` dispatch is seen splitting its own work in a report, which
`dispatches` shows as one dispatch doing N jobs in sequence.

**Answered `table` on 2026-10-19 (tl-387).** The steps below are the nested path and
stay closed; the table runs on §17's answer (tl-364, asked again in plain words the
same evening), since the guard refuses a second dispatch into any folder until §17's
modes exist.

**Gates (nested path only):** at depth 2 a nested spawn is refused unless its parent's
dispatch is `run` or `read` (test); a nested writer into a folder is refused like any
second writer (test); `dispatches` shows the parent of each nested spawn (test);
`quote-words.sh` gives a nested spawn its parent's words (test); `tokens --agents`
sums a nested spawn under its parent (test).

### Steps

1. **`harness`:** nothing until the decision; then depth `2` in `wiring.json` (the
   settings line stays Jacob's), the guard's nested rule, the four hooks and
   `dispatches` at depth 2, the tests above; after §17 steps 1, 5 and 7.
   track: needs-yes PLAN-routing-tree.md §17.2
2. **`harness`:** the manifest's `<service>-dispatcher` definitions for the services
   whose verbs are `run` (`site-scrapers`, `research`, `audit`), with `omitClaudeMd`,
   `maxTurns` and a `model_reason` if not Opus; after 1.
   track: needs-yes PLAN-routing-tree.md §17.2

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

## 20. Service roles: the agent that owns the knowledge, visible and addressable (Jacob, 2026-10-19)

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
folder for each request (PLAN-hub-review.md §5 D1, 2026-10-09: no role is kept
between tasks; §24: how long it lives is not a design axis). Its knowledge is on disk
and loads at start: its CLAUDE.md, `cli.json`, the CLI's help, the store's shape, and
the records of earlier replies (§19). Nobody relearns it because the request goes to
the owner: the planner that ran `todo decisions -h` on 2026-10-19 to record three
answers would instead send "dt-3: 2) refresh 3) fable 4) drive" to the `todo` role.
Because it is a process, Jacob can see it while it runs (its line on the hub page, a
tab with its transcript) and talk to it (a message while it runs, by the stream-json
input §5 names; the two pair windows stay what they are). Today's subagent has neither
property: it runs inside the dispatcher's process, unseen, and reports ten lines into
the dispatcher's context.

**The rule.** A request carries facts, never procedure: what to record, what to
answer, what to check. The role that owns the service runs its CLI. This is "one way
in" (PLAN-services.md §3) applied to agents as it is to code: the store's CLI is its
only writer, and the service's role is the only thing that runs that CLI on another
role's behalf. The planner's own CLI use (the top-level todo store) ends when the
hub routes to the `todo` owner (§10 phase 1); until then it stays, and the planner
reads no `-h`: the commands
it needs, verified, are in `PLANNER-HANDOFF.md`.

**One kind of role.** Which agent a request goes to is decided by the knowledge: the
service's owner for its CLI and store (`todo`, `research`, the `checks` ledger,
`usage`), the folder's owner for its code, `audit` with a brief cut to one plan or one
store (§21.1). How long the process lives is not a design axis (§24): each request
starts the owner in its folder, and neither a kept nor a fresh process is called
cheaper (Jacob's determination of 2026-10-19, not measured again here).
`tokens --agents --roles` reports tokens, and lines printed for Jacob, per request by
role, from the ledgers; that number serves §21's objective, not a choice between
lifetimes.

**Asked again the same evening (tl-384).** Jacob: "elaborate on this, I think I
understand the question, but I'd like to be sure. From what I understand, and from
what seems to be the case through the development of context cleaner is that there is
no idle cost, restart cost, or health difficulty for Agents that are not used often.
Theoretically, having long-lived roles, that are waiting for work but spin up with all
the necessary context they need would be more eficient right?" The answer, in his
terms (§24's gate allowlists this paragraph: it is the question, in his words):

- **Idle cost: none.** A waiting process spends no tokens. He is right.
- **Start cost: the files a role reads first** (its CLAUDE.md, the plan section, the
  item), about 30k tokens today (§21 row 5). A process that stays up pays it once; one
  started per request pays it every request. That is the whole saving of staying up.
- **Against it: every request re-sends the whole conversation.** A model keeps nothing
  between requests; the harness sends everything so far each time. A role that has
  done five tasks sends all five with the sixth, so its requests grow with every task,
  and compaction then drops detail. A role started per request sends only its task.
  After one task of ordinary size the carried conversation is usually larger than the
  start it saved; `tokens --agents` shows both columns, so the claim is checkable per
  role, and the number decides, not the argument.
- **Health: a waiting process can die, hang, hit a rate limit mid-wait, or hold a view
  of files others changed since it read them.** A role started per request reads the
  current files. "Spin up with all the necessary context" is what the per-request
  start does: the stores, the plans and the handoff are the role's memory, and they
  are smaller than a carried conversation.
- **The two windows are the exception** because the conversation with Jacob is one
  conversation.

The decision as re-asked: `one-kind`, as above, recommended; or `long-lived`, a
process per service stays up and takes requests in turn: one start per service,
growing requests, compaction losses, and a health check and a restart rule per role
still to write.

**What moves.** The folder lock stays where it is until the hub's write lease (§6)
exists, so the first roles routed this way are the ones that write only records
(`mode: run`, §17): `todo`, `research`, the `checks` ledger. Folder writers follow the
lease. A role started inside its folder runs that folder's hooks and sees no roster
definitions, so it cannot spawn roster agents: the silo is a fact of where it starts.
`peer-cap.sh`'s two-message rule is for the two windows; a role gets a daily request
budget (`roles.daily_budget`) instead, and its requests are ledger rows like any
dispatch.

**Visible on demand, not always.** §21's objective asks for less on screen, so a
role's transcript is a tab Jacob opens, while it runs or after, and the hub's page
shows one line per role: name, state, the request it is on, its last reply's key.

**Gates:** a request appears in the ledger with mode and class before its role starts;
the role's reply is a record (§19) and reaches the sender; a role never spawns a roster
agent (test: it has none to spawn); `tokens --agents --roles` reports tokens and lines
per request by role; no field, flag, column or sentence names a role's lifetime (the
`banned-terms` gate, §24).

### Steps

1. **`hub`:** PLAN-hub.md: one kind of role, started per request in its folder (D1),
   visible while it runs (its page line, a transcript tab) and reachable while it runs
   (the stream-json input §5 names); the order of services: record services (`todo`,
   `research`, `checks`), then `audit`, then folder writers after the lease (§6).
   track: needs-yes PLAN-routing-tree.md §20
2. **`harness`:** `tokens --agents --roles`: tokens, and lines printed for Jacob, per
   request by role, from `dispatches` and the reply ledger (§19).
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

**A second fixed point** (D4, 2026-10-19): the hub is a UI over services that exist
without it. It holds no store and no question of its own; every view reads a service's
CLI, and the hub's absence loses a view, never a record.

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

### 21.1 Silos: audits with small briefs

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

## 24. The temperature axis leaves every project (Jacob, 2026-10-19)

> "We have determined that cold and hot doesn't matter, please figure out what we need
> to do to scrub it from all projects, including the hub and context cleaner." "There
> is no benefit to cold vs warm so we need to scrub this from documents."

**Two meanings, one axis, both go.** The words carried two ideas here. The first is
prompt-cache warmth: a request's context as "warm" or "cold" against the cache, the
status-line segment, the cold-cache prompt guard, the cache TTL in `transcripts last`,
cache multipliers in cost models. Jacob has answered it four times (memory: never raise
it again); it leaves. The second is role temperature: a "cold role" started per message
against a "warm role" kept alive, with probes and token comparisons to choose between
them (§5, §10 phases 1 and 5, §13, the hub brief, PLAN-agent-groups.md §7, and §20 as
first written). That leaves too: one kind of role (§20). It had left once before:
Jacob dropped kept-alive roles on 2026-10-09 (PLAN-hub-review.md §5 D1; `warm-roles`
retired in checks' `gates.json` that day) and the cold-cache guard on 2026-10-13. The
gate entry retired, the plan text did not, so on 2026-10-19 the planner re-derived the
axis from §5. That is the case for the gate below.

**The replacement.** A role is the roster agent for a service or folder, started by
the hub in its folder for each request (§20). How long it lives is not a design axis,
and neither lifetime is called cheaper: a kept session re-sends its history each turn,
a fresh one pays its start, and Jacob has determined that nothing is gained between
them; it is not measured again. Costs are tokens at list price (the manifest's prices
table), never cache multipliers; the API's own `cache_*_input_tokens` counts stay
wherever tokens are summed, because they are tokens. A sentence that distinguishes
roles by lifetime, or gates a design on a token comparison between lifetimes, is
deleted, or rewritten to name the owner the request goes to. A quotation of Jacob is
never edited. A record (a research document, a review) is not rewritten: it says what
was true when it was written; the decision below says whether it gets a retirement
line.

**Inventory** (grep of `warm|cold|prompt_cache|cache ttl|cache-warm` on 2026-10-19,
hits per file; the kb's docs mirror, `docs/inputs/` copies, `todo-history.json` and
archives excluded):

| owner | where | hits | action |
|---|---|---|---|
| `deep-work`, for the planner (step 1) | PLAN-routing-tree.md §5, §10, §11 item 2, §13 (§20, §21.1, §10.1 and §24 as they stand on 2026-10-19 are kept) | 28 | §5's two modes become one, stream-json kept as how a running role takes a message; phase 5 deleted, phase 1 and principle 2 restated to the §20 rule; §11 item 2 (Jacob's yes of 2026-10-03) rewritten as "one kind of role", marked superseded by D1 on 2026-10-09 and by §20, its old words left to the store's history |
| | PLAN-agent-groups.md §2, §7 | 11 | the cost model at list price; §7 to the §20 rule |
| | PLAN-context-hygiene.md §4-§6 (§0 is Jacob's words: untouched) | 11 | the status-line segment, the guard and `measure`'s cache fields leave the plan; §6 decision 3 closed as withdrawn |
| | PLAN-cloud-offload.md:20, PLAN-interim-rules.md:26, PLAN-tools-folder.md, PRACTICES-rows.md | 1-2 each | the sentence each |
| | top-level CLAUDE.md: the transcripts and context-hygiene rows | 2 | the two descriptions (top-level prose, which the dispatcher hands on) |
| | PLAN-hub-review.md; RESEARCH-compliance.md, RESEARCH-workspace-audit.md, RESEARCH-registry-drafts.md, RESEARCH-gateway-docs.md | 21; 1-4 each | records: the decision below |
| planner | the top store (`todo.json`, rendered `TODO.md`); PLANNER-HANDOFF.md; the memory files | 8; 1; 2 | done 2026-10-19: tl-365 closed rejected, the records in tl-137, tl-165, tl-169 left as evidence; the handoff's one sentence; both memories |
| `context-hygiene` | `hygienelib/guard.py` and `tests/test_guard.py`; `hygienelib/statusline.py` and its test; `measure.py`; `hygiene.json`; `hooks/statusline.sh`; `CLAUDE.md`; its store and `TODO.md` (ch-70, the §6 decision 3 items) | 52 | the guard component deleted, the segment and the fields removed with their tests, the plan row in `README`; ch-70 closed rejected |
| nobody (a jacob-step in the top store) | `scriptingTools/context-hygiene/research/` (six `.jq` files: `carry`, `compactsim`, `compose`, `missscan`, `profile`, `subagent`, dated 2026-10-01, before the tool moved to `tools/`) | 1 | deleted by Jacob, or adopted by `context-hygiene` on his word |
| `transcripts` | `lib/context.jq`, `lib/agent-tokens.jq`, `lib/last.jq`, their tests, `CLAUDE.md` | 15 | TTL, expiry and warmth fields removed; `last` keeps the context size; the API's `cache_*_input_tokens` counts stay |
| `harness` | `.claude/lib/agent-tokens.jq` (a copy of transcripts'), `test-agents/19-tokens.sh`, the manifest's context-hygiene description (it renders `agents/context-hygiene.md`) | 8 | after transcripts; `gen` |
| `checks` | `gates.json` | 2 | the entries, then the gate below |
| `site-scrapers`; `job-import-scripts` | `test/steps.test.js`, `README.md`, `lib/failureTypes.js`; `import_hiringcafe_jobs.py` | 1 each | other senses of the words, most likely; the owner confirms in one line, no change expected |
| `hub` | the top-level PLAN-hub-brief.md (the original: its `docs/inputs/README.md` says the brief is edited there; hub's copy was identical at 13:23 on 2026-10-19) lines 30, 89-90, 109, 173; then `docs/inputs/` | 5 | with Dispatch 121's edits: the replacement, and line 30's dt-5 rows to the current `todo decisions` table; then `./dev.sh refresh` after step 1 |

**The gate, so it does not come back:** `checks` gains `banned-terms`, a list in
`vocab.json` of patterns with a reason and a date, the first entry this axis
(`prompt_cache`, `cache ttl`, `cache-warm`, `cold-cache`, `cold start`, `warm role`,
`cold role`, `hot cache`), an allowlist for records, stores and mirrors (`RESEARCH-*.md`,
`*-review.md`, `todo.json` and its rendered `TODO.md`, `todo-history.json`,
`*-records.json`, `research.json`, the kb mirror, archives), a passing and a failing
fixture; `checks all` fails on a hit, and `agents.sh check` runs the same check over the
top-level `*.md` (harness, step 4), since the top level is no repo. The allowlist also
names this section (the ban's own definition, by file and heading) and every quotation
line (`> `), because Jacob's words are never edited. A hit in another sense of a word
gets a dated allow entry naming the file, not a wider pattern. A rule restated four
times is a hook, not a rule.

**The decision (tl-381), in plain words.** Every live file is rewritten either way: the
plans, the docs, the code, TODO.md, the memory files. The question is the dated
records: the research documents (`RESEARCH-*.md`, rendered from `research.json` and
never hand-edited), the review record (PLAN-hub-review.md), and the hub's
`docs/inputs/` copies, pinned by `SHA256SUMS`, each of which says what was true on its
date. `live-only`: the records keep their words, the `banned-terms` gate allowlists
them by name, and a search of history still finds the old words there and nowhere
else. `records-too`: the records are rewritten as well, which needs a research verb
that edits a rendered document, a hub re-pin of its inputs, and a history that no
longer says what was found. Recommended `live-only`: a record that is edited stops
being a record.

### Steps

1. **`deep-work`:** the top-level documents in the inventory, live documents only (the
   records wait for the decision), with the replacement above; PLAN-routing-tree.md's
   §20, §21.1, §10.1 and §24 as they stand on 2026-10-19 are kept; one report naming
   each file and what changed, and no other edit.
   track: TODO.md "Scrub the temperature axis"
2. **`context-hygiene`:** its row. track: TODO.md "Scrub the temperature axis"
3. **`transcripts`:** its row. track: TODO.md "Scrub the temperature axis"
4. **`harness`:** its row, after step 3. track: TODO.md "Scrub the temperature axis"
5. **`checks`:** its row and the `banned-terms` gate with its fixtures.
   track: TODO.md "Scrub the temperature axis"
6. **`hub`:** the brief's five hits at the top-level original, with 121, which line 204
   folds into §10.4 step 3 (one hub spawn, not two); `./dev.sh refresh` after step 1.
   track: TODO.md "Scrub the temperature axis"
7. **`site-scrapers`:** its three hits, one line in its report.
   track: TODO.md "Scrub the temperature axis"
8. **`job-import-scripts`:** its one hit, one line in its report.
   track: TODO.md "Scrub the temperature axis"

## 25. The release job: dispatch when usage allows (Jacob, 2026-10-19)

> "Please write a chron-job script that can determine if there are todo items that
> [are] not blocked and don't require my intervention, if and when the usage limit will
> reset. If there will be available usage it will run the pair with the prompt asking
> to release held unblocked prompts."

**What exists.** `todo ready` lists a repo's dispatchable items (open, not blocked,
not waiting on Jacob). `usage gate <tokens>` says whether a job fits before the reset
and exits 1 with "hold until <time>" when it does not; `usage status` at 19:05 on
2026-10-19 printed the 5h window at 11% resetting 19:30 and the 7d window at 36%
resetting Thursday 13:00, and its store gate asks Jacob for `usage init`. `agents.sh
pair` opens the two windows and `agents.sh run <role>` is one window's launcher.
chron.py installs cron lines, `./dev.sh try` first. §18 step 4 is the same shape for
the nightly audit, under `usage gate`. The dispatcher holds auto-relays past
`pair.relay_budget` until Jacob's next prompt (`peer-cap.sh`) and holds the dispatch
lines it has not spawned yet.

**The job: `agents.sh release [--dry-run]`** (harness), one run per cron tick:
1. **Ready?** `todo dispatchable --json` in every repo that `services.json` lists (todo: the
   `--json` form and a workspace form, if missing; a report from here). N items. N = 0
   prints "nothing ready" and exits 0 with no process started.
2. **Room?** `usage gate` for `min(N, fanout.max_run)` dispatches at the median from
   `tokens --agents`. A hold prints the time and exits 0; the next tick asks again.
3. **Release.** If the pair is open (`record-session.sh`'s socket answers), the prompt
   goes to the dispatcher's inbox by the auto-relay path, stamped `origin: cron`. If
   not, the pair is started with the prompt as its first message. The prompt is fixed
   text in the manifest: "release: dispatch every `todo ready` item in order, within
   `usage gate`, and report what you started"; never Jacob's words.
4. **One row per tick** in `~/.claude/usage/releases.jsonl`: time, N, the gate's
   answer, the action; `agents.sh releases` prints them.

**Where cron meets the screen.** Opening iTerm2 is an Apple event. From cron, macOS
asks nobody for the Automation permission, so `osascript` may be refused with no dialog
(unverified; probe: a cron line running `agents.sh pair --dry-run`, then one real line
at a chosen minute, watched once). If it is refused, the release runs the dispatcher
without a window (`claude -p --agent dispatcher`, the hub's own path, §5) and prints
the transcript's path in its row, which Jacob opens as a tab. The windows stay the
first try, as asked.

**A cron prompt is never Jacob's.** `quote-words.sh` gives a spawn from a release the
relay note, not "Jacob's words"; `peer-cap.sh` counts it as a peer message; it carries
no approval and needs none: `todo dispatchable` lists only items already approved,
ready and not yet dispatched (`todo ready` ignores approval: it lists every item with a
repo, a kind of work and a done-when; td-81, found by the dispatcher 2026-10-19).

**Cadence.** Hourly. The 5h window resets at a time `usage status` prints, so an
hourly tick releases within the hour of a reset and costs no tokens while it holds; a
five-minute line was called extreme (§10.2). A one-shot line at the reset minute is
chron.py's to add if an hour proves slow.

**Gates:** `--dry-run` prints the three answers and starts nothing (test); N = 0
starts nothing (test); a hold starts nothing (test); the release row is written on
every exit (test); the prompt in a release spawn is the manifest's text (test);
`quote-words.sh` shows a relay note for it (test); the cron line is installed through
chron.py only, under `usage gate`, as §18 step 4.

### Steps

1. **`harness`:** `agents.sh release` and `releases`, the manifest's prompt text, the
   Apple-event probe with its result written into this section, the fallback without a
   window, the tests above. track: TODO.md "The release job"
2. **`todo`:** `ready --json` and the workspace form, if missing; reported from here.
   track: TODO.md "The release job"
3. **`cron-scheduler`:** the hourly line after `./dev.sh try`, after step 1.
   track: TODO.md "The release job"

## 26. The queue: everything ready runs, in this order (Jacob, 2026-10-19)

> "Also are there no pending todos that have been dispatched other than harness and
> todo" ... "Please queue them so they can run continuously and prioritize harness
> parallelism in checks when it finishes as the 1-3 hour testing situation seems
> untenable."

**The state he asked about** (`agents.sh dispatches --open`, 2026-10-19 evening): two
dispatches open, `harness` on tl-318 (waiting on its own check) and `todo` on tl-383
(the SQLite store move); every other dispatch of the day ended; 41 items dispatchable
(`todo -C . ready`) and 11 more held back only for lacking a size. Nothing else was
running because a dispatch starts only from a line, and the lines had run out.

**The rules of the queue** (this section; §25 is the job that will do this without a
hand):
- **Order is priority.** The Dispatch lines of 2026-10-19 (122 onward) are the queue in
  order; the list below is the same order by item. A line with an "after" waits for
  it; everything else starts when a slot frees.
- **The hub path first (Jacob, 2026-10-19, 19:40; §10.4).** The first free slot goes
  to the next dispatchable step of §10.4's path, ahead of every line below it in the
  queue; when no step of the path is dispatchable, the slot runs the order below.
- **Four open dispatches at a time, one per folder.** Four is the number §17 names as
  `fanout.max_run`, used here as the queue's limit and not as §17's gate, which stays
  needs-yes (tl-364). Two heavy checks never run at once (the parallelism rule: a
  repeat under load is no evidence; hx-104 saw a 26-hour `agents.sh check` at load
  25-30).
- **Harness first.** When tl-318 ends, the harness's next item is
  PLAN-check-progress.md §10 step 3, the `--jobs` pool for its own runner: the 1-3
  hour serial `test-agents.sh` is what Jacob called untenable. Then §25 step 1, the
  release job, which replaces this hand-queue.
- **The store is the source.** The list below is `ready` as of 2026-10-19; when it is
  exhausted, `todo -C . ready` is the queue, and §25's job reads it the same way.
- **Lines past the relay budget** (`pair.relay_budget`, 10) are held and delivered
  after Jacob's next prompt in the dispatcher window; one word there releases them.

**The list, by owner, in order** (ids from the top-level store's `ready` and from the
owners' stores through it):

| order | owner | items |
|---|---|---|
| 1 | harness | PLAN-check-progress.md §10 step 3 (tl-287's harness half); §25 step 1; TODO.md "The audit agent" (tl-350); §21 step 2; §22 steps 1-2; §24 step 4 |
| 2 | todo | §25 step 2; tl-378 (re-pins, left open by the 13:05 dispatch); §22 step 4; td-59, td-60, td-61, td-62, td-64, td-67; td-63 and td-73 sized first; all after tl-383 ends |
| 3 | cron-scheduler | §25 step 3, after §25 step 1 |
| 4 | each owner with a parts file | PLAN-check-progress.md §10 step 2 (mark `uses`, the `--jobs 1` comparison, timings) |
| 5 | context-hygiene | tl-373 (re-pin ch-65, left open by the 12:58 dispatch); §21 step 3; §24 step 2; ch-5, ch-49, ch-50, ch-58, ch-59, ch-60, ch-67, ch-69, ch-70, ch-73 |
| 6 | audit (after tl-350) | §21 step 1 |
| 7 | hub | §10.4's path first (the rule above): §24 step 6 inside §10.4 step 3 (line 204, folding in 121), then the merge and H1a-0 (tl-432) once row 1 is answered; §21 step 4; TODO.md "Roster settings page" (tl-310, after V1); hb-21, hb-22, hb-25 sized first |
| 8 | wizard | §22 step 3 |
| 9 | research | §23 steps 1-2; PLAN-text-channel.md §6 step 1; PLAN-sitegen.md §8 step 1; PLAN-bookstore-venues.md §7 steps 1-2; TODO.md "Ownership gates audit" (tl-303); TODO.md "Scraping frameworks assessed" (tl-352) |
| 10 | deep-work | §24 step 1; PLAN-services.md §3 step 7.3 (the Practices backfill, su-91) |
| 11 | transcripts, checks, site-scrapers, job-import-scripts | §24 steps 3, 5, 7, 8 |
| 12 | setup | tl-401 (the resolver reads `.rules` only); the required-heading flip after the backfill; su-74, su-75, su-99; su-86, su-93, su-94, su-95 sized first |
| 13 | email-tools | PLAN-gmail-tools.md §6 step 1 |
| 14 | the plan items of the top-level store | TODO.md "Static and dynamic stores" (tl-263), "Job sourcing as pipes" (tl-270), "Fit and the tool registry" (tl-280), "Assurance ledger" (tl-281), "Outside tools assessed" (tl-282), "Every tool call routed" (tl-286), "Watched employer pages" (tl-289), "Fable where allowed" (tl-349), "Replies are records" (tl-351): each to the owners its brief names |
| 15 | data-bridge | tl-315 (PLAN-job-sourcing.md §3 step 7.2) |
| 16 | knowledge-base | kb-55, kb-56 sized, then run |
| 17 | income | inc-68 |

**Not in the queue:** anything under needs-yes (`todo decisions`), the cloud pass
(§10.3), and Jacob's own steps.

## 27. The usage bars: a widget in the hub, its sources a registry (Jacob, 2026-10-19)

> "I would also like to implement a widget or a 'functionality block' I guess,
> somewhere in the hub, though I haven't figured out where in the layout/user flow it
> will sit. For the usage bars to be. (e.g. current session amount utilized, usage
> limit from this week, fable percentage from this week). I would also like to
> incorporate the possibility of expanding that area to include other percentages
> that can be dynamically changed as I determine new sources."

**What a bar is.** A percentage with a name, a window, the time of its sample and
where it came from. A bar is a row of a registry, `tools/usage/bars.json`: `name`,
`source` (a verb of a service and the keys it returns, or one of the usage tool's
own windows), `window` (`5h`, `7d`, `session`, `day`), `refresh` (seconds), `label`.
Adding a source is adding a row; no code in the widget names a source. A row whose
verb does not exist fails the usage tool's `check`, and the registry is the one
place the widget and `usage status` read.

**The three bars he named, and where each number is today.**

| bar | the number | source today |
|---|---|---|
| the current session | the 5h window's `used_percentage`, as the status line receives it in `rate_limits.five_hour` (https://code.claude.com/docs/en/statusline#rate-limit-usage, kb copy fetched 2026-10-09) and `usage-statusline.sh` records in `limits.json` | `usage status` |
| this week's limit | `rate_limits.seven_day.used_percentage`, the same path | `usage status` |
| Fable this week | two readings, and the usage owner's probe decides which exists: a Fable-specific weekly window, if `rate_limits` carries one (the docs name `five_hour`, `seven_day` and `spend_limit`; nothing per model is documented, so this is `unknown` until a sample is read); otherwise the share of this week's tokens that ran on Fable, from the transcripts reader (`agents.sh tokens` already sums by model per session). Both are rows; the probe says which one is live | `usage` + `transcripts` |

A fourth row costs nothing to name now and is the kind of source he means by "as I
determine new sources": the context window of the current request (the status
line's `context_window`), the day's tokens by role (`transcripts`), the release job's
hold state (§25), the credit balance (§10.3, typed by Jacob, never scraped).

**The verb.** `usage bars [--json]` evaluates every row and prints one list:
`{name, pct, window, asof, source, state}`, where `state` is `ok`, `stale` (older than
`refresh`) or `unknown` (the source failed or the field is absent). A bar is never
`0` for a source that did not answer: it is `unknown`, with the reason. No model
anywhere in the path.

**The widget.** The hub renders the list as bars, one per row, reading `usage bars
--json` on the row's `refresh`; a `stale` bar is drawn with its age, an `unknown` one
with its reason. The hub's own page does not know the rows. Where it sits is the
open question (decision below); PLAN-hub-view.md (hub's, on `plan/hub`) gets the
placement once answered, as one component the view includes.

**The Fable row's reading (planner, 2026-10-19, on the dispatcher's question from
tl-435).** The usage probe found that a live `rate_limits` sample holds only
`five_hour` and `seven_day` (tl-433), so the row is the second reading: the share of
this week's tokens that went to Fable, **weighted by list price** from the manifest's
dated prices table (the same weighting `agents.sh tokens --prompts` uses), computed by
transcripts' `share` verb (tl-435). Each of the four counts (input, cache write, cache
read, output) is priced at its own rate; the JSON keeps the four raw counts beside the
share, and the bar's label says "by list price". Output alone would hide the cost of
Fable's carried context; raw totals would weigh a cache read like an output token.
**The window:** the `seven_day` limit's own window when `limits.json` holds its reset
time, else the trailing seven days; the JSON says which. The Agent SDK also names
`seven_day_opus` and `seven_day_sonnet` rate-limit types (python#ratelimitinfo, kb copy
fetched 2026-10-09); none appeared in the live sample, so they are `unknown` until seen,
and a per-model window, if one appears, replaces the share for that model. No yes
needed: it is a reading, not a rule.

**Decision.**

| # | decision | hinges on | recommend |
|---|---|---|---|
| 1 | §27: where the bars sit | `strip`: a thin strip at the top of every hub page, always visible, the three bars and a `+` that opens the full list; `panel`: a panel of its own in the inbox view, opened on demand, the full list; `both`: the strip shows the first three rows, the panel the rest | strip |

**Gates.**

- a row naming a verb or key that does not exist fails `usage check` (fixture);
- a source that does not answer yields `unknown` with a reason, never `0` or the last
  value unmarked (test); a sample older than `refresh` is `stale` with its age (test);
- `usage status` and `usage bars` agree on the two windows (test);
- the Fable row's probe is recorded with its sample's keys in the usage repo's
  TODO.md before the row is marked live (report);
- the widget renders a fixture list with every state (fixture, in the hub's check).

**Steps.**

1. **`usage`:** `bars.json` with the three rows and the Fable probe (the keys of one
   `rate_limits` sample, in a report; the row's source set by what the sample holds),
   `usage bars [--json]`, the gates above. track: TODO.md "Usage bars in the hub"
2. **`transcripts`:** a weekly share-by-model verb for the Fable row's second reading
   if step 1's probe finds no per-model window; after 1.
   track: TODO.md "Usage bars in the hub"
3. **`hub`:** the component, placed by the decision; after 1 and the hub view plan.
   track: needs-yes PLAN-routing-tree.md §27
