# Context hygiene: implementation plan

> **Status: plan only — nothing here is built.** Drafted 2026-10-01 by an Opus planning
> agent. It was launched with `isolation: "remote"` but **ran locally** (TODO.md, "Confirmed"),
> and spent ~302k tokens. Its research scripts are in `scriptingTools/context-hygiene/research/`.
> Section 3's numbers come from a four-transcript sample and stay preliminary until the
> Phase 0 audit confirms them.
>
> **Who builds it:** `deep-work` creates `tools/context-hygiene/` as its own repo (first planned at `scriptingTools/context-hygiene/`, which now holds only `research/`), then
> `harness` adds its roster entry and the `wiring.json` lines, and Jacob applies the settings.
>
> **Settled since drafting:**
> - **P6 is answered.** `updatedInput` with *no* `permissionDecision` works, including on the
>   Agent tool. That was probed in a scratch project, and `.claude/hooks/dispatch-guard.sh`
>   relies on it.
> - **A first tokens audit exists:** `./.claude/agents.sh tokens [N]`. It reports usage per
>   session and model, main thread vs agents, and counts each streamed message once. The
>   Phase 0 audit should extend it and share `.claude/lib/tokens.jq`, not add a second reader.
> - **Per agent type too:** `./.claude/agents.sh tokens --agents [--since DATE]`
>   (2026-10-02) gives each agent type's starting context (its first request), plus its
>   tokens and turns per dispatch. That covers the Phase 0 per-`agent_type` prefix
>   measurement. Baseline, in TODO.md: folder agents start at about 29k tokens, and
>   agents that load CLAUDE.md at about 40k.
> - **Decision 6 is constrained.** `dispatch-guard.sh` already rewrites `Agent` prompts, to
>   attach Jacob's latest words. A recommender that also does so must go through that one hook;
>   a second PreToolUse writer on `Agent` would race it.


## 0. What this tool is for, in Jacob's words (2026-10-08)

> "I thought we were building it so that we can set filters to prevent re-loading
> SPECIFIC things to context. In this way, if I ask you to plan something, and you load
> a website, I set a filter to not reload the websearch results that you've ingested
> into context if I ask a similar question, but one that is unrelated to the specific
> results of that websearch. compressing those webresults specifically might also be an
> option. Similarly, compressing your response to certain questions might be useful.
> Compressing tool calls might be useful. Similarly replacing them with generic text,
> or exporting them to an external document that holds "conditional context" would be
> useful for situations in which you need context for previously compressed, or
> filtered information. This would eventually play into the hub, as I'd like to be able
> to interactively address blocks of text or types of text, but the functionality
> should be built out via out previously discussed architectural decisions."

**The planner's reading.** The tool is a filter layer over what enters context and
what stays there. §1-§8 below were drafted as a cost plan; they are the means, and this
section is the purpose.
- **Filters are data,** set by Jacob. Each filter matches a kind of content (web search
  results, a tool's output, an answer of mine), and optionally a source or a topic.
- **Each filter has an action:**
  - pass the content through;
  - compress it to a digest;
  - replace it with generic text, a stub naming what was removed;
  - export it whole to a **conditional-context store**, leaving a stub with its id.
- **Exported content comes back only when needed.** Claude reads it back by id, or a
  later prompt that matches it brings it back.

**Where Claude Code lets content be filtered, and where it does not** (§2 holds the
sources):

| point | possible? | how |
|---|---|---|
| as a tool result arrives (web search, web fetch, Bash, MCP) | **yes**, automatically | PostToolUse `updatedToolOutput` replaces the output before Claude sees it, for every tool (hooks#posttooluse-decision-control). C4 is this, so far narrowed to named tools and a temporary spill directory |
| by keeping it out altogether | **yes** | the bulky work runs in a subagent, and only its report enters, as the dispatcher already works |
| when a later prompt needs it | **yes**, capped | UserPromptSubmit `additionalContext` injects matching stored context, up to 10,000 characters per field |
| after it is already in the conversation, including my answers | **not in place, but by rebuild: yes** | see "Rebuild" below: clear, then load a filtered context. In place, nothing removes or edits one block of the history (§2, "Compact, clear or delete: No"). The only built-in ways are manual and coarse: `/compact <focus>`, and `/rewind` → "Summarize from here", which compresses everything after a chosen prompt (checkpointing#rewind-and-summarize). Compact instructions in CLAUDE.md steer what a compaction keeps |
| in a session the hub runs itself | **likely, unconfirmed** | a session driven through the Agent SDK or the API holds its own message list, so it can filter or replace any block before each request. That is the path to "interactively address blocks of text or types of text". The probe is a hub question for PLAN-hub.md |

**Rebuild: clear, then load a filtered context (Jacob's question, 2026-10-08: "can we
not clear the context, procedurally write a new context, and then load it as you would
normally?").** Yes. That reaches content already in the conversation, my answers
included, without waiting for the hub:
1. **`hygiene rebuild`** reads the session's transcript through tools/transcripts, the
   one reader of transcripts. It applies the filters and writes a new context file:
   - Jacob's prompts verbatim;
   - my answers whole, compressed or stubbed, per filter;
   - each tool result as its stub and store id;
   - what is still open: pending decisions, the files edited, the TODO path.

   Each original goes to the store first, so nothing is lost.
2. **Jacob types `/clear`.** No hook can clear (§2), so this keystroke stays his, or
   the hub's in a session the hub runs. The status line can say when a rebuild is
   worth it.
3. **A SessionStart hook with matcher `clear`** (hooks#sessionstart) loads the file.
   Up to 10,000 characters go in directly. Past that, the injection becomes a file path
   plus a 2,000-character preview (§2), and Claude reads the rest. Those reads are tool
   results, so the same filters apply to them.

**A second way, unconfirmed:** write a filtered copy of the transcript and open it with
`--resume` or `--fork-session`. It would load as ordinary history, with no 10,000-character
limit. But the transcript format is not documented, so a format change could load a
silently wrong conversation, which is the worst outcome here. It needs a probe before
anything is built on it, and it comes after the `/clear` route.

**Automatic rebuild (Jacob, 2026-10-08).** He asked: "Couldn't we have a "finished"
hook that reopens the claude session with the file loaded automatically?" Then, on the
two drafts that drove the terminal (iTerm2 typing `/clear`, then a helper signalling
the process): "are there no flags that we can run the claude command with that avoid
this. It seems like an antipattern that is designed to do what a properly built cli
should do by design. I'm worried that driving the terminal rather than running
commands will create issues if we try to implement basically anything with
subagents."

**He is right, and both drafts are withdrawn.** Typing into a session, or ending its
process from outside, works against the CLI rather than through it. His subagent worry
is concrete:
- subagents run inside the session's process, so ending it ends them;
- what a typed `/clear` does to a background agent's later report is unknown.

The CLI has documented flags for both halves (cli-reference#cli-flags, fetched
2026-10-03):

| need | flag |
|---|---|
| start a session with a written context loaded | `--append-system-prompt-file <file>` appends the file to the default system prompt |
| keep the window's name and role | `--name`/`-n` and `--agent`, as `pair` already passes |
| keep the old session reachable | it stays on disk; `--resume <name or id>`, and `--fork-session` to branch from it |
| a program owns the conversation | `-p --input-format stream-json --output-format stream-json`: the program sends each message and reads every event, subagents included (`--forward-subagent-text`), so it knows when a turn and its agents have finished |

There is no flag that clears and reloads a running interactive session. So the design
splits in two.

**Now: the launcher restarts its own session, with no keystroke (Jacob, 2026-10-08:
"I think the exit from me is unnecessary. We don't need to drive the keyboard or type
automatically to close a claude session from the outside do we?").** No, we don't.
Closing a process is ordinary process control: a signal from the process that started
it. No hook setting ends its own session; `continue: false` stops the turn, not the
process (hooks#posttoolbatch-decision-control). But a process can signal another.

**Revised 2026-10-09 (Jacob, planner window: "Ok, I guess in that case we have a stop
gap"): the hook closes, the window's loop only relaunches.** Only the window's own
shell can start an interactive `claude` again in that window; a server, the hub
included, cannot, since it holds no terminal. So the loop stays, but does nothing else.
This is the stopgap until the hub runs sessions itself ("Later", below), where the hub
ends and restarts its own child with no loop.
1. **The window's loop relaunches, and only that.** `pair` types each window's launch
   line once, as today. The line runs `agents.sh run <role>` (harness), a shell loop:
   it exports its own pid as `HYGIENE_LAUNCHER_PID` and the request path as
   `HYGIENE_RESTART_FILE`, runs the window's `claude` command from the manifest's
   `pair` settings in the foreground, and when it exits, starts it again only if a
   request exists **and** carries `signalled_at`; it deletes the request first and adds
   `--append-system-prompt-file <rebuild>`. Otherwise it exits. It never polls, waits
   or signals. A plain `/exit` with an unsignalled request pending does not relaunch.
2. **The Stop hook asks and starts a waiter** (context-hygiene). When its rule fires,
   it writes the rebuild and the request, as the contract in that repo's TODO.md says,
   then starts one detached waiter (it must outlive the session it ends) and returns.
3. **The waiter closes the session at a safe point.** It waits until the session is
   idle with no agent running (below), writes `signalled_at` into the request, then
   signals the child of `HYGIENE_LAUNCHER_PID` (the `claude` process, found from the
   launcher, never guessed) with B0's signal. Past a time limit it gives up, deletes
   the request and records why: no forced exit, and no surprise relaunch later.

Nothing types, and nothing drives the terminal after launch. The only process ended is
the launcher's own child. The same loop serves any later restart need (TODO.md
"Running sessions pick up `wiring --apply` without a restart", if its probe fails).

**"Idle with no agent running" is the guard that answers the subagent worry.**
Subagents run inside the session's process, so a signal while one runs would end it.
The waiter signals only when all of these hold:
- the Stop hook has fired for the turn;
- `agents.sh dispatches --open` lists nothing for this session;
- no background task is recorded as running;
- nothing has arrived since.

Otherwise it waits, and it never forces.

**Later: a session a program runs.** The launcher restarts a whole session. Editing
one block while the session continues needs a session run through `-p --input-format
stream-json`, or the Agent SDK. That program holds the message list, and reads its
idle point from the event stream instead of from ledgers. It is the same session the hub needs to
"interactively address blocks of text", so it is designed in PLAN-hub.md, under
PLAN-services.md §3, not here.

**Guards, each with a test:**
- **Nothing from a tool goes into the system prompt.** The system prompt carries the
  most authority of anything in context. Web results and other tool output in it would
  turn untrusted text into instructions. The rebuild puts only these there: Jacob's
  prompts, my answers, open decisions and the stubs. Every tool result stays in the
  store, and is read back as a tool result.
- **The rebuild is never Jacob's prompt.** It is not passed as an initial prompt
  (`claude "<text>"`). The two-window rules would read that as a prompt Jacob typed,
  and so as his approval.
- **Once only.** The restart request is deleted on use, so a crash loop cannot keep
  reloading it.
- **Nothing is lost.** The originals are in the store before the restart is requested.

**Probes before the build:**
- B0: which signal ends an idle `claude` cleanly, with its transcript complete and its
  SessionEnd hook run. Signal handling is not in the docs; SIGINT is tried first, then
  SIGTERM.
- B1: does `--append-system-prompt-file` cap the file's size, and does a session
  started with it cache that prefix like the default prompt?
- B2: does a session restarted with `-n planner` get the same `SendMessage` name, and
  does `record-session.sh` record its new socket?

What still waits for a session the hub runs: editing one block while the session
continues, without a clear.

**Built under the architecture rule (PLAN-services.md §3):**
- The conditional-context store is a service: one server, and the single source of
  truth for what was filtered.
- The hooks are its clients, loaded at setup. Ingest is a hook posting the full
  original; retrieval is a verb by id or by search.
- The filter rules live in the service, so every repo's sessions apply the same rules.
- **Fail-open means unfiltered:** if the store cannot be reached, the original passes
  through unchanged and the miss is counted. A filter must never drop content it could
  not store.

**What changes in §4 (the components C1-C4).**
- C4 becomes this tool's first slice, widened:
  - WebSearch and WebFetch join the named tools;
  - the spill goes to the store, not `$TMPDIR`;
  - each stub names the store id and the verb that reads it back.
- C1-C3 (the settings bundle, the context monitor, the post-compaction re-injection) stay as written.
  They serve the same aim at lower resolution.
- §1's non-goal "rewriting history" stays for Claude Code sessions, and is lifted for
  sessions the hub runs.
- **Risk:** a filter hides something Claude needed and answers without it, a plausible
  wrong answer. Every stub says what kind of content was removed, how big it was, and
  how to get it back. The re-read rate (C4 "Measure") shows which filters are too
  tight.

**Jacob's answers, 2026-10-08 (planner window: "1) yes 2) ... yes ... 3) Yes ... 4)
YES!"):**
- **The purpose above: approved: Jacob 2026-10-08.**
- **C4 widened as the first slice: approved: Jacob 2026-10-08,** "if these examples are
  good in terms of functionality". He asked for more ways to expand it; they are listed
  below and none is approved.
- **"Automatic rebuild", "Now" (the launcher as supervisor, `hygiene rebuild`, the
  restart request; probes B0-B2 first): approved: Jacob 2026-10-08; its revision (the
  hook's waiter closes, the window's loop only relaunches) approved: Jacob
  2026-10-09.** "I like that this
  solves multiple problems, the top agents AND the subagents."
- **"Later" (a session a program runs) as a hub requirement: approved: Jacob
  2026-10-08.** "It's nice because this functionality is easily portable, and should
  fit in with how we have been designing the hub."

**Ways to expand it (planner, 2026-10-08; all ten approved: Jacob 2026-10-08, "All ten are amazing", in the recommended order below).** Each
is a filter or a store use, held as data, under the same architecture rule:
- **E1. More content types on arrival.** Long Bash output (test runs, logs) becomes its
  failing lines plus a stub. A large Read becomes the lines asked about plus a stub
  naming the rest. MCP results (a Gmail thread, a Drive file) become a summary plus a
  stub.
- **E2. Repeats become references.** The second read of an unchanged file, or a repeated
  identical result, becomes "same as <id>". The `transcripts repeats` table
  (PLAN-services.md §2 S0.5) says where this pays: 278 repeated Bash results on one
  command shape alone.
- **E3. Ageing.** A block stays whole for N turns, then becomes its stub. N is set per
  content type.
- **E4. Recall when relevant.** This is the "conditional" part of the store. When a
  prompt matches a stored block, by the same FTS search `kb q` uses, a
  UserPromptSubmit hook offers that block's stub back, never the block itself.
- **E5. Secrets never enter context.** Credential-shaped values in any tool result are
  replaced by their key name before Claude sees them. That is the constraint "report
  key names, never captured values", enforced rather than intended.
- **E6. Untrusted text is labelled.** Web, email and scraped content arrive wrapped and
  marked as data, so an instruction inside a web page reads as quoted text.
- **E7. Filter profiles per agent.** Each roster agent gets its own filter set, as data
  in the manifest. A scraper agent never needs raw HTML in its context.
- **E8. Shared blocks between windows.** The planner and the dispatcher pass a store id
  instead of pasting content, the same rule as "pointers only to the dispatcher".
- **E9. Rebuild instead of compaction.** At the 200K window, the rebuild runs in place
  of the model's summary: deterministic, with every original kept.
- **E10. Handoffs written by the rebuild.** PLANNER-HANDOFF.md and the other handoff
  files come out of the same rebuild, rather than being written by hand.
- **E11. References instead of prose (Jacob, 2026-10-08: "Even if it is that in
  context every reference to agents names are replaced with their id, the results for
  specific search results are are shortened to the site-scraper id, and relevant
  params instead of recording this all as prose, it can be proceduralized. The
  data-stores can operate as inteded, as databases.").** What stays in context is the
  record's id, plus the few fields that make it readable. The record itself lives in
  its store. A rule per `kind:` makes that mapping, so it is procedural: no model
  writes a summary.
  - **A scrape:** `scrape:run-4812 (indeed.com#search v1.3, q="platform engineer",
    remote=true; 23 rows)` in place of the 23 rows. `get scrape:run-4812` returns the
    rows.
  - **An agent:** `agent:harness`, which resolves to its roster record (model, effort,
    tools). The gain is small where the name is already short. It is large where prose
    described the agent ("the Opus agent that owns .claude/ ...").
  - **A dispatch or a decision:** `todo:td-21`, or a decision id, in place of the
    paragraph that restated it.
  - **One of my own long answers:** the decisions it carried, by id, plus a stub for the
    rest (E3).

  **What it needs that does not exist:** site-scrapers' `scrape_runs` table already
  gives each run an id, its params, its recipe version and its row count. It does not
  keep the rows (db.js, `scrape_runs`). A site's results change between runs, so the
  params alone cannot bring them back. A reference to a run is only safe once the run
  keeps its output. That is a site-scrapers change, by its owner.

  **Not a second scrape (Jacob asked, 2026-10-08: "Isn't that double dipping for no
  reason?").** No. The model's work on a site happens once, when an agent builds and
  registers its recipe. Every run after that is headless Puppeteer, with no model in
  it. A run already holds its rows: it prints them as JSON to whoever called it. So
  keeping them stores what the run produced anyway. Today the double dip is the other
  way round: either the rows sit in the caller's context and are paid for on every
  later turn, or they are fetched again by a second scrape.

  **The row count is not the data.** `result_count` is evidence: `register.js` may mark
  a recipe `working` only after a run that extracted more than zero rows
  (`definitionHasPassingRun`, db.js). Next to `claimed_count`, the total the page
  itself shows (read with `result_count_regex`, engine.js), it is a self-check that the
  run got what the page says it has.

  **Keep rows only where no other store has them.** The importers in `scripts/` already
  send their rows on, through data-bridge into Proficiently. A second copy in
  site-scrapers would be two sources for one fact. So a run keeps its rows only when a
  session called it directly, and an import run's reference points at the import's
  records instead.

  **Revised: reference the query, and store no rows (Jacob, 2026-10-09: "if we can
  reference a scrape by id + the params that would be passed to it via cli, could that
  not be a direct reference to the information that should come back?").** Mostly yes.
  This replaces the row-keeping above. A recipe id, its version and its params are a
  complete, runnable reference to *what the site says now*. Two references, then:
  - **A query reference:** `scrape:indeed.com#search@v1.3 {q, remote}`. It is the
    default. Re-running it costs no tokens, only a page load, and it returns current
    results, which is what a search usually wants.
  - **What it cannot promise:** the same rows the session saw. Listings come and go, and
    a site can block or time out.
  - **Settled (Jacob, 2026-10-09: "If claude DOES anything with this information, it
    should be saved inside the conditional context right? ... the output while NOT
    deterministic, will be saved, right?").** Yes. The store already keeps every tool
    result on arrival, before any filter runs ("Nothing is lost" above). A scrape's
    output is one more tool result. So the stub carries both:
    - the query reference (`scrape:indeed.com#search@v1.3 {q, remote}`, which asks
      what the site says now);
    - the store id (`ctx:7f3a`, which holds exactly what the session saw).

    This is the same as any other tool whose result changes when it is run again.
    The store is the one source for "what was seen", and site-scrapers the one source
    for "what is there now". Nothing new is stored in site-scrapers, and the hash field
    proposed in the first draft of this revision is dropped: the store can compare a
    re-run against the saved output itself.
    - **Everything is kept, not only what Claude uses,** because nothing at arrival
      can tell which results will matter. Unused blocks are retired by E3's ageing,
      with a retention period as data.
    - **The output passes E5 before it is stored,** so a credential in a scrape's
      result never reaches the store either.
  - **When specific rows matter** (a job to apply to, a claim to check), those rows
    already go to their own store: `applications/job-urls.json`, or the import into
    Proficiently. The reference points there. One source per fact, so site-scrapers
    keeps no copy.
  - **Re-runs are not free in one way:** each one is a visit the site sees. A query
    reference re-runs only when `get` is called, never on its own. The once-a-day limit
    in PLAN-job-sourcing.md §4 applies to a re-run too.

**Recommended order:** E5 and E6 ride with C4, because they touch the same hook and are
safety rather than savings. Then E2 and E1, where the repeats data says the tokens are.
Then E4 and E9. E7, E8 and E10 wait for the store to exist.

Jacob's answers to the two order decisions, 2026-10-08: "1) yes 2)yes". E5 and E6 ride
with C4, and E2 then E1 follow once the first slice is measured. Every store record
here takes an id and tags under PLAN-services.md §3 "Every record a service holds has
an id and tags", so the stub ids are `ctx:` ids.

**E11 comes right after E2 and E1: approved: Jacob 2026-10-09 ("1) yes").** A scrape's
stub carries both the query reference and the `ctx:` id (E11, "Settled").

## 1. Goal and non-goals

**Goal.** Cut weighted usage tokens per user prompt without lowering answer quality, using three levers:
- keep carried context small, since every request re-reads it;
- keep bulky tool output out;
- point each prompt at the few rules or tools it needs, instead of loading them all every time.

Each lever is a setting, hook or gate, and each saving is measured.

**Non-goals.**
- Rewriting history, which hooks can't do.
- Redesigning the delegation layer: dispatcher, folder agents, `dispatch-guard.sh`, and the model and effort choices.
- Fast mode.
- Model-backed hooks (`type: "prompt"`/`"agent"`), which spend tokens to save tokens.
- Running `/clear` or `/compact` itself. The tool recommends them, or holds one prompt.

## 2. What hooks can and cannot do here

Sources are code.claude.com/docs/en/…, fetched 2026-10-01. **P#** = Phase 0 probe.

| Capability | Verdict | Source |
|---|---|---|
| Replace a tool result | **Yes.** PostToolUse `updatedToolOutput` "works for all tools". A built-in tool's replacement must match its output shape (Bash: `stdout, stderr, interrupted, isImage`), or it is **silently ignored**. MCP output isn't validated. Unverified: Read/MCP shapes, and whether the transcript stores the original or the replacement (**P1**) | hooks#posttooluse-decision-control |
| Replace a *failed* result (Bash exit ≠0, except grep/find/diff/test/git diff exiting 1) | **No.** PostToolUseFailure only adds `additionalContext`. The only fix is a PreToolUse command rewrite | hooks#posttoolusefailure-decision-control; tools-reference#output-limits |
| Rewrite tool arguments | **Yes.** PreToolUse `updatedInput` replaces the whole input, and permissions judge the rewritten input. Behaviour with no `permissionDecision` is unverified (**P6**) | hooks#pretooluse-decision-control |
| Inject context | Through stdout or `additionalContext` on UserPromptSubmit or SessionStart. Capped at 10,000 chars per field; anything over becomes a file path plus a 2,000-char preview. Stays in history and is re-read on every request | hooks#json-output, #add-context-for-claude |
| Block a prompt | **Yes.** UserPromptSubmit `decision:"block"`: the prompt never reaches Claude, and `reason` goes to the user only. Prompt text is kept in the block message and history | hooks#userpromptsubmit-decision-control |
| Talk to the user only | `systemMessage` is "shown to the user"; whether Claude also sees it is unverified (**P4**). The status line costs **0 tokens** and gets `context_window.*` and `rate_limits.five_hour.used_percentage` | hooks#json-output; statusline#available-data |
| Compact, clear or delete | **No.** PreCompact can only block. PostCompact gets `compact_summary` but can't act on it. SessionStart with matcher `compact` can inject | hooks#precompact, #postcompact, #sessionstart |
| Work in subagents | Tool events fire there, with `agent_id`. SubagentStart can inject but gets no task text. InstructionsLoaded logs each loaded file | hooks#hook-locations, #subagentstart, #instructionsloaded |
| Fail open | Exit 1/127, timeouts and bad JSON are non-blocking. Only exit 2 or a valid deny/block blocks. So a missing hook script does **not** block, which contradicts CLAUDE.md's "copies, not symlinks" reasoning | hooks#other-exit-codes, #timeouts |
| Built-in caps | `bashOutputMaxChars` 4,000–128,000 (default 30,000; over it, a file plus a 2,000-char preview). `MAX_MCP_OUTPUT_TOKENS` default 25,000 (over it, a file path). `CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` default not documented | settings-reference#bashoutputmaxchars; mcp#mcp-output-limits; env-vars |
| Compaction threshold | `autoCompactWindow`, 100K–1M. On 1M-window models (Sonnet 5.5, Opus 4.7+) the default is about **967K** | model-config#set-the-auto-compact-window |

On macOS, Grep and Glob aren't default tools; searches arrive as Bash (tools-reference#glob-tool-behavior).

## 3. Where the tokens go

I ran read-only jq profiles over the four largest main transcripts (Sep 18–29) and their subagents. This is a preliminary sample, not the tokens audit. Weights follow API ratios: cache read 0.1, one-hour cache write 2, output 5. P9 calibrates them against the plan meter. (Those ratios are this sample's 2026-10-01 method; costs are now tokens at list price, the manifest's prices table, never multipliers: PLAN-routing-tree.md §24.)

1. **Carried context: 72–80% of weighted tokens.**
   - Sessions grow until compaction triggers at about 967K. Average context per request was 348–471K, peaking at 965K.
   - a0f9528a made 1,032 requests and read 454M tokens from cache. Its one compaction cut 967,576 tokens to 16,238.
   - Replaying the same growth under a lower compaction window cuts the summed context 3.0–4.1× at 200K, 2.1–3.1× at 300K and 1.8–2.8× at 400K.
   - The dispatcher pays this cost on every report it receives.
2. *Withdrawn 2026-10-19:* the share of cache rebuilds after idle gaps, measured here as a lever. The cache's state is not one (PLAN-routing-tree.md §24; §6 decision 3).
3. **Bulky tool results (inside #1).**
   - Results over 8,000 chars are at most 3–19% of cache reads, an upper bound that assumes spilled output is never re-read.
   - Worst MCP results: Gmail `search_threads` 30.6K chars, Drive `search_files` 40.7K, Dropbox `fetch` 36.7K, Chrome `read_page` 50.3K. Read results reached 57.8K.
   - Tool *arguments* outweigh tool results: 836K vs 637K chars in a0f9528a (Edit 406K, Write 195K). That makes compaction the main lever, not shrinking output.
4. **Subagent start.** Each spawn writes a 36–42K-token prefix. Within it: CLAUDE.md plus MEMORY about 30K chars, deferred tool names 12K, skill listing 10.6K, MCP instructions 7.4K.
5. **Output, including thinking: 5–6%.** Effort settings belong to the delegation layer.
6. **Always-on CLAUDE.md: about 1–2%** of the main session. Its share is larger per subagent spawn.

**Run first:** the tokens audit over 30 days of main and subagent transcripts, reporting:
- per session: requests, average and maximum context, cache reads and writes, output, weighted total;
- per tool: result chars and *carried* volume (chars × later requests in the same compaction segment);
- per `agent_type`: first-request prefix;
- the replay at 200K, 300K and 400K.

The ranking below holds only if this confirms #1. My research scripts (`profile`, `carry`, `compactsim`, `missscan`, `subagent` .jq) are in this session's scratchpad.

## 4. Components, ranked by saving per effort

**Home.** A new repo, `tools/context-hygiene/` (PLAN-tools-folder.md §3), built by `deep-work` and then given its own folder agent. One entry point, `hygiene.sh` (`check`, `test`, `audit`, `replay`, `index`, `rules`, `probe`), plus a `hygiene.json` config. Harness owns the settings lines. Ask harness to have `agents.sh tokens` and `hygiene.sh audit` share one transcript reader.

### C1. Settings bundle (no code)
- **Mechanism.**
  - `autoCompactWindow`: decision 1.
  - `promptSuggestionEnabled: false`: each suggestion is a request that reads the full context from cache.
  - `awaySummaryEnabled: false`: decision 7.
- **Injected:** 0.
- **Fail-open:** not applicable. To revert, remove the key.
- **Seam gate.** `check` asserts each key and value. The audit proves the setting is live: each compaction segment's peak context is at most the window plus the largest single-request growth.
- **Measure.** Average context per request and cache reads per prompt, 7 days before and after; requests per prompt may rise at most 15%.

### C2. Context monitor
- **Mechanism.** `statusline.sh` wraps any existing status line. It shows `ctx 212k/300k · 5h 38%` and writes those numbers to `$TMPDIR/hygiene/<session_id>.json`. At 70% of the window it adds "/compact <focus> at next break".
- **Withdrawn 2026-10-19** (PLAN-routing-tree.md §24; §6 decision 3): the status line's cache segment, and the prompt guard (`prompt-guard.sh`) that held a send after an idle gap. Neither is part of this plan; context-hygiene removes both with their tests (§24 step 2).
- **Injected:** 0.
- **Tests.** The status line's own, less the cache fields (§24 step 2).
- **Seam gate.** The status line is registered and executable, checked both ways against a manifest. The state file carries a schema version.

### C3. Post-compaction re-injection (ships with C1)
- **Mechanism.**
  - SessionStart with matcher `compact` runs `after-compact.sh`. It prints the last user prompt (up to 300 chars), files edited this session (up to 10 paths), and the repo's `TODO.md` path with an item count.
  - Nothing from the root CLAUDE.md is repeated, since Claude Code re-injects it after compaction.
  - Add a four-line "Compact instructions" section to CLAUDE.md, which the docs support for steering the summary.
  - A PostCompact hook logs how many of the last prompt's keywords survive in `compact_summary`.
- **Injected:** at most 1,500 chars per compaction, truncated per field.
- **Fail-open:** on any error, print nothing.
- **Tests.** Fixtures produce the expected block. Changing the last prompt changes the output. Output never exceeds the cap.
- **Measure.** Requests and Read calls in the 10 requests after each compaction, before and after.

### C4. Bulky output at the source
Three mechanisms, applied in order:
1. Set `bashOutputMaxChars: 8000` and lower `MAX_MCP_OUTPUT_TOKENS`, but only after P3 confirms how spilling behaves.
2. `shrink-output.sh` (PostToolUse) for named tools only: Gmail `search_threads`, Drive `search_files`, Dropbox `fetch`, Chrome `get_page_text`/`read_page`.
   - The full result goes to `$scratchpad_dir/spill/<tool_use_id>`.
   - Claude gets a structure-aware digest plus that path, for example one Gmail row per thread: id·date·from·subject.
   - Digest formats come from a Phase 0 census of keys and sizes, never values.
3. `spill-bash.sh` (PreToolUse), only for allowlisted noisy runners. It runs `( cmd ) >"$f" 2>&1; rc=$?; hygiene.sh digest "$f"; exit $rc`, so the exit code survives.

- **Injected:** a digest of at most 2,000 chars plus the path. It is never larger than the original; if it would be, the original passes through.
- **Fail-open.** An unknown shape, error or timeout produces no output, and the original passes. A built-in shape mismatch is ignored silently, so a shape-drift counter records it and `check` reports it.
- **Tests.** Different fixtures produce different digests. Error lines are always kept. `false` and `exit 3` keep their exit codes.
- **Measure.** Carried volume per tool, and the **spill re-read rate** (Reads of spill paths ÷ spills). Above 30%, loosen that cap: one extra request at a 300K context costs more than the bytes saved.

### C5. CLAUDE.md restructure and one source for shared rules
- **Mechanism.**
  - Cut the root CLAUDE.md to at most 150 lines: the dispatch table, the constraints that don't bend, one line per rule pointing to `docs/rules/<rule>.md`, the hooks table, and the compact instructions.
  - Move rationale stories into `<!-- -->` comments, which are stripped before injection, or into the rule docs.
  - Turn the parallelism rules into a `.claude/rules/` file scoped with `paths:`.
  - Write the shared short form (about 40 lines) once, in `shared-rules.md`. `hygiene.sh rules gen` writes it between markers into the five tool CLAUDE.md files, and each owner commits their own copy.
- **Injected:** this component only removes text.
- **Seam gate.** `rules check` fails on a block that differs from the generated one, missing markers, or a dead pointer.
- **Measure.** The `instructions` attachment size, the first-request prefix per agent type, and an InstructionsLoaded log per agent. P5: does a nested CLAUDE.md still load inside an `omitClaudeMd` agent?

### C6. Keyword recommender
- **Honest value.** The always-on text it could replace is only 1–2% of cost. The real lever is avoided round trips: each exploration call, and each call `prefer-recipes` or `no-inline-blobs` blocks, re-reads the whole context. It ships only if measurement shows that saving.
- **Index.** `index.tsv` (`id, keywords, pointer, source, sha`) is generated and read-only. A pointer over 100 chars fails the build. Sources:
  - `docs/rules/*.md`, via their `keywords:` line;
  - the agents manifest (dir → owner);
  - working recipes by host, via `./dev.sh known`, never raw SQL;
  - helper subcommands, from each helper's `usage()`;
  - memory topic files.
- **Mechanism.**
  - On UserPromptSubmit in the dispatcher, tokenize the prompt, stem lightly, and score IDF-weighted overlap.
  - Above the threshold, inject up to 3 pointers phrased as facts, such as "site-scrapers has a working recipe for linkedin.com: `./scrape.sh …`".
  - Skip slash commands, prompts under 4 words, pointers already sent this session, and targets the prompt already names.
  - Pointers reach the Opus agents through the dispatch prompt. Rewriting `Agent` prompts is decision 6.
- **Injected:** at most 350 chars per prompt and 15 pointers per session.
- **Fail-open.** If the index is stale (sha mismatch) or missing, inject nothing.
- **Tests.** A "linkedin" prompt gets that pointer; without the word, nothing. Editing the index changes the result. A stale index stays silent.
- **Seam gate.** `index check` compares sources and shas in both directions.
- **Measure.** An A/B on alternate sessions, switched by a flag file. Compare requests per prompt, exploration calls, blocked calls, injected chars, and **uptake**: whether a later tool call uses the pointed path or command. Turn it off if uptake is below 20% or requests don't fall.

## 5. Phased rollout

**Phase 0: probes and baseline.** Run the audit above. Each probe is one short `claude -p` run with a throwaway hook in a scratch project:
- **P1.** Replace `echo PROBE_ORIGINAL` with `PROBE_REPLACED`; Claude must quote the replacement. Repeat for Read and one MCP tool, then grep the transcript for the stored string.
- **P2.** `false` fires only PostToolUseFailure.
- **P3.** With `bashOutputMaxChars: 8000`, run `seq 1 20000` with and without `; exit 1`. Record inline size, preview, and what PostToolUse receives.
- **P4.** Send a sentinel `systemMessage`. Can Claude repeat it, and do input tokens move?
- **P5.** InstructionsLoaded logger (with `agent_id`) while an `omitClaudeMd` agent reads a `site-scrapers/` file.
- **P6.** `updatedInput` with and without `permissionDecision`; check `--debug-file` for `modified tool input keys`.
- **P7.** Which transcript entry stores hook `additionalContext`?
- **P8.** After a block, does ↑ recall the prompt?
- **P9.** Log `rate_limits.five_hour.used_percentage` for a week to fit the weights.

**Phase 1: C1 + C3.** Stop if weighted tokens per prompt fall less than 25%, if requests per prompt rise more than 15%, or if you log a post-compaction wrong answer that C3 doesn't fix.

**Phase 2: C2,** the context monitor.

**Phase 3: C4.** Apply step 1, then step 2 one tool at a time. Roll back a tool whose re-read rate exceeds 30%, or after any task fails for missing output.

**Phase 4: C5.** Roll back if hook blocks per session rise, a sign that adherence dropped.

**Phase 5: C6,** run as a two-week A/B and left off unless it wins.

At every phase: commit, run `hygiene.sh check`, measure with the audit, and record the result in TODO.md.

## 6. Open decisions for Jacob

1. **Compaction window: 200K, 300K or 400K?** The replay gives 3–4×, 2.1–3.1× or 1.8–2.8× less carried context. Hinges on how much detail loss you accept between natural breaks. **Decided: 200K, Jacob 2026-10-02** (TODO.md "Apply the auto-compact window"). It is applied: `.claude/settings.json` line 235 has `"autoCompactWindow": 200000`, which `wiring.json` requires. The fallback, if compactions prove lossy, is 300K. `statusline.window` is 200000, and context-hygiene's `files_window` gate checks that it equals every `autoCompactWindow` it can find (2026-10-08; its commit waits on the hooks re-render). Unconfirmed: that the key takes effect; the probe is `/autocompact`. Also unconfirmed (context-hygiene's agent, 2026-10-08): tools/context-hygiene has its own `.claude/settings.json` without `autoCompactWindow`. If Claude Code reads only the settings of the folder a session starts in, a session started there compacts at the default while its status line shows /200k. The probe: start a session in tools/context-hygiene and run `/context` or `/autocompact`. The same question applies to every tool folder with its own settings.
2. **User or project settings?** `~/.claude/settings.json` covers every session from one copy, with no site-scrapers duplicate, but sits outside git. Project settings belong to harness. Hinges on whether you start sessions inside tool folders.
3. **Guard: block, or status line only?** Blocking costs a resubmit; a warning relies on you noticing it. **Answered by Jacob, 2026-10-13: neither.** "We have gone over this more than once, cold cache doesn't matter." **Closed as withdrawn, 2026-10-19** (PLAN-routing-tree.md §24): the guard (`prompt-guard.sh`, C2) was never wired and leaves the tool with its tests; the status line shows context and the 5h window and nothing of the cache's state (dt-2 row 4, dt-3 row 1).
4. **One-hour subagent cache lifetime?** **Withdrawn, 2026-10-19** (PLAN-routing-tree.md §24): it chose a setting by the cache's state, which is not a design axis.
5. **claude.ai connectors per project?** Gmail, Drive, Dropbox and Todoist put about 7K chars of instructions, plus tool names, into every session and subagent. Hinges on whether only job-search sessions use them.
6. **Recommender reach:** dispatcher prompt only, or also rewriting `Agent` prompts? The second needs harness to accept a second PreToolUse writer on `Agent`.
7. **Prompt suggestions and session recap off?** Each adds model requests over the conversation. Hinges on whether you use them.

## 7. Risks: ways this could add tokens

- **Per-prompt injection.** Every injected char is re-read on every later request. Mitigated by the threshold, dedupe, caps and the A/B; the audit flags any session over 2K injected chars.
- **False-positive pointers** cause extra reads. Caught by the uptake metric; below 20% the recommender goes off.
- **Spill files read back.** One extra full-context request costs more than the bytes saved. Caught by the re-read gate; C1 ships first so extra requests are cheaper.
- **More compactions.** Each is a summarising request plus up to five file re-reads, and lossy summaries risk a plausible wrong answer. Covered by C3, the retention log and decision 1.
- **Silent disable or a hidden error.** A built-in tool's shape mismatch is ignored without any error. Covered by the drift counter, a P1 re-run after every Claude Code upgrade, and digests that always keep error lines.
- **Cache busts.** Changing MCP servers or plugins mid-session rebuilds the prefix once, so apply settings between sessions.
- **Two transcript parsers would drift,** so the audits share one reader.

## 8. Setup component

Split by component. C1 (settings), C2 (the context monitor) and C3 (re-injection) are
hooks, a status line and a settings proposal: they ship through setup's hooks component
(PLAN-repo-setup.md §2), and settings stay Jacob's. C5 (one source for shared rules) is
setup's rules component itself; PLAN-routing-tree.md §12 is its declared sync. C4 (bulky
output at the source) and C6 (the keyword recommender) are each tool's own helpers, or
the knowledge base's, and ship with their repos, not through setup. Content-agnostic:
the hooks read the transcript and a state file, never a repo path.

**§6 decision 2, answered by Jacob 2026-10-04 (planner window):** yes, "so long as this
is not done outside the context of both setup, hooks, and checks. We don't want to be
building reusable logic that is invisible to reuse." So user-scope wiring is a feature
of the three tools, never a hand edit: `hooks` emits the user-scope registration (one
`settings.proposed.json` for `~/.claude/`, pointing at `tools/hooks/source/` in place,
the path from the instance file of PLAN-portable-env.md §3.1); `checks`'s
`hooks-installed` counts a hook as installed when either the repo's settings or the
user-level settings register it, and says which; `setup`'s `hooks` component stops
copying into a repo that user scope already covers, and says so in its report. Order:
hooks, then checks, then setup; Jacob applies the one proposal. Until all three ship,
the per-repo copies stay and nothing is removed.
