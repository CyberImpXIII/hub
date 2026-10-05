# Cloud offload: the dispatcher can send work to cloud sessions

> **Status: plan, priority #1** (Jacob, 2026-10-02: "plan to do what is necessary for
> this to be possible by the dispatcher, and make this priority #1"). Phase 0 is
> Jacob's: one look at a settings page decides whether the rest is worth building.
> Owners: `harness` (the `agents.sh cloud` helper, the flag, the guard),
> `deep-work` (the first offloaded task). All facts below are from the docs, read
> 2026-10-02, with links.

## 1. What the docs say, and the question they leave

- **Cloud sessions don't have their own budget.** "cloud sessions share rate limits
  with all other Claude and Claude Code usage within your account [...] There is no
  separate compute charge for the cloud VM."
  <https://code.claude.com/docs/en/claude-code-on-the-web#limitations>
- **Usage credits are what you spend past your plan's limit, wherever you run.**
  "Usage credits let you keep working past your plan's usage limit."
  <https://code.claude.com/docs/en/costs#add-usage-credits-to-your-subscription>.
  This applies to local sessions too: past the limit, Claude Code "draws on usage
  credits" and drops the main conversation to the 5-minute cache TTL.
  <https://code.claude.com/docs/en/prompt-caching#which-ttl-each-request-gets>
- **So, if the $100 are ordinary usage credits, moving work to the cloud doesn't
  change which pool pays.** Plan usage pays first and credits after, local or cloud.
  Offloading would buy parallelism and a free machine, not cheaper tokens.
- **If the $100 is a grant only for cloud sessions,** it isn't described on these
  pages, and offloading is cheaper for as long as it lasts.
- **Settled by:** claude.ai/settings/usage, "Usage credits" section, which shows the
  balance and what it covers. That's Phase 0 (§5).

The memory written on 2026-10-01 says "the credits are a separate budget". That was an
assumption, and the docs above don't support it for ordinary usage credits.

## 2. How the dispatcher would do it (documented paths)

- **Start:** `claude --cloud "<task>"`, run in the tool's repo.
  - It "clones your current directory's GitHub remote at your current branch, not
    your local checkout, so push first".
  - A repo with no remote is bundled and uploaded instead (under 100 MB, tracked files
    only, credential-named files left out).

  <https://code.claude.com/docs/en/claude-code-on-the-web#from-terminal-to-cloud>,
  <https://code.claude.com/docs/en/claude-code-on-the-web#send-local-repositories-without-github>
- **Steer:** `claude -p "<msg>" --cloud <session-id> --output-format json` returns
  `{ok, session_id, url}`. It posts one message and exits.
  <https://code.claude.com/docs/en/claude-code-on-the-web#send-follow-ups-from-the-cli>
- **Collect:** the session pushes a branch. The local folder owner fetches it, runs
  that repo's pre-commit check and merges. `--teleport` pulls a session into a terminal,
  but it needs the branch pushed to a remote and a clean tree.
  <https://code.claude.com/docs/en/claude-code-on-the-web#teleport-requirements>
- **Not a path:** Agent `isolation: "remote"`. It reported success on 2026-10-01 and
  ran locally (TODO Confirmed). The subagent docs list only `worktree` for `isolation`:
  <https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields> "Set to `worktree` to run the subagent in a temporary"

## 3. What can go, and what can't

| roster agent | cloud? | why |
|---|---|---|
| `deep-work` (new tool in its own repo) | **yes** | self-contained, tests offline |
| `job-import-scripts`, `data-bridge` | yes, code and tests only | on GitHub; live imports touch local data |
| `site-scrapers` | code and offline tests only | **no live scraping:** cloud IPs and Chrome would invite bot detection (constraint), and the recipe DB is local |
| `email-tools` | no | needs Gmail credentials, which are never stored |
| `cron-scheduler` | no | the real crontab is local |
| `harness` | no | `.claude/` has no remote, so a bundle goes up but nothing comes back except by hand |

- **Network:** the default "Trusted" level reaches GitHub, the Anthropic API and the
  package registries. code.claude.com isn't on that list.
  <https://code.claude.com/docs/en/cloud-environments#default-allowed-domains>
- **Hooks:** each tool repo carries its own `.claude/hooks/` copies, so they travel
  with the clone. Whether they fire in a cloud session is **unverified**. The Phase 1
  probe checks it.

## 4. Is the router a good first cloud task? No

- It lives in `.claude/`, which has no remote, so a cloud session couldn't hand it
  back.
- Testing it means local sessions firing hooks at a local server, plus launchd. A cloud
  VM has neither.
- A cloud session's own hooks would POST to the VM's localhost, not to this machine. So
  the router can't route to or from cloud sessions either.

**Better first task:** the knowledge-base tool (PLAN-knowledge-base.md). It's a new
repo, deterministic, and testable offline against fixture pages. It's also priority #2.

## 5. Phases

**Phase 0: DONE 2026-10-02.** Jacob: "yes they are promotional cloud only usage
credits". So offloading is cheaper while they last. Go on.

**Phase 1: the first real task is also the probe, run by hand from the dispatcher.**
The task is the knowledge-base build (PLAN-knowledge-base.md §5 step 1, in the cloud
part).
1. Jacob notes the balance.
2. The dispatcher runs `claude --cloud` in the new `knowledge-base` repo, with a brief
   pointing at the plan copy inside that repo.
3. Jacob notes the balance again when the session finishes.

What it settles:
- whether the balance moved;
- whether the repo's hooks fired;
- which model ran (the docs don't say how to pick one for `--cloud`; probe it);
- whether creation accepts `--output-format json`.

Done only when the balance has moved and the branch came back.

**Phase 2: `harness` builds the dispatcher's path.**
- **One flag:** `.cloud` in `agents.manifest.json`: `enabled`, `noted` (date and
  Jacob's words), and per-agent `cloud_ok` with a reason (§3).
  - `doctor` prints the state at session start.
  - Turning it off is one edit, and the helper refuses to run while it's off.
- **`agents.sh cloud <agent> <brief-file>`:**
  - refuses an agent whose `cloud_ok` is false;
  - checks the repo is pushed;
  - prefixes the brief the way a roster spawn is prefixed (folder rules pointer,
    Jacob's quoted words);
  - runs `claude --cloud`, appends `{id, agent, brief hash, started}` to a gitignored
    ledger, and prints ≤3 lines.
- **`agents.sh cloud status`:** one line per open session. **`cloud collect <id>`:**
  fetches the branch and prints a diffstat in ≤10 lines, for the owner to review.
- **`dispatch-guard.sh`:** blocks a bare `claude --cloud` from the dispatcher and names
  `agents.sh cloud`. It's a spawn outside the roster, the same as a non-roster Agent.
- **Gates:**
  - helper tests for flag off, a `cloud_ok:false` agent, an unpushed repo and a failed
    send (it reports, never stays silent);
  - a guard test;
  - `check` verifies every roster agent has a `cloud_ok` entry with a reason.

**Phase 3: route by default.** While `.cloud.enabled` is on, the dispatcher sends
`cloud_ok` work to the cloud.

## 6. Decisions

1. **Resolved 2026-10-02:** the $100 is promotional, cloud-only usage credits.
2. **Moot,** given 1.

## 7. Setup component

Nothing per repo. The flag, `agents.sh cloud` and the guard are top-level and belong to
`harness`. What a cloud session needs from a repo is exactly what PLAN-portable-env.md's
component installs: a clone that bootstraps and runs its check from nothing on a machine
that is not this one. A repo that passes portable-env is cloud-ready; this plan adds no
file to it.

## 8. Greenfield planning goes to the cloud: the rule, and conditional offloading

> **Jacob, 2026-10-04 (planner window):** "I'd also like to setup rules with you and
> the dispatcher that sets up greenfield projects so that the planning stage can be
> done with cloud agents, as my current promotional balance for cloud only usage
> credits has gone up." And: "This might be good as a todo for... maybe harness? So
> that we can have conditional offloading of certain work."

**The rule.** A *greenfield* project is a new tool with no repo and no local state yet.
Its **planning stage is cloud work by default** while the cloud-only credits last
(Jacob says when they are out). The hub plan on 2026-10-04 is the worked example, and
its steps are the procedure:

1. **The planner writes `PLAN-<x>-brief.md`**, shaped like PLAN-hub-brief.md: the task
   in one paragraph; the inputs in reading order, each a file and the sections that
   matter; the fixed points not open for re-decision; the questions the plan must
   settle; the output contract (file, branch, status header, Gates, Phases with token
   costs, Decisions table, done criteria). The brief is the only thing the cloud
   session reads first, so what it omits is decided wrong.
2. **The dispatcher runs `setup tools/<x> --github`** (public, as Jacob said of hub),
   copies the brief and every input file into `docs/inputs/` with `SHA256SUMS`, commits
   and pushes. Running setup and copying files is tool use, the dispatcher's own; no
   roster agent is needed. The top-level `CLAUDE.md` goes in as `claudeTest-CLAUDE.md`
   so the clone's own `CLAUDE.md` stays the tool's.
3. **Jacob starts the cloud session** on the repo, pointed at the brief. Never from a
   spawn: a spawn with `isolation: remote` ran locally and billed ordinary usage
   (TODO.md, "Confirmed"), so the only path that reaches the credits is the one Jacob
   starts himself, and phase 1 of §5 is still what proves which one that is.
4. **The plan comes back as `PLAN-<x>.md` on branch `plan/<x>`.** The dispatcher
   fetches it; the planner reviews it against the brief's fixed points and puts its
   decisions in a table; Jacob decides. Only then does building start.
5. **Building stays local** unless §3 says the cloud is fine for that work: a new tool
   with offline tests is §3's first row, so a greenfield build may follow its plan to
   the cloud once the §5 phase-1 probe has shown the repo's hooks fire there.

**Conditional offloading, the predicate behind the rule.** Work is cloud-eligible when
every one of these holds, and §3 is this predicate applied to today's roster:

- every input is in a public-safe repo or can be copied into one: no secrets, no local
  database, no captured handoff values, nothing from `.claude/`;
- the output is a document or a commit on a branch, nothing that has to land in local
  state by hand;
- it drives no browser against a job site, no Gmail, no crontab;
- the credit balance has not been reported out by Jacob.

**The harness item**, interim until the hub routes: `agents.sh offload <PLAN-x.md>`
reads the plan's `Owner` and inputs, applies the predicate, and prints `cloud-eligible:
yes` or `no, because <the failing clause>`, with the brief's required sections it finds
missing. A test fixes the answer for each §3 row and for a plan that names
`site-scrapers/data/`. The hub later carries the same predicate as a routing rule
(PLAN-routing-tree.md §3), which is why it is written as a predicate and not as a
list of names. ~25k tokens, harness, after the resumable check and the hub entry.

**What the planner and dispatcher do differently from today:** the planner, asked for a
new tool, writes the brief instead of the plan and says so; the dispatcher, handed a
brief, runs step 2 without a roster spawn and hands Jacob the one command for step 3.
Both rules go in the top-level `CLAUDE.md` "Two windows" section (the dispatcher's
edit) once Jacob approves below.
