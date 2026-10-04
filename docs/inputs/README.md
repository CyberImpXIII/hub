# Inputs for PLAN-hub-brief.md

Copies taken 2026-10-04 from the top of the claudeTest folder, which is not a git
repo. They are snapshots: the originals keep changing, these do not. The brief
(`../../PLAN-hub-brief.md`) is the eleventh input and sits at the repo root.

**One rename.** The brief's row "`CLAUDE.md` (top level)" means claudeTest's own
`CLAUDE.md`, copied here as `claudeTest-CLAUDE.md`. It is not this repo's
`CLAUDE.md`. It was renamed because Claude Code loads a `CLAUDE.md` in a
subdirectory as project instructions when it reads files there
(<https://code.claude.com/docs/en/large-codebases#choose-where-to-start-claude>),
and that file is claudeTest's instructions to its dispatcher, not to this repo.

Each copy matched its original byte for byte when taken (sha256 below, checked
against the originals with `shasum -a 256` on 2026-10-04). Check a copy here with
`shasum -a 256 -c docs/inputs/SHA256SUMS` from the repo root.

| copy | original (claudeTest top level) |
|---|---|
| `../../PLAN-hub-brief.md` | `PLAN-hub-brief.md` |
| `claudeTest-CLAUDE.md` | `CLAUDE.md` |
| `PLAN-routing-tree.md` | `PLAN-routing-tree.md` |
| `PLAN-tools-folder.md` | `PLAN-tools-folder.md` |
| `PLAN-auto-relay.md` | `PLAN-auto-relay.md` |
| `PLAN-question-routing.md` | `PLAN-question-routing.md` |
| `PLAN-group-servers.md` | `PLAN-group-servers.md` |
| `PLAN-agent-groups.md` | `PLAN-agent-groups.md` |
| `PLAN-todo-tool.md` | `PLAN-todo-tool.md` |
| `PLAN-interim-rules.md` | `PLAN-interim-rules.md` |
| `PLAN-cloud-offload.md` | `PLAN-cloud-offload.md` |

**Referenced by the inputs but not copied** (the brief's §2 does not list them):
`PLAN-repo-setup.md` (the brief's §5 cites its §1 for the Setup component),
`PLAN-portable-env.md` (`init.sh`, §4 item 7), `PLAN-context-hygiene.md`,
`PLAN-knowledge-base.md`, `PLAN-applications.md`, and the top-level `TODO.md`.
Where a plan needs one of these, it names it as an open pointer rather than
guessing its content.
