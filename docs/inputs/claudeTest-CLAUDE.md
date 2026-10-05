# claudeTest

A folder of small tools built with Claude for Jacob's own workflows (job search, email, web scraping).

## How work is split here: a cheap dispatcher, an Opus roster

**A session started here runs as the `dispatcher`** (`"agent": "dispatcher"` in
`.claude/settings.json`): Sonnet 5.5 with Claude Code's default system prompt. It
chats, answers from what it can read, runs the tools in this folder, and hands
everything that needs real reasoning to an agent running **Opus 5.5**. The split is
about where tokens go: a dispatcher that reads and writes code pays for that code on
every later turn; one that reads a ten-line report does not.

| the work | who does it |
|---|---|
| chat, questions, running an existing tool, reading a report | the dispatcher |
| prose at the top level: `CLAUDE.md`, `TODO.md`, `PLAN-*.md` | the dispatcher |
| any edit, new file, test, audit or commit in a tool folder | that folder's agent |
| `.claude/`: the roster, hooks, libraries, their tests, `wiring.json` | `harness` |
| plans, designs, research, reviews, new tools, anything unowned | `deep-work` |
| planning WITH Jacob across sessions: `PLAN-*.md`, `TODO.md`, decisions | the **planner** window (`claude --agent planner`) |
| `.claude/settings.json`: which hooks run, the model, permissions | **Jacob only** |

`./.claude/agents.sh list` prints the roster. `applications/` has its own agent,
`applications` (Opus, dry fill only): its `disallowedTools` removes the Chrome tools,
WebFetch, Gmail and the skills that submit applications, so it reaches a page only
through `site-scrapers`. **Dispatch the whole task, not a step:**
what, why, the files you already know about, and what "done" means. A subagent starts
with no memory of this conversation, and a brief that omits the why produces a
plausible wrong change, the most expensive outcome available here. Jacob's latest
messages are attached to every roster spawn automatically (human-origin only, never a
peer session's), but the brief is still the dispatcher's to write.

**Enforced, not intended.** `.claude/hooks/dispatch-guard.sh` blocks the dispatcher
from:
- writing anywhere in the project except top-level `*.md`;
- spawning anything but the roster (plus `Explore`, `claude-code-guide` and
  `statusline-setup`);
- overriding a roster agent's model.

Each block names the agent to use instead. Subagents pass. Bash writes are caught
heuristically; `.claude/lib/write-targets.sh` lists what it cannot see. For a
deliberate Opus session, such as redesigning this layer, start
`claude --agent deep-work`: the guard lets a session started as a roster agent work
directly.

**One source for each fact:**
- `.claude/agents.manifest.json` holds the roster and every knob:
  - the dispatcher's model;
  - the roster's default model and effort (`coders`);
  - per-agent overrides (model, effort, tools, disallowedTools, maxTurns,
    omitClaudeMd, ...) and routes;
  - the quote size.

  A non-Opus model on an agent needs a written `model_reason`, or `check` fails.
- **To change an agent:**
  1. Edit the manifest.
  2. `./.claude/agents.sh gen`, then `check`.
  3. Commit inside `.claude/`.
  4. Compare with `./.claude/agents.sh tokens --agents --since <date of the change>`.

  Keep the change only if the numbers say it helped (TODO.md, "Measure overhead
  per agent").
- `./.claude/agents.sh gen` renders `.claude/agents/*.md` read-only.
- `.claude/wiring.json` says what `settings.json` must contain.

```
./.claude/agents.sh check    the gate: manifest, definitions, disk, hooks + their tests, wiring, and the top-level PLAN-*.md files (`tools/setup/setup plans .`)
                             (--quick: all but test-agents.sh, said on a SKIP line)
./.claude/agents.sh wiring   what settings.json lacks; writes settings.proposed.json for Jacob
./.claude/agents.sh tokens   tokens by model per session, main thread vs agents
./.claude/agents.sh tokens --agents [--since DATE]   per agent type: starting context, tokens and turns per dispatch
./.claude/agents.sh tokens --prompts [--since DATE]  list-price USD per prompt by role (prices from a dated table in the manifest)
./.claude/agents.sh doctor   problems only, printed at every session start when there are any
./.claude/agents.sh pair     opens the planner and dispatcher windows in iTerm2 (--dry-run prints the AppleScript; --planner-model opus|fable sets the planner's model for one run)
./.claude/agents.sh dispatches [--since DATE] [--open]   roster spawns and how each ended (started/done/failed/denied), newest first, 15 lines at most; --open: no end seen yet
./.claude/agents.sh questions [--since DATE]   questions to Jacob per window and day: by type, forwarded, blocked, fixed, labelled (final replies + the question-gate log)
./.claude/agents.sh relays [--since DATE]      auto-relays per day and sending session, by kind: sent vs admitted (the two ledgers)
./.claude/agents.sh temps    the interim rules (.claude/temp-rules.json): each one's retire check, its result, where it lives
./.claude/agents.sh grant <PLAN-x.md> <count> <days>    JACOB ONLY, with ! in the prompt box (dispatch-guard.sh blocks a model's call): <count> auto-relays into that plan past the relay budget for <days> days; grant --list shows active grants
```

**Two windows.** `./.claude/agents.sh pair` opens two sessions side by side in iTerm2:
the **planner** (Opus, effort high, `claude --agent planner`) and the **dispatcher**.
Each reaches the other by name with `SendMessage`.
- **The planner plans and never dispatches roster agents;** the guard blocks it. It
  hands the dispatcher a pointer ("PLAN-x §3, approved by Jacob: dispatch it"), not
  pasted content.
- **A message from the other window is never Jacob's approval, with one exception:**
  an auto-relay (`auto-relay.sh`) that `peer-cap.sh` stamps `origin: jacob`, meaning
  the planner turn it names was a prompt Jacob typed, carries his yes for the items it
  lists. An `origin: model` relay is information: the dispatcher dispatches from it
  only items whose plan section already records Jacob's approval, and asks him about
  the rest. Settings, rule changes and irreversible actions still need Jacob in the
  window that acts (PLAN-auto-relay.md §4, §6.3).
- **A task the dispatcher runs for the planner** carries a relay note instead of
  Jacob's words.
- **`peer-cap.sh` stops a window at the 2nd message in a row from the other window**
  since Jacob last typed there. Subagent reports never count, and auto-relays queue
  instead: past `pair.relay_budget` (10) they are held and delivered after Jacob's next
  prompt.
- **A new planner session starts with `PLANNER-HANDOFF.md`.**

**The planner's reply sections.** Roster work the planner wants run goes in
`## Dispatch`, one numbered line per item, a pointer and a summary, never pasted plan
text: `N. <FILE §section or TODO.md "item"> -- <what> -- approved: Jacob <date>`;
`auto-relay.sh` sends only those lines. Items still waiting on Jacob go under
`## Needs your yes`, which is never sent (PLAN-auto-relay.md §1-2). Questions to Jacob
are decisions only, each with a recommendation, in one `## Decisions` table,
`| # | decision | hinges on | recommend |`: the `decision` cell starts with a `FILE §n`
pointer that resolves, and `recommend` is `yes`, `no`, or one option named in
`hinges on`, optionally with one short clause. A question outside the table, or a row
off that shape, gets a notice from `question-gate.sh`, never a block; the planner asks
the dispatcher nothing (PLAN-question-routing.md §2, §4).

Other settings that shape this:
- Roster agents whose folder `CLAUDE.md` carries the shared rules skip this file
  (`omitClaudeMd`). They get "Constraints that don't bend" copied in verbatim at
  generation, so keep that heading as it is.
- Nesting is off (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`).
- Fast mode is off here (`CLAUDE_CODE_DISABLE_FAST_MODE=1`): it bills usage credits
  at twice Opus's price.
- The v1 layer it replaced is in `.claude/archive/v1-2026-10-01.tar.gz`.

## Prefer the tools built here — ENFORCED for the scraper

Before reaching for a generic approach (interactive browser tools, one-off scripts, manual steps), check whether a tool in this folder already does the job, and use it if so.

**For reading a web page, `site-scrapers` is the primary path, not a fallback.** A `PreToolUse` hook (`.claude/hooks/prefer-recipes.sh`) blocks a WebFetch or a Claude-in-Chrome navigation to any host that already has a `working` recipe, and names the `./scrape.sh` command to use instead. It exists because this was already the first rule in this file and being a rule was not enough — opening a browser is the reflex, and the check that avoids it has to happen *first*, before the expensive thing. That is the same shape the inline-blob rule lost to.

The hook is deliberately narrow, so it cannot strand you:

- A recipe that is `broken`, `blocked` or `needs-review` does **not** block — there the browser may be the only path left.
- An **unknown** site does not block. Use the browser, then register what you learned so the next visit is one call.
- When you genuinely need a browser on a covered host — building another recipe for it, confirming a wall, an attended handoff — open a short window first: `cd site-scrapers && ./dev.sh browser-ok`.
- It fails **open**: anything unexpected allows the call.

`cd site-scrapers && ./dev.sh known <hostname>` answers "do we already cover this?" across every page_type.

| Tool | What it's for | Start with |
|---|---|---|
| `site-scrapers/` | Scraping job sites and other pages, plus repeatable browser actions, via stored recipes | `site-scrapers/CLAUDE.md` (check `node query.js site <hostname>` before opening a browser) |
| `emailTools/` | Gmail: count unread senders by company, bulk-mark chosen senders as read | Docstrings at the top of `count_unread_senders.py` and `mark_senders_read.py` |
| `scripts/` | Import jobs end to end: scrape a site, normalize through a data-bridge mapping, import into Proficiently. Twelve recipes, dry-run by default | `scripts/CLAUDE.md` (`python3 import_<site>_jobs.py --from-profile`) |
| `scripts/dedupe_import_jobs.py` | Merge job-apply search results into Proficiently's `~/.proficiently/job-history.md`, skipping duplicates | Docstring at the top of the script |
| `applications/` | Preparing job applications, **dry fill only**: describe a job's application form, answer each field from Jacob's own data (an unknown question stays `missing`), fill it headless through `site-scrapers` without submitting, and present the results as one batch table with a batch id. Phase 1: no submit, approve or account path exists | `applications/CLAUDE.md`, then `docs/PACKET.md` (`./apply prepare <job url> --company C --role R --resume PATH`, `./apply batch`; `./dev.sh check` before committing) |
| `scriptingTools/chronjobScheduler/` | Scheduling anything with cron: add, edit, enable/disable, explain and back out cron jobs | `scriptingTools/chronjobScheduler/CLAUDE.md` (`./chron.py` for the menu; `./dev.sh try …` to experiment without touching the real crontab) |
| `knowledge-base/` | Claude's docs and our own findings, searchable and checkable without a model, from a local mirror of the docs (222 pages, 5,065 sections at the 2026-10-02 refresh) in an SQLite FTS5 index. `kb q "<question>"` answers with the matching sections and their `url#anchor`; `kb show <url#anchor>` prints one section; `kb cite` and `kb check` verify that a cited platform claim matches the source text. Plan phases 2-4 are still open | `knowledge-base/CLAUDE.md`, then `docs/KB.md` (`./dev.sh check` before committing) |
| `addon-bench/` | Trying third-party add-ons on our repos before anything is adopted: each candidate pinned by hash, installed offline, run only in an empty environment under a macOS sandbox with no network, against a read-only `git archive` copy of a repo, its output capped. First candidate: graphify. A candidate's answer is a claim, not a fact | `addon-bench/CLAUDE.md`, then `README.md` (`./dev.sh run <c> <verb>`, the only way a candidate runs; `./dev.sh check` before committing) |
| `tools/setup/` | Bringing a git repo (or a new folder) to the shared baseline from its path alone: the shared-rules block of `CLAUDE.md`, the shared hooks and a `settings.proposed.json`, `TODO.md`, a `./dev.sh check` stub that fails until filled in, one commit of what it wrote (only in a repo it just created), and on request a GitHub repo (`--github`, public by default, `--private` on request). Never touches `settings.json`; drift is reported, never overwritten. Its own repo is `github.com/CyberImpXIII/setup` (public, created 2026-10-04 with Jacob's approval) and is pushed | `tools/setup/CLAUDE.md` (`./setup <path> [--dry-run]`, `./setup components`; `./dev.sh check` before committing) |
| `scriptingTools/data-bridge/` | Schema-to-schema transformation where a mapping is data, not code: register a sender schema, a receiver schema and a mapping of declarative steps, and `verify.js` returns conforming documents plus an account of what did not conform, which earns the mapping its status. The `scripts/` importers normalize through its mappings. Node 22.5+, no dependencies. Not built yet: `lab.js` and the UI | `scriptingTools/data-bridge/CLAUDE.md` for the rules, `README.md` for the design (`./dev.sh demo` end to end on a throwaway database; `./dev.sh check` before committing) |
| `tools/todo/` | Structured TODO items per repo: open items in `todo.json`, closed ones in an append-only `todo-history.json`, `TODO.md` rendered read-only from the store. The `todo` CLI (15 commands) is the only way in: `add`, `edit`, `done`, `report` (creates the counterpart in the owner's store), `ready` and `brief` (dispatchable items), `history`, `check` and more. Reads no roster; items name repos, never agents | `tools/todo/CLAUDE.md`, then `README.md` (`./todo list`, `./todo history [ID]`; `./dev.sh check` before committing) |
| `tools/hooks/` | The one source of the three shared hooks (`no-inline-blobs.sh`, `prefer-recipes.sh`, `troubleshooting.sh`) and `lib/write-targets.sh`, in `source/`. Change a hook there, never in a copy; `./hooks copies` compares every installed copy with the source by meaning (comments and blank lines aside) | `tools/hooks/CLAUDE.md` (`./hooks list`, `./hooks source`, `./hooks copies`, `./hooks audit`; `./dev.sh check` before committing) |
| `tools/checks/` | The one source of the generic pre-commit gates (7 checks: `docs-rows`, `help-matches`, `hooks-installed`, `no-roster`, `no-secrets`, `rules-in-sync`, `todo-valid`), run per repo or across the workspace as one repo-by-check grid. Each check has a passing and a failing fixture | `tools/checks/CLAUDE.md` (`./checks run [PATH]`, `./checks all`, `./checks explain <name>`; `./dev.sh check` before committing) |
| `tools/hub/` | Planning stage, nothing built: the node server from PLAN-routing-tree.md. The repo holds `PLAN-hub-brief.md` and its inputs in `docs/inputs/` (copies made 2026-10-04, with `SHA256SUMS`) so a cloud session can plan the hub from them; its output is `PLAN-hub.md`. Its `./dev.sh check` is still setup's stub, which fails by design until the contract is filled in | `tools/hub/CLAUDE.md`, then `PLAN-hub-brief.md` and `docs/inputs/README.md` |

If a tool is close but not quite right, extend it rather than writing a parallel one-off. If you build something new and reusable, put it in this folder and add a row to the table above.

## Prefer helper scripts over inline one-liners — ENFORCED, not advised

**Don't write inline script blobs at all** — no `node -e "..."`, no `python3 -c "..."`, no `node - <<EOF` / `python3 - <<PY` heredocs. If a helper exists, use it. **If none fits, write the helper first and then call it**, in the same turn; don't write it inline "just this once".

A `PreToolUse` hook (`.claude/hooks/no-inline-blobs.sh`) blocks these rather than discouraging them. It is a hook because being a rule was not enough: the session that tightened this rule then hand-authored the same 100-character `jq` filter four times in a row, and chained `test && audit && git status` by hand three times. Neither was ignorance — both were read and agreed with. Repetition does not feel expensive in the moment and each instance looks too small to stop for, which is the whole failure mode.

Re-authoring a blob costs full tokens every time, reintroduces a quoting bug roughly every third attempt (it has caused a silent no-op and a mangled commit message here), and leaves nothing behind for the next session.

**The destination is always one of three, so you never have to invent one under time pressure:**

| what you are doing | where it goes |
|---|---|
| a read or check you will repeat | a subcommand of that tool's helper script |
| anything touching stored data | that tool's own CLI — never raw SQL |
| a genuine one-off | a script file, then run the file |

Most cases are already covered, so an inline blob is usually a discipline failure rather than a missing tool: `jq` (installed) for reading JSON, the **Edit** tool for patching files, and each tool's own CLI for its own data. **If a `jq` expression is long enough to need thought, it is a helper subcommand you have not written yet.**

- Make the helper trim its own output. Reading five lines instead of five hundred saves more than shortening the command does.
- Keep failure detail. A helper that prints only a pass/fail count forces a second run to find out what broke.
- Write one when the repetition has actually happened, not speculatively. An unused helper is worse than the inline version it replaced, and a wrong one is worse still.
- `site-scrapers/` has `./dev.sh` (check/test/audit/run/verify/inside/apply/health/blocked/snap/new/clean) and its CLIs `query.js` / `lab.js` / `register.js` / `verify.js` / `audit.js` / `failures.js`. Use them rather than rebuilding their behaviour inline.

**Second time you type something, it becomes a subcommand.** Don't ask; just add it.

## Wall clock is not a cost — tokens are

**Cost here means tokens and AI usage. Nothing else.** This machine is powerful and loads many pages at once. If something takes a while but is purely Puppeteer — headless, in a subprocess, returning a small result — it is **not expensive**, and "it takes a minute" is not an argument against it.

The distinction is that the page never enters anyone's context. A browser loads it, a few hundred bytes of JSON come back, and the model reads those. A run that takes 60 seconds and returns 400 bytes is cheaper than one that takes 2 seconds and returns 40KB.

So: **do not optimise for speed, do not batch to save seconds, do not skip a measurement because it is slow.** Prefer the thorough run. Spend wall clock freely to avoid a second round trip through the model, which is the thing that actually costs.

What DOES still count: output size, because it lands in context — and anything that would provoke a site into blocking us. When in doubt about whether a cost is real, ask whether a token is spent on it.

## Gate the seams — STANDING DIRECTIVE for all work in this folder

**When you build or change a tool here, the interfaces it creates get a gate, a test, or an audit in the same change.** Not afterwards, not "worth adding later". If you cannot think of how to check something, say so explicitly rather than leaving it unchecked and unmentioned.

This is the general rule behind everything below, and it exists because the gap is never in the feature — it is in the *seam between* two things that each work:

- Four copies of a hook existed with "keep them in step" as a comment. Their logic happened to agree, by diligence rather than by check.
- Two of those hooks were installed in only 2 of 4 tool folders, so a rule was enforced or not depending on which directory a session started in.
- Both resolved a sibling repo by a fixed `../..`, so in the other folders they exited 0 and enforced **nothing while still looking installed**.
- Every hook's header promised it "fails open" and nothing tested that. A hook that exits 2 on malformed input does not degrade to unenforced — Claude Code reads exit 2 as a block, so it refuses every matching call.
- `dev.sh usage()` printed a hardcoded line range, bumped by hand, wrong three times in one session: the help truncated mid-list while the tool kept working.

Every one of those is a seam, not a feature, and every one was invisible. **A guard that is present, reports no error, and does not run is the worst state available, because you stop looking.**

What "the seam" means in practice — if your change introduces any of these, check it in the same change:

| you added | the seam to gate |
|---|---|
| a second copy of anything | a check that the copies agree, on *meaning* not bytes |
| a file that must be present for something to work | a check that it is present, executable, and parses |
| a documented list (subcommands, params, fields) | a check that documented == implemented, both directions |
| a vocabulary/config consumed by code | a check that each consumed key exists, and each key is consumed |
| an accessor meant to be the only way in | an audit that nothing bypasses it |
| a fallback or "fails open" path | a test that exercises the failure, not just the success |
| a promise in a comment | either a check, or delete the promise |

`site-scrapers/check-hooks.sh` and `site-scrapers/test/hooks.test.js` are the worked examples. `cd site-scrapers && ./dev.sh check` runs suite + offline audit + hook layer + working tree in one command.

## Make the wrong thing impossible, not discouraged

The general form of the rule above, and the principle the tools here are built on. A constraint that lives only in a document is an intention; a constraint enforced by code is a constraint.

Where something matters enough that getting it wrong would be expensive or silent, prefer a guard over a warning: a write that refuses unless authorized, a gate that runs the checks before and after and rolls back a change that introduces a finding, a generated file written read-only so editing it by hand is visible, a hook that blocks. `site-scrapers/docs/architecture.md` describes how those are built there.

**These rules are hooks** (`.claude/hooks/`, registered as `.claude/wiring.json` specifies), each because it had already failed as a rule:

| hook | blocks / does | the rule it enforces |
|---|---|---|
| `dispatch-guard.sh` | the dispatcher writing outside top-level `*.md`, spawning a non-roster agent, or overriding a roster agent's model | "How work is split here" |
| `session-doctor.sh` | says at session start what is not wired, and nothing when all is | "a guard that does not run is the worst state" |
| `planner-role.sh` | tells a planner session its role when it starts | "Two windows" |
| `peer-cap.sh` | stops a window at the 2nd message in a row from the other window since Jacob last typed (subagent reports never count; auto-relays queue instead, and are held only past `pair.relay_budget`, then delivered after Jacob's next prompt) | "Two windows" |
| `quote-words.sh` | a SubagentStart hook: gives each roster agent Jacob's latest messages verbatim under "## Jacob's words" (only what he typed, never another session's); a relayed task gets a relay note instead | "Jacob's latest messages are attached to every roster spawn" ("How work is split here") |
| `agent-watch.sh` | alerts once when a spawned agent goes silent past `spawn_watch.stale_minutes` | "never silent about what failed" |
| `auto-relay.sh` | a Stop hook in the planner session: delivers the planner's `## Dispatch` section to the dispatcher's inbox socket, sending only lines that parse and were not sent before, and prints one notice for Jacob on every outcome | "Two windows" |
| `record-session.sh` | at session start and on each prompt, records the dispatcher's messaging socket and permission mode, so `auto-relay.sh` can find it | "Two windows" |
| `question-gate.sh` | a Stop hook on both windows' final replies. Dispatcher: questions to Jacob only in `## Needs Jacob`, one typed item per line (`N. [<type>] <question> -- blocks: <pointer>`, types from `questions.types`). `[dispatch]` passes to Jacob; `[plan]` is forwarded to the planner's inbox (stamped `origin: dispatcher`, never his yes); `[context]`, an item off the shape, or a `?` line outside the section is blocked once ("ask the owner, not Jacob"); past `questions.max_blocks` (1) everything passes, labelled "rule not met". Planner: a `?` outside `## Decisions` or a row off its shape gets a notice, never a block. **Not live until Jacob wires it**: on 2026-10-03 `settings.json` lacked it (`./.claude/agents.sh wiring` names it) | "Two windows" (PLAN-question-routing.md §3, §4) |
| `no-inline-blobs.sh` | `node -e`, `python3 -c`, heredocs feeding an interpreter | "Prefer helper scripts over inline one-liners" |
| `prefer-recipes.sh` | a browser/WebFetch call on a host with a `working` recipe | "Prefer the tools built here" |
| `troubleshooting.sh` | re-running a `blocked-attn` recipe without `--attended` | site-scrapers rule 3 |

Each **fails open** — a hook that broke every call would be worse than the habit it corrects — and each has a test beside it (`bash .claude/hooks/test-<name>.sh`). `troubleshooting.sh` also *prints* a host's recorded failure history when you are about to edit its recipe, rather than demanding you go and read it.

The last three, with `.claude/lib/write-targets.sh`, have one source: `tools/hooks/source/`. They are installed as copies in **fourteen** places: here, and in the `.claude/hooks/` of thirteen tool folders (`site-scrapers`, `emailTools`, `scripts`, `scriptingTools/data-bridge`, `scriptingTools/chronjobScheduler`, `knowledge-base`, `applications`, `addon-bench`, `tools/setup`, `tools/checks`, `tools/hooks`, `tools/hub`, `tools/todo`). The count is from `cd tools/hooks && ./hooks copies`, which on 2026-10-04 printed `copies: 14 location(s), 85 file(s) ... agree`. That's because a hook only fires when Claude Code's project dir is the one holding it. This copy covers sessions started from this folder; each of the others covers sessions started inside its repo, and travels with a fresh clone. Copies rather than symlinks: only exit 2 blocks, so a missing command (exit 127) is a non-blocking error, and a dangling link would leave the hook silently unenforced. **Change a hook in `tools/hooks/source/`, never in a copy.** Each copy belongs to its folder's owner, so reinstalling it is a dispatch to each; `./hooks copies` names every copy that differs from the source in meaning (exit 1 on drift, a missing file or a non-executable one). A copy only runs where that repo's `.claude/settings.json` registers it: on 2026-10-04 `tools/checks`, `tools/hooks`, `tools/hub` and `tools/todo` had none, so their copies did not run there (Jacob's step, as for the hub). `cd site-scrapers && ./dev.sh check` also fails when the hooks it registers stop matching their other copies. Its `DECLARED` list names the first ten locations (`applications` added in site-scrapers commit 2c23193, `addon-bench` and `tools/setup` in commit c492976, both dated 2026-10-03), not the four newest, so on 2026-10-04 its `./check-hooks.sh` printed `hooks: 8 ERRORS`: those four undeclared, and those four without a `settings.json`. It also runs every `prefer-recipes.sh` copy against a covered host from where it is installed, and requires a block. The first nine hooks in the table exist only here, because the dispatcher and the planner only exist at the top level. `cd site-scrapers && node init.js` reports which hooks are actually live, and says so loudly when one is missing or not executable.

**Apply this to your own behaviour too.** If you catch yourself about to do something the rules say not to, the durable fix is usually a check that makes it impossible next time, not a firmer resolution.

## A wrong answer is worse than a failure

Most of the expensive bugs in this folder produced *plausible* output rather than an error: a salary string reported as a location, a search filter that never filtered, a parameter that changed nothing, an `href` pointing at a company page while being read as a job link. Each one was confidently wrong and therefore invisible.

- **Prefer `null` over a guess.** If a value can't be found, say so.
- **Prove a feature does something.** Anything that accepts an input and might ignore it needs a test that the input *changes the output*. "It ran without erroring" is not evidence.
- **A claim is earned, never asserted.** Don't mark something working, verified or done because you believe it is — make it provable by a run, and let the run set it.
- **Check the reported result, not the exit code.** A process can exit 0 having done nothing, and can exit non-zero while carrying the data you wanted.
- **Verify counterfactuals.** Before concluding X caused Y, check that Y doesn't happen without X. Several long investigations here ended with a cause that was never tested against its own negation.

## Don't duplicate procedure — the unique thing is the data

When two things do the same work against different inputs, the work belongs in one parameterised place and the inputs stay separate. A near-duplicate that drifts is harder to find than a missing feature, and both copies look correct in isolation.

If an existing helper *almost* fits, add a parameter to it rather than forking it. If a literal inside shared code belongs to one caller's domain, it is a parameter with a documented default — not a constant. `site-scrapers` enforces this with `node audit.js` (`inline`, `repeats`, `literals`, `hardcoded`); the principle applies to anything here.

## Keep an active TODO

**Jacob's rule, and it belongs in every copy of these rules.** Every repo here
keeps a `TODO.md`, and every agent keeps it current. An issue you noticed and
neither fixed, reported, nor wrote down is **lost when the session ends** — and
the next session pays to rediscover it.

It holds four things:

- **your own bugs** — including the ones you caused and worked around
- **open decisions**, with what each one hinges on
- **unconfirmed suspicions, labelled as such**, naming the probe that would
  settle them. A suspicion worth having is worth recording before it is proven
- **what you reported to another owner**, so the next session doesn't report it
  again, and so a stalled report is visible rather than assumed handled

**Add items when you notice them, not at the end of the session** — the end is
exactly when context runs out. Delete them when they are done; a TODO nobody
trims stops being read.

A finding recorded with its evidence is worth more than one recorded as a
worry: say what you ran, what you saw, and what you concluded.

## Report a problem in someone else's code to whoever owns it

**Jacob's directive, and it belongs in every copy of these rules — like the
hooks.** When you find a bug, a wrong result, a status that overstates what
works, or a missing guard in code another agent owns, **tell that agent.** Do
not fix it silently, do not route around it, and do not leave it to be
rediscovered.

- From the main session, `ListAgents` to find the owner and `SendMessage` to
  report it. A dispatched agent has neither tool, so it puts the problem in its
  report and the dispatcher relays it. Either way, say what you
  observed, the exact input or parameters, what you expected, and what you did
  on your own side in the meantime.
- **Both alternatives cost more.** Fixing it yourself clobbers their work and
  skips the checks their repo has for a reason. Routing around it hides a
  fixable fault behind a workaround, and the next consumer pays for it again.
- **Report the unconfirmed findings too**, labelled as such, naming the probe
  you ran — so the owner can tell evidence from inference.
- If nobody owns it, or the owner is unresponsive, say so to Jacob rather than
  quietly absorbing the problem.

It has already paid for itself in both directions across this folder: a
`glassdoor` recipe reported as broken turned out to have an undeclared
parameter whose wrong value returns a *plausible smaller result set* rather
than an error, and a report in the other direction found an import script
discarding good data by aborting on a non-zero exit code. Neither would have
surfaced from one side alone.

## Check for a primary context before changing anything that exists

More than one agent may be working in this folder at once. Two agents editing the same file or the same recipe will clobber each other, and each one separately running `git status` / diffing / committing burns tokens re-deriving what another already knows.

**Before modifying existing code, existing recipes, or anything already committed**, work out whether another session already owns that work:

- Run `ListAgents` to see other Claude sessions on this machine. A session whose name points at what you're about to touch (e.g. `site-scrapers-*` when you're editing `site-scrapers/`) is a candidate owner. A dispatched agent has no `ListAgents`; it relies on the `git` check below, and on the dispatcher, which has already looked.
- Check `git status` and `git log -1`. Uncommitted changes you didn't make, or a commit from minutes ago you didn't write, mean someone else is mid-task.

If a primary context exists, **do not edit in parallel — queue the change with it.** Use `SendMessage` to describe the change you want (file and function, what should differ, why) and let the primary apply it. A dispatched agent writes that in its report instead, for the dispatcher to queue. Wait for its reply rather than editing anyway. If it's idle or unresponsive and the change is urgent, say so to Jacob and ask before proceeding.

If no other session is working the same area, you are the primary. Proceed normally.

**Additive work needs none of this.** Creating new files, registering new recipes, adding new generic actions, or adding a new tool can happen concurrently without coordination — nothing is being overwritten. `site-scrapers` handles concurrent DB writes safely (WAL + busy timeout), so registering a recipe while another agent runs a scrape is fine. Editing an *existing* recipe is not additive: it bumps that recipe's version, and two agents doing it at once produces conflicting version history.

Each repo carries its own copy of this rule — see "Keeping these rules in sync" below.

## Parallelism: structured, and never silent about what failed

This applies to code you write here *and* to how you run these tools while troubleshooting.

- **Use promise combinators, not ad-hoc concurrency.** Fire-and-forget promises, or a loop that starts work without awaiting it, lose both ordering and failures. Everything concurrent goes through `Promise.all` / `Promise.allSettled` (or the language equivalent) so there is one place that knows what was started and what came back.
- **Prefer `Promise.allSettled` when troubleshooting.** `Promise.all` rejects on the *first* failure and throws away every other result, including the ones that succeeded — which is exactly the comparative information you need when working out why something broke. Reach for `Promise.all` only when fail-fast is genuinely what you want (a later step can't run without all the earlier ones).
- **Report per-branch outcomes, never just the first error.** When N things run in parallel, say which succeeded and which failed, and for the failures, where. A summary that surfaces one exception and drops the rest hides the pattern — "3 of 12 failed, all on the same step" is the finding; "one thing threw" isn't.
- **Prefer parallelising across processes over inside one.** Module-level state (progress trackers, caches, counters) is written on the assumption that one job runs per process. Two overlapping jobs in a single process interleave those writes and produce confidently wrong diagnostics. Separate processes each keep their own state and each report their own failure.
- **Contention produces failures indistinguishable from real ones.** Running two browser sweeps at once produced "detached Frame", "Execution context was destroyed" and "Target closed" across five recipes that all returned records when run alone — and separately, a recipe that failed 4 of 4 runs under parallel load with a navigation timeout succeeded on both its param sets when run by itself. **A repeat under parallel load is not evidence about the thing being tested.** Re-run it alone before concluding anything, and never run two heavy sweeps concurrently.
- **Don't let one bucket swallow the ambiguous cases.** `site-scrapers` reports an `INFRA` verdict for errors that can *only* come from the harness, and deliberately keeps ambiguous ones (a navigation timeout, which is equally what a dead URL looks like) out of it. A catch-all that absorbs genuine breakage is worse than no category at all.

## Run the checks before committing, and commit at checkpoints

**Each repo has one pre-commit command — run that, not a chain you retype.** In `site-scrapers` it is `./dev.sh check` (suite, offline audit and working tree in one, non-zero exit if the suite fails). If a repo has no such command yet, that is the first helper to write.

**Don't start a long operation with uncommitted work.** A session can end mid-task, and unpushed work is work nobody else can pick up. Commit at checkpoints — after each logical piece, before anything that will take minutes.

**One verification run, not two.** If a command already tells you what happened, don't run a second one to confirm it. This matters most for anything that drives a browser or hits a network.

## Push code changes to git

Whenever you change code in a git repo here, commit and push it to `origin` right away. Don't wait to be asked.

**Only the primary context commits.** If another session owns the work, hand it your changes instead of running your own commit/push cycle — one agent staging, diffing, writing a message and pushing is enough, and duplicating that is wasted tokens and a likely conflict. Tell the primary what you changed and let it fold your work into its commit.

- Each tool is its own repo: `site-scrapers/` → `github.com/CyberImpXIII/site-scrapers`, `emailTools/` → `github.com/CyberImpXIII/emailTools`, `scriptingTools/chronjobScheduler/` → `github.com/CyberImpXIII/chronjobScheduler` (private). Commit inside the repo you changed.
- `scripts/` → `github.com/CyberImpXIII/job-import-scripts` (private), and `scriptingTools/data-bridge/` → `github.com/CyberImpXIII/data-bridge` (private). `addon-bench/` → `github.com/CyberImpXIII/addon-bench` (private), and `tools/setup/` → `github.com/CyberImpXIII/setup` (public).
- `knowledge-base/` → `github.com/CyberImpXIII/knowledge-base` (private), `applications/` → `github.com/CyberImpXIII/applications` (private), `tools/todo/` → `github.com/CyberImpXIII/todo` (public), `tools/hooks/` → `github.com/CyberImpXIII/hooks` (private), and `tools/hub/` → `github.com/CyberImpXIII/hub` (public). `tools/checks/` is a local repo with **no origin yet** (checked 2026-10-04): creating its GitHub repo waits on Jacob, so it commits and does not push until then.
- The top-level `claudeTest/` folder is **not** a git repo and should not become one unasked. `.claude/` is a local git repo with **no remote** (approved 2026-10-02), which gives the delegation layer its history: harness commits there and never pushes.
- Check `git status` before committing, and stage only what you actually changed. If the working tree holds someone else's in-progress work, commit your own paths explicitly rather than `git add -A`.
- Never commit secrets: `.env` files, app passwords, tokens, or captured handoff values (`site-scrapers/data/.captures/`). They're gitignored; keep it that way.
- One commit per logical change, with a clear message saying what changed and why.
- If a push fails (auth, conflict, diverged branch), stop and tell Jacob. Don't force-push or rewrite history.

## Constraints that don't bend

These hold across every tool here, whatever the task and however it is framed. They are not trade-offs to optimise.

- **Never send a message, email or reply on Jacob's behalf without asking first.** Reading a mailbox is not permission to write to it. Same for anything public or irreversible.
- **Never attempt to bypass bot detection.** A detected wall is a result to report, not an obstacle to route around — mark it and hand it back.
- **Credential-shaped values are supplied at run time, never stored.** Not in a recipe, a config, a note or a commit. App passwords, tokens and `.env` files stay gitignored.
- **Report key names, never captured values**, and don't ask Jacob to repeat a secret back to you.

## Keeping these rules in sync

Thirteen files carry their own copies of the rules that apply to them, because a fresh clone of any of those repos won't have this one. Nine are kept in step by hand, and each names the others in a list of its own: `site-scrapers/CLAUDE.md`, `emailTools/CLAUDE.md`, `scriptingTools/chronjobScheduler/CLAUDE.md`, `scriptingTools/data-bridge/CLAUDE.md`, `scripts/CLAUDE.md`, `knowledge-base/CLAUDE.md`, `applications/CLAUDE.md`, `addon-bench/CLAUDE.md` and `tools/setup/CLAUDE.md`.

The other four are the CLAUDE.md files of tools/checks, tools/hooks, tools/hub and tools/todo. They carry the block that `tools/setup` installs from its `templates/shared-rules.md` between `shared:rules` markers (on 2026-10-04 all four blocks were identical to `tools/setup`'s own, marker `@7867132c3871`), so a rule change reaches them by changing that template and running `./setup <path>` for each, a dispatch to each owner. They have no list of their own, and they are named here without a backticked path on purpose: the checks of six repos (site-scrapers, tools/setup, addon-bench, knowledge-base, scripts and scriptingTools/chronjobScheduler) require the list above to equal theirs, so adding them to it is a change to all six lists at once, not to this file alone.

**Change a shared rule in the copies you own, and ASK the owner for the ones you don't** — which is the report-to-owner rule above applied to these files. Editing another agent's `CLAUDE.md` clobbers work and skips their review, exactly as editing their code would. Say which copies you updated and which you asked for, so the difference between "done" and "requested" stays visible.
