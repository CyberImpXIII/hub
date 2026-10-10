# PLAN: usage reporting, so the hub can wind down before a limit, not after

> **Status: plan, requested by Jacob 2026-10-04 (planner window):** "Perhaps we can
> create a tool with hooks that has every active agent reporting its usage to the relay
> server and all agents reporting when they hit a rate limit. After hitting the rate
> limit a few times we should better be able to approximate when rate limits are
> approaching. This way, the relay server can pre-empt winding down."
>
> **Owner:** `deep-work` builds `tools/usage/` (a tool: it reads no roster). Jacob wires
> the status line and the hook registrations, because both live in `settings.json`.
> The hub consumes it in its own plan.

## 1. What the platform already gives, which changes the shape

The approximation Jacob describes is not needed, because the limit is readable directly:

- **The status line script receives the plan's windows as numbers.** For Pro and Max
  subscribers the status line input carries a `rate_limits` object with a rolling
  `five_hour` window and a weekly `seven_day` window, each with a `used_percentage`,
  present only after the first API response
  (https://code.claude.com/docs/en/statusline#rate-limit-usage). The windows are the
  account's, not the session's, so one reporting session is enough for all of them.
  Neither the project nor the user settings configure a status line today (both read
  `none`), so the reporter *is* the status line, and wiring it is Jacob's step.
- **A hit is a hook event.** `StopFailure` fires when a turn ends in an API error and
  carries `error: rate_limit` among its types; it has no decision control and exists
  for logging (https://code.claude.com/docs/en/hooks#stopfailure-input). That is the
  "report when they hit a rate limit" half, exactly, for every window and subagent that
  runs under the hooks.
- **Tokens per agent are in the transcript.** Every hook gets `transcript_path`, and
  `agents.sh tokens --agents` already sums `usage` blocks from transcripts. A
  `Stop`/`SubagentStop` hook can append the turn's delta per agent without a model.
- **Claude Code's own warnings are at 75% and 95%** of the most-consumed cap, behind a
  gateway (https://code.claude.com/docs/en/claude-apps-gateway-spend-limits#usage-warnings-in-claude-code).
  Those are the thresholds to start from.

So the hits become the **calibration**, not the estimator: each recorded hit is checked
against the last sample before it, and a hit that arrives below the hold threshold
means the threshold is wrong, which the tool reports.

**Unknowns the first sample settles** (recorded as suspicions until then):
- whether `rate_limits` distinguishes the separate weekly Fable limit, or reports one
  weekly number;
- what each window carries beyond `used_percentage` (the docs mention a reset time;
  the field name is taken from the first dump, not assumed);
- whether a cloud session, billed to credits, shows anything here (expected: no).

## 2. Shape: `tools/usage/`

Three small scripts that write, one CLI that reads, one JSON store under
`~/.claude/usage/` (outside every repo, never committed):

| piece | event | writes |
|---|---|---|
| `usage-statusline.sh` | the status line, every refresh | `limits.json` (latest) and one row in `samples.tsv`: time, 5h %, 7d %, the reset fields as received. Prints a one-line status so it can be Jacob's status line, or chains to an existing command given as its argument. |
| `usage-stop.sh` | `Stop`, `SubagentStop` | one row in `tokens.tsv`: time, session, agent type (from the hook input, a string, not a roster lookup), model, input, output, cache read, cache write, for the turn's delta since the last row for that transcript |
| `usage-failure.sh` | `StopFailure` with `error: rate_limit` | one row in `hits.tsv`: time, session, agent type, the last sample's percentages. Any other error type writes nothing. |

```
usage status                   latest 5h and 7d %, resets, time since the sample
usage burn [--window 5h|7d]    % per hour over the last N samples (default 12), and tokens per hour from tokens.tsv
usage project [--threshold P]  at the current burn, when each window reaches P (default: hold)
usage gate <tokens>            exit 0 if <tokens> fit before the window's reset under the burn so far;
                               exit 1 with "hold until <time>" otherwise. The hub's question.
usage hits [--since D]         rate-limit hits with the sample that preceded each; flags one below the hold threshold
usage tokens [--since D] [--by agent|model|session]   what agents.sh tokens shows, from the ledger instead of the transcripts
usage calibrate                proposes thresholds from the hits so far; never applies them
usage check                    the gates in §4
```

Thresholds live in `usage.json` beside the scripts: `warn: 75`, `hold: 90`, and
`sample_stale_minutes: 15` (a sample older than that makes `gate` answer "unknown,
hold", because a stale number is a wrong answer). `calibrate` prints a proposal; a
change to the file is a commit a person reads.

**Every script fails open:** malformed or absent input, a missing store, a full disk,
each exits 0 and writes nothing. A reporter that blocks a turn costs more than the
limit it watches.

## 3. The hub winds down on it

"Pre-empt winding down" is one rule in the hub, not a mode: **before starting a job, ask
`usage gate <estimate>`**, where the estimate is the per-agent figure the hub already has
(`tokens --agents`, or the plan's stated cost). Below `warn`, dispatch. Between `warn`
and `hold`, dispatch only jobs that checkpoint (the resumable check, PLAN-check-
progress.md §7; any job whose plan names a breakpoint) and say so in the brief. At
`hold`, or when `gate` says the job will not finish before the reset, queue it with the
hold time and tell Jacob once. Nothing running is interrupted; a running job's
checkpoint is what makes the cut survivable, which is why PLAN-check-progress.md comes
first in harness's queue. The planner and dispatcher windows show the same numbers in
their status line, so Jacob sees the wind-down coming without asking.

This is one question for the hub plan: PLAN-hub-brief.md §4 gains item 11, "the usage
gate: where in the routing path `usage gate` is asked, and what the queue holds while
it says hold", once Jacob approves below. The hub reads a tool, which keeps the tools
criterion intact.

## 4. Gates (in the same change)

| seam | gate |
|---|---|
| the status line script | fixture inputs with and without `rate_limits`: with, one sample row with the given numbers and the one-line output; without, no row, exit 0; chained command still runs and its output is kept |
| the stop hook's delta | a fixture transcript with three turns: three runs give three rows whose sums equal `agents.sh tokens` on the same file; a fourth run on an unchanged file writes nothing |
| the failure hook's filter | `error: rate_limit` appends a hit with the preceding sample; `error: overloaded` appends nothing |
| fails open | truncated JSON, no store directory, read-only store: exit 0, nothing written, for all three scripts |
| `project` and `gate` | fixture samples with a known slope: `project` gives the arithmetic answer; `gate` holds for a job larger than the room and passes a smaller one; a stale sample holds |
| thresholds are a vocabulary | every key in `usage.json` is read by the code, and every key the code reads is in the file |
| hits calibrate | a fixture hit below `hold` makes `hits` flag it and `calibrate` propose a lower `hold` |
| documented == implemented | the §2 list against the CLI, both ways |
| direction | no file in `tools/usage/` reads `.claude/` or names a roster agent |
| settings are Jacob's | the tool writes `settings.proposed.json` entries (status line, three hook registrations) through setup's component and never `settings.json`; a test asserts the latter is untouched |

## 5. Phases

1. **`deep-work`, one job:** the tool, `usage.json`, the gates, `./dev.sh check`,
   `TODO.md`, a repo via `setup --github`. ~120k tokens.
2. **Jacob:** wire the status line and the three hooks from the proposal. Zero tokens.
   The first sample answers the three unknowns in §1; the builder's TODO.md carries
   them until then.
3. **A week of samples**, then `usage calibrate` once, read by Jacob. Zero tokens
   beyond the hooks, which run no model.
4. **The hub's gate**, inside the hub plan's phases, after item 11 is answered. Its
   cost belongs to that plan.

Order among the tools: after `tools/checks/` (step 3 of PLAN-tools-folder.md §4), in
parallel with `todo`, before the hub's phase 2. It depends on nothing being built now,
and the hub depends on it only at phase 4.

## 6. Decisions

1. **Build `tools/usage/` as §2, deep-work, ~120k.** Hinges on: whether a reporter is
   worth a tool, or the status line percentages alone are enough for Jacob to wind down
   by hand. *Recommended: yes*; the point is a gate the hub can ask, not a number a
   person reads.
2. **Thresholds `warn: 75`, `hold: 90`, stale after 15 minutes.** Hinges on: Claude
   Code's own 75/95, or something tighter. *Recommended: yes*, with `calibrate` moving
   them from evidence.
3. **Add item 11, the usage gate, to PLAN-hub-brief.md §4** and relay it to the hub
   repo. Hinges on: whether the cloud session should plan around a tool that does not
   exist yet. *Recommended: yes*; the brief already fixes the hub to read tools, and
   the interface is one command with an exit code.

## 7. Setup component

`usage`: top-level only (`applies_to: roles:dispatcher,planner`, since the windows are
the account's); installs the three scripts' registrations and the status line into
`settings.proposed.json`, creates `~/.claude/usage/`, and reports `needs-jacob` until the
live settings carry them. No per-repo install.

## 8. Decisions answered (Jacob, 2026-10-05)

1. **Build `tools/usage/`: yes.** §5 phase 1, deep-work, in the order §5 gives.
2. **Thresholds `warn: 75`, `hold: 90`, stale after 15 minutes: yes**, moved only by
   `calibrate` from evidence.

## 9. Phase 1 built; §7 corrected (2026-10-05)

Deep-work built phase 1 (tools/usage, local commit ea3db4d, no origin yet: all ten §4
gates, 54 tests, `check --json` green). Two corrections from the build, relayed by the
dispatcher and verified:

- **§7 cannot hold as written.** Setup refuses a path that is not a repo, and the
  user-level settings file is not in any repo, so no setup component can write the
  registrations. The tool only *prints* them: `usage registrations` prints the status
  line and the three hook entries as JSON with absolute paths (this machine's, which is
  right for a user-level file and never enters the repo). Until they are in
  `~/.claude/settings.json` and `usage init` has run, the tool is inert and `gate`
  answers "unknown, hold". Who merges them is the open point: the live file is Jacob's
  and already has content, so a copy-over is wrong and a hand merge of nested JSON is
  the kind of step that goes wrong silently. Options: (a) Jacob merges by hand from the
  printed output; (b) `usage registrations --merge-into <file>` writes a merged copy
  *beside* the file (`<file>.proposed`), never the live one, with a check that the copy
  parses and keeps every key of the original, and Jacob copies it over. (b) is the
  `settings.proposed.json` pattern at user level. Planner: (b).
- **The GitHub repo** waits on Jacob (`setup ../usage --github`, public: the tool holds
  nothing of this instance; the absolute paths are in its output only).
- **Two suspicions in its TODO.md**, labelled as such with their probes: a subagent's
  last message may be missed when the transcript lags the Stop hook; the per-token
  percentage runs high while some usage is unrecorded. Phase 3's week of samples is
  the probe for the second.

**§9 decision: yes, as an export (Jacob, 2026-10-05).** "This would be effectively an
'export' feature, not a merge feature, as this would be a static copy." So the verb is
`usage registrations --export [<settings file>]` (default `~/.claude/settings.json`):
it reads the live file, adds the status line and the three hook entries, and writes
the result as a static copy beside it, `<file>.proposed`, never touching the live file.
It is declared in the tool's `cli.json` with the other verbs (PLAN-routing-tree.md
§14.8). Gates, same change: the copy parses; every key of the original is present and
unchanged in the copy; the registrations are present once, so a second export of an
already-registered file is byte-identical to the first (no duplicate hook entries); a
live file that fails to parse gives an error and no copy. Jacob's steps after it lands:
copy the proposal over the live file, then `usage init`. Builder: deep-work, until
harness adds the usage roster entry (its request is queued).
