# Inputs for PLAN-hub-brief.md and for the review's fix pass

Copies from the top of the claudeTest folder, which is not a git repo. They are
snapshots: the originals keep changing, these do not until someone refreshes them.

- **First taken 2026-10-04** for the cloud session that wrote `PLAN-hub.md`: the
  brief (`../../PLAN-hub-brief.md`, at the repo root) and its §2 inputs.
  `PLAN-hub.md` was written from that snapshot; it is commit 842d00b here.
- **Refreshed 2026-10-04 (evening)** for the fix pass that PLAN-hub-review.md §4a
  sends back to the cloud: every copy replaced by its original, and the three plans
  the review builds on and the brief does not list were added (`read by: review`
  below). Seven copies had drifted: the brief (it gained "§6. Setup component"),
  `claudeTest-CLAUDE.md`, `PLAN-cloud-offload.md` (it gained §8, which the review's
  finding 8 cites), `PLAN-question-routing.md`, `PLAN-todo-tool.md`,
  `PLAN-tools-folder.md` and `PLAN-portable-env.md`.
- **Refreshed 2026-10-04 (night)** for brief fixed point 9: `PLAN-routing-tree.md`
  gained §13 (read-only roles, server-run writes, failures as routed messages;
  decision 31 yes) and §14 (open, decisions 36–38); the brief gained fixed point 9
  and its §2 row now says §13 is decided. `PLAN-hard-gates.md` had also drifted (a
  "Not its own project" paragraph) and came along, as every refresh copies all.
  The brief is edited at its original, the top-level `PLAN-hub-brief.md`, because
  `./dev.sh refresh` copies the original over this repo's copy.
- **Refreshed 2026-10-05** for brief fixed point 10: Jacob decided routing-tree §14
  (decisions 36-38 and §14.8: one server with four services, an owner per seam kind,
  services declared as data). The brief's fixed point 9 now points at fixed point 10
  for owners, fixed point 10 is new, its §2 row says §11-§14 are decided, and it reads
  `PLAN-repo-setup.md` §7.8 too. `PLAN-agent-groups.md` (§10) and
  `PLAN-repo-setup.md` (§7) had also drifted and came along.
- **Refreshed 2026-10-05 (later)** for the planner's settlement of §14.6:
  `PLAN-routing-tree.md` §14.6 now makes the registry the server's one input, with
  harness's `gen` rendering the manifest's `servers.<group>` entry (port, keep-alive)
  into it, so brief fixed point 2 stands; §14.7's worked example no longer reports a
  duplicate item 9. The brief's fixed point 10 (and §4 item 2) were edited at the
  top-level original to match and lose their "Not fixed" paragraph. Nothing else drifted.

**One rename.** The brief's row "`CLAUDE.md` (top level)" means claudeTest's own
`CLAUDE.md`, copied here as `claudeTest-CLAUDE.md`. It is not this repo's
`CLAUDE.md`. It was renamed because Claude Code loads a `CLAUDE.md` in a
subdirectory as project instructions when it reads files there
(<https://code.claude.com/docs/en/large-codebases#choose-where-to-start-claude>),
and that file is claudeTest's instructions to its dispatcher, not to this repo.
`./dev.sh check` fails if any `CLAUDE.md` is stored under `docs/`.

**Checked by `./dev.sh check`:** every copy matches its line in `SHA256SUMS`; this
table, `SHA256SUMS` and the files in this folder list the same copies; every file the
brief's §2 names has a row here. By hand: `shasum -a 256 -c docs/inputs/SHA256SUMS`
from the repo root. `./dev.sh drift` compares each copy with its original (only where
the originals are reachable, not in a clone), and `./dev.sh refresh` copies them all
again, running the leak audit on the originals first and refusing on any finding.

| copy | original (claudeTest top level) | read by |
|---|---|---|
| `../../PLAN-hub-brief.md` | `PLAN-hub-brief.md` | brief |
| `claudeTest-CLAUDE.md` | `CLAUDE.md` | brief §2 |
| `PLAN-routing-tree.md` | `PLAN-routing-tree.md` | brief §2 |
| `PLAN-tools-folder.md` | `PLAN-tools-folder.md` | brief §2 |
| `PLAN-auto-relay.md` | `PLAN-auto-relay.md` | brief §2 |
| `PLAN-question-routing.md` | `PLAN-question-routing.md` | brief §2 |
| `PLAN-group-servers.md` | `PLAN-group-servers.md` | brief §2 |
| `PLAN-agent-groups.md` | `PLAN-agent-groups.md` | brief §2 |
| `PLAN-todo-tool.md` | `PLAN-todo-tool.md` | brief §2 |
| `PLAN-interim-rules.md` | `PLAN-interim-rules.md` | brief §2 |
| `PLAN-cloud-offload.md` | `PLAN-cloud-offload.md` | brief §2; review §3 finding 8 (§3, §8) |
| `PLAN-repo-setup.md` | `PLAN-repo-setup.md` | brief §2 |
| `PLAN-portable-env.md` | `PLAN-portable-env.md` | brief §2 |
| `PLAN-usage-reporting.md` | `PLAN-usage-reporting.md` | review §3 finding 3 (§3: the usage gate admission asks) |
| `PLAN-hard-gates.md` | `PLAN-hard-gates.md` | review §3 finding 4 (§2: the `Agent:` commit stamp) |
| `PLAN-check-progress.md` | `PLAN-check-progress.md` | review §3 finding 5 (§7: why H1a splits) |

## What the fix pass needs, and where each piece is

The fix pass is PLAN-hub-review.md §4a's prompt, run on branch `plan/hub`. Item by
item:

| the prompt asks | it reads |
|---|---|
| read the review first | `docs/REVIEW-2026-10-04.md` on `plan/hub` (a copy of the top-level `PLAN-hub-review.md`, byte-identical on 2026-10-04) |
| 1. citations as `"quote" (url#anchor)` | the review's §2 table, which lists the anchors. `kb check` and its docs mirror live in the knowledge-base repo, which is private and local: the cloud cannot run it. The planner runs it on the result (review §4 step 4) |
| 2. findings 1-6 and 8 | `PLAN-hub.md` on `plan/hub`; `PLAN-usage-reporting.md` §3, `PLAN-hard-gates.md` §2, `PLAN-check-progress.md` §7, `PLAN-cloud-offload.md` §3 and §8, all here |
| 3. §11 into `PLAN-hub-view.md` | `PLAN-hub.md` §11, and Jacob's message about the view, which is **not** an input anywhere: it exists only in the cloud session's own transcript (review §1, deviation 2). A fresh session would not have it |
| 4. a TODO.md item per cloud phase | `PLAN-hub.md` §9 |

**These copies are on `main`; the fix pass works on `plan/hub`,** which was branched
before they were added. Read them there with `git fetch origin main` and then
`git show origin/main:docs/inputs/<file>`, or have `main` merged into `plan/hub`
first. Never copied, on purpose: anything from `.claude/` (PLAN-cloud-offload.md §8's
predicate), and the plans `PLAN-hub.md` names as open pointers (`PLAN-context-hygiene.md`,
`PLAN-knowledge-base.md`, `PLAN-applications.md`), which the fix pass does not need.
