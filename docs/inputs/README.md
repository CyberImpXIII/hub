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
- **The brief alone re-copied 2026-10-08** for §4 question 11 (a session the hub runs,
  from PLAN-context-hygiene.md §0 "Later"; §5 now says eleven questions). Edited at the
  top-level original, copied over by hand, and only its `SHA256SUMS` line rewritten.
  Not a refresh: seven other copies had drifted and were left as they were, since
  refreshing them is a decision (TODO.md).
- **`PLAN-routing-tree.md` and the brief re-copied 2026-10-19** for routing-tree §15,
  the roster settings page (Jacob, 2026-10-19; owner hub), so `PLAN-hub.md` plans it.
  The brief's §2 row now says §11-§15 are decided and names the page; it was edited at
  the top-level original, and the re-copy also brings in the brief's §4 questions
  12-14 (added at the original 2026-10-12). Done with `./dev.sh refresh
  PLAN-routing-tree.md PLAN-hub-brief.md`, which copies only the named ones (leak
  audit first) and leaves every other `SHA256SUMS` line as it was. Not a full
  refresh: eight other copies had drifted and stay as they were (TODO.md).
- **`PLAN-routing-tree.md` alone re-copied 2026-10-19 (later)** for routing-tree §19
  step 2: the original gained §16 (Fable 5.1 at max where allowed), §17 (read and run
  dispatches share a folder), §18 (the audit agent) and §19 (replies are records, with
  the hub's inbox view). Done with `./dev.sh refresh PLAN-routing-tree.md`; only its
  `SHA256SUMS` line changed. The brief is not re-copied: adding the settings view
  (§15) and the inbox view (§19) to its §4 list is an edit at the top-level original,
  which the planner owns, so it was requested (TODO.md "Brief §4: the settings and
  inbox views"); re-copy it with `./dev.sh refresh PLAN-hub-brief.md` once made.
- **`PLAN-routing-tree.md` and the brief re-copied 2026-10-19 (13:22)** for tl-379
  (relay line 121, Jacob): the brief was edited at the top-level original by hub's agent
  on that relay. Its §2 row now runs to routing-tree §16-§21 (§17 pending dt-5 row 4, §20
  pending dt-5 row 5, §22-§23 pending rows 7-9), §3 gained fixed point 11 (§21's
  objective), and §4 gained question 15 (the roster settings page, §15) and question 16
  (the inbox view of replies, §19). The routing-tree copy brings in the original's
  §20-§23 and its 12:44 edit (§10.1, §16 step 4, §17.1). Done with `./dev.sh refresh
  PLAN-routing-tree.md PLAN-hub-brief.md`; the other copies keep their sums and their
  drift (TODO.md hb-5).
- **Refreshed in full 2026-10-19 (later)** for tl-406 (relay lines 118, 27 and 53,
  Jacob; routing-tree §10.1 D1 and §10.3 step 1): every copy replaced by its original
  with `./dev.sh refresh` (leak audit first), and `PLAN-context-hygiene.md` became a
  brief §2 input and a copy here (§0: the launcher, its rebuild guards, the `ctx:`
  store, and the session a program runs). The brief's §2 table gained its row and
  question 11 no longer says it is not an input; edited at the top-level original.
  Routing-tree §20 is still marked pending dt-5 row 5 in the brief. **`PLAN-services.md`
  is not copied yet:** the leak audit refused its original (one home-folder path, its
  line 74), so it waits for its owner, the planner, to fix that line (TODO.md).
- **Refreshed in full again 2026-10-19 (evening)**, still tl-406: the planner made
  `PLAN-services.md` line 74 a relative path, the leak audit passed on it, and it
  became a brief §2 input and a copy here (§1, §3's rules on ids and tags, gated
  read-only stores and static or dynamic stores, §4 step 10), its row edited at the
  top-level original. Seven copies had drifted since the first refresh and were
  re-copied with it (`./dev.sh refresh`).

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

**The copies are mode 0444** (no write bit), set by `./dev.sh refresh` as it writes
them and by `./dev.sh seal`; `./dev.sh check` fails (`sealed`) on a writable one.
That mode is a marker, not a guard: it stops a plain `cp` or `>` over a copy, but
Edit, Write, `sed -i` and `mv` replace a 0444 file and leave it 0444. The guard is
the `SHA256SUMS` check above. Git does not keep the mode, so a clone, or a checkout
that rewrites a copy, leaves it 0644: run `./dev.sh seal` then.

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
| `PLAN-context-hygiene.md` | `PLAN-context-hygiene.md` | brief §2 (since 2026-10-19) |
| `PLAN-services.md` | `PLAN-services.md` | brief §2 (since 2026-10-19, evening) |
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
predicate), and the plans `PLAN-hub.md` names as open pointers (`PLAN-knowledge-base.md`,
`PLAN-applications.md`), which the fix pass does not need. `PLAN-context-hygiene.md`
was one of those until 2026-10-19, when it became a brief §2 input.
