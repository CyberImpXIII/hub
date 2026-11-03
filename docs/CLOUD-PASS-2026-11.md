# Cloud pass 2026-11-03: PLAN-hub.md §4, §7, §9; H1a-0b, H1a-1, H1a-2

> **The pass** PLAN-routing-tree.md §10.4 step 5 names, approved by Jacob (PLAN-hub.md
> Decision 9; his `credits` answer of 2026-10-19, tl-398). Run from a lone clone of this
> repo in a cloud session (no `../tools`, no workspace around it), on branch
> `cloud/pass-2026-11` from `main` at f2917ae, in two sittings on 2026-11-03. Scope as
> Jacob gave it: first, the plan's §4, §7 and §9 re-cost from the brief's answers, then
> H1a-0b (TODO.md hb-36); then, continuing, H1a-1 (hb-37) and H1a-2 (hb-38) as PLAN-hub.md
> §9 orders, each to its done-when with offline tests, one commit per phase, the hub's
> part only (the harness and setup halves stay local). No browser, Gmail, crontab or
> `.claude/` directory was touched (the lone clone's `./dev.sh seal` set the input
> copies' mode, which git does not track; nothing under `.claude/` was written but the
> check's own gitignored state).

## 1. What was done

| commit | what | check |
|---|---|---|
| b21beca | **Step 1.** PLAN-hub.md §4 "Roles and modes" rewritten from routing-tree §20 `hybrid`, §17 `declare` and §24: a role is declared by `mode` (`window` \| `process` \| `driven`) and `lifetime` (`per-task`, or `kept` for a repo's coding role); the kept role's health check, restart rule and request budget (`limits.role_silence_s`, `limits.role_daily_budget`, under Decision 4's condition); the order roles are routed in; the request's `mode: write\|run\|read` and `uses: browser`; one page line per role and a transcript tab on demand; probes P-R1 and P-R2. §7 from question 7 `session-start`: `init.sh` is the one keep-alive, `hub up` counts its restarts in the ledger (`hub status --restarts`), `launchd` waits for the bundled-application stage, Decision 5's server-list request to cron-scheduler drops. §9 from question 4 `credits`: $150 the balance to plan against, H1a-0b on the credits, a re-cost that adds no phase (total 1.7–2.6M, cloud share ~1.25–1.8M, H1a-0 spent). §8 gained a "roles and lifetimes" row; Decisions 1, 4, 5, 7 and 9 record the answers. The temperature axis left every live file in this repo (§24): the hub-started mode is `process` in the plan and in H1a-0's code | 6 of 10 passed, 4 UNCHECKED (§2); hubtests 36 passed, 2 unchecked |
| e68e473 | **H1a-0b, the read route.** `POST /read-request` (`src/read.js`), `hub hook gate`'s store-read classification from disk (`src/classify.js`), the hook failing closed for store reads as for writes, `hub.json` `stores` in the shape and in `hub check`, a ledger row per answer. `tests/hub/read-route.test.js` holds every §8 "read route" clause and hb-36's done-when (§3 below) | 6 of 10 passed, 4 UNCHECKED; hubtests 50 passed, 2 unchecked |
| c92a62c | this report's first version; the plan says H1a-0b is built | as above |
| ab21ffa | **H1a-1, the program with no routing yet.** `hub.schema.json` is `hub.json`'s shape (a draft-07 subset read by `src/schema.js`, a validator of its own, no package; an unknown keyword throws), every enum a `src/vocab.js` list, held equal both ways; `hub check` runs the schema then the rules the shape cannot say (the workspace rules and derived names, a process role's `lifetime` required, every `stores` prefix a repos key, every tag resolving and every repo-declared tag routed, every seam kind owned or the `unowned` default, on disk: role dirs and repos directories exist, each repos cli executable, `rendered_from.source` exists). **The §2 example registry passes `hub check`**, read from PLAN-hub.md by the test itself (it gained repos rows for `context-hygiene` and `todo`, which its `stores` map named and nothing declared). `hub init` writes `hub.starter.json` (data, so the no-names audit keeps role names out of `src/`); `GET /routes` and `hub routes`; `hub up` restores held and dead-letter state from `.hub/` and never truncates the ledger; a start over a stale pidfile writes a `restart` row and `hub status --restarts` counts them (§7). `tests/hub/registry.test.js`, `tests/hub/state.test.js` | 6 of 10 passed, 4 UNCHECKED; hubtests 57 passed, 2 unchecked |
| 7fb2819 | **H1a-2, the relay through the server.** `POST /route` (`src/relay.js`) in routing-tree §14.3's order with no model: validate (`src/envelope.js`), identical dropped, hops, origin stamped by the server (`src/origin.js`; a forged `origin` is discarded before it is read; `origin_id` and the record's stub travel, never its text; a pasted body is flagged), the decision by routing-tree §3's four rules (`src/route.js`, pure over registry and envelope), the usage gate before a spawn, the budget since Jacob last typed, delivery to a window's recorded socket or a queue (`src/deliver.js`), a failure as a `delivery` message to the owners row, one ledger row per decision with the registry hash. `/sessions`, `/sessions/:id/prompts`, `/ledger`, `/held`, `/dead-letter`, `/limits`; `hub send\|log\|grammar\|origin\|get\|limits`; the hooks `planner-stop`, `dispatcher-stop`, `session-start`, `user-prompt`, each failing open and doing today's work directly with the server down. `tests/hub/relay.test.js`, `hooks.test.js`, `section.test.js` | 6 of 10 passed, 4 UNCHECKED; hubtests 76 passed, 2 unchecked |
| this commit | this report; PLAN-hub.md's header and §9 rows say H1a-1 and H1a-2 are built | as above |

## 2. What the check could not run here (named, not counted as passed)

`./dev.sh check` on each commit: **6 of 10 parts passed, 4 UNCHECKED**, exit 0 with
"the pass was not recorded" (the runner records a pass only when every part passed, so
no `check:` trailer was written and the commits carry none). The UNCHECKED parts, each
because a sibling tool is absent in a lone clone:

| part | why unchecked | what runs it |
|---|---|---|
| `hooktests` | `test-prefer-recipes.sh` and `test-troubleshooting.sh` read site-scrapers beside the repo (10 of 12 hook test files passed) | `./dev.sh check` in the workspace |
| `hubtests` | two of the program's tests skip `UNCHECKED`: the classifier's parity with tools/hooks' shared write-target parser, and the no-names audit's workspace-folder half (76 of 78 passed) | the same |
| `plans` | `../setup/setup plans .` | the same |
| `checks` | `../checks/checks run . --json` (todo-valid, no-secrets, hooks-installed, rules-in-sync, help, ...) | the same |

Run once locally on `cloud/pass-2026-11` before the merge: `./dev.sh check`. Things it
will say that this clone could not: whether `checks`' `banned-terms` gate (routing-tree
§24 step 5), if it exists by then, passes on the rewritten plan and view (the grep for
`cold|warm|temperature|prompt_cache|cache ttl|cache-warm|hot cache` over the live files
is empty here); whether `todo-valid` accepts the store untouched (this pass changed
nothing in `todo.json`); and the no-names audit's workspace half over the eleven new
`src/` modules (it passed its direction and script-name halves here).

Not run here, by design: `kb check` on PLAN-hub.md (the planner's, brief §5; this pass
added no new platform claim or URL, it moved existing cited text and cited §11 for
`--input-format stream-json`); `./dev.sh drift` (the originals are on Jacob's machine).

## 3. The done-whens, clause by clause

**hb-36 (H1a-0b)**, `tests/hub/read-route.test.js`: a declared-prefix id and a path the
fixture `stores.json` lists are answered with the store's `get` (the row names the store
and its `get` verb, or says `declares no get yet`); a Read of an owned non-store path and
of an unowned path is plain Read with no server call and no row; with the server killed
a declared-prefix read and a Read of a listed store path are denied with the `hub status`
line and a Read of an unlisted path is allowed; with `stores.json` removed every Read of
a path is plain and `hub status` reports the file missing; every answer is one ledger
row. In H1a-0b the server names the `get` and never runs it (`hub get` is now H1a-2's for
`ctx:` ids, R1's for the rest).

**hb-37 (H1a-1)**, `tests/hub/registry.test.js`, `state.test.js`, `server.test.js`:
`hub init` writes a starter that passes `hub check`; the §2 example registry passes `hub
check` with no child registered, `limits` and `stores` included (the test creates the
files the example names); a mode or lifetime value that is not a declared word fails `hub
check` (the test plants `kept` as a mode and `process` as a lifetime); `hub up` binds,
writes `.hub/server.json`, answers `/health` and `/status` with the token and refuses
without it; `hub status --json` reports `{"up": false}` within one second after a kill
and `hub up` restores held, dead-letter and ledger state from `.hub/`; `hub --help` lists
exactly the subcommands and `docs/API.md` exactly the served routes, both ways; nothing
under the tool reads `.claude/` or names a repo, path or command (the two audits run in
`./dev.sh check`; the workspace half is UNCHECKED here, §2).

**hb-38 (H1a-2)**, `tests/hub/relay.test.js`, `hooks.test.js`, `section.test.js`:
`/route` stamps origin from a fixture transcript (a forged `jacob` is `model`; a Jacob
turn carries `origin_id` and its stub line, never the text; `hub get ctx:<id>` returns
the prompt the fixture `ctx:` CLI stored; a body with the prompt past `stub_chars` is
flagged `pasted`); admission (identical dropped, invalid dead-lettered with a notice,
`budget_per_conversation` + 1 held while ten free results between them do not count,
released by a fixture Jacob prompt once and never pasted again); a fixture usage CLI
asked with the estimate (exit 0 goes, `warn` holds a job without a checkpoint and lets
one with a checkpoint through with the note in its queued envelope, `hold` holds with
exactly one line to the dispatcher window; a missing CLI holds every spawn and says why;
no row, the gate is off); the limits export equals `hub.json`'s limits and `vocab.LIMITS`
both ways and a budget of 1 holds the second model message naming the limit; `hub hook
planner-stop` and `dispatcher-stop` forward through `/route`, and with the server killed
relay direct to the recorded socket (duplicates dropped, origin from the ledger) or
block once; `hub hook user-prompt` with the server killed still stores the prompt and
keeps the record for `hub origin` and the restarted server; a delivery failure reaches
the `owners` row (the planner in the fixture) and, with the row removed, the dispatcher
`routed_by: dispatcher` and nowhere else; 100 fixture envelopes route identically twice
and every routed ledger row replays to its decision; every hook exits 0 on malformed
input with no block. Also held: hops past the limit dead-letter; the four routing rules
and the reserved targets; a window with no socket is a dead letter and a `delivery`
message; `hub send`, `hub log`, the restart after a kill keeping sessions, queue and
prompts; the audit that no limit's code path carries a numeric literal.

## 4. Choices this pass made that the planner should read

Each is in the code's comments and `docs/API.md`; none reopens a decision.

- **Origin without the harness's method.** The plan has `hub origin` read the planner
  transcript "as `relay-gate.sh` does today"; that script is in `.claude/` and not an
  input here. The hub's rule is data it owns: a prompt is Jacob's unless the hub itself
  delivered that text to the session (the hashes of what it wrote to each socket), read
  against the transcript's last `user` line with string content to name the turn. A
  window-to-window `SendMessage` that does not pass through the hub (until H4) is
  therefore recorded as typed; the planner diffs behaviour against today's hook at review
  (hb-38 says so).
- **The fallback state file is the hub's.** With the server down, `hub hook
  session-start` writes `.hub/sessions/<id>.json` and `planner-stop` reads the
  dispatcher's socket from there; the plan said "the state file `record-session.sh`
  still writes", whose path is harness's and unknown to the hub. Harness's hook may
  keep writing its own file; the hub reads its own.
- **Three registry fields the plan did not have**, each the smallest way to keep a
  constant out of code: `limits.question_max_blocks` (PLAN-question-routing.md §3's
  `questions.max_blocks`, a limit like every other), `services.usage.unit_tokens` (the
  1u estimate the gate is handed when an envelope names none), and `prompts` (the prefix
  of the store that takes typed prompts) with a `put` verb in that store's `ids` entry
  (PLAN-context-hygiene.md's write verb was "not guessed" by the plan; the hub names the
  field, the owner names the verb). Decision 4 and §2 record them.
- **`routed_by` names the fallback role from the registry** (`dispatcher` at the top),
  not a literal: the no-names audit forbids a role name in `src/`, and the ledger reads
  as routing-tree §3 says.
- **A `question` envelope's kind** travels as `kind_hint` (the nested `tags.question`
  row routes by it); `kind` stays the server's seam-kind field.
- **Free messages** (routing-tree's "route, check and write results cost no tokens"):
  one handed to a service (`@write`, `@check`) does not count against the budget; in
  H1a-2 no result flows back yet, so the fixture's free results are `write-request`
  envelopes.
- **An unregistered child's message goes to the fallback with a notice** (routing-tree
  §9 "Hierarchy"), since no child registers before H3.
- **`hub get` runs the store's `get` locally** through the declared CLI; the server's
  read route (`/read-request`) still only names it.
- **`hub.json`'s `stores` map is derived nowhere yet**: the §2 example and the fixture
  carry it by hand; setup's component renders it from the repos' `ids` (hb-55).

## 5. What is left

**Of the brief's §5 "Build" half** (H1a-0b, H1a-1, H1a-2, S1, H1b in order, as far as
the credits go): this pass built H1a-0b, H1a-1 and H1a-2. **S1 (hb-39) and H1b (hb-40)
remain**, and run next, in that order, in the cloud on the credits or locally one
dispatch per phase (Decision 9's rule). H1b now finds its inputs in place: the queue
under `.hub/queue/<role>/` holds the envelopes a spawn takes, each with the usage gate's
note; the `write` service's queue under `.hub/queue/@write/`; `services.usage` asked;
the `origin_id` stub ready to go into a spawn's prompt. H2 carries the `kept` role's
health check, restart rule and budget, the ping-pong hold, `routes --proposed` from the
dispatcher's choices and from the third identical unowned re-route (the counts are in
the ledger now), and the `@owner` template `{repo}/coder`.

**The credits.** How many tokens this pass spent is not readable from inside the
session; Jacob's usage page has it, and PLAN-hub.md §9 says the balance to plan against
is $150 and that the next pass stops when it runs short.

**Open in this pass's own area, recorded for the store** (nothing in `todo.json` was
changed here: the todo CLI is not in the clone and a hand edit fails `todo check`):

- hb-36, hb-37 and hb-38 are done by their done-whens (§3) and await `todo done` with
  this report as evidence.
- hb-64 is half answered: a declared CLI's `get` verb is read as a read; other read verbs
  (`items list`) are still write requests the server denies as undeclared.
- hb-65 (the fixture's `stores.json` shape) now also covers the `ids` declaration (`{prefix,
  pattern, get, put}`, read from the repos row first, else the repo's `services.json`)
  and `hub.json`'s `stores` map; setup's render of both is hb-46's and hb-55's.
- New: P-R1 and P-R2 (PLAN-hub.md §4), two probes for H0's item, local.
- New: the role mode `cold` became `process` with a `lifetime` column (b21beca); a
  `hub.json` with `mode: cold` fails `hub check`. No committed `hub.json` exists yet.
- New, unverified: the hook JSON output field `systemMessage` carries each hook's
  one-line notice; that it is shown to the user in a window is a platform claim this
  pass took from the hooks documentation's common output fields and did not run.
  Probe: register one hook locally and type a prompt. If the field is not shown, the
  notice moves to stderr with exit 0.
- New, unverified: a window's inbox socket accepts the message line with no auth line
  first (auto-relay §3's probe found so for the dispatcher, 2026-10-03; the fixture
  socket here asks for none). The first real relay through `hub hook planner-stop`
  settles it.

## 6. What needs Jacob's local machine, or another owner

Requests, per the brief's §5 ("written in the pass's report as a request, never made"):

1. **Merge `cloud/pass-2026-11` into `main`** (six commits on f2917ae, a fast-forward
   unless `main` moved), after `./dev.sh check` runs green locally with the four parts
   this clone could not run. Then the store: `todo done hb-36`, `hb-37`, `hb-38`; hb-64
   and hb-65's notes; P-R1/P-R2 on H0's item; hb-39 and hb-40 as the next cloud items
   (todo CLI, local).
2. **The brief** (the top-level original, the planner's): its line 30 and §4 questions
   4, 7 and 9 may now point at PLAN-hub.md §4, §7 and §9 as taking the answers; then
   `./dev.sh refresh PLAN-hub-brief.md` here.
3. **`harness`** (PLAN-hub.md §9, the job beside H1a-2, local): `gen` renders
   `.claude/hub-roles.json` with `mode: process` and `lifetime`, never `hub.json`
   (hb-54); the three hook files become one-line callers of `hub hook planner-stop`,
   `dispatcher-stop` and `session-start`, and `hub hook user-prompt` is installed for
   the two windows; `dispatch-guard.sh` reads `hub status --json`; the status-line
   segment that prints `hub: down` (§7). Note the fallback state file (§4 above) and
   the origin rule, so the two hooks agree before the switch.
4. **`tools/setup`** (hb-55, hb-46, the job beside H1a-2, local): the `hub` component
   writes `hub.json` from the role list with `mode: process`, `lifetime`,
   `limits.question_max_blocks`, `services.usage.unit_tokens` and `prompts`; renders
   `stores.json` and the `stores` map from the repos' `ids` declarations.
5. **`context-hygiene`** (hb-56): the `ctx:` store's `ids` entry declares `get` and
   `put` (one record on stdin, its id printed; `get` prints the one readable line first,
   then the record), so `hub hook user-prompt` can store a typed prompt and the stub
   render from the first line.
6. **`tools/usage`** (hb-60): `usage gate <tokens>` as PLAN-usage-reporting.md §2 has
   it; the hub reads exit 0 as go and the first word of a non-zero answer as `warn` or
   `hold`.
7. **`cron-scheduler`**: the server-list request of Decision 5 is withdrawn (PLAN-hub.md
   §7, question 7); `chron.py list --json` for the view's cron panel stands (V2).
8. **`checks`**: when the `banned-terms` gate lands (routing-tree §24 step 5), this
   repo's live files are already clean of the axis.
9. **The planner**: `kb check` on PLAN-hub.md (no new URL was added); a review of §4
   above against today's hooks' behaviour before harness switches the callers.

Nothing outside `tools/hub` was changed.
