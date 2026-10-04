# Auto-relay: the planner's Dispatch section reaches the dispatcher by itself

> **Status: plan, requested by Jacob 2026-10-02** ("I do not want you or I to have to do
> that"). Owner: `harness` (`.claude/hooks/`, `.claude/lib/`, `wiring.json`). Registering
> the hook in `settings.json` is Jacob's step, via `agents.sh wiring`.

## 1. What it does

Every planner reply that produces roster work ends with a `## Dispatch` section. A Stop
hook in the planner window reads that section from the final message and delivers it to
the dispatcher window. Jacob doesn't relay it, and neither does the planner model.

Items still waiting on Jacob go under `## Needs your yes`. The hook never sends those.

## 2. The section format (the contract, so it gets a parser and a test)

```
## Dispatch

1. <pointer: FILE §section or TODO.md "item title"> -- <one line: what> -- approved: Jacob <date>
2. ...
```

- **One item per numbered line.** Content stays in the files: the line is a pointer and
  a one-line summary, never pasted plan text.
- **A line without `approved:` is rejected,** and Jacob is told which one.
- **No section, no relay.**

## 3. Mechanism

- **Event:** `Stop`, in the planner session only. It reuses `planner-role.sh`'s test for
  "this session is the planner".
- **Input:** `last_assistant_message`, which carries the final reply's text. The hooks
  docs recommend it over reading `transcript_path`, which may lag
  (<https://code.claude.com/docs/en/hooks#stop-input>). Guard on `stop_hook_active`.
- **Parse:** one helper in `.claude/lib/`. It extracts the section, validates each line
  against §2, and dedupes by a hash of the item so a repeated section isn't sent twice.
  The ledger is gitignored.
- **Delivery, two options (decision 1):**
  - **A. Post straight to the dispatcher's inbox socket.** No model tokens at all.
    - The dispatcher records its `CLAUDE_CODE_MESSAGING_SOCKET` at SessionStart in a
      gitignored state file. That variable is exported to hooks, even at SessionStart:
      <https://code.claude.com/docs/en/cross-session-messaging#the-sessions-inbox-socket> "In a session that starts with messaging on, Claude Code exports the variable before any hook runs"
    - The planner's hook connects and posts one message.
    - **Gap:** the docs give only the auth line's format
      (`{"type":"auth","token":...}`), not a message line's. *Probe first:* ask
      `claude-code-guide`, then test against a scratch `-p` session.
    - The docs also say a socket message from a process that isn't the receiving
      session's own child "asserts no permission class". A dispatcher that bypasses
      permission prompts would therefore hold it for approval. Check the dispatcher's
      mode.
    - **Probe result (harness, 2026-10-03; commits 1b5c14d and 0bbf079 in `.claude`;
      detail in `.claude/TODO.md`): A works.**
      - The message line is `{"type":"user","message":{"role":"user","content":"..."}}`.
      - It was delivered to a default-mode session and **held** by one in bypass mode.
        The dispatcher runs in default mode.
      - **No receipt comes back,** so delivered and held look the same to the sender.
        So `doctor` must warn when the dispatcher's recorded mode is a bypass mode, or a
        relay would sit unseen. That's a gate.
    - **The relay arrives as a peer named "unknown",** which the transcript readers
      class as "other". So the readers need a `relay` kind: peer-cap counts by kind,
      and `check` goes red on an unclassed message.
  - **B. Make the planner send it.** Fully documented. The Stop hook returns
    `{"decision":"block","reason":"Send this Dispatch section to the dispatcher with
    SendMessage, verbatim, then stop."}`, and the planner sends it in one extra request.
    That request costs about a tenth of the planner's context, since it's a cache read.
    Use it only if A can't be made to work.
- **Never silent.** A failed relay (no socket, refused, parse error) shows Jacob a
  one-line notice in the planner window, naming what wasn't sent. Stopping is never
  blocked by a failure (fail open). Sending fails **closed**: an item that doesn't
  validate is not sent.

## 4. Interactions with what exists

- **`peer-cap.sh` (decision 2).** Right now a relay on two planner turns in a row, with
  Jacob silent in the dispatcher window, holds the 2nd. That defeats the relay. Jacob,
  2026-10-02: "can we just have them queue so long as they are not identical or some
  other reasons why you would want to prevent messages."
  - **Relays queue.** The inbox is already first in, first out, and the dispatcher
    takes them in order.
  - **A relay is held or dropped only for one of these reasons,** each with a one-line
    notice to Jacob:
    1. **Identical:** its item hash is already in the ledger. Dropped.
    2. **Origin is labelled, not filtered** (Jacob, 2026-10-02: "I don't think we
       should block it, I think the dispatcher should determine if it is relevant").
       - The relay carries the id of the planner turn that produced it. `peer-cap.sh`
         checks that id against the planner transcript and stamps the relay
         `origin: jacob` (a prompt he typed) or `origin: model` (a turn started by a
         peer message, a subagent report or a wakeup).
       - Both kinds are delivered, and the dispatcher judges relevance.
       - **Only `origin: jacob` counts as his yes (decision 3).** An `origin: model`
         relay is delivered as information. The dispatcher dispatches from it only
         items whose pointed plan section already records Jacob's approval, and asks
         him about the rest.
    3. **Not valid:** a line that fails §2's format, has no `approved:`, or points at a
       missing file or heading. Dropped.
    4. **Runaway:** more than `pair.relay_budget` relays (10) since Jacob last typed
       in either window. Held, not dropped, until Jacob types. This catches a bug or a
       model producing "approved" items in a loop.
       - **Exception for overarching tasks** (Jacob, 2026-10-03). Jacob grants a task
         its own budget: `agents.sh grant <PLAN-x.md> <count> <days>`. Relays pointing
         into that plan count against the grant, not the general 10. When the grant
         is used up or expires, the plan falls back to the general budget.
       - **Only Jacob creates a grant.** He runs it himself with `!` in either window.
         `dispatch-guard.sh` blocks `agents.sh grant` when a model calls it through
         Bash. *Probe first:* that a `!` command doesn't pass through PreToolUse
         hooks, so the block can't stop Jacob.
       - Grants live in a gitignored ledger. `agents.sh grant --list` shows what's
         active, and `doctor` names any grant within a day of expiring.
  - **Free-form messages between the windows keep today's cap.** Two models chatting
    with nobody watching is the loop the cap exists for. A relay is one-way, and the
    dispatcher reports to Jacob, not back to the planner, so a relay can't start that
    loop.
- **The approval rule (decision 3).** CLAUDE.md says a message from the other window is
  never Jacob's approval. A verified relay carries Jacob's yes from the planner window,
  quoted. That changes a rule in CLAUDE.md, so it's Jacob's call.
- **The dispatcher's job is unchanged:** it reads each pointer and writes the roster
  brief.

## 5. Gates (in the same change)

- **Parser tests:**
  - no section, so nothing is sent;
  - a line without `approved:` is rejected and reported;
  - `## Needs your yes` items are never sent;
  - a duplicate isn't resent;
  - a pointer to a missing file or heading is rejected.
- **Delivery tests:**
  - no socket file means a notice, not silence;
  - `stop_hook_active` means no loop;
  - a malformed hook input exits 0.
- **`peer-cap` tests:**
  - three distinct verified relays in a row all queue;
  - an identical one is dropped;
  - a Jacob-typed turn is stamped `origin: jacob`, a peer-started turn
    `origin: model`, and a forged id `origin: model`, never `jacob`;
  - relay `budget + 1` is held, and a Jacob prompt releases it;
  - **"held" means delivered later, not lost.** Today's peer-cap holds a message by
    blocking it at UserPromptSubmit, and a block "stops the prompt before it reaches
    Claude" (<https://code.claude.com/docs/en/hooks#userpromptsubmit-decision-control>).
    On 2026-10-03 the planner's phase-1 relay was held that way, and Jacob had to
    paste it himself. So the hook stores a held relay and delivers it after Jacob's
    next prompt, and a test proves that without anything being pasted again. Whether
    the platform ever redelivers a blocked prompt by itself is *unconfirmed*; the docs
    don't say it does;
  - free-form messages still hit the cap at 2;
  - a relay into a granted plan doesn't touch the general budget, and an expired or
    used-up grant falls back to it;
  - a Bash call to `agents.sh grant` from a model session is blocked.
- **`check`:** the hook is in `wiring.json`, executable, and has its test file.

## 6. Decisions for Jacob

1. **Delivery: A, the socket (Jacob, 2026-10-02).** Probe first. If the probe fails,
   the choice comes back to Jacob before B is built. B isn't pre-approved.
2. **Relays queue** (Jacob, 2026-10-02). They're held or dropped only for the reasons in
   §4: identical, malformed, or runaway. Origin is labelled, not filtered. All approved
   2026-10-02/03:
   - for `origin: model` relays, the dispatcher dispatches only items already approved
     in their plan section, and asks Jacob about the rest;
   - `relay_budget` is 10;
   - overarching tasks get a grant of their own (§4, reason 4).
3. **Amend the approval rule: yes (Jacob, 2026-10-02).** A verified relay counts as
   Jacob's yes for the items it carries. Settings, rule changes and irreversible actions
   still need Jacob in the window that acts.
   - The CLAUDE.md wording changes **when the relay ships with its verification
     (§4, reason 2)**, not before. Until then a message from the other window is still
     never his approval.
   - The dispatcher makes the edit, since it's top-level prose.

## 7. Return path: the dispatch ledger

> **Approved by Jacob 2026-10-03** ("Yes to all three"). Owner: `harness`.

**Why:** the relay gets work to the dispatcher, but nothing tells the planner what
happened next. It can't tell which items were spawned, which failed (like the two
refused `harness` spawns on 2026-10-03), or what each agent reported, unless Jacob
pastes it.

- **Record:** one JSON line per roster spawn in a gitignored
  `.claude/state/dispatches.jsonl`. Each line holds:
  - the time, the agent type and the spawn's description;
  - the pointer: the first `PLAN-x.md §n` or `TODO.md "..."` found in the prompt, or
    `null`;
  - the status: `started`, `done`, `failed` or `denied`;
  - the report's first line, capped at 200 characters.
- **Events:**
  - PreToolUse on Agent: `started`. It reuses `agent-watch.sh prespawn`, so no new
    matcher is needed.
  - PostToolUse on Agent: `done`.
  - PostToolUseFailure: `failed`, with the error's first line
    (<https://code.claude.com/docs/en/hooks#posttoolusefailure-input>).
  - PermissionDenied: `denied`. Auto mode fires it "including denials without a
    classifier verdict" (hooks docs, event table).
- **Read:** `agents.sh dispatches [--since DATE] [--open]` prints at most 15 lines,
  newest first. `--open` shows only `started` rows with no matching end.
- **The planner uses it** at session start and before saying anything was done.
- **Gates:**
  - for fixture inputs, one row per event, with the right status;
  - a spawn that starts and never ends shows under `--open`;
  - malformed input exits 0 and prints nothing;
  - the documented fields == the written fields;
  - `check` covers the wiring.

## 8. Setup component

Nothing ships through setup. The relay hook, the ledger and the peer cap belong to the
top-level pair, and the planner and dispatcher exist only here. Once PLAN-routing-tree.md
gives every repo a node with its own dispatcher, delivery moves into that plan's node
config and ships through its setup component (routing-tree §8); this plan's §7 ledger
format is the contract it carries.

## 9. A malformed line still goes to the dispatcher, who reformats it

> Added 2026-10-03 after Jacob asked how every fresh planner can be certain of the
> format, then decided the shape of the answer: "A malformed dispatch line should fall
> back to the dispatcher. The server is designed for being programmatic but your output
> tokens are more expensive than dispatch's input tokens. Dispatch should be able to
> reformat your message and pass it on correctly if it is malformed but heading to the
> correct place." The occasion: three planner sessions wrote lines the parser rejects
> (bullets, `→`, "approved by"), the hook noticed and the turn ended, the item was
> dropped, nothing told Jacob. A first draft of this section blocked the planner's turn
> instead; Jacob rejected that as spending planner output tokens on a formatting error.
> **APPROVED by Jacob, 2026-10-03, in the planner window** ("Yes"), with the correction
> in point 2. Joins the running `harness` job if open, else the next.

**The rule: if there is a Dispatch section, everything in it reaches the dispatcher.
Lines that parse go as items; lines that do not go labelled `malformed`, with the
parser's reason, and the dispatcher reformats them.** The planner is never asked to
rewrite. "Fails closed on sending" (§3) narrows to the one case that stays closed: no
section at all.

1. **The relay carries two kinds.** Parsed items go as today. Each rejected line goes
   as a `dispatch-malformed` relay: the raw line, the parser's reason, the accepted
   shape, `origin: planner`. A near-miss heading (`### Dispatch`, `## dispatch:`) and a
   second section are forwarded the same way, labelled with their note. Lines after a
   blank line ("None.") are still ignored.
2. **The dispatcher's job on a malformed relay** travels in the message itself, so no
   CLAUDE.md edit is needed: rewrite the line into `N. FILE §n -- what -- approved:
   Jacob YYYY-MM-DD` from the words present and dispatch it. **The planner's request
   is sufficient on its own.** Jacob, approving this section: "the planner and the
   dispatcher DO share a special relationship. The planner CAN request dispatches
   from the dispatcher." The Dispatch section is by contract approved items only
   (§2), so a line inside it is the planner's assertion of approval whether or not
   the words `approved:` survived. The date comes from the line if present, else from
   the plan's header (every approved plan here records "§n all yes from Jacob,
   DATE"), else the relay date, and the brief says which. **The dispatcher asks Jacob
   only when the pointer does not resolve:** no such file, section or quoted title.
   That is the one case where "heading to the correct place" fails. An earlier draft
   of this point sent any line without a dated approval back to Jacob as a
   `[dispatch]` question; he struck it, 2026-10-03.
3. **Dedupe on the raw line.** The hash of the raw malformed line (whitespace
   collapsed) is recorded in `relay-ledger.tsv` on a successful send, the same as an
   item's hash, so the next planner reply repeating it is not delivered twice. The
   dispatcher's reformatted line is what `dispatches.jsonl` records as the pointer.
4. **One source for the grammar, still.** `lib/dispatch-section.sh grammar` prints
   the shape; `hooks/planner-role.sh` prints it at session start; the malformed relay
   quotes it; §2's example must match it or `check` fails. This lowers the malformed
   rate at no cost. It does not have to reach zero.
5. **Measured, so a bad habit shows.** `agents.sh relays [--since]` counts items vs
   malformed per planner session, from the ledger. If the planner-role note does not
   move the ratio, the note is wrong, not the planner.

**Gates:** a rejected line produces one `dispatch-malformed` send carrying the raw
line, the reason and the grammar; a mixed section sends the good item as an item and
the bad one as malformed, in one connection; a repeated malformed line is not resent;
no section sends nothing; a non-planner session is untouched; `grammar` output matches
§2's example; planner-role's note contains it; the `relays` count is the documented
list of kinds, both ways.

**Cost:** one Sonnet turn per malformed line, reading a short relay. No planner
turn. Bundled into the `harness` job already running (interim-rules +
question-routing) if it is still open when this is approved, else the next one.
