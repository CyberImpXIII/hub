# Check progress: a long check says how far along it is

> **Status: plan, requested by Jacob 2026-10-03:** "For the very long test suites if we
> could have it either log or emit its status, so that if a dispatcher agent wants to
> know how much is complete, we don't have to guess".
>
> **Owners:**
> - `harness`: the writer, its copies' agreement check, and the reader `agents.sh
>   progress`;
> - each folder's agent: wiring the writer into its own `./dev.sh check`.

## 1. The problem

A check prints its result only at the end. Partway through, the dispatcher has three
choices, and each one is bad:
- wait;
- read the raw output, which costs tokens and is often hidden inside a subagent's Bash
  call;
- guess.

`site-scrapers`' `./dev.sh check` (27 test files, then the audit, the hook layer and
the working tree) already takes a lock holding its pid. Nothing records how far along
it is.

## 2. The contract: one small status file per run

Every `./dev.sh check` (and `agents.sh check`) keeps `<repo>/.progress/check.json` up to
date. The file is gitignored, written to a temp file and renamed, so a reader never
sees half of it:

| field | holds |
|---|---|
| `cmd` | `check` |
| `pid` | the run's pid |
| `started`, `updated` | ISO times |
| `step`, `total` | `14`, `27`. `total` is counted before the first step (test files plus fixed stages) |
| `label` | the current step, e.g. `suite: guard.test.js` |
| `passed`, `failed` | counts so far |
| `failed_names` | up to 5 |
| `state` | `running`, `passed` or `failed` |
| `last_duration_s` | how long the previous complete run took, for a rough time left |

Names and counts only. A test's output never goes into the file.

## 3. Writer and reader

- **Writer:** `progress.sh`, about 20 lines of shell, with three calls:
  - `progress_start <total>`;
  - `progress_step <label> <pass|fail>`;
  - `progress_end <state>`.

  **It never changes the check's result.** A failure to write is ignored, and the
  check exits exactly as it would without the writer.
- **Where the writer lives:** canonical in `.claude/lib/progress.sh`, with a copy in
  each tool repo so it travels with a clone (the same reason the hooks are copied).
- **Reader:** `agents.sh progress [repo]`, at the top level. It prints one line per
  repo with a running or recent check, for example:

  ```
  site-scrapers  check  14/27  suite: guard.test.js  1 failed (compose.test.js)  3m12s, ~2m left
  ```

  - A `running` state whose pid no longer exists prints **`DIED at 14/27`**, never
    `running`.
  - Each repo also gets `./dev.sh status`, printing the same line for itself.
- **Who reads it:** the dispatcher, when asked how far along something is. It's
  cheaper than reading the run's output, and it works when the check is running inside
  a subagent.

## 4. Gates (in the same change)

| seam | gate |
|---|---|
| the writer doesn't change outcomes | the same fixture check, run with the progress directory writable and read-only, gives the same exit code and output |
| documented == implemented | in a fixture run, the final `step` equals `total`, and every documented field is written and no other |
| a run that dies is visible | kill a fixture check mid-run: the reader prints `DIED at k/N`, never `running` |
| copies agree | `agents.sh check` compares every repo's `progress.sh` with the canonical one |
| every check writes it | `doctor` flags a repo with a `dev.sh check` that has no `.progress/check.json` after a run |
| no output in the file | a schema check: only the declared fields, and `failed_names` holds names only |
| the reader stays small | one line per repo; a test caps it |

## 5. Phases

1. **`harness`:**
   - `progress.sh` and `agents.sh progress`;
   - `agents.sh check` reporting its own progress;
   - the gates in §4.
2. **`site-scrapers`:** wire it into `./dev.sh check`, per test file. This is the long
   one.
3. **The other folders** (`knowledge-base`, `scripts`, `data-bridge`,
   `chronjobScheduler`, `emailTools`, and `applications` once it exists): each agent
   wires its own `check`.

## 6. Decision for Jacob

1. **All repos, not only the long ones.** One contract keeps the reader simple, and a
   short check costs nothing to report. *Recommended: yes.*
2. **A resumed pass counts as the pre-commit gate** when its fingerprint matches (§7).
   It ran the same steps on the same inputs. *Recommended: yes.* The alternative is that
   only a full run gates a commit, and resume is just for getting answers sooner.

> **Queued for harness first, 2026-10-04 (Jacob, planner window):** "Can we queue up
> the partial testing and picking up where we left off for the harness before we move
> to the next step? I feel like we've encountered a bunch of issues by the tests
> getting caught in our session usage limits and then having to redo them." So §5
> phase 1 plus §7 for harness's own check go into harness's queue right after the
> Fable job and before the `hub` roster entry. The suite that keeps being cut is
> `test-agents.sh` (20–35 minutes, a full `check` per fixture case; `check --quick`
> skips it): its breakpoints are the fixture cases, each one independent by
> construction, so a run cut at case k resumes at k+1 on the same tree and a
> commit's gate is the first run that reaches the end without a tree change in
> between. Evidence of the cost: 2026-10-03 the harness job reported "the check is
> still running in the background" twice, and a second `check` was started beside
> it; neither result was recorded as a pass. §6's two decisions are in the planner's
> table of 2026-10-04; the build proceeds under their recommendations unless Jacob
> answers otherwise.

## 7. Resume from a breakpoint

> Jacob, 2026-10-03: "Tests should also be able to pick up partway through the suite if
> we know that it made enough progress to get to a necessary breakpoint."

**The risk this has to rule out:** a resumed run skips steps that passed **on a
different tree**, and reports a pass the code never earned. That's a wrong answer, which
is worse than a slow one. So a resume is allowed only when the skipped steps provably
ran against exactly what is on disk now.

- **Breakpoints are declared, not assumed.** Each repo lists its safe boundaries in a
  `check.breakpoints` file: points where nothing carries over from earlier steps (no
  shared fixture rows, no temp files, no started servers).
  - `site-scrapers`' suite shares one `data/scrapers.db`, so a boundary is safe only
    where every earlier file has cleaned up its fixtures.
  - A boundary that isn't listed is never resumed from.
- **A fingerprint guards each checkpoint.** At every breakpoint the status file records:
  - the steps passed so far;
  - a fingerprint of the inputs:
    - `HEAD`;
    - a hash of the uncommitted diff;
    - a hash of untracked, non-ignored files;
    - the runtime versions and the lockfile.
- **`./dev.sh check --resume`:**
  - starts at the last breakpoint whose fingerprint matches what's on disk now;
  - otherwise runs the whole suite and says why: "tree changed since 14/27";
  - its output and status file always say `resumed from 14/27 (13 steps passed at
    <time>, same tree)`, so a resumed result is never mistaken for a full one;
  - **an explicit flag, never the default.** `agents.sh progress` suggests the command
    when a resumable checkpoint exists.
- **Failures run first.** A step that failed last time is re-run before the steps after
  it.
- **Checkpoints expire** after 24 hours, and on any new commit.

### Gates for §7

| seam | gate |
|---|---|
| a breakpoint really is independent | for every declared breakpoint: `--resume` from it on a fixture tree gives the same verdicts as the full run (the counterfactual) |
| a changed tree never resumes | edit one tracked file, one untracked file, or a runtime version after a checkpoint: `--resume` runs from scratch and names the reason |
| an undeclared boundary is never used | a fixture whose run died between breakpoints resumes from the previous declared one |
| resumed is labelled | the output and the status file carry `resumed from k/N`; a test requires both |
| expiry | a checkpoint past 24 hours, or behind a new commit, isn't used |

### When
After §5 phase 2, in the same `site-scrapers` job if its breakpoints can be proven
there. That job's report says which boundaries it proved independent and which it
couldn't.

## 8. Setup component

Setup installs the writer, not the wiring. `progress.sh` goes in through the hooks/lib
component (PLAN-repo-setup.md §2), with `.progress/` added to the repo's gitignore;
drift is a repo whose check command runs with no writer present. Wiring the writer into
each repo's check (§5, phases 2 and 3) stays with that repo's agent, because only it
knows the repo's steps. Content-agnostic: the file format (§2) names steps and counts,
never a repo or a command.
