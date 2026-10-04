# hub TODO

## Own bugs

- **`./dev.sh check` is still the setup stub** (deep-work, 2026-10-04): it fails by
  design until the hub is built. The one seam this repo has today, `docs/inputs/`
  against `docs/inputs/SHA256SUMS` and against the brief's §2 list, is checked only by
  hand (`shasum -a 256 -c docs/inputs/SHA256SUMS`, 11 OK on 2026-10-04). The first
  real `check` should run that, plus "every file the brief's §2 names is present".

## Open decisions

- **`.claude/settings.json` is absent** (Jacob's step): the three shared hooks are
  installed but not registered, so they do not fire here, in a local session or a
  cloud one. setup wrote `.claude/settings.proposed.json` (untracked); applying it is
  `cp .claude/settings.proposed.json .claude/settings.json`.

## Unconfirmed suspicions

- **The cloud session may lack inputs it needs** (deep-work, 2026-10-04): the inputs
  cite `PLAN-repo-setup.md` (12 times, and the brief's §5 requires its §1),
  `PLAN-portable-env.md`, `PLAN-context-hygiene.md` and `PLAN-knowledge-base.md`,
  which the brief's §2 does not list and which are not copied. Probe: whether
  `PLAN-hub.md` comes back with open pointers to them.

## Reported to other owners

- **setup** (via the dispatcher, 2026-10-04): it leaves `.claude/settings.proposed.json`
  untracked with no `.gitignore` entry, so a new repo never reads clean and a
  `git add -A` would commit the proposal; and it writes no `.gitignore` at all, though
  this repo's plan (routing-tree §7) puts a token in `local.env`.
