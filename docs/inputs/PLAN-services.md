# PLAN-services.md: programmatic planning, behaviour gating and architecture services

> **Status: first pass, planner, 2026-10-08.** Written from the cloud's questions,
> `PLAN-services-questions.md`. That file is a verbatim copy of the one on branch
> `claude/great-hypatia-902ht4` of claudeCloudPlanning, written 2026-10-05 and copied
> here 2026-10-08. The copy is the question list; this file holds the answers and the
> plan.
>
> **Jacob, 2026-10-08:** "I want to make programattic as much of our interaction as
> possible", and not only for work done in the cloud. He chose the top level over
> income's store: "1) sounds good. top level". The questions are workspace-wide, so
> their answers are recorded here rather than in a repo's todo store. That holds until
> a store exists for workspace-level items, which is S1.4.
>
> **Owner:** the planner; the counter is by `transcripts`. Builds on: PLAN-services-questions.md, PLAN-hard-gates.md,
> PLAN-repo-setup.md, PLAN-todo-tool.md, PLAN-routing-tree.md. Related: PLAN-wizards.md
> is a separate tool, and the J rows in §3 are one of its consumers.

## 1. What this plan is for

Some processes are re-derived by a session each time they recur. This plan turns each
one into a command with a contract: one source, deterministic, installed in every repo
by setup. Three areas:
- **planning:** the parts of writing a plan that are the same every time;
- **behaviour gating:** a funnel that hands a session a stored procedure for a
  recurring process, with checks behind it and hooks as triggers;
- **architecture:** the house shape, held as checks.

Script linting is the possible fourth area (questions S4). Nothing is built before
repetition is counted (S0.5). A service for a process done once is premature.

## 2. Answers so far (L rows, answered by reading)

Each answer gives the command that produced it, so it can be re-run.

**S0.2: who consumes `services.json` and the registry today.** The files are written
and gated, but nothing that discovers a service reads them.
- 14 repos have a `services.json`, from `ls */services.json tools/*/services.json
  scriptingTools/*/services.json`. Each one checked (tools/todo, income) lists a
  single service: `check` run through `dev.sh`.
- Setup's `services` component writes them (`tools/setup/setuplib/core.py:703-710`).
- `tools/checks/source/services-valid.py` validates them, and `registry-matches.py`
  holds a node's registry equal to the `services.json` files under it.
- No hook reads them: `grep -rln 'services\.json\|registry\.proposed'` over `*.sh` in
  `.claude/hooks` finds none.
- No registry file exists at the top level.

The cloud's default holds: discovery is by CLAUDE.md prose. Making services
discoverable is the first mechanical step shared by all three services.

**S1.1: the shape of every plan written so far.** There are 28 top-level PLAN-*.md
files, plus income's and the hub's briefs. The run was a `grep -qi` per section name
over each file, on 2026-10-08:

| section | present in |
|---|---|
| status header | all 30 |
| decisions table | all 30 |
| handoff / dispatch steps | 29 (not PLAN-probes.md) |
| setup component | all 30; `setup plans` already gates it |
| risks | 9: PLAN-agent-groups, PLAN-context-hygiene, PLAN-group-servers, the three hub plans (brief, replies, review), PLAN-services-questions, income's brief, and the hub repo's copy of its brief |
| "builds on" | 8: PLAN-group-servers, PLAN-routing-tree, the three hub plans, PLAN-services-questions, and the two briefs |

The count matches the word anywhere in a file, not a heading, so it is an upper bound.
A heading-level count is part of the S1.2 check.

Every plan already has the four sections in the first rows. Risks and "builds on" are
the gap between local plans and cloud plans. This makes S1.2's scaffold-and-check split
mechanical for four sections today. Two more can be added once a plan template
requires them.

**S0.5: where repetition is measurable (dispatcher's relay of the transcripts agent's
report, 2026-10-08).** The tool is `./transcripts repeats 10 --project ../..`, run from
`tools/transcripts` (the workspace folder by its relative path; a home path in a plan
is a leak finding, hb-27). It is built and tested but **not committed**: the
tools/transcripts gate is red on a `hooks-installed` drift caused by tools/hooks'
uncommitted edits. One run read 22,064 tool calls in 20 main sessions and 260 subagent
sessions; 84 calls copied into a resumed session were counted once. Each column is
sessions / calls / blocked / retried / done:

| shape | sessions | calls | blocked | retried | done |
|---|---|---|---|---|---|
| Bash | 278 | 11,656 | 93 | 93 | 11,563 |
| Edit | 247 | 5,124 | 10 | 7 | 5,114 |
| Read | 260 | 2,165 | 0 | 0 | 2,165 |
| Write | 159 | 1,382 | 1 | 0 | 1,381 |
| Agent | 9 | 284 | 19 | 19 | 265 |
| SendMessage | 11 | 205 | | | |
| `grep` | 238 | 2,012 | 16 | 15 | 1,996 |
| `sed` | 178 | 1,367 | 2 | 1 | 1,365 |
| `cat` | 162 | 719 | 8 | 5 | 711 |
| `git status` | 218 | 399 | | | |
| `dev.sh check` | 183 | 366 | | | |
| `git add` | 154 | 327 | 6 | 6 | 321 |

What the counts say, as the planner reads them:
- **The top shapes are generic tools, not processes.** `grep`, `sed` and `cat` are
  how a session reads; they are not something to make a service of.
- **The clearest recurring process is the commit cycle.** `git status`, then `dev.sh
  check`, then `git add`, then commit, each appears in roughly 150 to 220 sessions.
  It is the first candidate for a stored procedure, the S2 funnel. Jacob has not asked
  for that funnel, so it is offered, not planned.
- **A two-word shape cannot see process-level repetition.** It cannot tell, for
  example, how often "report a bug to another owner" happens. The next refinement is
  sequence counting: which shapes follow each other within a session.
- **Unconfirmed, recorded in transcripts' TODO:** a resumed session shares 84 tool-call
  ids with its original, so `daily` and `prompts` may count that session's tokens
  twice.

**Not yet answered:**
- S0.4 (with `checks` and `hooks`);
- S1.5 and S1.6;
- the S2, S3 and S5 L rows.

They are answered in the order PLAN-services-questions.md §3 gives: S0.5, S2.1, S5.1,
S3.1, then the rest.

## 3. Jacob's rows

**S0.3 answered, Jacob 2026-10-08:** "I think in this case it would be guardrails for
writing code, or writing scripts. The idea would be to consolidate design specifically
so that when writing code that is modular, we can make it modular. In order to do that
though, we would need all these projects to have unified rules for how code is
written, then later we can build out the possibility of deterministically finding
common patterns."

What this answer means for the plan:
- **"Linting" here is the architecture service (S3), plus script linting (S4).** It is
  not the process funnel (S2). That makes S2 a separate idea, one Jacob has not asked
  for.
- **The order is fixed by his sentence:**
  1. unified code-writing rules across every repo, held as checks;
  2. later, a deterministic finder for common patterns across repos.
- **The rules shared today are process rules, not code-writing rules.** Setup's
  shared-rules block covers how agents work. The 7 checks in tools/checks cover
  repository shape (docs, help, hooks, secrets, todo).
- **The pattern finder exists for one repo.** `site-scrapers/audit.js` already finds,
  mechanically:
  - code that re-implements an existing generic action (`inline`);
  - step sequences shared by two or more recipes (`repeats`);
  - the same literal in two or more recipes (`literals`);
  - literals that should be parameters (`hardcoded`).

  It works because recipes are data. Doing the same for code needs a parser per
  language (S3.4).
- **Three languages are in play: Python, shell and JavaScript.** No linter is
  installed: shellcheck, ruff, eslint and pyflakes are all absent from `PATH`
  (checked 2026-10-08). That is S4.1, answered.

**S0.1 answered, Jacob 2026-10-08:** "While a "command" in each repo MIGHT be adequate,
I'd like to think of it more portably. Each service is a dependancy that is loaded in
as the code is set up."

What this answer means for the plan:
- **A service is a versioned dependency.** A repo declares the services it uses and
  setup loads them. Neither the repo nor a session re-creates a service by hand.
- **Today's nearest form is the hook copies.** `tools/hooks/source` is rendered into
  14 repos by setup, and `hooks copies` checks them for drift. They have no version:
  a copy is either equal to the source or different from it. Checks, todo and the
  wizard have no copy at all: a repo calls them by a path to a sibling folder.
- **The failure this fixes is recorded.** The cloud's lone clone had no `../tools`,
  so income's `dev.sh` could not run its hook tests (PLAN-services-questions.md §2a).
  A dependency loaded at setup travels with the clone.
- **What it needs:**
  - a manifest per repo naming each service, where it comes from, and the version it
    is pinned to;
  - a load step in setup;
  - a check that what is loaded equals the pin.

  How a dependency is loaded was asked 2026-10-08. The planner recommended a vendored
  copy, and Jacob's next answer, below, rules that out.

**Architecture rule, Jacob 2026-10-08:** "in regards to the cloud folder, we should keep
it somewhat seperate architecture wise. Services are meant to interact through their
respective servers, if we are using asynchronous or alternative methods to communicate
with the services, that should be done via whatever ingest method is used, rather than
assuming we can make seperate services elsewhere. This way, if the services are ever
migrated to a hosted setting, I can have them be their single source of truthe even if
parts are local and parts are not."

This is a fixed point for this plan and for PLAN-hub.md, which is not written yet:
- **Each service has one instance, behind its own server, and it is the single source
  of truth.** That holds whether the server is local, hosted, or partly each.
- **No copy of a service runs anywhere else.** Not in a cloud session, and not vendored
  into a repo as a working copy. A vendored check that runs in a clone would be a second
  source of truth.
- **What a repo loads at setup is a client of the service, not the service.** The
  client is a pinned dependency that knows the service's address and its ingest methods.
  It does not know or care where the server runs.
- **Every other way in goes through the service's ingest:**
  - a synchronous request when the server is reachable;
  - an asynchronous one, such as a document drop or an API poll, when it is not.

  The cloud is the second case. It cannot reach a local server, so it leaves documents
  for the service to ingest, which is what the cloud sessions already do with branches.
  The transports are the questions in `PLAN-async-routing-questions.md` §4 (A3), copied
  to the top level 2026-10-08 from the same branch.
- **A client that cannot reach its service says UNCHECKED (exit 3), never pass.** That
  is the existing check contract, applied to an unreachable server.
- **Approved: Jacob 2026-10-08 ("1) Yes").** Fallback services, syncing and split
  behaviour are a nice-to-have, not blocking (TODO.md "Nice to have, not blocking:
  fallback services, service syncing, split service behaviour").
- **Setup is the source, not the hub. Jacob, 2026-10-08,** declining the proposal that
  the rule go into the hub brief's fixed points: "In the event that someone is ONLY
  installing the hub, certainly all of these services would be necessary, but as these
  are all designed to use each other, and potentially be used in other apps, the hub
  shouldn't be the source, as that's what setup is designed for. As the hub initialized,
  it calls its own version of setup. If the services dont exist or can't be found, they
  are then set up in turn. This should be the case for any application that uses any of
  the services." What that means for the design:
  - **Every application declares the services it uses.** The hub is one application
    among others, and so is any app outside this workspace.
  - **On initialising, an application runs setup.** Setup finds each declared service,
    and sets up any it cannot find, in turn. A service that uses other services gets
    the same treatment, so resolution recurses.
  - **The hub brief already agrees in part.** `tools/hub/PLAN-hub-brief.md` lines
    123-127 have setup install each repo's contract (`services.json`, `cli.json`, a
    registry row), and the node's registry is the union of those, read at start. What
    it lacks is the find-or-install step at initialisation. That step belongs to setup,
    and the hub calls it like any other application.
  - **To design here before setup's owner builds anything:**
    - how setup finds a service: an address in the declaration, a registry, or both;
    - what "set up in turn" installs: the service's server, its client, or both;
    - how a cycle is handled, since services use each other;
    - how setup itself is obtained, since it is the one dependency nothing else can
      install.
- **This retires the vendored option and the lone-clone fix as written above.** A cloud
  clone does not run the checks itself. It hands its work in through ingest, and the
  service checks it.

These rows are Jacob's to answer: S0.1, S0.3, S1.2, S1.3, S1.4, S5.2, and the
confirmations. Each goes to him as a row in a planner `## Decisions` table, once the L
answers it depends on are in. When PLAN-wizards.md is built, they move to a wizard
definition instead, which makes them that tool's first workspace-level use. S0.1 and
S0.3 are asked first, because every other answer changes shape with them.

### Every record a service holds has an id and tags (Jacob, 2026-10-08)

> "I think that the tagging and ids should be added architecturally to EVERY service.
> This allows the stores and patterns to be better utilized by agents. If you can come
> up with good examples (and document it) that'd be great, if you can't please ask me
> about it. This is meant to meet our design and architecture guidelines, which we
> still need to work on proceduralizing."

This is a fixed point next to the architecture rule above, and it came out of
PLAN-context-hygiene.md §0, where every stub names the stored block it replaced. It
pays off for agents because an agent can ask for exactly one record by its id, or
select records by tag, without loading a store or reading content to find what it
wants. That saves tokens directly.

**The rule:**
1. **Every record has one id, `<service>:<local id>`.** The prefix names the service
   that owns the record, and so the server that answers for it. The id never contains
   a host, a path or a machine, so it survives a move to a hosted server (the
   architecture rule). An id is never reused, and a record that is closed keeps its id.
   The form is already in use: Dispatch lines say `todo:td-21`.
2. **Every record carries tags, `<namespace>:<value>`.** The shared namespaces are
   defined once, and mean the same in every service:

   | namespace | says | example |
   |---|---|---|
   | `repo:` | which repo it concerns | `repo:todo` (the repo's name, never a path; td-26) |
   | `plan:` | which plan section it serves | `plan:PLAN-services.md§3` |
   | `kind:` | what sort of thing it is | `kind:web`, `kind:bash`, `kind:decision` |
   | `origin:` | who produced it | `origin:jacob`, `origin:model`, `origin:tool` |
   | `trust:` | whether its text may be read as instructions | `trust:untrusted` for web, email or scraped text |
   | `status:` | its state in its owner's vocabulary | `status:open`, `status:working` |
   | `ref:` | another record it points at, by id | `ref:kb:hooks#sessionstart` |

   A service may add namespaces of its own under its prefix, such as `todo.work:audit`.
3. **Every service answers the same three verbs at its server:**
   - `get <id>`: one record;
   - `find <tag>...`: the ids, and one-line titles, of the records holding every tag
     named;
   - `refs <id>`: the records anywhere whose `ref:` names this id.

   These go in the service's `services.json` contract, which setup installs. `tools/todo`
   already has a `services.json` naming its `check` verb.
4. **An id resolves through its prefix.** Given an id, the prefix names the service and
   the registry (the hub brief's union of contracts) names its server. An unknown prefix
   is UNCHECKED, exit 3; a known prefix with no such record is a failure, a dangling
   reference.

**Examples, one per store we already have:**
- **todo.** `todo:td-21` carries `repo:todo`, `kind:audit`, `plan:PLAN-services.md§3`
  and `origin:planner`. Then `find plan:PLAN-context-hygiene.md§0` lists every item a
  plan section produced, which is the lookup S1.6's G2 needs to show that no plan step
  goes untracked. And `refs todo:td-21` shows every Dispatch line and report that
  named it.
- **The conditional-context store (context-hygiene).** A WebFetch result becomes
  `ctx:7f3a`, with `kind:web`, `trust:untrusted`, `origin:tool`, `repo:...` and
  `plan:...` for the work it served. The filters in PLAN-context-hygiene.md §0 become
  tag queries:
  - E6 labels anything `trust:untrusted`;
  - E3 ages each block by its `kind:`;
  - E4 recalls by tag and text;
  - E7's profile per agent is a tag filter;
  - E8 passes `ctx:7f3a` between windows instead of the text.
- **The knowledge base.** `kb:hooks#sessionstart` carries `kind:doc` and the date it was
  fetched. A plan that cites it records `ref:kb:hooks#sessionstart`, so when a docs
  refresh changes that section, `refs kb:hooks#sessionstart` names every plan to
  re-check. Today nothing does that.
- **site-scrapers.** A recipe is `scrape:<host>/<page_type>` with `status:working`. The
  `prefer-recipes.sh` hook's question, whether this host is covered, is then
  `find repo:site-scrapers status:working` for that host rather than a query of its own.
- **applications.** A batch is `apply:batch-<id>`, and each row in it carries
  `ref:todo:...` for the job's sourcing item and `ref:scrape:...` for the recipe that
  found it. Jacob's one yes on a batch, in phase 2, then names one id.
- **wizards.** An answer is `wizard:<definition>/<question>` with
  `ref:<the decision it answers>`, so an answer closes its Decisions row by id, not by
  someone copying it across.
- **transcripts.** A turn is `tx:<session>/<message id>`. The rebuild in
  PLAN-context-hygiene.md §0 keeps `ref:tx:...` on every stub, so each original can be
  traced to where it entered the conversation.
- **data-bridge (Jacob, 2026-10-09: "I also want to be sure dataBridge has tags and ids
  because this is potentially the most useful addition").** It is the most useful
  place because it is where records cross from one store into another, so it is where
  lineage is either kept or lost. It already has most of the ids (db.js):
  - schemas, mappings and their versions;
  - fields, which keep a permanent id through a rename;
  - `transform_runs`, with an `input_digest`.

  What it lacks is tags, and any link from an output record back to its source. The
  additions:
  - **Ids under one prefix:** `bridge:schema/<id>@v<n>`, `bridge:mapping/<id>@v<n>`,
    `bridge:field/<id>` and `bridge:run/<id>`.
  - **Lineage on every output record:** `ref:` to the input record it came from
    (`ref:ctx:7f3a`, or the scrape query), and `ref:bridge:run/<id>`, which names the
    mapping version that made it. A job in Proficiently can then be traced to the
    search that found it, and `refs bridge:mapping/<id>@v3` lists every record that
    version produced, which is what a mapping bug needs to know.
  - **Tags are mapped like any other field.** A mapping step translates a sender's own
    tags into the shared vocabulary, for example a board's `fulltime` into
    `job.type:full-time`. A service's own tag names then reach the shared vocabulary
    through declared, verified data, not code in each service. That makes data-bridge
    the translator the vocabulary registry relies on.
  - **Tests:**
    - a planted tag in the input shows up, mapped, in the output;
    - an output record's `ref:` resolves;
    - a run with a changed mapping version produces records whose `ref:` names the new
      version.

**Context carries ids; the stores are the databases (Jacob, 2026-10-08:** "The
data-stores can operate as inteded, as databases."**).** The rule above also governs
what a conversation holds. A record enters context as its id and a short readable line,
never as a copy of the record. The full record is fetched with `get` only when it is
needed. That turns compression into a procedure, PLAN-context-hygiene.md §0 E11, and
every store becomes queryable rather than retold. Each service must therefore keep
enough to answer `get` for any id it has handed out. A store that hands out an id and
then forgets the data is a dangling reference waiting to happen. For tool results whose
source changes, such as a scrape, what the session saw is kept by the
conditional-context store, not by the tool (PLAN-context-hygiene.md §0 E11, settled
2026-10-09).

**Gates, in the same change as each service adopts it** (the seams rule):
- the id format and the prefix registry, both ways: every prefix in use is
  registered, and every registered prefix has a server;
- tags against the shared vocabulary, both ways: every tag used is defined, and every
  defined namespace is used somewhere;
- dangling `ref:` tags are a failure, and an unreachable service is UNCHECKED;
- each service's three verbs are tested, including that `find` with a planted tag
  changes what comes back.

These are generic checks, so they belong in `tools/checks` (provisional names
`ids-resolve` and `tags-known`), run by every repo.

**Adoption order:** this follows PLAN-context-hygiene.md's order, because its store is
the first new one.
1. The conditional-context store is built with ids and tags from its first record.
2. data-bridge adds tags, lineage and tag mapping, since it already has the ids and is
   where records cross between stores (Jacob's priority, 2026-10-09).
3. todo adds tags and the three verbs; it already has ids.
4. kb, site-scrapers and applications follow, each through its own owner.

**The vocabulary lives in the architecture service (S3) (Jacob, 2026-10-09,** revising
the same day's "registry service" answer: "I think that the shared vocabulary should go
into the proposed architecture service, I want to be careful, as while I'd like there
to be a data store, I want there to be able to be an agent that can determine when new
vocabulary can and should be added. This fits our architecture decision that says that
AI agents should be a fall back when decisions can't be made procedurally through
their server"**).** This supersedes the pinned file in setup. The setup dispatch of
2026-10-09 00:12 ("Pinned shared vocabulary file") was sent before this answer, and its
file is not to be kept.

How a new tag reaches the vocabulary:
1. **A service proposes it through the architecture service's ingest,** never by
   writing the store.
2. **The server decides whatever a rule can decide,** and records which rule decided
   it:
   - **accept** a value in an open namespace that passes that namespace's rule. A
     `repo:` value must be a repo that exists, a `plan:` value a plan section that
     resolves, and a `ref:` value an id that resolves.
   - **alias** a value that normalizes to one already there (`fulltime`, `full-time`,
     `Full Time`). The alias is stored, so the same spelling is decided by rule next
     time.
   - **reject** a malformed value, or an unknown namespace written as if it existed.
3. **What no rule can decide goes to the agent:**
   - a new namespace;
   - a new value in a closed namespace (`kind:`, `trust:`, `origin:`);
   - a near match the normalizer cannot settle, such as `remote` against `hybrid`.

   The server queues a proposal record, `arch:proposal/<id>`, with its evidence: who
   asked, how many records would carry it, and the nearest existing terms.
4. **The agent decides, and the decision becomes a rule.** It can accept, alias or
   reject, with its reason recorded. Each decision is written back as data (a new
   value, an alias or a rejection pattern), so the same question never reaches an
   agent twice. That is the ratchet: judgement is spent once, then becomes procedure.
5. **A new shared namespace also needs Jacob's yes.** It changes what every service
   means by a tag, which is a rule change, so the agent recommends it and Jacob
   approves it (CLAUDE.md "Two windows": rule changes need Jacob). New values within a
   namespace are the agent's.

Tests: each rule in step 2 has a planted case that it decides, and a planted case it
must pass on to the agent, never decide. A proposal the agent decided once is decided
by rule the second time.

**Not finished: tagging in every codebase needs more thought (Jacob, 2026-10-09: "I
think we should have an open todo to more thoroughly address tagging in every
codebase, because it may require a little more thought").** The rule and the examples
above are the frame, not the design for each repo. TODO.md "Tagging in every codebase:
a design per repo" holds the open questions. Each repo's adoption waits on its own row
there, except steps 1 and 2 above.

**Part of the design guidelines.** Jacob: "our design and architecture guidelines,
which we still need to work on proceduralizing." There are five architecture rules so
far:
- one instance behind its own server;
- other ways in go through the service's ingest;
- setup is the source;
- ids and tags on every record;
- **an agent is the fallback, never the first step.** A service's server decides
  everything a rule can decide. It hands an agent only what it cannot, and the agent's
  decision is written back as a rule (Jacob, 2026-10-09; the dispatcher's place in
  PLAN-routing-tree.md §4 is the same rule, applied to routing).

They are the first entries of that list. Making them procedural means each becomes a
check that `setup` installs, with the S3.1 code-writing rules alongside them (TODO.md
"Design and architecture guidelines as checks").

### Every data store is gated and read-only (Jacob, 2026-10-09)

> "Have we not built a method for gating with tests and site scraper? EVERY data store
> should be gated and read only. I'd like a little report to make sure we've been
> actually following this and maybe every other architectural and design rule." And:
> "this exemplified why we need things like linting and architecture services. We have
> no method of enforcing these decisions as we build more services."

**Yes, the method exists.** site-scrapers built it (`site-scrapers/docs/architecture.md`):
- one CLI per store;
- generated files written read-only, with a do-not-edit header;
- a gate that runs the checks before and after a write and rolls back a write that
  adds a finding.

`tools/checks` already generalizes the first part as `accessor`: a store-shaped file
needs a `cli.json` naming its one CLI. What was never generalized is the rest, and
that is how todo's store files ended up writable (PLAN-todo-tool.md §9, "The gap his
question found").

**The rule, for every store in every repo:**
1. **One way in.** The store is named in the repo's `cli.json`, and its CLI is the only
   writer. This is `accessor`, widened so it no longer sees only `*.db` and `*.sqlite`:
   a JSON store such as `todo.json` counts once its repo declares it.
2. **Read-only to everything else.**
   - A store that the CLI writes whole, such as a JSON file, sits at mode 0444. The CLI
     makes it writable for its own write, then sets it back.
   - A SQLite store has to stay writable while its CLI runs, because of its WAL
     files, and site-scrapers writes to its store from several processes at once.
     For SQLite, the hook below and the `accessor` audit enforce rule 2, not the file
     mode. Each owner confirms this for its own store.
3. **A hook refuses a direct write.** One PreToolUse hook in `tools/hooks/source/`
   reads the repo's `cli.json`, and refuses Edit or Write to any store it names, as
   well as visible Bash writes (`sqlite3`, redirects, `sed -i`), naming the CLI verb
   to use instead. Setup installs it everywhere. It replaces §9's todo-only hook, so
   there is one hook, not one per store.
4. **Writes are gated.** The CLI validates a record before writing it, and refuses
   one that would turn the repo's check red. site-scrapers' rollback gate is the
   reference.
5. **Tests in every repo:**
   - a planted hand edit is refused by the hook, or caught by the check;
   - a CLI write still succeeds;
   - a new check, `stores-readonly`, fails on a store file that is writable when it
     should be at mode 0444.

**File mode alone does not make a store read-only (probe, planner, 2026-10-09).** A
file was set to 0444 in the scratchpad, then written five ways:
- `cp` over it: refused, exit 1;
- `>>` onto it: refused, exit 1;
- `sed -i`: it wrote a new file and renamed it into place. Exit 0, content changed, and
  the mode was still 0444 afterwards;
- `mv` of another file onto it: exit 0, content replaced.

So a store at mode 0444 breaks some writers loudly and lets others through silently,
depending on how each writes. That is the hard way to break that Jacob warned of. The
mode is a signal and the seal and the hook are the gate, so all three ship together.
The Edit and Write tools have not been probed the same way; that is the first row of
the inventory below.

### Every store is static or dynamic (Jacob, 2026-10-18)

> "All data stores should be one of two things. Either static, or dynamic. For the
> results of a process, that may be accessed occasionally, a static store is good. For
> the services, each should have an SQL database. This way, ids in other stores can be
> referenced."

**Approved: Jacob 2026-10-18** ("1) yes 2)sqlite 3) now"), as the planner's three rows
put it:
- the rule is adopted with three refinements: config is not a store (ST3), static
  has a definition a check can test (ST2), and references between services go by id
  through the owner (ST4);
- the dynamic store is SQLite;
- todo moves to SQLite now, not after research (PLAN-todo-tool.md §10.6).

It is an architecture rule (PLAN-architecture.md §3). It sharpens "Every data store is
gated and read-only" above and does not replace it: rules 1, 3 and 4 there hold for
both kinds, and rule 2's two cases become the two kinds.

**ST1. Dynamic: a service's records.**
- **One SQLite file per service,** behind its CLI. `cli.json` names it, and the CLI is
  the only writer.
- **Every record has an id and tags** (§3 "Every record a service holds has an id and
  tags").
- **The schema holds the constraints:** NOT NULL, UNIQUE, CHECK, and foreign keys
  within the service (`PRAGMA foreign_keys = ON`). A bad write fails in the database,
  not only in the CLI's code.
- **The schema version is `PRAGMA user_version`.** The CLI's own migrations step it up,
  one version at a time, each in a transaction.
- **WAL mode,** as site-scrapers already runs it under concurrent writers.
- **The file is never committed** (it is gitignored). What git or the data repo holds
  is its static export (ST2).

**ST2. Static: the output of a process.** A static store:
- is written whole by one process, and never edited by anything;
- sits at mode 0444, with a generated header, or a field for formats with no comments;
- names its producer (the command) and its inputs (the store and its `user_version`, or
  the run's id);
- is either **regenerable,** so that running its producer again gives the same bytes
  (a render such as TODO.md, a research topic doc, the §7.11 export), or **immutable,**
  never rewritten once written (a run's result, a report, a check's output).

Anyone may read a static store; no CLI is needed to read it.

**ST3. Not a store: source and config.** These are files written by hand and reviewed
in git:
- plans and CLAUDE.md;
- the roster manifest, `vocab.json`, `wiring.json` and `cli.json`;
- schemas, fixtures and code.

They are outside this rule. A knob that a service reads at run time and that changes
often belongs in the service (PLAN-todo-tool.md §10.4), not here.

**ST4. References between services go by id, through the owner.**
- **The form is `<service>:<id>`,** resolved through the owning service's `get` and
  `refs`.
- **Never a foreign key into another service's file, and never a read of it.** SQLite
  does not enforce foreign keys across attached databases. A shared database would,
  but it breaks "one instance behind its own server" and the tool/data repo split
  (PLAN-repo-setup.md §7.11).
- **`ids-resolve`** (§3 "Every record a service holds has an id and tags") proves that
  every stored reference resolves. So SQL gives integrity inside a service, and the id
  scheme with its check gives it between services.

**ST5. Declared, and checked.**
- **Each store in `cli.json` names its `kind`.**
  - A `dynamic` store adds its `schema_version` and its `export` verb.
  - A `static` store adds its `producer`, and either `regen` (the command) or
    `immutable: true`.
- **`stores-classified`** (tools/checks) fails when:
  - a store-shaped file (`*.db`, `*.sqlite`, a JSON or TSV file a CLI writes, a
    generated `*.md`) is not declared, or declares no kind;
  - a dynamic store is not SQLite;
  - a static store is writable, or has no header;
  - a regenerable store's `regen` does not reproduce it byte for byte.

  Each case has a passing and a failing fixture. It starts as a report listing every
  store in every repo with its kind or none (the inventory, §4 step 10.3), and becomes
  a failing gate once every repo is declared.

**ST6. One store helper per language, not one per tool** ("Don't duplicate
procedure").
- **What it does:** it opens a store with WAL and foreign keys on, migrates by
  `user_version`, wraps a write in a transaction that rolls back on error, and writes
  the deterministic static export.
- **Two languages:**
  - Python's comes out of todo's move (§4 step 10.1), written with nothing todo-specific
    in it;
  - Node's comes from what site-scrapers and data-bridge already open their databases
    with.
- **Setup is the source.** Both helpers live in setup's templates, and setup installs
  them as copies with a drift check, the way the shared hooks are installed (§7.8 of
  PLAN-repo-setup.md).

**What moves.** The §4 step 10.3 inventory names every dynamic store still in JSON or
TSV, for example todo's stores, `.claude`'s ledgers, `temp-rules.json`, and
knowledge-base's `insights.tsv` and `sources.tsv`. Each gets an item in its owner's
store. todo goes first, by Jacob's row 3. The research service is born on SQLite
(R6: an answer is a row attached to its question, and a topic doc is that row's static
render).

### Before any store goes read-only: every writer, inventoried (Jacob, 2026-10-09)

> "How are you, the planner repo, making changes. This is counter to our delegation
> and read only strategy. We need to make sure that ALL of our code is prepared for
> going read only, as this will break in a difficult way if we dont."

**How the planner has been writing.** The planner's role allows it to write top-level
`PLAN-*.md` and `TODO.md`, and it has written nothing else. But it wrote them through
Bash, with no CLI:
- `sed -i` on one line;
- `cat >>` to append a section;
- a whole file rebuilt in the scratchpad and copied over the original with `cp`.

None of that passes a gate.
- **The `cp` rebuild can erase another session's edit.** It copies a snapshot over the
  file, and several of this session's writes landed on files that "changed on disk
  since you last read it".
- **Once `TODO.md` is a rendered read-only file, these break in different ways.** `cp`
  and `>>` fail, while `sed -i` succeeds and breaks the seal, as the probe above shows.

**The end state is already designed: PLAN-routing-tree.md §13.2** (Jacob, 2026-10-09:
"Yes, our plan is to block tool calls with hooks and have the server run them,
remember?"). Every role is read-only:
- hooks block its write tool calls;
- its tools list lacks Edit and Write;
- an OS sandbox allows writes only to its scratchpad. The sandbox holds against
  `sed -i` and `mv` as well, which file mode does not.

A role writes by sending a `write-request`: the CLI verb and its arguments, as data.
The node's server runs that tool's gated CLI and answers with the CLI's own result.
The planner is a role like any other, so in the end state it writes nothing itself.
Its plan and TODO edits become `write-request`s.

So the work below is not a second design. It is what §13.2 needs before it can be
switched on: **a write that has no CLI verb has nothing for the server to run.** Until
the hub server exists, the planner uses the Edit tool only, because it refuses an edit
to a file that changed since it was read.

**What has to be true before any store goes read-only** (dispatch lines 3 and 5 of
2026-10-09 are held for it):
1. **An inventory of every writer of every store and generated file, across all
   repos.** For each: the file, every process or agent that writes it, how it writes
   (its CLI, Edit/Write, `sed -i`, `cp`, a redirect, `mv`, SQLite), and what happens
   when the file is 0444 and the hook is live: works, fails loudly, or bypasses
   silently. `lib/write-targets.sh` already lists what the Bash heuristic cannot see,
   and that list is an input. The first rows are the Edit and Write tools themselves
   (do they write in place, or rename into place?) and the planner's own writes.
2. **Every writer that is not the store's CLI gets a path through a CLI.** The
   planner's writes are the clearest case:
   - `TODO.md` moves to the todo store (PLAN-todo-tool.md §9 step 1);
   - plans need a write verb. Setup, which owns the plans gate, adds
     `setup plans edit <FILE> §<n> --from <file>`. It replaces one section, refuses if
     the file changed since the section was read (a digest given on the command
     line), and runs `setup plans` before and after the write.

   These are the verbs the server will run for a `write-request`. In the meantime the
   planner calls them itself. Only once they exist does harness remove the planner's
   direct write to the top-level `*.md` files from `dispatch-guard.sh`. That is the
   interim form of §13.2's block, until the hub server runs the writes.
3. **Each repo goes read-only in its own job, with its own tests green before and
   after,** in the order the inventory gives. A repo whose writers are not all ready
   stays as it is, and is listed as such.

**What this is waiting on (the planner's reading, 2026-10-12, each line from a
command).** Jacob: "It should be a rule you are incapable of breaking. That is what
the gating and read-only objective is supposed to do. What is that waiting on?"
- **Nothing above was ever dispatched.** `agents.sh dispatches --since 2026-10-08`
  lists no inventory, no `plans edit`, no store hook registration and no read-only
  job. The 2026-10-09 lines were "held for" the inventory, and the inventory itself
  was never sent. A held line with no item behind it is exactly §11 S6 of
  PLAN-architecture.md: approval as prose, invisible to `dispatchable`.
- **The store hook is rendered and dead.** `store-guard.sh` sits uncommitted in 13
  repos' `.claude/hooks/` (setup's render of 2026-10-10), is in no `settings.json`
  (`grep -c store-guard .claude/settings.json` → 0; `tools/hooks/source/settings.json`
  → 0) and in no `wiring.json`. It blocks nothing anywhere.
- **The planner's own writes have no verb yet.** The top-level `todo.json` exists at
  mode 0444 (`ls -l todo.json`) and is empty: the import waits on the importer fix
  (PLAN-todo-tool.md §10.2 step 6, dispatched to `todo` 2026-10-12 23:18). `setup
  plans edit` does not exist. So the planner still writes plans and TODO with the
  Edit tool, allowed by `dispatch-guard.sh`.
- **The end state has no server.** PLAN-routing-tree.md §13.2's `write-request` needs
  the hub server; `tools/hub` holds a brief and no code, and `PLAN-hub.md` is not
  written.

**The order that makes the planner incapable, not just forbidden** (each step its
own dispatch; approved by the 2026-10-09 directive above and by "a rule you are
incapable of breaking", 2026-10-12):
1. `setup`: `setup plans edit <FILE> §<n> --from <file>` as specified in step 2
   above (digest check, `setup plans` before and after, refuse on drift), with
   fixtures for each refusal. Also `setup plans add <FILE> --after §<n> --from <file>`
   for a new section, since the planner adds sections daily.
2. `todo`: the importer fix, then the top-level import (PLAN-todo-tool.md §9 step 1),
   so `TODO.md` is rendered and 0444.
3. ~~`harness`: remove the planner's write tools~~ **Replaced by Jacob, 2026-10-13:**
   "You should be writing through the server, which can be the programmatic gate that
   prevents you from doing what you are not supposed to. Commands that are unallowed
   will be sent to the server via hooks and denied." So the gate is the hub server,
   not a shorter tool list, and it is PLAN-routing-tree.md §13.2 applied to the planner
   first:
   - **the hook:** one PreToolUse hook in the planner window on Edit, Write,
     NotebookEdit and every Bash write `lib/write-targets.sh` can see. It sends the
     call to the server as a `write-request` (role, tool, file, the CLI verb and
     arguments where the call names one) and returns the server's answer as the tool
     decision: allow, or deny with the verb to use instead;
   - **the server's rule:** a write is allowed only when it is a declared verb
     (`cli.json`) on a store that role may write, and the server runs the verb itself.
     An Edit of a `PLAN-*.md` is therefore denied and `setup plans edit` is run for it.
     Nothing is decided in the hook; the hook carries the call and the answer;
   - **when the server is down:** the hook denies, with one line naming `hub status`.
     The purpose is incapability, so this path fails closed for writes. It is the one
     exception to "every hook fails open" (CLAUDE.md), recorded there once built, and
     its test exercises the server being down;
   - **what it needs built:** steps 1 and 2 (the verbs), and the server's
     `write-request` route, which PLAN-hub.md §9 places in H2 (the write lease). For
     the planner's writes it moves forward: a slice **H1a-0, "the write gate"**, the
     route and the deny answer alone, before H1a-1's routing. The hub owner costs and
     places it in the next plan pass (step 7).

   **Widened by Jacob, 2026-10-13, to every tool call, reads included:** "read only is
   enforced via hooks. While every agent and service acts as though they can call
   tools, our hooks intercept ALL of them, determine where the agent, or service, or
   cli that is in charge of those are, and then are sent via hooks, programmatically
   rather than via output." What changes:
   - **No role has a tool list that is the gate.** An agent is given its tools as
     usual and calls them as usual; the PreToolUse hook sees every call, not only the
     writes. A permission list may still exist as a default, but nothing rests on it:
     a call the list lets through is still the hook's to route or deny.
   - **The hook resolves the owner, never the agent.** For each call it works out
     which store, CLI or service is in charge of the thing named (a path, an id with a
     prefix, a verb) and sends the call there as a request: `read-request` for a read,
     `write-request` for a write. The owner's CLI runs it, and the result comes back
     as the tool result. The agent never carries the request in its output, so a
     request is never a line of prose the next session has to parse.
   - **Reads are allowed by rule, writes by declared verb** (the rule above). A read
     of a store goes through its declared `get`; a read of any other path is plain
     Read, whether an owner holds it or not. A write is allowed when it is a declared
     verb on a store the role may write, or (under H2's lease, Decision 13) an Edit
     or Write of a non-store path inside the repo the role holds the lease for; any
     other write is denied with the verb to use. Only writes are ever denied for
     naming nothing an owner declares.
   - **PLAN-hub.md Decisions 12 and 15 dissolve:** there is no read-only tool list to
     widen by one verb, because the list is not the gate. `hub get <id>` stays as the
     server's read route; the hook calls it when an agent reads a store, whatever tool
     the agent used. The hub owner records this in PLAN-hub.md §4 and §12 (Dispatch,
     2026-10-13).
   - **Fails closed for both.** A store read the hook cannot route while the server
     is down is denied the same way as a write, with `hub status` named; a Read of a
     non-store path never needs the server, so a down server does not strand a
     session reading its own repo. The test covers both halves.

   **The hub owner's four questions (tools/hub/TODO.md on `plan/hub`, 2026-10-13),
   answered here, the planner's reading:**
   1. **The planner's row in `owners`.** `owners` gains one row, `workspace`: the
      top-level stores (`PLAN-*.md`, `TODO.md`, `todo.json`), written by the planner
      and the dispatcher through `setup plans edit|add` and `todo`, never by Edit.
      Derived from `owners`, the planner's writable set is that row and nothing else;
      the dispatcher's is the same row. No repo row names either of them.
   2. **Owned paths.** No new key: a repo row's path is the directory it owns, and
      every path under it belongs to that owner. The `workspace` row lists its
      top-level files by glob, since the top is not a repo. Which of an owner's paths
      are stores comes from its `cli.json`, not from `hub.json`; the hook asks the
      server, and the server reads `cli.json`.
   3. **"Denied" against "plain Read".** The first bullet above was wrong as written
      and is corrected: reads are never denied for being unowned; only writes are.
      The three read cases are store (server, `get`), owned non-store path (plain
      Read), unowned path (plain Read).
   4. **The coder's Edit under the lease.** The write rule carries the clause now
      (above): a non-store path inside the leased repo may be edited; a store inside
      it still goes through its verb, which `store-guard.sh` and 0444 enforce
      regardless. H2's gate row tests the two: an Edit of a leased repo's source
      file is allowed, an Edit of its `todo.json` is denied with the verb.

   The read half of H1a-0 can now be costed; whether it splits off as H1a-0b is the
   hub owner's call, reported, not asked. **Reported (`1094761`, 2026-10-13):** read
   half 50-90k by analogy, H1a-0 130-220k, split off as H1a-0b, cloud by default;
   total 1.7-2.6M, cloud share 1.25-1.8M.

   **Two more from the hub owner (same commit), answered:**
   1. **Down-server reads.** The hook never needs the server to tell a store path from
      a non-store one: store-ness is on disk. Each owner's `cli.json` names its
      stores, and setup renders the workspace list of them (`stores.json`, read-only,
      beside `hub.json`) when it runs at any repo. The hook reads that file; the
      server reads the same file. With the server down a store read is denied with
      `hub status` named, and any other Read is plain Read, so both rules in step 3
      hold. The test: server down, a Read of a listed store path is denied, a Read of
      an unlisted one is allowed; a `stores.json` that is missing means every Read is
      plain Read and `hub status` reports it, which `session-doctor.sh` surfaces.
   2. **A repo's own role may write its repo.** Confirmed: that is what deriving from
      `owners` means. The owner role of a repo writes that repo's stores through their
      verbs, and its non-store paths under H2's lease; no other role writes there.
   3. **Noted, and these are steps 1 and 2 of this list:** no manifest `owners` block
      and no `tools/setup/cli.json` exist yet, so no `cli.json` names `PLAN-*.md` as a
      store. `owners` is rendered by setup from the roster manifest (harness) and the
      repos' `cli.json` files; `setup plans edit|add` is the first verb, and setup's
      `cli.json` the first file to name the plans as a store.
4. `hooks` and `setup`: register `store-guard.sh` in `tools/hooks/source/settings.json`
   and re-render, so every repo's hook is live once Jacob applies; `checks`
   `hooks-installed` fails where it is not registered.

   **Corrected by RESEARCH-writers.md (deep-work, 2026-10-13), Q1 and Q2:**
   - **Per-repo registration never reaches the sessions that write.** Every roster
     agent and both windows run with the workspace top as their project, and a repo's
     `.claude/settings.json` applies only to sessions whose project is that repo
     (docs, hooks#hook-locations: "Single project"). The source registration landed
     (`tools/hooks` `5eac66b`), and it fires for nothing that matters. The hook has to
     be in one of: the top-level `wiring.json` (harness, then Jacob's apply), user
     scope (`hooks userscope`, then Jacob's apply; the hook is `applies_to=all`, so
     this is the route its own repo designed), or each roster agent's frontmatter from
     the manifest (which still misses the two windows). Jacob's choice: TODO.md
     "Questions for Jacob" dt-4 row 1.
   - **The Edit and Write tools rename into place.** On a 0444 scratch file both
     succeeded, content changed, mode stayed 0444, new inode. So do `mv`, BSD `sed -i`,
     `perl -pi`, `install`, `os.replace` and `renameSync`, several of them resetting
     the mode to 0644 or 0600 without a word. Mode 0444 stops only in-place writers
     (`>`, `>>`, `cp`, `tee`, `open('w')`, `writeFileSync`, every SQLite writer). The
     mode is a signal and the hook is the only gate, for a model's tools above all.
   - **Q5's order:** todo stores and kb's TSVs are ready now (0444, CLI keeps it,
     seal), held back only by the hook not being live; `.claude/` and hub renders are
     ready as files but the hook does not cover renders (dt-4 row 3); SQLite stores and
     the ledgers are never 0444 (the hook and append-only code guard them, dt-4 row
     2); applications has no `cli.json`, so the hook cannot see it; `~` stores are
     outside the hook's reach; the top-level plans and TODO are the server gate's job
     (step 3). `agents.manifest.json` has no writing verb, so a live hook at the top
     would leave harness without a way to change the roster (dt-4 row 4).
   - **The probes die with the scratchpad** ("What this could not settle" 1): the
     primitive probe becomes `hooks probe-modes`, and the write-site scan becomes
     `checks writers`, so the inventory can be re-run. Each `code`-status row of Q4 is
     settled by its owner running the writer against a 0444 scratch copy.
5. `deep-work`: the inventory (step 1 above), read-only, written through the research
   verbs where they exist, as `RESEARCH-writers.md`.
6. Each repo, in the inventory's order: read-only in its own job (step 3 above).
7. **The hub server is on the critical path, not after it (Jacob, 2026-10-13).** Its
   state, each line from a command:
   - `git -C tools/hub branch -a` → `plan/hub` exists locally and on origin;
     `git show plan/hub:PLAN-hub.md` has §1-10, with §9's order H0 → H1a-1 → H1a-2 →
     S1 → H1b → H2 → G1 → H3 → S2 → V1-V3 → H4 → H5;
   - PLAN-hub-review.md §5.9-5.10: every decision on it answered 2026-10-09;
   - `git ls-tree plan/hub docs/` → `REVIEW-2026-10-09.md` is on the branch (§5.11
     step 1 done);
   - `git log -1 plan/hub` → `82aab8c TODO.md: question 12 open for the cloud pass`:
     the §5.11 cloud pass itself never ran, `plan/hub` is not merged, and H0 was never
     dispatched (TODO.md "Routing tree": "waits on Jacob"). Four days.

   **Corrected 2026-10-13, from the hub owner's report:** the §5.11 cloud pass had
   already run (`origin/plan/hub` PLAN-hub.md §11, §12, Decisions 14-16 hold D1-D4,
   5.5, D9 and brief questions 11-12); `git log -1 plan/hub` showed the local branch,
   which was behind. Only H1a-0 was pending, and `hub` added it the same day
   (`6d2b3f6`, pushed, not merged): the slice before H1a-1, a per-role `writes` list in
   `hub.json`, the §8 write-gate row, the hook failing closed for writes, Decision 17.
   Re-cost: 1.7-2.5M tokens (58-87u), cloud share unchanged. PLAN-hub.md Decisions 9,
   14, 15, 16 and 17 are Jacob's (dt-5). The hook half of H1a-0 (a PreToolUse caller
   of `hub hook write-gate` in the planner window) registers only after
   `setup plans edit|add` and todo's import exist; harness holds it beside H1a-0.
   Then the planner checks the branch (`kb check --all`, `setup plans`), the merge
   into `main` is one dispatch, and H0 follows.

### Decisions get a gate when they are made (Jacob, 2026-10-09)

His point is that an approved decision stays prose unless something enforces it. Each
new service then copies whatever the last one did. That is what the architecture
service (S3) is for, and `tools/checks` already holds its seed:
- `rules-gated` makes every CLAUDE.md rule either a `gate`, with the gate named in
  `tools/checks/gates.json`, or `prose`, with a reason no check can hold it;
- setup installs the checks into every repo it makes, so a new service starts with
  them.

The missing link is from a plan to the registry: an approved architecture decision
in a plan does not have to name its gate. **The fix: `setup plans` fails on a plan
line recording an architecture or design decision as approved, unless that line
names its gate row in `gates.json`, or says `prose: <why>`.** A decision then cannot
be approved without its enforcement being named. A new service made by setup inherits
the check, and the S3 server later serves the same registry. The five architecture
rules above and today's store rule are the first rows. Each gate row needs its own
check, and until that check exists the row is marked `unbuilt`. `checks all` counts
those as red, so the gap stays visible.

### The report, 2026-10-09 (`tools/checks/checks all`, run by the planner)

19 locations: 9 green, 10 red.

| rule | where it fails | what it means |
|---|---|---|
| every rule is a gate or prose (`rules-gated`) | addon-bench, applications, emailTools, knowledge-base, chronjobScheduler, data-bridge, scripts, site-scrapers | these 8 repos have CLAUDE.md rule sections not classified as either; the `tools/*` repos and income pass |
| one way into a store (`accessor`) | site-scrapers: `data/failures.db` is not named in its `cli.json` | one real finding |
| the same, as seen from the top level | `.`: kb.sqlite, data-bridge.db, failures.db, scrapers.db | likely a false finding: the top level scans into nested repos that pass on their own (knowledge-base and data-bridge are green in their own rows). Unconfirmed; reported to `checks` |
| hook copies agree with the source (`hooks-installed`) | scripts, site-scrapers, tools/usage, and the top level | drift; re-rendering needs Jacob's yes |
| every tool has a CLAUDE.md row (`docs-rows`) | `.`: income | the row is missing |
| store files read-only | nowhere checked | no check exists; rule 5's `stores-readonly` |
| JSON stores have one way in | nowhere checked | `accessor` sees only `*.db` and `*.sqlite` unless a repo declares more |
| the five architecture rules above | nowhere checked | `ids-resolve` and `tags-known` are planned, and the other three have no check yet |

Many cells came back UNCHECKED, each saying why: `registry-matches`,
`rendered-matches` and `stores-exported` wait on `node.json` files and on the data
repo. They are not counted as green.

### Plan steps are always tracked (S1.6): the planning service's first guardrail

**Jacob, 2026-10-08:** "I'd like incorporate guard rails that prevent this from
happening into the planning service." "This" is the audit in TODO.md "Plan steps that
were not done and not in any TODO": 11 of about 157 open plan steps were tracked
nowhere, and 5 more could not be classed. Nothing failed when a step was written
without a TODO item, when a step was superseded without saying so, or when a step was
finished without anything closing.

**The rule.** Every actionable step in a plan names exactly one place that holds its
state, and that place resolves. The plan never repeats the state itself (one source
for each fact): an open or closed item's status lives in its store.

**G1. A step's tag.** Each numbered item under a heading that starts with `Steps`,
`Phase` or `Handoff` ends with one `track:` tag:

| tag | means | resolves when |
|---|---|---|
| `track: todo:<repo>#<id>` | a store item holds it | `todo show` finds the id, open or closed |
| `track: TODO.md "<title>"` | the top-level TODO holds it, until that file moves to a store (PLAN-todo-tool.md §6 phase 3) | an item with exactly that bold title exists |
| `track: needs-yes <FILE §n>` | not approved yet | the pointer resolves |
| `track: superseded-by <FILE §n>` | replaced by other work | the pointer resolves |
| `track: done <repo>@<commit>` | finished before stores existed (legacy only) | the commit exists in that repo |

**G2. The plans gate checks the tags.** `tools/setup/setup plans .` is already the
gate every plan passes, and `agents.sh check` runs it.
- It fails on a step with no tag, a tag off the table above, or a tag that does not
  resolve.
- **The reverse direction:** a store item or TODO.md item that cites `PLAN-x.md §n
  step m` where no such step exists fails as dangling.
- **A ratchet for the 32 existing plans:** today's untagged steps go into a baseline
  file. The gate fails if the count rises, or if a plan written after the gate has any.
  The baseline can only shrink.
- Each rule has a passing and a failing fixture.

**G3. Caught when written, not at the next check.** The top level has no commits, so a
step written in a planner turn would wait for someone's next `agents.sh check`.
- A Stop hook in the planner window runs the step check on top-level plans changed in
  that turn, the way `question-gate.sh` checks the reply.
- It blocks the reply once, naming the step, and then passes labelled "rule not met"
  (`questions.max_blocks`' pattern), so it cannot trap a turn (decision below).

**G4. Approval and closure go through the item.**
- A `## Dispatch` line carries the step's `todo:ID` (PLAN-todo-tool.md §6 phase 5).
  `auto-relay.sh` refuses a line whose step is still tagged `needs-yes`.
- When Jacob approves a step, the planner changes its tag from `needs-yes` to the new
  item's id in the same turn. G3 catches a turn that forgets.
- The dispatched agent closes the item with `todo done`.
- A `harness` check: a dispatch the ledger records as done whose item is still open is
  reported. It is not counted as done.

**G6. Plans generate their items; they are not only checked (Jacob, 2026-10-12).**
"This should be gated, when new plans are made, new non-blocking todos should be
added. When plans are changed, they should generate new todos and edit ones that need
to be changed." So G1-G5 change from "fail when a step has no item" to "make the
item, then check":
- **One sync, run when a plan is written:** provisionally `todo sync-plans`. It reads
  each plan's steps through `setup plans steps <file> --json`, the one parser of G1's
  grammar, and compares them with the items whose `plan:` tag cites that step.
  - **A new step gets a new item** in the store of the repo the step names:
    - its title is from the step, and it is pinned (`--pin-plan`);
    - its status is `open` if the plan records Jacob's approval, otherwise
      `waiting-jacob`;
    - its kind is `plan-step` (built under that name; this plan first called it
      `step`, td-50).
  - **A changed step:** its item's mechanical fields (title, pin, `plan:` tag) are
    updated by the sync. Its judgement fields (`done_when`, size, scope) are not
    rewritten: the item is listed as `stale` with the old and new step text, for the
    planner or its owner to edit. An item already dispatched is never changed under
    a running agent. It is flagged to the dispatcher instead.
  - **A removed step:** its item is listed as `gone`. It is never deleted or closed
    automatically, because only a person or the owner says whether the work is
    superseded or still wanted.
  - **A renumbered step** is matched by its text hash before its number, so inserting
    a step does not re-point every item after it.
- **Non-blocking, as Jacob asked:**
  - a generated item never blocks a dispatch, a commit or a reply;
  - it carries no `blocked-by`;
  - the sync fails open: an error is one notice line, never a stopped turn.

  The G2 gate still fails a step the sync could not place: a step that names no repo,
  or a step with an unknown grammar. That is the one thing a person must fix.
- **Where it runs:**
  - in the planner window, after each `Edit|Write` of a top-level plan, beside
    `plan-drift.sh`, which already reports the drift this repairs;
  - in `agents.sh check`, as a dry run that prints what it would add.
- **Steps owned by the planner, or naming no repo,** go to the top-level TODO.md. That
  file is hand-written until it becomes a store (PLAN-todo-tool.md §6 phase 3), so the
  sync lists them for the planner to add in the same turn. It does not write them
  itself.
- **The tag in the plan becomes optional.** The item's `plan:` tag and pin are the
  link (one source), so the sync never edits a plan file. `track: needs-yes`,
  `superseded-by` and `done` stay, because they carry state that no item holds.

**Approved: Jacob 2026-10-12** ("This should be gated"), for G1-G6 as revised here:
§4 step 6. **G2's failing half was held, then settled by G2-1 below.** Jacob, the same
day: "The G2 gate should possibly be something we discuss in terms of keeping this as
procedural as possible, though maybe this will be enforceable once every repo is read
only."
- **The planner's reading:** a gate that fails after the fact still leaves a person
  to repair the plan. The procedural form is to refuse the bad step when it is
  written. That is possible only once plans, like stores, have one writer: a
  `plans` CLI behind a read-only file (§3 "Every data store is gated and read-only").
  That writer would refuse a step that names no repo, or whose grammar is unknown,
  so G2's case could not arise.
- **Until then:** the parser, `steps --json`, the G5 report and G6's sync are built.
  G2's unplaceable steps are listed by the sync's notice and by `agents.sh check`'s
  dry run, without failing anything. The ratchet baseline waits with G2.
- **G2-1, answered: Jacob 2026-10-12, yes.** "Everything should be as programmatic
  as possible. The idea is to create as few situations that require AI intervention
  as possible." So plans are a store. Once repos go read-only, plans are written only
  through one writer, which refuses a step it cannot place. G2 becomes a refusal at
  write time, not a gate that fails later.
- **Before read-only (the planner's supporting rule, under root principle 1):** the
  refusal comes first as a PreToolUse hook on Edit and Write of a `PLAN-*.md`.
  - It works out the file as the edit would leave it, and runs setup's parser on that
    result (`setup plans steps --json`).
  - It refuses (exit 2) only a step that is new or changed by this edit and that
    names no repo or has an unknown grammar. It names the step and the fix.
  - Steps already in the file are never refused. They are G6's notice and the
    planner's backlog (§4 step 6.2), so no ratchet baseline is needed.
  - It fails open: if the parser is missing, slow or errors, the edit is allowed and
    a notice says so. Its test exercises that failure.
  - When plans go read-only, the same check moves into the writer. The rule stays
    the same; only where it runs changes.

**G5. The plan proves it was followed (S1.6's default).** `setup plans . --steps` prints
each plan's steps as open, closed, needs-yes or superseded. A closed item must have
evidence dated after the plan's date. This report replaces the hand audit.

### Every architecture and design practice is adhered to, and it shows (Jacob, 2026-10-12)

**S3's home and index is PLAN-architecture.md** (Jacob, 2026-10-12). It covers
everything said about architecture, who uses the service, the meta rules, fit, and the
living list of open questions. Approved text stays here and is cited there.

> "I would like to include something about making sure that all our achitectural and
> design practices are adhered to."

**Where it stands (read 2026-10-12).** The practices are scattered and mostly unchecked:
- **Top-level CLAUDE.md:** gate the seams, make the wrong thing impossible, a wrong
  answer is worse, don't duplicate procedure, helpers over blobs, parallelism.
- **This plan, §3:**
  - the five architecture rules;
  - ids and tags on every record;
  - one way into a store, and stores read-only;
  - decisions get a gate.
- **The code-writing rules (S3.1):** not written yet.

`tools/checks/gates.json` is the registry that `rules-gated` reads. It covers
CLAUDE.md rules only, and 8 repos fail it (§3 "The report"). None of the five
architecture rules has a check.

**The rule.** Every practice is one row in one registry, and every row is in one of
three states:
- **gate:** a named check holds it;
- **prose:** it says why no check can, and something else is named to hold it;
- **unbuilt:** a check is planned. The row counts as red until the check exists.

Adherence is checked where work happens, never by a session remembering.

**A1. One registry.** `tools/checks/gates.json` gains the design and architecture
practices beside the CLAUDE.md rules, with no second file. Each row says which repos it
`applies` to. The S3 architecture service later serves this same registry (S0.1).

**A2. One report, with a ratchet.** `checks practices` prints each row with where it is
held, where it is broken and where it is unchecked. A baseline file holds the count of
red and unbuilt cells, and the count can only fall. `agents.sh check` fails when it
rises, and `doctor` says so at session start.

**A3. Checked at the three points where work happens:**
- **When a plan is written:** `setup plans` requires a `## Practices` heading, like
  "Setup component", in every plan that builds or changes a tool. It names the
  registry ids the work touches, and each id must resolve. An approved design decision
  names its gate row, or says `prose: <why>` (§3 "Decisions get a gate").
- **When a repo commits:** `checks run .` in each repo's `dev.sh check` runs every
  gate row that applies to that repo, so setup's install carries new rows to every
  repo.
- **When work is dispatched:** `todo brief` lists the prose rows that apply to the
  item's repo, by id with one line each. The agent's report ends with a `practices:`
  line naming any row it could not hold, and why. A dispatch whose report lacks the
  line is flagged in `agents.sh dispatches`.

**A4. Prose rows still get checked.** An agent is the fallback, never the first step
(§3). When every step of a plan closes, one review checks that plan's commits against
the prose rows that apply. Its findings go to each owner as reports, not fixes. Whether
the review runs is decision A-2.

**A5. Prose shrinks over time.** Each prose row records what would make it checkable.
When the repetition counter (§4 step 1) shows a pattern recurring, that row is a
candidate to become a gate.

**Decisions, Jacob 2026-10-12.** A-1: yes. A-2: yes, per finished plan. His words on
A-1: "As long as we have an explanation for how anything is adhering to our practices
yes, this should be fine. Ideally this will be more 'enforcable' with audits, linting,
and more later, but so long as I can ask you to check and you will be able to see what
is justified and what is not, we should be ok. Always ask me if you don't know, rather
than guess or make things up, these questions can be added to our todo list."

**What that changes:**
- **The bar is an explanation, not a gate.** Gates come later, as A5 already says.
  - **Every cell in `checks practices` is one of four:**
    - held by a gate;
    - `justified: <why it holds here>`;
    - `unjustified`;
    - `unknown`.
  - A prose row counts as held only where its cell carries the explanation.
  - The ratchet (A2) counts the `unjustified` and `unknown` cells.
- **The `practices:` report line (A3) carries that explanation.** For each prose row
  that applies, it says how the work held it, or that it did not. A bare "held" is
  read as `unjustified`.
- **A6. Ask, never guess.** When a planner or an agent does not know whether a
  practice applies, or how it holds, the cell says `unknown`. The open question goes to
  Jacob in TODO.md "Questions for Jacob", one line each, with its pointer. A guessed
  `justified` is the "wrong answer is worse than a failure" case and is never written.
- **"Can you check?" is answered from the report, never recalled.** The planner runs
  `checks practices`, or until it exists, reads the registry and the reports. It says
  per row whether the row is gated, justified, unjustified or unknown, with the evidence.

**Gates for this section:**
- each A-step has a passing and a failing fixture;
- the ratchet has a test that a planted new red cell fails it;
- `setup plans` refuses a `## Practices` id that does not resolve;
- a fixture brief carries its repo's prose ids.

### External tools are held to the same practices (Jacob, 2026-10-12)

> "I think also the addon sandbox should be able to work in the same way, I want to be
> able to integrate external tools in a way that adds tests, checks, and audits, and
> determines if there are gaps that do not meet our architecture/design needs. This
> MAY fall into the purview of a separate architecture service as we were
> brainstorming before."

**The planner's reading of "in the same way":** an outside tool is measured against
the same practices registry as our own code (§3 "Every architecture and design
practice is adhered to"). Each practice cell gets one of the four states: gated,
justified, unjustified or unknown. Any cell that is not gated or justified is a gap.
That reading is the first question in TODO.md "Questions for Jacob" (A6); it is not
assumed settled.

**Where it stands (read 2026-10-12):**
- **`addon-bench` already isolates a candidate.** It has:
  - a hash pin and an offline install;
  - a sandbox with no network, a deny-list of reads and an allow-list of writes;
  - `git archive` inputs, checksummed before and after;
  - an output cap;
  - a wrapper that passes only declared verbs;
  - a `probes/test.sh` per candidate;
  - known wrong answers in the candidate's TODO.
- **Its adoption ladder (PLAN-addon-bench.md §5) maps a candidate's parts to "an
  existing rule, check or hook".** It does that in prose, by hand. It does not read the
  registry, so its "already covered?" answer and the practices report can disagree.
- **Nothing measures a candidate against the architecture practices.** For example:
  does it fail open, does `--json` give one schema, does a parameter change the output,
  does it keep secrets out of its output.

**The rule.** Whether code is ours or someone else's, it is checked by one assessor
against one registry. An outside tool is never integrated on trust: every practice
that applies to it is gated, justified or listed as a gap. Each gap is closed by a
check we add around the tool, or taken to Jacob. It is never waived silently.

**X1. Two kinds of row for an outside tool.** A registry row's `applies` field gains
two subjects:
- **`seam`:** practices about how we hold the tool. These must all be gated, because
  the bench already has the parts:
  - pinned by hash;
  - sandboxed;
  - reached only through its wrapper, so the wrapper is the one way in, with a
    bypass audit;
  - output capped;
  - no credential in its environment.
- **`behaviour`:** practices about what the tool does. We cannot rewrite its internals,
  so each row is measured from outside where a probe can, and is otherwise justified or
  `unknown`:
  - fails open, or not;
  - one schema for `--json`;
  - a parameter changes the output;
  - a wrong answer is not dressed as a right one (its known wrong answers);
  - no secret values in its output;
  - no writes outside its sandbox.

**X2. The assessor is the architecture service's (S3), not the bench's.**
- **S3 owns:** the registry (A1) and one verb, `checks assess <path> --subject
  repo|candidate`. It prints the four-state cells for the rows that apply.
- **The bench supplies the subject:** `./dev.sh assess <c>` runs that verb against
  the candidate's installed tree and its probe outputs, inside the sandbox.
- **No second copy of the practices:** the bench holds none, and its §5 ladder cites
  registry ids instead of prose.
- **A gap becomes one of three things:**
  - a probe or check the bench adds for that candidate, which makes the cell gated;
  - a wrapper rule that makes the cell hold, such as filtering secret-shaped output;
  - a question for Jacob: adopt with the gap stated, or don't adopt.

**X3. Two ways to integrate, both allowed** (decision X-2):
- **extract:** the existing ladder. A useful part is rewritten in our form.
- **wrap:** the tool stays as it is, runs only through the bench's sandbox and
  wrapper, and is called by our tools as a dependency. This needs every `seam` row
  gated, and every `behaviour` row gated or justified. A tool that hits a gap in use is
  re-assessed, not patched around.

**X4. Where S3 lives.** For now it is verbs on `tools/checks`, where the registry
already is. It becomes its own repo through setup only when it outgrows a verb, which
is S5.5's default (decision X-3). Jacob's "MAY fall into a separate architecture
service" is this: it is a separate service with its own contract from day one, and a
separate repo only when that pays.

**Gates for this section:**
- A planted candidate that lacks a probe for one declared verb shows that row as
  `unjustified`.
- A planted candidate that writes outside its sandbox shows the write row as a gap.
  The sandbox already blocks the write, and the block is the evidence.
- `assess` on one of our repos and on a candidate reads the same registry. A test
  plants a row and sees it in both.
- An audit fails if addon-bench names a registry practice in its own files instead
  of citing its id.
- Every `seam` row has a gate, or `checks practices` counts it red.

### S7. The research service (Jacob, 2026-10-12)

> "I'd also like to have a research stage, possibly with seperate documents elsewhere.
> I think this will be a good way to implement expanding the site scraper."
>
> Then: "I think the research stage might be able to be expanded to its own separate
> service, as they are not necessarily required for every plan and not necessarily
> only used in plans."

**So research is a service of its own, S7, beside planning (S1), gating (S2) and
architecture (S3), and not a stage inside planning.** It takes questions from any
consumer and answers them with evidence. A plan is one consumer, and an optional one.
The others are:
- a dispatched agent that hits a factual question it cannot settle from its own repo;
- the planner, answering Jacob;
- income's open questions;
- a tool deciding what to build next, such as the scraper choosing new sites.

It follows the service contract (S0.1): one source, installed by setup, with ids and
tags on every record (§3 "Every record a service holds has an id and tags").

**What exists.** Research happens, but it has no fixed place or shape. There are
three precedents:
- `RESEARCH-gateway-docs.md` at the top level: every bullet cites the kb mirror, and
  `kb check --all` verifies each quote. This is the shape to keep;
- `income/RESEARCH-knowledge-tools.md`;
- `scriptingTools/context-hygiene/research/`, which holds jq probes and no prose.

S6.2 also found that the todo store has no kind for research. Plans mix research into
their own sections, so a finding and a decision sit in the same paragraph, and a
finding is never re-checked once the plan moves on.

**The rule.** A question of fact is asked once, answered once with evidence, and
cited by id wherever it is used. A consumer points at the answer and never restates it
(one source for each fact).

**R1. Its interface.** A `research` CLI is the only way in:
- `research ask "<question>" --tags ... [--kind desk|probe|measure] [--for <pointer>]`
  records a question with an id, `rs-<n>`. `--for` names the consumer, such as a plan
  section or a todo id.
- `research answer`, `research show <id>`, `research find <words or tags>` and
  `research stale`.
- An answered question is found before a new one is asked: `ask` lists close matches
  from `find` first. Duplicate research is the repetition this whole plan exists to
  remove.

**Plans are one consumer, not a requirement.** A plan that uses research lists its
questions by id under `## Research`, as `rs-<n> -- <question>`. A plan without research
has no such heading. `setup plans` checks two things:
- every id resolves;
- a Decisions row whose design rests on an `rs-` id cites one that is answered. A
  design cannot be put up for a yes on an open question.

**R2. The document's shape.** The answers are documents, one file per topic, named
`RESEARCH-<topic>.md`, beside a small index that maps `rs-` ids to file sections. Each
section has:
- one question;
- the answer;
- the evidence: a `url#anchor` the kb verifies, or a command and what it printed;
- the date;
- `verified` or `unverified`.

Research gathers and compares, and it never decides. It ends with the options and
what each one hinges on, which become the plan's Decisions rows. A claim with no
evidence is marked `unverified`, never stated as fact (the shared rule "a wrong answer
is worse than a failure").

**R3. Who does the research.** Each kind goes to whoever already has the tool for it:
- **desk research** (docs, terms, public APIs) to `research` itself, on the model
  PLAN-routing-tree.md §16 prefers (Jacob, 2026-10-19: "research-answers"), citing
  through `kb`; `deep-work` only for a question no research dispatch holds;
- **live probes** of a site to `site-scrapers`, headless, a few hundred bytes back,
  with a wall reported and never routed around;
- **measurements** to the tool that already counts the thing, such as `transcripts`,
  or `checks all`.

**R4. Research stays checked after the plan moves on.** `kb check` re-verifies every
cited quote. A research section older than its `recheck_after` date (default 90 days)
is listed by `doctor`, as stale plans are today.

**Decisions, Jacob 2026-10-12:**
- **R-1: yes,** with this caveat: "we may need to work more on this conceptually, if
  we need clarification, questions can always be added to the todo, this is a core
  tenant of the research phase, as not everything always needs to run in full.
  Planning and research should be a back and forth between me and you."
- **R-2: yes, `tools/research`.**
- **J-1: run now.** His words: "dont wait for service, this can be a longer project,
  but job sourcing is urgent."

**R6. Depth and dialogue (from R-1's caveat).**
- **A question runs only as deep as it needs.** Each question carries a depth, `quick`
  or `full`:
  - `quick` is a desk read or one probe, with the answer marked as `quick`;
  - `full` is every kind (R3), compared.

  A question starts `quick` and goes `full` only when its answer would decide
  something Jacob is asked to approve, or when Jacob asks for it.
- **Research is a conversation with Jacob, not a report to him.**
  - Every research document ends with three parts: options, then what it could not
    settle, then questions for Jacob.
  - Each question is one line, also listed in TODO.md "Questions for Jacob".
  - His answer is evidence too, cited as `Jacob, <date>: "<words>"`.
  - A question the research cannot answer is asked, never guessed (A6).
- **Answered, Jacob 2026-10-15** (TODO.md "Questions for Jacob", S7 questions 1-3):
  - **When a question gets an id: "yes"** to the rule that a question gets an `rs-`
    record when a decision rests on its answer or a second consumer needs it. Anything
    else is a plain lookup an agent does and moves on from.
  - **Who sets depth: "the asker w check".** Whoever opens a question sets `quick` or
    `full`, and Jacob can raise it. A check holds the rule: `setup plans` refuses a
    Decisions row whose design rests on an `rs-` id answered only at `quick`.
  - **Jacob's answers: "stored, but I dont think every answer should be a single
    documemt".** His answer is a record in the service, findable by `research find`
    and found by `ask` before he is asked again. It is attached to the question it
    answers, inside that question's topic document (R2, one file per topic). An answer
    is never a document of its own. The planner's reading of the second half, to be
    confirmed: Decisions row 5 of the 2026-10-15 reply.
- **S7 itself is still being worked out with Jacob.** Its open concepts are in TODO.md
  "Questions for Jacob", under S7. Steps 8.2-8.5 below build only what those answers
  settle. Until then, step 8.6 (job sourcing) uses the R2 document shape by hand.

**R5. Where it lives.** This was decision R-2: Jacob said yes to `tools/research` on 2026-10-12.
- **Recommended: a new `tools/research` repo, made by setup.** It holds the CLI, the
  index and the documents, and uses `kb` as a library: `kb cite` and `kb check` verify
  quotes, and `kb q` searches research beside the docs.

  A service of its own then has its own repo and checks, as S5.5's default allows once
  a service outgrows a verb on an existing tool. Every other service here started as
  verbs on `todo`, `checks` or `hooks`. Research does not fit any of them: none of the
  three holds documents, evidence or a recheck date.
- **The cheaper option: a `research/` folder in `knowledge-base`,** plus verbs on
  `kb`. It means no new repo, but it ties a general service to the docs mirror's
  owner.

**Gates for this section:**
- `research` CLI fixtures:
  - `ask` refuses a question with no tags;
  - `ask` lists an existing close match before recording;
  - `answer` refuses a section with no evidence line;
  - `stale` lists one planted old section.
- `setup plans` fixtures, one passing and one failing, for an unresolved `rs-` id and
  for a Decisions row resting on an open one.
- The `doctor` line has a test.
- An audit that no research document is written except through the CLI. That is
  "an accessor meant to be the only way in" from "Gate the seams".

**R7. Web research goes through research, enforced (Jacob, 2026-10-18).**
> "So obviously, we haven't implemented the tool call blocking hooks, you just did a
> web search whem we want to be seeing if our researcher can do that."

The evidence: on 2026-10-18 the planner answered "what is REA" with its own
WebSearch, in the planner window. Nothing recorded the question, nothing kept the
sources as an `rs-` record, and nothing stopped it. R1 says the CLI is the only way
in, and the research service has existed since commit 2aec69f, but that rule bound
only the documents, never the search that feeds them. That is the "intended, not
enforced" gap this workspace's rules exist to close.

- **The rule:** WebSearch and WebFetch are refused in the planner's and the
  dispatcher's main threads. The refusal names the route: record the question
  (`research ask`) through a dispatch, and `deep-work` answers it as desk research
  (R3).
- **Where it applies:** the main threads only. A subagent passes, so `deep-work`
  doing desk research still can. `prefer-recipes.sh` still applies to every session.
- **It fails open,** like every hook here, and has a test for each window that blocks,
  a subagent that passes, and malformed input that passes.
- **The cost it avoids:** the search result lands in the window that runs longest,
  and is paid for on every later turn.

**Approved: Jacob 2026-10-18, widened.** His words: "yes, this will ideally be part
of the "read only" guard as ALL tool calls should gated and routed". The read-only
guard is PLAN-routing-tree.md §13 (roles are read-only, and the server runs the
writes). So the web rule above is the first row of a general rule, not a hook of its
own:
- **Every tool call has a route,** declared as data: one table of tool (and target)
  → owner. Its first rows:
  - the web → research;
  - a covered host → `site-scrapers`, which `prefer-recipes.sh` already enforces;
  - a store write → its owner's CLI, which store-guard already enforces;
  - a write in a tool folder → that folder's agent, which `dispatch-guard.sh`
    already enforces.
- **One guard reads the table.** A call whose row says another owner is refused in
  that window, and the refusal names the route.
- **An unlisted call is allowed and logged as `unrouted`.** Blocking everything not
  yet listed would stop every session, and a hook that blocks everything is worse
  than the habit it corrects. The log shows which rows to add next. An audit prints
  the unrouted calls by tool and window, so the table grows from evidence.
- **The existing guards move into the table one at a time,** each only when its
  tests pass against the table. Until then each stays as it is. This is the
  Duplicates question (PLAN-architecture.md §6) applied to our own hooks.
- **When the hub serves the roles,** the table is what its server checks
  (routing-tree §13). It is one table either way, never two.

**R8. REA, the first test of research and the bench (Jacob, 2026-10-18).**
> "I'd like to incorporate the tool "reverse engineer everything" into our ecosystem,
> can we use this to test run our research agents and our sandbox? Have we met the
> criteria to do this?"

**The criteria are not met yet.** These are the gaps, with what closes each one:

| criterion | state on 2026-10-18 | closed by |
|---|---|---|
| the practices rows (§3 X1) | `PRACTICES-rows.md` written (tl-255), seam/behaviour marks not added | §4 step 9.1 |
| `checks practices` and `checks assess` (X2) | not built | §4 steps 7.2 and 9.2 |
| `./dev.sh assess` in the bench (X2) | not built; the bench runs `graphify` only | §4 step 9.3 |
| what the tool is, from a recorded source | not recorded. The planner's search (R7) is not evidence, so the first research question below re-asks it | step 9.6.1 |
| a way to run an MCP server in the sandbox | none. The bench runs a candidate's CLI verbs; REA is described as an MCP server that an agent drives, so its seam is the agent's tool calls, which the bench cannot see today | step 9.6.2 decides; X-2 governs wrap |

**What can run before the criteria are met, and what that tests:**
1. **Research, now (read-only).** `deep-work` records and answers the questions below
   through the `research` CLI, at depth `quick`. This is the research service's first
   real run, not a fixture. Its own finding counts as much as REA's:
   - can `research answer` hold a source kb does not mirror (a GitHub page)?
   - does `--unverified` read honestly in the rendered document?

   The questions:
   - what REA is: its official repository, its licence, its install path, and what it
     reads and writes;
   - whether it runs without the network after install;
   - whether a lookalike or malicious copy is reported, and how the official one is
     told apart (a commit hash the bench can pin);
   - which of its parts are a CLI the bench can run as it is, and which are MCP only;
   - what it would do on our repos, which hold JavaScript, Python and SQLite and no
     native binaries.
2. **The bench, after the research (step 9.6.2).** The research answers decide whether
   the bench can pin it by hash and run its CLI parts against a `git archive` of one of
   our repos, with no network. That run tests the sandbox with a candidate far larger
   than graphify.

   **Its scope is our own repos only, never a third-party site or app**
   ("never bypass bot detection"; a page is reached only through `site-scrapers`).
3. **The incorporation proposals (step 9.5)** for every gap found, once 9.3 exists.

### S2a. The funnel, as Jacob asked it (2026-10-12)

> "how is it that the bulky command output snuck past? Shouldn't this be controllable
> via hooks? Same with the check-stage-commit-push cycle? Can't we programatically
> determine when git commands are being written and block them, funneling them into
> deterministic outcomes?"
> "Is context-hygene done? why has nothing been dispatching for this?"

**Status: approved, Jacob 2026-10-12, item by item.**
- F1 comes under PLAN-architecture.md §11 S3.
- F2 is his answer "3) yes".
- F3 is his answer "2) yes".

This is the S2 funnel, which until now had been offered but not asked for.

**Why the output slipped through (found 2026-10-12, by reading, not inferred):**
- **context-hygiene was built on 2026-10-05, and it is still not wired.** Its digest
  hooks exist (`hooks/hook.sh spill` on Bash, `shrink` on Read, WebFetch and the named
  MCP tools), and its suite passes on synthetic input.
- **Its registrations do not go through the one wiring source.** `./hygiene wiring`
  prints 70 lines of settings for Jacob to paste by hand. `.claude/wiring.json` has
  none of them, so:
  - `agents.sh wiring --apply` printed "carries all 62 wiring requirements" while
    hygiene stayed unwired;
  - `doctor` never said so;
  - `.claude/settings.json` has 0 references to hygiene.

  `tools/usage` has the same shape (`usage registrations`). A guard that is built,
  reports no error and does not run: this is the state the root CLAUDE.md calls the
  worst.
- **Nothing was dispatched because nothing was dispatchable.**
  - Every open hygiene item waits on that wiring, a step that is Jacob's alone.
  - That step was never put to him as an action, so it sat in hygiene's own TODO.md.
  - The E items Jacob approved on 2026-10-08 were never put in a store (plan-step
    audit, 2026-10-12).

  `todo blockers` (PLAN-todo-tool.md §10.2) is the cure: it would have listed "Jacob
  wires hygiene" as the root that frees every item.
- **Commits:** no hook looks at git at all. 262 of 359 sessions typed the cycle by
  hand, and `git add -A` was typed 35 times against the rules
  (RESEARCH-workspace-audit.md T4).

**F1. One wiring source.** A tool that needs settings declares them in a
`registrations.json` that `setup` reads. `wiring.json` takes every declared
registration, so `wiring --apply` carries them and `doctor` names any that are
missing. A `checks` row fails when a tool's declaration and `wiring.json` disagree,
in either direction.

**F2. Bulky output is funnelled before it lands.** hygiene's `spill`
(PreToolUse `updatedInput`) rewrites a Bash command so that it:
1. writes the full output to the `ctx:` store;
2. returns a digest of at most 2,000 characters plus the id;
3. keeps the exit code.

A rewrite is the only route for a failed command (PLAN-context-hygiene.md §2).
`shrink` covers Read, WebFetch and the MCP tools. Once these hooks run, a trailing
`| head`/`| tail`/`| grep` on a runner the digest covers is unnecessary, and the hook
may refuse it, naming `hygiene get <id>`. That refusal waits until the spill re-read
rate is measured below 30% (§4 C4 "Measure").

**F3. Git is funnelled.** Two layers, because a Claude Code hook alone only sees
commands typed into the Bash tool:
1. **A PreToolUse hook on Bash** (`git-funnel.sh`, source in `tools/hooks/source/`).
   - It parses each command segment with the same splitter as `no-inline-blobs.sh`.
   - It denies `git add`, `git commit`, `git push`, `git reset --hard`,
     `git checkout -- …`, `git stash` and `git rebase`, and the denial names the verb
     to use.
   - Read-only git (`status`, `log`, `diff`, `show`, `rev-parse`) passes.
   - It fails open.
2. **Git's own `pre-commit` and `pre-push` hooks, installed by `setup`.** They refuse
   unless the variable the verb sets is present, so a script, a `bash -c`, or an alias
   cannot get round them. They enforce only when `CLAUDECODE` is set, so Jacob's own
   terminal is unaffected. Whether Claude Code sets `CLAUDECODE` in Bash, and whether
   Jacob's `!` commands carry it, is **unverified (probe G1)**.

**The verb:** `commit "<message>" <paths…>` (one source in `tools/hooks`, installed
per repo like the shared hooks). Each step is deterministic, in this order:
1. refuse a path outside the repo, and `-A` or `.`;
2. run that repo's `./dev.sh check`, and stop on failure, printing its digest;
3. stage only the named paths;
4. commit with the message, appending the attribution line;
5. push only if `origin` exists and the repo's `setup` record says push. The `.claude`
   repo, usage and checks say no today;
6. print one line: the hash, the files, and pushed or not.

`commit --status` replaces the hand-typed `git status` and `git log -1`: one line per
changed path, plus whose session last committed. Every outcome is one of a fixed set
(`committed`, `check-failed`, `nothing-staged`, `push-refused`, `push-failed`), never
free text. Exits are data in `vocab.json`, never typed again.

**Gates:**
- each denied git verb is refused by the hook and passes through `commit` (fixtures);
- a read-only git verb passes;
- malformed hook input fails open (exit 0);
- a direct `git commit` with `CLAUDECODE=1` and no token is refused by the git hook;
- without `CLAUDECODE` it passes;
- `commit` with a failing check commits nothing;
- `commit` in a no-push repo never pushes;
- `checks` audits that every repo has the git hooks installed and the verb on its
  `dev.sh`;
- F1's agreement row.

**Order:**
1. F1 (`harness` and `setup`); then Jacob's one `wiring --apply`, which wires hygiene.
2. Probe G1 (`hooks`).
3. F3: `hooks` writes the hook and the verb, and `setup` installs them in every repo,
   one owner at a time.
4. F2's pipe refusal, after the re-read measurement.

### S8. The docs service: one vocabulary, and where a question about a doc lands (Jacob, 2026-10-13)

> "I think we should also have a docs service. This will include making sure that our
> other services and applications have a unified vocabulary and also that when other
> services or agents request clarification on documentation, the knowledge base has a
> service to fall through to."

**Two duties, and what already exists for each.**

1. **One vocabulary across every service and application.** S3 already owns the
   *tag* vocabulary (the namespaces and values above, with the architecture agent as
   the fallback for a new namespace). What nobody owns is the *words*: thirteen
   CLAUDE.md files, nineteen `--help` outputs and 36 plans each name the same things,
   and nothing holds "store", "verb", "gate", "check", "audit", "item", "report",
   "recipe", "working", "blocked" to one meaning. The docs service holds the
   **glossary**: one record per term with its definition, its owner (the repo whose
   doc defines it), its aliases, and, for a term that names a tag namespace, a pointer
   to S3's entry rather than a second definition. S3 keeps the tags, S8 keeps the
   words, and each cites the other, so there is one source for each.
2. **Fall-through for a question about documentation.** `kb` is the first answerer:
   Claude's docs and, since 2026-10-13 (`040cef4`), our own repos' docs (§11 of
   PLAN-knowledge-base.md). When a service or an agent asks what a doc means and `kb`
   has no section for it, the question does not end in a shell read of the file, a
   guess, or a question to Jacob. It falls through to the docs service, which answers
   from the glossary or **files the gap**: a `docs-gap` item in the store of the repo
   whose doc should have answered, naming the question and the doc. An agent is the
   fallback after that, as the architecture rule says, never the first stop.

**The verbs** (a `cli.json`, every read verb with `--json`, PLAN-architecture.md §12):
- `docs term add|edit|alias <term>`: the only writer of the glossary, a read-only
  store behind the CLI (§3 "Every data store is gated and read-only").
- `docs terms [--repo R] [--json]`: the glossary, or the terms a repo's docs use.
- `docs terms --check [--repo R]`: every term used in a repo's `CLAUDE.md` first
  section, `README.md` and `--help` is either in the glossary with that meaning, an
  alias (reported, with the term to use), or declared local by the repo. Unknown
  words are not failures; a glossary term used as an alias of another is.
- `docs ask "<question>" [--repo R] --json`: the fall-through. One fixed outcome set:
  `answered:kb <url#anchor>`, `answered:glossary <term>`, `gap:filed <todo:id>`. The
  same question gives the same outcome; `checks repro` covers it.

**Gates, in the same change:**
- the glossary is a store: in `cli.json`, 0444, covered by `store-guard.sh`;
- `terms-in-sync`, a generic check in `tools/checks`: `docs terms --check` per repo,
  with a passing fixture and a failing one (a doc using an alias);
- `docs ask` has a counterfactual test: a question `kb` answers never files a gap,
  the same question with the section removed from the fixture mirror files exactly
  one, and asking twice files one, not two;
- a `docs-gap` item closes only when `docs ask` with the same question answers
  (`done` refuses otherwise, as PLAN-todo-tool.md §10.5's detectors do).

**Phases, each a dispatch:**
1. The glossary store and `docs term|terms`, seeded from the terms the shared-rules
   block and this plan's §3 already define; `--check` on `knowledge-base` first.
2. `docs ask` with `kb q --repo` as its first call and `todo add --kind docs-gap` in
   the owner's store (`docs-gap` joins todo's kinds, a `todo report`).
3. `setup`: a docs component so each repo declares its local terms; `checks` adds
   `terms-in-sync` to the grid.
4. The hub route (`docs-request`, after H2): an agent's question goes to `docs ask`
   first and to an agent only on `gap`.

**Decisions:** DS-1 to DS-3, asked in the planner's reply of 2026-10-13.
track: TODO.md "Docs service: one vocabulary, fall-through for doc questions"

### S9. The testing service: every test findable, with its reason (Jacob, 2026-10-13)

Asked about `dev.sh test <name>` in seven repos (PLAN-workspace-audit.md §3.2 option 5):
> "we shouldn't be putting things in one by one at all, if that's what this is
> implying. Unit-tests should be able to be pulled and looked at for why they are
> there, if a testing/checking service/agent doesn't exist, this is maybe indication
> that we should make one."

**What exists.** `tools/checks` runs the seven generic gates per repo and as one grid
(`checks run`, `checks all`); each repo's `dev.sh check` runs its own suite; the
assurance ledger (PLAN-architecture.md §6a, store approved 2026-10-12) will record what
each check proves and when it last passed. Nothing lists the **tests**: 537 unittest
commands were typed by hand across 114 sessions because the only way to run one test
was to know its file and class.

**The service.** Tests are data, declared once per repo in `tests.json` (a setup
component writes the skeleton; the repo's suite fills it, or the service derives it
from the runner's own listing where the runner can list). One record per test:
`id`, `runs` (the exact command), `proves` (one sentence), `rule` (the CLAUDE.md rule,
plan section or `chk:` id it exists for), `owner` (the repo). The verbs, on
`tools/checks` first (X4's pattern: a verb before a repo):
- `checks tests [--repo R] [--json]`: every declared test, with its reason;
- `checks test <id>`: runs one test anywhere in the workspace, by id, never by file;
- `checks tests --why <id>`: the record, the rule it points at, and the last run;
- `checks tests --orphans`: tests with no `rule`, and rules with no test, both ways.

**Gates, in the same change:**
- `tests.json` is a store (`cli.json`, 0444, `store-guard.sh`);
- a declared `runs` that does not exist fails `checks tests` by name, never silently;
- the two-way check: every test in a repo's suite is declared, every declared test
  exists (the documented == implemented rule, applied to tests);
- a planted test with no `rule` appears in `--orphans`, and gets one when the record
  is fixed.

**With the ledger.** Each `chk:` row in §6a's ledger points at the tests that earn it,
so "what does this check prove" and "which tests prove it" are one `--why`. The ledger
is the ledger; this is its index of tests. Whether that is one service or two is
decision TS-1.

**Decisions:** TS-1 (own service on `tools/checks` now, or folded into the §6a ledger
build), asked in the planner's reply of 2026-10-13.
track: TODO.md "Testing service: every test findable, with its reason"

## 4. Steps

Each step is read-only or additive unless marked otherwise.

1. **The repetition counter (S0.5).** A `transcripts repeats` subcommand in
   tools/transcripts, the one reader of transcripts. Per session (main and subagent),
   it counts:
   - the tool calls by name;
   - the Bash commands by shape: the first two words with paths stripped, so
     `./dev.sh check` and `tools/todo/todo -C x list` each count as one shape;
   - recurring commit-subject shapes.

   It prints shape → sessions it appeared in → mean per session. It has `--since` and
   `--json`, and a fixture test that proves a planted repeat is counted and a one-off
   is not. Owner: `transcripts`. Done when one run's table is pasted into §2 as the
   S0.5 answer.
2. **S0.4 inventory.** The planner reads `tools/checks` (7 checks) and
   `tools/hooks/source`, then writes the table: check or hook → what it holds → which
   service it belongs to. A question either owner must answer goes through the
   dispatcher as a report.
3. **The remaining L rows**, in the order §2 gives, each answer appended to §2 with
   its command.
4. **The design sections of this plan**, written from the answers: the service
   contract (S0.1), the planning service's checks (S1.2), the funnel (S2), the
   architecture checks (S3). Each is offered to Jacob as one Decisions row before
   anything is built.
5. **Income's §2a bug** goes to its owner: `cmd_hooks` in `income/dev.sh` counts a
   test's exit 3 (UNCHECKED) as FAIL. Unconfirmed locally; the probe is `./dev.sh
   hooks; echo $?` in a clone with no site-scrapers above it.
6. **Plan-step guardrails (§3 "Plan steps are always tracked", G1-G6; approved: Jacob
   2026-10-12),** in this order:
   1. `setup`: G1's grammar, and `setup plans steps <file> --json`, the one parser
      G6's sync reads. Then `--steps` (G5), and the reverse check as a report, all
      with fixtures. G2 is not a failing gate (§3 G6, G2-1): `check` lists
      unplaceable steps and never fails on them. Step 6.4's hook refuses them at
      write time.
      track: TODO.md "Plans generate their todo items"
   2. The planner: works through the 2026-10-12 audit of all plans. Untracked steps get
      items, and unsure ones get `superseded-by` or `needs-yes`. The ratchet baseline
      is then what remains. track: TODO.md "Plans generate their todo items"
   3. `todo`: a `plan-step` kind, a lookup by citation (`todo list --cites "PLAN-x.md §n"`),
      and `todo sync-plans` (G6: add, update mechanical fields, list `stale` and
      `gone`, match by text hash, fail open), with a passing and a failing fixture for
      each case. track: TODO.md "Plans generate their todo items"
   4. `harness`: G3's Stop hook, G4's `auto-relay.sh` refusal and the ledger check.
      Also G2-1's write-time refusal: a PreToolUse hook on Edit and Write of
      `PLAN-*.md` (§3 G6, G2-1), after 6.1. Its tests cover an edit that adds an
      unplaceable step (refused), an edit near an old one (allowed) and a missing
      parser (allowed, with a notice). The hooks need wiring, which is Jacob's step.
      track: TODO.md "Plans generate their todo items"
7. **Practices are adhered to (§3, 2026-10-12; approved: Jacob 2026-10-12, A-1 and A-2),**
   in this order:
   1. **The planner** writes every practice as a row: the CLAUDE.md principles, the five
      architecture rules, ids and tags, the store rules, and the S3.1 code-writing
      rules once they are written. Each row is gate, prose or unbuilt. A prose row says
      what a `justified` explanation must show (A6). The planner hands the rows to
      `checks` as data, in `PRACTICES-rows.md` at the top level. track: TODO.md "Practices adhered to"
   2. **`checks`:** the rows go into `gates.json` (A1), plus `checks practices` with its
      four cell states and the ratchet baseline (A2). track: TODO.md "Practices adhered to"
   3. **`setup`:** the `## Practices` heading in `setup plans`, and the approved-decision
      rule (A3). track: TODO.md "Practices adhered to"
   4. **`todo` and `harness`:** prose ids in `todo brief`, the `practices:` report line
      with its explanation, and its flag in `dispatches`. Then the ratchet goes into
      `agents.sh check` and `doctor` (A2, A3). track: TODO.md "Practices adhered to"
   5. **Each repo's owner, one job each:** classify the CLAUDE.md rules that
      `rules-gated` finds unclassified. On 2026-10-09 that was 8 repos. This can share
      the job with that repo's queue Q7. track: TODO.md "Practices adhered to"
   6. **The plan review (A4),** per finished plan. track: TODO.md "Practices adhered to"
8. **The research service, S7 (§3, 2026-10-12; approved: Jacob 2026-10-12, R-1 and R-2),**
   in this order. Steps 2-5 build only what TODO.md "Questions for Jacob" has settled
   (R6):
   1. **The repo:** `tools/research`, made by `setup`. track: TODO.md "Research service (S7)"
   2. **Its owner** builds the `research` CLI (R1), the R2 shape check, the R4
      recheck, the R6 depth field, the bypass audit and all their fixtures, using `kb`
      for citations. A new roster agent comes from the harness manifest (the roster's
      own step). track: TODO.md "Research service (S7)"
   3. **`todo`:** a `research` kind whose items point at `rs-` ids, closing S6.2.
      track: TODO.md "Research service (S7)"
   4. **`setup`:** the `## Research` id rules in `setup plans` (R1), and the service
      installed in the repos that ask for it. track: TODO.md "Research service (S7)"
   5. **`harness`:** the `doctor` line for stale research (R4), and the R3 routing in
      dispatch briefs. track: TODO.md "Research service (S7)"
   6. **The first consumer:** PLAN-job-sourcing.md §6, expanding the scraper. It does
      not wait for steps 1-5 (J-1, Jacob 2026-10-12: "job sourcing is urgent"). Its
      document is written to the R2 shape by hand now and imported into the service
      when the service exists. track: TODO.md "Job sourcing research"
9. **External tools held to the same practices (§3, 2026-10-12; 9.1-9.3 and 9.5
   approved: Jacob 2026-10-18, dt-1 row 4),** after step 7.2, because it needs the
   registry and `checks practices`:
   1. **The planner:** `PRACTICES-rows.md` marks the rows that apply to `seam` and to
      `behaviour` (X1). This is part of step 7.1.
      track: TODO.md "Outside tools assessed"
   2. **`checks`:** `checks assess <path> --subject repo|candidate`, with the four
      states and fixtures for both subjects (X2).
      track: TODO.md "Outside tools assessed"
   3. **`addon-bench`:** `./dev.sh assess <c>` inside the sandbox; the §5 ladder cites
      registry ids; the bypass audit on the wrapper; the gates above. graphify is the
      first subject, because it is already installed.
      track: TODO.md "Outside tools assessed"
   4. **`addon-bench`:** the `wrap` path (X3), only if decision X-2 says yes.
      track: needs-yes PLAN-services.md §3
   5. **A candidate that falls short gets proposals, not only a verdict** (Jacob,
      2026-10-18: "When outside tools DON'T meet our criteria, I would like proposals
      for how to encorporate them into our ecosystem"). For each gap in 9.3's
      assessment, research writes a proposal; `deep-work` writes it until the research
      service exists. Each proposal is in the R2 shape and names:
      - the gap;
      - the rungs that could close it: a probe that gates the cell; a wrapper rule;
        running it only inside a pipe stage whose output is checked (PLAN-job-sourcing.md
        §2); extracting the useful part in our form (X3 extract); wrap, if X-2 allows;
        or not adopting it;
      - each rung's cost in tokens and in build work, and its recommendation.

      The planner turns each proposal into a Decisions row; nothing is adopted without
      Jacob's yes. Tests: none of its own; the proposal is checked by R2's shape check.
      track: TODO.md "Outside tools assessed"
   6. **REA as the first test (§3 S7 R8),** in this order:
      1. **`research`:** records R8's questions as `rs-` ids at depth `quick`, under
         topic `rea`. Then `deep-work` answers them as desk research through the
         CLI. Each answer carries its source, and `--unverified` where kb cannot judge
         it. The report names what the service could not hold. Desk research only:
         nothing is downloaded or installed (approved: Jacob 2026-10-18, "Yes run
         research, but no need to install").
         track: TODO.md "Outside tools assessed"
      2. **`addon-bench`:** if 9.6.1 finds an official repository the bench can pin by
         hash, and CLI parts that run offline: REA as candidate 2, installed offline,
         run only through `./dev.sh run` against a `git archive` of one of our repos.
         Its MCP parts stay out until X-2 is answered. Held: Jacob said yes to this
         step ("ye") and also "no need to install" for 9.6.1, so it is asked again
         with 9.6.1's report in hand. track: needs-yes PLAN-services.md §3
   7. **`harness`:** R7's route table and the one guard that reads it, with the web
      row live and the other rows listed but enforced by their existing hooks; the
      `unrouted` log and its audit; tests for a refused call in each main window, a
      subagent that passes, an unlisted call that passes and is logged, and
      malformed input that passes; the `wiring.json` entry. Jacob applies the
      settings change himself (approved: Jacob 2026-10-18).
      track: TODO.md "Every tool call routed"
   8. **Scraping frameworks (Jacob, 2026-10-19: "I'd love to do research and planning
      into how to use as much popular scraping frameworks that already exist in our
      system as possible").** Approved: Jacob 2026-10-19, desk research and planning;
      nothing installed. The order is 9.6.1's: `research` records the questions (kind
      desk, depth full), the answering agent answers them through the research CLI
      (R3, or §16 of PLAN-routing-tree.md once it lands), the planner brings the
      proposals to Jacob, and a candidate he picks goes through the bench (9.4's
      shape) with his yes.

      The questions:
      - which scraping libraries our repos already use, and how: `site-scrapers`
        (Puppeteer) and `scripts` (Python), read from their package and requirement
        files and imports, as `--ran` evidence;
      - which frameworks are popular by a measurable at a dated check (GitHub stars,
        npm or PyPI weekly downloads, last release): at least Scrapy, Crawlee,
        Playwright, Puppeteer, Selenium, BeautifulSoup with lxml, cheerio, jsdom,
        Firecrawl, the Apify SDK, Colly, Stagehand, Browser Use and ScrapeGraphAI;
        the research adds or drops a name with its reason;
      - for each: what it would add against site-scrapers' recorded failure classes
        (`node failures.js`, counts by class, supplied by `site-scrapers` as a `--ran`
        record), such as retries, waits, pagination, structured extraction, change
        detection; and what it would replace;
      - the seam: how a recipe would name an engine (a per-recipe `engine` field, a
        pipe stage of PLAN-job-sourcing.md §3, or a sidecar process in the framework's
        own language), keeping recipes as data ("the unique thing is the data") and
        the result shape small, so the page never enters a context;
      - each candidate against 9.1-9.3's criteria: licence, offline run, a pin by
        hash, a capped output; bench-ready or not, and why;
      - what each returns to the model per run, in bytes, since output size is the
        cost here (CLAUDE.md "Wall clock is not a cost").

      Out of scope, so the research does not propose it: stealth plugins, proxy
      rotation, CAPTCHA solving, fingerprint spoofing. "Never attempt to bypass bot
      detection" is a constraint that does not bend; a framework whose main value is
      evasion is declined at 9.5's last rung.

      Output: `RESEARCH-scraping-frameworks.md` in the research CLI's shape, one
      proposal per candidate on 9.5's rungs, and a Decisions table for Jacob. The
      planner turns the chosen ones into PLAN-job-sourcing.md steps.
      track: TODO.md "Scraping frameworks assessed"
10. **Static and dynamic stores (§3 "Every store is static or dynamic"; approved: Jacob
    2026-10-18, "1) yes 2)sqlite 3) now"),** in this order, except that 10.3's report
    needs nothing before it and runs alongside 10.1:
   1. **`todo`:** moves to SQLite now (PLAN-todo-tool.md §10.6). Its store module has
      nothing todo-specific in it, because it becomes the Python helper (ST6).
      track: TODO.md "Static and dynamic stores"
   2. **`setup`:** lifts todo's module into templates as the Python helper, and writes
      the Node helper from site-scrapers' and data-bridge's open code. A `store`
      component installs both as copies, with a drift check. Fixtures cover: WAL and
      foreign keys on, a migration by `user_version`, a rollback on error, and a
      deterministic export. track: TODO.md "Static and dynamic stores"
   3. **`checks`:** `stores-classified` (ST5), with the `kind` field in `cli.json`'s
      schema. It runs first as a report over the workspace: every store-shaped file,
      with its kind or none. track: TODO.md "Static and dynamic stores"
   4. **The planner:** turns that report into one item per store still in JSON or TSV,
      each in its owner's store. track: TODO.md "Static and dynamic stores"
   5. **`research`:** builds its store on the Python helper, as part of step 8.2. The
      rest of 8.2 does not wait for it. track: TODO.md "Research service (S7)"

## 5. Risks

- **The questions stall, as the Todoist list did.** The L rows are answered by the
  planner in the order given. The J rows reach Jacob at most two per reply.
- **A service duplicates a check that already exists.** S0.4 runs before any design.
- **The counter counts noise.** A shape that recurs because a hook blocked it and the
  command was retried is a repeat of the block, not of the process. Step 1's fixture
  includes a blocked-and-retried call, so the counter's output can say so.

## 6. Setup component

None yet. A service that becomes its own repo is made through `tools/setup` per
PLAN-repo-setup.md, as a step added here when S5.5 decides it. The default is verbs
on `todo`, `checks` and `hooks` before any new repo.

## Decisions

Approved 2026-10-08: the top level as this plan's home ("1) sounds good. top level").
Open decisions are asked in the planner's replies, not stored here.
