# Portable environment: pack claudeTest up, init on another machine, same behaviour

> **Status: plan, requested by Jacob 2026-10-02.** His words: "making references to
> directories, my name, and other things OUTSIDE the folders should be dynamic.
> Hardcoding paths are not as useful as saving the path to a .env on an init script
> run, or asking the users name. [...] I'd like to be able to pack it up, and move it
> to another computer. Type a few commands, and potentially having it work exactly the
> same way but with different repos."
>
> **Companion to PLAN-repo-setup.md.** `init` sets up a machine once; `setup` sets up
> one repo, and init calls it per repo. Owner: `harness` for init, the local config and
> the audit. Each folder's agent removes its own hardcodes (§4).

## 1. The directive (text for top-level CLAUDE.md, beside the setup directive)

> ## Nothing about this machine or its owner is hardcoded
>
> **Jacob's directive (2026-10-02).** Code, templates and generated prompts never
> contain:
> - an absolute path, or a path outside the folder;
> - the owner's name;
> - an account name (GitHub, email);
> - a machine-specific location (a node install, a data directory).
>
> Those values live in one gitignored file, `.claude/local.env`, written by
> `./init.sh`. It asks for what it can't discover and discovers the rest. Paths inside
> the folder are found at run time, relative to the root. Dated records in plans and
> TODO ("Jacob, 2026-10-02") are history, not code, and stay as written.
>
> Credentials never go in `local.env`. They're supplied at run time, as before.


> **Jacob, 2026-10-04 (planner window), the directive restated and widened:** "Also
> tools/checks should be public, and this should be the case for all of these folders.
> Anything SPECIFIC to my projects and setup should be abstracted to a file that is
> ignored. The code that is public is the framework by which it can be applied to
> anyone elses or any other projects at all." So: every tool repo here is public;
> §3.1 (`local.env`, gitignored) is the file; the §5 hardcode audit becomes a
> `tools/checks` check, `no-instance-data`, red on any `local.env` value found in
> tracked code or templates; a private repo flips to public only after that check is
> green there, and the flip (`gh repo edit --visibility public`) is Jacob's own step.
> §4 then runs per owner. Decisions 1 and 2 in §7 stay open; decision 3's order is
> overtaken: setup exists, so §3.1 and the audit go now, as one deep-work job.
## 2. Where things stand (probed 2026-10-02, grep over code, excluding `*.md`, data and archives)

| hardcoded | where | count |
|---|---|---|
| owner's name | `.claude/` hooks, lib, agents.sh, tests, manifest; data-bridge; chronjobScheduler; scripts tests | 31 code files, mostly comments and agent-facing strings ("## Jacob's words", "Tell Jacob") |
| node install | `~/.nvm/versions/...` | 39 references |
| Proficiently data | `~/.proficiently` | 24 references |
| job search output | `~/.claude-job-searches` | 3 references |
| the folder's own path | `emailTools/check.sh:25` (`$HOME/Desktop/claudeTest/...`) | 1 |
| GitHub account | `.claude/agents.manifest.json` repo URLs | 5 |

Absolute `/Users/...` paths in code: **none**. Paths inside the folder are already
mostly relative. Prose (`*.md`) names the owner in 31 files; the shared-rules part of
that becomes a template under PLAN-repo-setup.md's `rules` component.

**Outside the folder, owned by Claude Code itself:**
- auto memory and transcripts live in `~/.claude/projects/<slug of the absolute
  path>/`, so moving the folder, even on the same machine, orphans them;
- user settings live in `~/.claude/settings.json`;
- the plugins (`proficiently`, `job-apply`) are installed per machine.

*Unconfirmed:* whether Claude Code has a documented setting that relocates auto
memory. Probe: the memory docs, raw, before designing around it.

## 3. The pieces

### 3.1 `.claude/local.env` and its vocabulary
- **One file, gitignored, `KEY=value` lines.** The keys are declared in a committed
  `.claude/local.vars.json`: name, what it is, how it's found (`ask`, `discover`,
  `default`), and its default. A first set:
  - `OWNER_NAME`, `GITHUB_ACCOUNT`: ask.
  - `NODE_BIN`: discovered with `command -v node`.
  - `PROFICIENTLY_DIR`, `JOB_SEARCH_DIR`: default under `$HOME`, confirmed when asked.
- **Every script reads it through one loader** (a sourceable sh file, plus one
  function each for node and python). Nothing reads `local.env` directly.

### 3.2 `./init.sh` (top level, the only file someone runs first)
1. Checks prerequisites: git, jq, node, python3, gh, claude. Names what's missing and
   how to install it, and stops.
2. Fills in `local.env`: asks for the `ask` keys, discovers the rest, and shows the
   result.
3. Takes a repo list: clone URLs or existing paths. It's per machine, so it lives in
   `local.env` or a gitignored `repos.json`, never in the framework. Clones what's
   missing, then runs `agents.sh setup` on each.
4. Restores what lives outside the folder: auto memory (exported by `pack`, §3.3), and
   the plugins named in a committed list (it prints the install commands, since
   plugin installs are the user's).
5. Writes the settings proposal and prints the one copy command. Settings stay the
   owner's.
6. Ends with `agents.sh check`. Init succeeded only if check passes.

Rerunning it is safe: it asks only for values that are missing.

### 3.3 Packing it up (decision 1)
- **A. claudeTest becomes a private git repo** holding only the framework: top-level
  rules, `.claude/` and `init.sh`. The tool repos stay separate repos, listed per
  machine. Moving means: clone, `./init.sh`, answer a few questions. This reverses the
  standing rule that claudeTest isn't a repo, so it needs Jacob. `.claude/` would move
  from its own local repo into this one, and its history comes along with
  `git subtree` or a merge.
- **B. `agents.sh pack`** writes a tarball of the framework, plus an export of auto
  memory, excluding data, secrets, `local.env` and `node_modules`. No git change, but
  no history or sync between machines either.

### 3.4 Framework vs instance in the manifest
- **The manifest holds both kinds now:** the framework (roles, defaults, the
  dispatcher, harness, deep-work) and this machine's repos (the five folder agents and
  their GitHub URLs).
- **The framework part stays committed.** Folder agents become instance entries that
  `setup` writes, and their URLs come from `GITHUB_ACCOUNT` plus the repo name. Then
  another machine gets the same framework with its own repos.

## 4. Removing what exists: queued per owner once §3.1 lands

- harness: the name in hooks, lib, agents.sh and test strings becomes `$OWNER_NAME`;
  the manifest URLs are derived.
- cron-scheduler: the nvm paths become `NODE_BIN`.
- job-import-scripts and data-bridge: `~/.proficiently` and `~/.claude-job-searches`
  become the loader's values.
- email-tools: `check.sh:25` becomes a path relative to the root.
- The dispatcher: the shared-rules prose becomes a template, via PLAN-repo-setup.md's
  `rules` component.

## 5. Gates (in the same change)

- **The hardcode audit is content-agnostic.** It reads the *values* in the current
  `local.env` and greps tracked code and templates for each one. Any hit is a
  hardcode. It also flags absolute paths and `~/` or `$HOME/` literals outside the
  loader's defaults. Dated records in `PLAN-*.md` and `TODO.md` are exempt. Nothing in
  it names Jacob.
- **The vocabulary seam:** every key that's read is declared, and every declared key
  is read, both directions.
- **No secrets:** init refuses keys or values shaped like credentials (token,
  password, key, secret).
- **The move test, runnable here:** copy the framework to a scratch directory, set a
  fake `HOME`, and run `init.sh` non-interactively with answers from a fixture and a
  fixture repo list. `agents.sh check` then has to pass, and no file may reference the
  original location. This is "another computer" without needing one.
- **Idempotent:** a second `init.sh` asks nothing and changes nothing.

## 6. Setup component

`init` is the machine-level counterpart of `setup`, and calls it for each repo. The
`rules` and `agent` components (PLAN-repo-setup.md §2) read `OWNER_NAME` and
`GITHUB_ACCOUNT` from the loader.

## 7. Decisions for Jacob

1. **Packing:** A (claudeTest becomes a private git repo, framework only), or B (a
   tarball)? I suggest A. It reverses "claudeTest is not a repo", which is yours to
   reverse.
2. **Split the manifest into framework and instance** (§3.4)?
3. **Order:** I suggest building `local.env`, the loader and the audit together with
   setup phase 1 (#3a), since setup's templates need `OWNER_NAME`. `init.sh` and
   packing come after the group-server pilot.
