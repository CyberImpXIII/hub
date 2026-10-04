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
