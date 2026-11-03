# Cloud pass 2026-11-03: PLAN-hub.md §4, §7, §9 and H1a-0b

> **The pass** PLAN-routing-tree.md §10.4 step 5 names, approved by Jacob (PLAN-hub.md
> Decision 9; his `credits` answer of 2026-10-19, tl-398). Run from a lone clone of this
> repo in a cloud session (no `../tools`, no workspace around it), on branch
> `cloud/pass-2026-11` from `main` at f2917ae. Scope as Jacob gave it for this pass:
> step 1, the plan's §4, §7 and §9 re-cost from the brief's answers; step 2, H1a-0b
> (TODO.md hb-36) to its done-when with offline tests; this report. No browser, Gmail,
> crontab or `.claude/` directory was touched (the lone clone's `./dev.sh seal` set the
> input copies' mode, which git does not track; nothing under `.claude/` was written
> but the check's own gitignored state).

## 1. What was done

| commit | what | check |
|---|---|---|
| b21beca | **Step 1.** PLAN-hub.md §4 "Roles and modes" rewritten from routing-tree §20 `hybrid`, §17 `declare` and §24: a role is declared by `mode` (`window` \| `process` \| `driven`) and `lifetime` (`per-task`, or `kept` for a repo's coding role); the kept role's health check, restart rule and request budget (`limits.role_silence_s`, `limits.role_daily_budget`, under Decision 4's condition); the order roles are routed in; the request's `mode: write\|run\|read` and `uses: browser`; one page line per role and a transcript tab on demand; probes P-R1 and P-R2. §7 from question 7 `session-start`: `init.sh` is the one keep-alive, `hub up` counts its restarts in the ledger (`hub status --restarts`, H1a-1), `launchd` waits for the bundled-application stage, Decision 5's server-list request to cron-scheduler drops. §9 from question 4 `credits`: $150 the balance to plan against, H1a-0b on the credits, a re-cost that adds no phase (total 1.7–2.6M, cloud share ~1.25–1.8M, H1a-0 spent). §8 gained a "roles and lifetimes" row; §2's example carries `lifetime` and the two limits; Decisions 1, 4, 5, 7 and 9 record the answers. The temperature axis left every live file in this repo (§24): the hub-started mode is `process` in the plan and in H1a-0's code (`src/registry.js` `MODES`, `LIFETIMES`), PLAN-hub-view.md follows | `./dev.sh check`: 6 of 10 passed, 4 UNCHECKED (below); hubtests 36 passed, 2 unchecked |
| e68e473 | **Step 2, H1a-0b.** `POST /read-request` (`src/read.js`), `hub hook gate`'s store-read classification (`src/classify.js`: a Read of a path `stores.json` lists; a Bash argument or input redirection that is one; a word that is a declared id, its prefix in `hub.json` `stores` and its pattern in the owner's `services.json` `ids`; a declared CLI called with its own `get` verb), the hook failing closed for store reads as for writes, `hub.json` `stores` in the shape and in `hub check`, the ledger row per answer with `id`, `store`, `kind`, `docs/API.md`'s route, the gate help, CLAUDE.md's stage. `tests/hub/read-route.test.js` holds every §8 "read route" clause and hb-36's done-when | `./dev.sh check`: 6 of 10 passed, 4 UNCHECKED; hubtests 50 passed, 2 unchecked |
| this commit | the report; PLAN-hub.md's header and §9 row say H1a-0b is built | as above |

**hb-36's done-when, clause by clause** (`tests/hub/read-route.test.js`):

- `POST /read-request` answers a fixture declared-prefix id (`items:it-7`, prefix `items`
  in the fixture's `stores`, pattern `items:it-\d+` in `tools/items/services.json`) and a
  path the fixture `stores.json` lists (`PLAN-alpha.md`, `todo.json`, `TODO.md`,
  `tools/items/todo.json`, `site/data.db`) with the store's `get`: the row names the
  store and the `get` verb where one is declared (`tools/items/items get`), and says
  `declares no get yet` where none is (`tools/plans`).
- A Read of an owned non-store path (`site/src.txt`, `tools/items/cli.json`) and of an
  unowned path (`notes.md`, a path outside the node, a path built at run time) is plain
  Read, never denied, with no server call and no ledger row; Grep and Glob are plain.
- With the server killed, a declared-prefix read and a Read of a listed store path are
  each denied with the `hub status` line (one hook row each, `by: hook`), and a Read of
  an unlisted path is allowed. The counterfactual runs first: the same calls pass while
  the server is up.
- With `stores.json` removed, every Read of a path is plain Read (no server call),
  `hub status` prints `stores.json missing` and `--json` says `"stores_json": "missing"`;
  an id read is still a store read, since its prefix is `hub.json`'s; with the file back
  the same Read is a store read again.
- Every answer is one ledger row (`route: /read-request`, `by: server`, `id`, `store`,
  `kind`, `verb`, `targets`, no `args`); the hook's own denies are rows `by: hook`.
- Also held: a store read beside a write is a write; a stranger role and a missing role
  are denied; `HUB_TOKEN` unset or wrong denies a store read and passes a plain one; a
  declared CLI's `get` verb with no id is a store read, while another verb on the same
  CLI is still a write request; an id no declared prefix claims, or one failing the
  pattern, is prose; `hub check` fails a `stores` prefix naming no repos key; a malformed
  `ids` declaration leaves the id a store with no `get`.

**What the server does with an allowed store read in H1a-0b:** it names the store and
its `get` and never runs it; the role's own call runs (PLAN-hub.md §3 H1a-0b: "the `get`
runs as the role's own call until `hub get` exists (H1a-2, R1)"). So today the route
changes nothing a role can read; it puts every store read in the ledger with its owner,
and makes a store read fail closed with the server down.

## 2. What the check could not run here (named, not counted as passed)

`./dev.sh check` on each commit: **6 of 10 parts passed, 4 UNCHECKED**, exit 0 with
"the pass was not recorded" (the runner records a pass only when every part passed, so
no `check:` trailer was written and the commits carry none). The UNCHECKED parts, each
because a sibling tool is absent in a lone clone:

| part | why unchecked | what runs it |
|---|---|---|
| `hooktests` | `test-prefer-recipes.sh` and `test-troubleshooting.sh` read site-scrapers beside the repo (10 of 12 hook test files passed) | `./dev.sh check` in the workspace |
| `hubtests` | two of the program's tests skip `UNCHECKED`: the classifier's parity with tools/hooks' shared write-target parser, and the no-names audit's workspace-folder half (50 of 52 passed) | the same |
| `plans` | `../setup/setup plans .` | the same |
| `checks` | `../checks/checks run . --json` (todo-valid, no-secrets, hooks-installed, rules-in-sync, help, ...) | the same |

Run once locally on `cloud/pass-2026-11` before the merge: `./dev.sh check`. Two things
it will say that this clone could not: whether `checks`' `banned-terms` gate (routing-tree
§24 step 5), if it exists by then, passes on the rewritten plan and view (the grep for
`cold|warm|temperature|prompt_cache|cache ttl|cache-warm|hot cache` over `PLAN-hub.md`,
`PLAN-hub-view.md`, `src/`, `tests/`, `docs/API.md`, `CLAUDE.md`, `dev.sh` and
`devtools/` is empty here), and whether `todo-valid` accepts the store untouched (this
pass changed nothing in `todo.json`).

Not run here, by design: `kb check` on PLAN-hub.md (the planner's, brief §5; this pass
added no new platform claim or URL, it moved existing cited text and cited §11 for
`--input-format stream-json`); `./dev.sh drift` (the originals are on Jacob's machine).

## 3. What is left

**Of the brief's §5 "Build" half** (H1a-0b, H1a-1, H1a-2, S1, H1b in order, as far as
the credits go): this pass was scoped to H1a-0b. **H1a-1, H1a-2, S1 and H1b remain
open** in the hub's store (hb-37, hb-38, hb-39, hb-40) and run next, in that order, in
the cloud on the credits or locally one dispatch per phase (Decision 9's rule). H1a-1
now also carries, from §7 and §4: the `restart` row `hub up` writes over a stale pidfile
and `hub status --restarts`; `lifetime` required on a `process` role in `hub check` and
the schema; `stores` completed in the schema (its prefixes' `get` executable, R1's
clause stays R1's). H1b carries the envelope's `mode` and `uses`, the `uses: browser`
hold and the record services as the first roles routed to; H2 the `kept` role's health
check, restart rule and budget (PLAN-hub.md §9 rows, §8 "roles and lifetimes").

**The credits.** How many tokens this pass spent is not readable from inside the
session; Jacob's usage page has it, and PLAN-hub.md §9 says the balance to plan against
is $150 and that the next pass stops when it runs short.

**Open in this pass's own area, recorded for the store** (nothing in `todo.json` was
changed here: the todo CLI is not in the clone and a hand edit fails `todo check`):

- hb-36 is done by its done-when (above) and awaits `todo done hb-36` with this report
  as evidence.
- hb-37's done-when gains the two §7/§4 items above (`--restarts`; `lifetime` required).
- hb-64 is half answered: a declared CLI's `get` verb (from its `services.json` `ids`)
  is now read as a read; other read verbs (`items list`) are still write requests the
  server denies as undeclared, since `cli.json` verbs still do not say read or write.
- hb-65 (the fixture's `stores.json` shape) now also covers the `ids` declaration the
  fixture puts in `tools/items/services.json` (`[{prefix, pattern, get}]`, PLAN-hub.md
  §12) and `hub.json`'s `stores` map (prefix without its colon → repos key); setup's
  render of both is hb-46's and hb-55's.
- New: P-R1 and P-R2 (PLAN-hub.md §4), two probes for H0's item, local.
- New: the `hub.json` role mode `cold` was renamed `process`, and `lifetime` added, in
  the plan and in H1a-0's code (b21beca); any `hub.json` written by hand or by a
  renderer with `mode: cold` now fails `hub check` (the message names the three words).
  No committed `hub.json` exists yet, so nothing broke; harness's role-list render
  (hb-54) and setup's `hub` component (hb-55) take the new words.

## 4. What needs Jacob's local machine, or another owner

Requests, per the brief's §5 ("written in the pass's report as a request, never made"):

1. **Merge `cloud/pass-2026-11` into `main`** (three commits on f2917ae, a fast-forward
   unless `main` moved), after `./dev.sh check` runs green locally with the four parts
   this clone could not run. Then the store: `todo done hb-36`, hb-37's done-when, hb-64
   and hb-65's notes, P-R1/P-R2 on H0's item (todo CLI, local).
2. **The brief** (the top-level original, the planner's): its line 30 and §4 questions
   4, 7 and 9 may now point at PLAN-hub.md §4, §7 and §9 as taking the answers; then
   `./dev.sh refresh PLAN-hub-brief.md` here.
3. **`harness`** (PLAN-hub.md §7, §4): the status-line segment that prints `hub: down`
   from `hub status --json`; `.claude/hub-roles.json`'s render carries `mode: process`
   and `lifetime` (hb-54); `tokens --agents --roles` (routing-tree §20 step 2, already
   its item).
4. **`tools/setup`** (hb-55, hb-46): the `hub` component writes `mode: process` and
   `lifetime` into `hub.json`, renders `stores.json` and the `stores` map from the
   repos' `ids` declarations (PLAN-hub.md §2, §12).
5. **`cron-scheduler`**: the server-list request of Decision 5 is withdrawn (PLAN-hub.md
   §7, question 7); `chron.py list --json` for the view's cron panel stands (V2).
6. **`checks`**: when the `banned-terms` gate lands (routing-tree §24 step 5), this
   repo's live files are already clean of the axis; its records (`docs/inputs/`,
   `docs/REVIEW-*.md`) keep their words per `live-only`.
7. **The planner**: `kb check` on PLAN-hub.md (no new URL was added; the §4 table's
   `--input-format stream-json` claim cites §11's existing quotation).

Nothing outside `tools/hub` was changed.
