# Inputs for PLAN-hub-brief.md

Copies taken 2026-10-04 from the top of the claudeTest folder, which is not a git
repo. They are snapshots: the originals keep changing, these do not. The brief's §2
lists thirteen inputs: the brief itself (`../../PLAN-hub-brief.md`, at the repo
root) and the twelve files in this folder. `PLAN-repo-setup.md` and
`PLAN-portable-env.md` were added to §2 later the same day; they were copied and
the brief refreshed from the top-level original then.

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
| `PLAN-repo-setup.md` | `PLAN-repo-setup.md` |
| `PLAN-portable-env.md` | `PLAN-portable-env.md` |

**Referenced by the inputs but not copied** (the brief's §2 does not list them):
`PLAN-context-hygiene.md` (6 mentions), `PLAN-knowledge-base.md` (4),
`PLAN-applications.md` (1), and the top-level `TODO.md` (counted 2026-10-04 with
`grep -ohE 'PLAN-[a-z0-9-]+\.md'` over the brief and this folder; `PLAN-x.md` is a
placeholder and `PLAN-hub.md` is the output).
Where a plan needs one of these, it names it as an open pointer rather than
guessing its content.
