# Agent groups per repo: plan

> **Status: plan only.** Phase 0 gates it on Jacob's condition (2026-10-02): build it
> only "if the audit has shown that the changes that we've implemented reduce token
> usage overall".
>
> **Who builds what:**
> - `harness`: the `.claude/` parts (schema, composer, report formatter, hooks).
> - Each folder's own agent: tagging its own CLAUDE.md, and adding `--json` to its own
>   `dev.sh check`.
>
> **Related plans:**
> - The **trim experiment** (TODO.md) is folded into Phase 2 here: a role's tool
>   allowlist *is* the trim.
> - PLAN-context-hygiene.md overlaps with this plan; §7 says where.

## 1. Goal

Each tool repo gets a **group** of agents instead of one. Each member is a silo for one
kind of work in that folder: code, tests, audits, or docs (README, CLAUDE.md, TODO.md).
A silo loads only the rules, tools and context its kind of task uses. That saves input
and output tokens that don't feed the task.

The group also cuts dispatcher error. Routing becomes a lookup (folder, then role), and
the tests and audits tell the dispatcher which silo should act. The dispatcher doesn't
have to judge it.

## 2. Phase 0: facts from the docs, then instruments

Rewritten 2026-10-02 with Jacob. Documented behaviour is answered from the docs, with
the link kept beside the claim, and probes are only for what the docs leave open.

**Answered by documentation (read 2026-10-02):**
- **The cache matches an exact prefix, layered in this order:**
  1. the system prompt (core instructions and tool definitions);
  2. project context (CLAUDE.md, auto memory, unscoped rules);
  3. the conversation.

  A change anywhere recomputes everything after it. There's no per-file caching.
  ([CC: how the cache is organized](https://code.claude.com/docs/en/prompt-caching#how-the-cache-is-organized))
- **Every token in the prefix costs the same,** whichever layer it's in. A cache write
  costs 1.25× base input (5-minute TTL) or 2× (1-hour TTL). A read costs 0.1×, or
  **0.05× on Opus 5.5**: $0.20/MTok, the same price as a Sonnet 5.5 read. So a
  CLAUDE.md token saved is worth exactly a system-prompt token saved. On cold Opus
  agents, the prefix's cost is mostly the one 1.25× write, not the reads.
  ([API: pricing](https://platform.claude.com/docs/en/build-with-claude/prompt-caching#pricing))
- **Subagents start cold, for practical purposes:**
  - a subagent never reads its parent's cache;
  - two runs share a cache only when the prefix is identical: same system prompt and
    tools, directory, and git-status snapshot;
  - subagents get a 5-minute TTL even on a subscription.

  ([CC: subagents and the cache](https://code.claude.com/docs/en/prompt-caching#subagents-and-the-cache),
  [cache scope](https://code.claude.com/docs/en/prompt-caching#cache-scope),
  [which TTL each request gets](https://code.claude.com/docs/en/prompt-caching#which-ttl-each-request-gets))
- **What follows from that:**
  - Agents dispatched minutes or days apart, with commits landing in between, almost
    always start cold. The audit agrees: site-scrapers' cache writes over a whole run
    (30.6k) ≈ its first request (29.4k).
  - So more agent types lose no cache hits that exist today.
  - A smaller prefix saves on every request of a run, starting with the first.
- **The main windows' TTL depends on billing.** They get 1 hour on a subscription within
  plan usage, and 5 minutes once usage credits are drawn. A 5-minute gap between prompts
  re-writes the whole window.

**Left open by the docs:**
- **Does a `tools` allowlist shrink the prefix?** The docs say that while tool search is
  active, denying a tool leaves the tool definitions unchanged
  ([denying an entire tool](https://code.claude.com/docs/en/prompt-caching#denying-an-entire-tool)).
  An agent's allowlist may behave the same way, which would make the trim experiment a
  no-op on size.
  - *Probe:* compare `start` for an allowlisted agent against an unrestricted one.
  - *First clue:* email-tools started at 17.0k against 29k (n=1). Find out why.
- **How big each layer is.** `/context` in a main window gives the split
  <https://code.claude.com/docs/en/debug-your-config#see-what-loaded-into-context> "shows everything occupying the context window for the current session, broken down by category". For
  agents, the audit's `start` per agent type gives it.

**Instruments, built alongside rather than instead of** (Jacob, 2026-10-02):
- **A `harness` task, extending `agents.sh tokens`:**
  - the first request split into cache write vs cache read;
  - **history share per run:** cache reads beyond `requests × start`;
  - weighted per-prompt totals that count **planner and dispatcher together**.
  - The price table is dated data in the manifest, with its pricing-page link. It
    reuses `.claude/lib/tokens.jq`.
- **History share is studied as the plans that attack it get built:** context-hygiene
  C2 and C3, §4.3 export/reload here, and `maxTurns` per role.
  - Each ships with a before/after reading from these columns.
  - Each reading goes in TODO.md with its sample size.
  - The tests are the instrument; nothing waits a week for them.

**Jacob's original gate** (only build if v2 shows it reduces usage overall) is decision
1 in §6. Trimming the prefix no longer depends on it, because the docs show trimming
saves on every request.

**The old Phase 0 metric**, kept for that gate: weighted tokens per human prompt.
Pre-v2 Opus sessions give the "before" side: `a0f9528a` re-read 453.9M cached tokens
over 1,024 requests.
- Weight each token type by its price relative to input: cache read about 0.1, cache
  write about 1.25 (5-minute cache) or 2 (1-hour cache), output 5.
- Weight each model by its price.
- Compare per prompt, not per session, because sessions differ in length.
- State the sample size with every number.

**What Phase 0 needs:**
1. **A week of normal work through the dispatcher window** (`./.claude/agents.sh pair`).
2. **A harness task:** extend `./.claude/agents.sh tokens` with per-prompt and weighted
   columns.
   - The price table is dated data in the manifest, verified from the pricing page, not
     from memory.
   - It reuses `.claude/lib/tokens.jq`, the one transcript reader.
3. **The comparison** against the pre-v2 Opus-main sessions (`a0f9528a`, `dddbc1b4`,
   `e1b65f20`).

**Proceed only if:**
- dispatcher sessions cost at least X% less per prompt (Jacob sets X; 30% is suggested);
- quality didn't drop: count the tasks that needed a second dispatch to come out right.

## 3. Why groups could save tokens, and how they could cost more

**Where the saving comes from:**
- **Smaller starting context.** A folder agent pays about 29k tokens before any work
  (baseline in TODO.md). Two things drive that:
  - every agent loads every tool name, skill listing and MCP server's instructions
    (about 30K characters by the context-hygiene plan's measurement);
  - it loads its folder's whole CLAUDE.md (8-19 KB).

  A docs silo needs neither Chrome nor the scraping rules.
- **Smaller working context.** A tests silo reads tests, not the whole repo.
- **Fewer misroutes.**

**Where it could cost more** (corrected 2026-10-02; this said "every silo pays its own
cold start", which overstated it):
- **The starting context isn't a one-time fee.** It rides on every request, written once
  when cold (1.25×) and read after that (0.1×). Splitting a task across two agents sends
  it about as many times as one agent doing both halves.
- **The real extra costs of a split:**
  - one more cache write per extra agent: about 33k input-price tokens on a 29k prefix;
  - rediscovery, when the second agent re-reads files the first already read;
  - a brief and a report added to the dispatcher's history.
- **The real saving of a split:** history doesn't carry over. One agent doing two tasks
  re-reads all of the first task on every request of the second. In a median `harness`
  run (71 requests, 9.4M cache reads), the 40k prefix accounts for about 2.8M. History
  is the other ~70%.
- **Worked example, at Opus 5.5 prices** (reads 0.05×; recomputed 2026-10-02, after an
  earlier version used 0.1×): 20 requests, each adding 3k of history.
  - Splitting saves 300k of history reads, about 15k input-price tokens.
  - The extra write costs about 35k.
  - **Net: the split costs ~20k more.**

  Splitting pays only when the history it avoids is above roughly 700k tokens of reads
  per extra agent: long tasks, or a silo prefix well below 29k. Short single-role tasks
  favour one agent. The audit's history-share column (Phase 0) decides it per task kind.
- Because most dispatches start cold anyway (§2), more agent types lose no cache hits.
  The folder agent stays as the owner and the fallback for tasks that span roles.
- Measure **per task** (every dispatch for one request), never per agent.

## 4. Design

### 4.1 Groups in the manifest
- **A `roles` block** gives each role its defaults: routes, a tools allowlist or
  disallowedTools, maxTurns, which CLAUDE.md sections it gets, and its report view
  (§4.4). Starting roles: `code`, `tests`, `audit`, `docs`.
- **Each agent entry gains a `role`**, which defaults to `code`. A group is the entries
  that share a `dir`; members are named `<group>-<role>`, e.g. `site-scrapers-tests`.
- **One owner per path stays true.** resolve-owner names the group's `code` agent when
  the guard blocks. Routes pick the silo by task kind.
- **Trimming uses `disallowedTools` or a `tools` allowlist.** The `mcpServers` and
  `skills` fields only add things, never remove them (raw docs, TODO.md).
- **Gates:**
  - each dir has exactly one `code` role;
  - each (dir, route) pair is unique;
  - every role an agent names exists;
  - a role's tools include what its precommit needs.

### 4.2 Rules per role: filtering CLAUDE.md
- **Tag the sections of each folder's CLAUDE.md with roles,** using an HTML comment
  under the heading, e.g. `<!-- roles: code tests -->`. Claude Code strips block-level
  HTML comments before injection, so tags cost no tokens. An untagged section goes to
  every role, which is the safe default.
- **Every silo sets `omitClaudeMd`.** `gen` composes each silo's prompt from three
  parts: the template, the sections tagged for its role, and "Constraints that don't
  bend" (always included).
- **Gates:**
  - a role that receives zero sections fails;
  - an unknown role tag fails;
  - a prompt that no longer matches its sources is stale. That is the existing pattern.
- **Measured by** each silo's starting context (`tokens --agents`) against the folder
  agent's 29k.

### 4.3 Context per task: export, clear, reload
- **Silos are one-task subagents.** They start empty and end after the task, so there's
  nothing to clear between tasks. `maxTurns` per role caps growth within one.
- **The two long-lived windows (dispatcher, planner) are where context piles up.** Hooks
  can't run `/clear` or `/compact` (hooks docs, checked 2026-10-01). What they can do:
  1. **Export.** A `handoff` subcommand writes that window's bounded state file: goal,
     decisions, open items, files in play, at most 2,000 chars. It runs when Jacob asks,
     or when the context monitor (context-hygiene C2) says it's time.
  2. **Clear.** Jacob types `/clear`, or `autoCompactWindow` compacts at 200K.
  3. **Reload.** A SessionStart hook with matcher `clear` (and `compact`) injects that
     window's state file. The dispatcher gets routing state; the planner gets design state.
- **Probes:**
  - SessionStart(`clear`) additionalContext arrives after `/clear`;
  - the state file never exceeds its cap;
  - a window that has been through `/clear` keeps its hooks.

### 4.4 Test and audit reports per role
- **Each repo's `dev.sh check --json`** reports, for each check (suite, audit, hooks,
  tree): its status, counts, failures with file:line, and the role each failure belongs
  to. A failing test belongs to tests or code; a stale README table to docs.
- **One formatter, `.claude/lib/report.jq`,** renders a view per consumer. It's one
  reader, like `tokens.jq`.
- **The schema's one source is `tools/checks/schema/check-json.schema.json`** (checks,
  2026-10-05, e9e001d), and this section's prose defers to it. Confirmed by the planner
  2026-10-05: top level `ok` and `checks[]`; each check has `name`, `status` (`ok`,
  `fail`, `unchecked`, `error`), `counts.failed` and `failures[]` with `message`, `file`,
  `line`, `role`; link rules include exit 0 only when `ok`, and `counts.failed` equal to
  the length of `failures`. The second gate here, each `role` naming a role that exists,
  waits on the node registry (PLAN-routing-tree.md §14.8 `services.json`), since checks
  reads no roster. `check-json` runs in audit runs only (`checks all --roles audit`,
  `checks one check-json <repo>`), never inside a pre-commit run, because it runs the
  repo's whole suite: sequential, as Jacob asked. Its per-repo limit (280 s, todo's suite
  took 240 s) should be raised, wall clock is not a cost. Status 2026-10-05: conforms
  tools/checks; shape FAIL tools/hooks, tools/hub, tools/todo (they print
  `{"ok","gates"}`); setup's stub unverified; nine repos UNCHECKED (no `--json`).

  | consumer | sees |
  |---|---|
  | dispatcher | one line: the verdict, and which silo should act (e.g. `site-scrapers-tests: 2 failing in test/x.test.js`) |
  | code | the failing assertions with file:line, nothing else |
  | tests | which tests fail, and changed files with no test |
  | audit | findings, and the trend since the last run |
  | docs | mismatches between what's documented and what's implemented |

  That first row is the dispatcher-error fix: the check names the silo, and the
  dispatcher relays rather than judges.
- **Delivery.** A silo's precommit pipes the check through its own view, so its output
  stays bounded. Automatic delivery by replacing tool output is documented: a
  PostToolUse hook's `updatedToolOutput` replaces any tool's result, and that answers
  P1 (<https://code.claude.com/docs/en/hooks#posttooluse-decision-control>, read
  2026-10-02).
- **Gates:**
  - every repo's `--json` validates against one schema;
  - every failure names a role that exists in its group.

### 4.5 Routing
- **The dispatcher picks (folder, role):** the folder from paths and keywords, the role
  from routes.
- **A keyword → (folder, role) index** suggests the silo in a UserPromptSubmit pointer
  of at most 300 chars. That is context-hygiene C6's recommender, now with a precise
  target.
- **Role reports end with the silo to dispatch.**

## 5. Phases

0. **Facts and instruments** (§2). The docs answers are recorded; `harness` adds the
   audit columns; the allowlist probe runs. No week-long wait. The original gate
   applies only if Jacob keeps it (§6, decision 1).
1. **Tooling, in .claude/ (harness).** The weighted per-prompt audit; then the `roles`
   schema, the CLAUDE.md composer and `report.jq`. No silos yet.
2. **Pilot: site-scrapers.**
   - Why this repo: the largest folder CLAUDE.md (19 KB), the most mature `dev.sh check`,
     and the most dispatches.
   - Its owner tags its CLAUDE.md.
   - Add tests, audit and docs silos, each with a role tool allowlist. **This is the trim
     experiment, done per role.**
   - `site-scrapers` (code) stays the owner, and the fallback for tasks that span roles.
3. **Measure the pilot for two weeks.** Use per-task totals. Keep a silo only if it is
   cheaper per task than the folder agent was on the same kind of task.
4. **Role reports and export/reload.** First role reports (`--json` and `report.jq`) for
   the pilot; then export/clear/reload for the two windows.
5. **Roll out.** Extend to other repos only where the pilot's pattern won. Retire the
   silos that didn't pay.

## 6. Open decisions for Jacob

1. **Keep the original gate?** That is, build only if v2 shows it reduces usage overall.
   If kept, set its threshold (30% fewer weighted tokens per prompt is suggested).
   Trimming the prefix no longer depends on it (§2).
2. **The pilot repo.** site-scrapers is suggested.
3. **The starting roles.** All four (code, tests, audit, docs), or start with docs and
   audit, the most self-contained.
4. **Where role reports go.** Also to you directly (a status line or a file), or only
   through the dispatcher.

## 7. Overlap with PLAN-context-hygiene.md

- **Its C5** (restructure CLAUDE.md, one source for shared rules) becomes §4.2 here.
  Tagging replaces moving text into rule docs. Do one, not both.
- **Its C2** (context monitor) and **C3** (post-compaction re-injection) are the
  "clear" and "reload" halves of §4.3.
- **Its C6** (keyword recommender) gets a precise target in §4.5.
- **Its C1** (compaction window) is decided: 200K.
- **Merge the two plans' Phase 0s into one audit run.**

## 8. Risks

- **Cross-role tasks pay several cold starts.** Mitigation: the folder agent stays as the
  fallback, and everything is measured per task.
- **A silo misses a rule it needed,** because filtering removed it. Mitigation:
  - untagged sections go to every role;
  - the constraints always go;
  - a role with zero sections fails the gate;
  - watch for rework.
- **More agents mean more routing choices, and more dispatcher error.** Mitigation:
  deterministic routes, the "silo to dispatch" line in reports, and the recommender
  pointer.
- **More generated files and tags to maintain.** Mitigation: everything is generated,
  `check` gates staleness, and untagged sections are safe by default.
- **Measurement noise.** A week is a small sample, and tasks differ. Mitigation: compare
  per prompt and per task kind, and state the sample size with every number.

## 9. Setup component

Groups are the roles setup writes. `agents.sh setup <repo>` (PLAN-repo-setup.md §2)
installs a repo's role set from the manifest's group defaults (§4.1); a repo setup
knows nothing about gets the default roles. The site-scrapers pilot (§5) is that
component's first run, not a hand-edited set of definitions, so the second repo costs
nothing new. Content-agnostic: a role names a tool class and an allowlist, never a
repo or a path. PLAN-routing-tree.md §8 writes the same roles into the node config,
so once routing-tree lands, this component is routing-tree's.

## 10. Roles by kind across repos, and what checks are the truth of (Jacob, 2026-10-04)

> Jacob: "is the idea that checks is the source of truth for architecture and design as
> well? Should we come up with stricter rules in terms of HOW code is written that can
> be better enforced by check? If this is the case, we may have to reconsider our groups
> right? Tests would determine tests for any repo, site-scraper would have a dedicated
> agent that a lack of recipes falls back to. And while we COULD have a dedicated dev
> agent for each repo, it might reduce the amount of active agents we need, making
> context-cleaning that much more important? Let me know if you agree."

**10.1 Agreed, with four corrections to the reasoning.**

1. **Checks are the truth of *gates*, not of design.** Design lives in the plans; a
   tool's facts live in its store (PLAN-routing-tree.md §14.1). What `tools/checks`
   owns is the executable form of every rule that *can* be executed, each with a passing
   and a failing fixture. The link between the two is PLAN-hard-gates.md §5,
   `rules-gated`: every rule in `CLAUDE.md` either names its gate or is listed as a
   principle with the reason it cannot be gated. So "stricter rules on how code is
   written": yes, and the test of whether a rule is strict enough is whether it has a
   failing fixture. A rule without one is a principle, not a rule. Candidates already
   named across the plans: one CLI per store and nothing reads the store around it
   (PLAN-hard-gates.md §3 "accessor"); generated files written read-only; `check --json`
   conforming to the one schema (§4.4); no second copy of anything (PLAN-one-source.md
   §3 item 1); help equals implementation (`help-matches`, built); literals that belong
   to one caller are parameters (site-scrapers' `audit.js literals`, generalised).
2. **Roles by kind across repos, yes, because the per-repo part becomes data.** Once a
   repo meets the contract (its `dev.sh check --json`, its gated CLI, its `checks.json`,
   its `CLAUDE.md` section), what a tester or a coder needs to know about the repo is
   supplied per task by the server and the registry, not baked into an agent
   definition. One `tester` prompt instead of fourteen copies is the "don't duplicate
   procedure" rule applied to agents. The site-scrapers case Jacob names is a
   `recipe-builder` role that `route` sends to when `known <host>` says unknown: the
   fallback is a routing rule, not a standing agent.
3. **The cost is tokens per task, not the number of agents.** `tokens --agents` since
   2026-10-03 shows every folder agent starting at about 29.3k regardless of repo, so
   the per-repo part of today's prefix is already small; fewer definitions save almost
   nothing by themselves. The saving comes from a role loading only its kind's rules
   and tools (§3 of this plan), and it is measured, not assumed (decision 1's gate
   stands).
4. **Context-cleaning matters more, for a sharper reason than "fewer agents".** A role
   that serves many repos must not carry repo A's context, hosts or findings into repo
   B. Cold roles (PLAN-routing-tree.md §5) solve that by construction: one task, one
   process. Warm roles across repos are therefore gated on a context reset at every
   repo switch, which is PLAN-context-hygiene.md §4's component; until it exists,
   cross-repo roles run cold. One more consequence: with one coder serving a repo at a
   time, the write lease (PLAN-routing-tree.md §6) stops being a safety net and becomes
   the normal case.

**10.2 What changes in this plan.** §4's silos were per kind *per repo*. They become per
kind, with the repo a parameter of the task: `coder`, `tester`, `auditor`, `docs`,
`recipe-builder`, each a registry role with its tool allowlist, `omitClaudeMd`, and the
repo's `CLAUDE.md` section attached per task by `quote-words.sh`'s successor in the
`hook` service. The pilot (decision 2) is unchanged: site-scrapers first, because it
already meets the contract. Gate: the same `tester` role, run cold against two repos'
fixtures, produces each repo's findings and none of the other's; its starting context
is within 1k of a per-repo silo's.

**10.3 Decision:** yes, Jacob 2026-10-05 ("Yes I think so. I'd love a run down of what that means though"). The rundown he asked for is 10.1-10.2; building waits on decision 1 of §6 (measure first), unchanged.
