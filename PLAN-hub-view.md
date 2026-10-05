# The hub view: a terminal front end over the hub's API

> **Status: plan, written in the cloud 2026-10-05 on `plan/hub`**, split out of
> PLAN-hub.md §11 at the planner's review (docs/REVIEW-2026-10-04.md §3 finding 7) so the
> hub's merge and build do not wait on a terminal-host choice that rests on a probe
> nobody has run. Nothing is built. **Built after PLAN-hub.md's H3**, locally (every
> phase opens a terminal on Jacob's machine, so none is cloud-eligible under
> PLAN-cloud-offload.md §3).
>
> **Owners:** `deep-work` for `tools/hub/view/` (the pages, the TUI fallback, `hub view`,
> the gates); the `cron-scheduler` agent for `chron.py list --json` (§2); Jacob for the
> host terminal (Decision 1) and the hour-long probe that precedes V1 (V0).
>
> **Builds on:** PLAN-hub.md §2 (the registry the panels read), §3 (`/sessions`, the
> ledger the feed streams), §4 (the three modes and the state each one exposes), §7
> (`hub cron --json`), §8 (help == implemented, which this plan's endpoints fall under);
> PLAN-routing-tree.md §1 (a node knows only its children: the view walks, the server
> never stores a grandchild), §14.1 (stores stay the truth: the view caches nothing);
> PLAN-repo-setup.md §2 ("Settings stay Jacob's").
>
> **The request is not in any input.** Jacob typed it into the cloud session on
> 2026-10-04; the review notes the planner never saw it (§1, deviation 2). It is quoted
> in full below so this file is its record.

> Jacob, 2026-10-04: "I would like to take an open source terminal software, and add
> some features to it to make specifically managing all these agents and tasks easier.
> Basically, in the same way I have a terminal window with you right now, I'd like that
> to be the case. Though I would like to be able to pin blocks of text to the top and
> bottom of the terminal view. I'd also like to have a section maybe 1/5 the screen
> width to the right. In the top third of that section, I would like a list of agents
> in the active directory. A green circle to the left of the agents name indicates it
> is actively working, a yellow circle indicates it is awaiting commands, and a red
> circle is an agent in the manifest.json that has not been spawned. To the left of the
> circles are an on off switch that switches on or off what I am seeing in the single
> terminal view. Beneath that, in the second third of that section is a list of the
> folders in that directory, a white circle with a green cross next to a folder
> indicates that it is a github repo with active subagents (later also more importantly,
> an active server/node), yellow cross means it meets the criteria for green but the
> agents and server are not active, and red cross means that it is a folder that is
> managed by the current directory (that it does not have a github repo, server, or
> dedicated agents). Clicking on a folder should spin that cross to an X and display the
> agents in that folder similar to the section above. The bottom third of this section
> should have upcoming chron jobs from my chronjob scheduling script. There should also
> be a gear icon in the top left that will give me access to settings, which we will
> expand on, but will include adding folders, changing the directory, adding or removing
> tabs to the main view (which should by default have a Planner agent tab, and my
> dispatcher agent tab). Change the icons for any of the status colors."

**Cost unit.** As in PLAN-hub.md: one roster agent's starting context, about 29k tokens,
written "1u".

## 1. What it is, in the hub's terms

The view is a **client**. It reads `/agents`, `/folders`, `/cron`, `/held`,
`/dead-letter` and the `/events` stream from the current node's server, and `claude
agents --json` for session state; it writes only `hub` commands (`hub send`, `hub up`,
`setup <path>`) and its own `hub-view.json`. It never spawns, never reads the manifest,
never touches `.claude/settings.json`. That keeps it portable (any node, any machine),
keeps the server the one path (routing-tree §14.1), and lets the host terminal be
swapped without rewriting the panels.

The three panels and the pinned blocks are **served by the hub as small local web
pages** (`GET /view/agents`, `/view/folders`, `/view/cron`, `/view/pin/top`,
`/view/pin/bottom`, `/view/feed`): plain HTML and a few hundred lines of JS, updated
over `/events`. Circles, toggles, a spinning cross and a gear are trivial in HTML and
awkward in text cells, so this is the one implementation; the terminal host only has to
show a local URL beside a terminal. A text-only fallback, `hub view --tui`, draws the
same panels in the terminal for SSH and cloud sessions, from the same JSON.

It lives in `tools/hub/view/`, same repo and same CLI as the server (`hub view`), so the
API and its only client change in one commit (Decision 3).

## 2. The panels

**Agents panel (top third).** One row per role of the current node, from `/agents`,
which joins the registry's `roles` with the server's process state and the sessions
recorded in `/sessions`:

| glyph | state | source |
|---|---|---|
| green circle | working | `cold`/`warm`: the server's own process state (running); `window`: `claude agents --json` `status: busy` for the recorded session. The JSON's `pid`, `status` are present "While the process is alive" as "Process ID and one of `busy`, `waiting`, or `idle`" (<https://code.claude.com/docs/en/agent-view#list-sessions-as-json>) |
| yellow circle | awaiting commands | `window`/`warm`: `status: idle` or `waiting`, with `waitingFor` as the tooltip: "`permission prompt` for an approval, `input needed` for a question from Claude or an MCP server's input request" (same anchor) |
| red circle | in the registry, not spawned | the role exists in `hub.json` and no process or session is known. Jacob said "in the manifest.json"; `hub.json` is rendered from the manifest at the top node, so the set is the same, and the view never opens the manifest (Decision 4) |

To the left of each circle, an **on/off switch** controlling whether that agent's events
appear in the **feed**: the single scrolling block of one-line events the server emits
(`spawned`, `tool: Bash`, `report: …`, `write-request: register`, `held`,
`dead-letter`) for every agent whose switch is on. Interactive tabs (planner,
dispatcher) are always in the tab bar; the switch does not close a tab (Decision 2 asks
Jacob to confirm this reading of "what I am seeing in the single terminal view").
Clicking an agent's name opens its tab: `claude attach <id>`, "Attach to a background
session in this terminal" (<https://code.claude.com/docs/en/cli-reference#cli-commands>),
for a warm or window session; `hub log --role <name>` for a cold role, which has no
session to attach to between messages.

**Folders panel (middle third).** One row per direct subfolder of the node root, from
`/folders`, which joins the parent's children state with a one-level filesystem scan:

| glyph | state | source |
|---|---|---|
| white circle, green cross | a node with its server up (registered child, `/health` answering) and at least one session or process alive there | the parent's children state plus the child's own `/agents` |
| white circle, yellow cross | a node (a git repo with `hub.json`) whose server is down, or up with nothing alive | same |
| white circle, red cross | a folder managed by this node: no git repo, or a git repo with no `hub.json` | the filesystem |

Clicking a folder rotates the cross to an X and shows that folder's agents in the same
shape as the agents panel, fetched from **the child's own** `/agents`, one level at a
time. The parent's server still stores no grandchild (routing-tree §1); the view walks
the tree by following links. A red folder has nothing to expand; its row offers "set up
as a node", which runs `setup <path> --node` (PLAN-hub.md "Setup component").

**Cron panel (bottom third).** The next N runs from `hub cron --json` (PLAN-hub.md §7),
each as `HH:MM  job-name  (schedule)`, with disabled jobs greyed. `hub cron --json`
shells out to `chron.py list --json`, which does not exist yet: it is a request to the
`cron-scheduler` agent, recorded in `TODO.md`. Read-only in V2; enabling and disabling
through `chron.py` is a later request, not this plan.

**Gear (top left) → settings.** Writes `hub-view.json` next to `hub.json` (gitignored,
per machine; already in PLAN-hub.md's `.gitignore` list). Keys: `node` (the root whose
server the view talks to, "changing the directory"), `tabs` (`[{name, command, cwd}]`,
default `[{Planner, "claude --agent planner"}, {Dispatcher, "claude"}]` run at the node
root), `folders` (extra roots to show), `icons` (per state: glyph, colour), `pins` (§3),
`feed.default_on`. "Adding a folder" runs `setup <path>` and then `hub register`;
`--github` is outward-facing and asks first (Decision 5). Settings never touch
`.claude/settings.json`, which stays Jacob's (PLAN-repo-setup.md §2).

## 3. Pinned blocks

Two blocks, above and below the terminal area, each bound to a **source**: a file path,
a hub endpoint (`/held`, `/status`, the planner's last `## Decisions` table from `hub
log`), or literal text; configured in `hub-view.json` and editable from the gear. A
block re-renders when its source changes (SSE for endpoints, a file watch for files).
A block whose source is missing shows `source missing: <path>`, never stale text.

## 4. The host terminal

Three ways to put these panels beside a terminal, with what each costs. Jacob chooses
(Decision 1); the panels are the same in all three. **These rows cite software outside
Claude Code's documentation, so `kb check` cannot verify them; the quotes were read from
the projects' own source files on GitHub on 2026-10-04 and are to be re-read on Jacob's
machine in V0.**

| host | how the view arrives | fits the request | risk |
|---|---|---|---|
| **A. Wave Terminal** (Apache-2.0; Go backend, Electron/React front end, <https://github.com/wavetermdev/waveterm>) | no fork at first. Wave's unit is the **block** in a per-tab layout with tabs and a right **widget sidebar** configured in `widgets.json`: "By adding a widget to this file, it is possible to add widgets to the widget bar" (<https://docs.waveterm.dev/customwidgets>). `wsh` creates and places blocks from the shell: "The run command creates a new terminal command block and executes a specified command within it", blocks can be opened magnified or placed, `wsh web` "opens URLs in a web block", `wsh badge` "sets or clears a visual badge indicator on a block or tab header", `wsh notify` "creates a desktop notification" (<https://docs.waveterm.dev/wsh-reference>). `hub view` writes a `widgets.json` entry per panel (a `web` block at the hub's URL), lays out the default tab (planner terminal, pinned `web` blocks above and below, the sidebar column), and badges a tab when its agent needs input | tabs, blocks and a configurable sidebar are native; pinned blocks are literally blocks; the gear is a widget | **docs.waveterm.dev was unreachable from the cloud container** (egress blocked); the quotes come from the docs' source files on GitHub and must be probed on Jacob's machine (V0). Young project; layout persistence across restarts to confirm |
| **B. Tabby** (MIT; Electron, TypeScript, xterm.js, <https://github.com/Eugeny/tabby>) | a plugin: "A plugin should only provide a default export, which should be a `NgModule` class", loaded from the user's plugins directory or `TABBY_PLUGINS` (<https://github.com/Eugeny/tabby/blob/master/HACKING.md>). The plugin adds the sidebar and pinned blocks as Angular components around the terminal tab and a settings tab for the gear; the panels are the same hub-served pages in webviews | tabs and split panes native; a mature plugin API | Angular; whether a plugin can wrap the terminal tab's DOM without a fork is unverified: probe, else fork |
| **C. No fork: a tmux layout in the terminal Jacob already uses** | `hub view --tui` opens a tmux session: main pane (`claude --agent planner`), thin top and bottom panes (`hub pin top|bottom`), a right column of three panes (`hub panel agents|folders|cron`), one tmux window per tab. iTerm2 renders tmux panes natively: Claude Code's own `--tmux` flag "Uses iTerm2 native panes when available" (<https://code.claude.com/docs/en/cli-reference#cli-flags>) | works over SSH and in a cloud session; one language; zero dependency on a host's API | glyphs not icons, no spin, no gear; panes not overlays. This is the fallback that ships with every host anyway |

**Recommendation:** A, with C always present as the fallback. Wave's native concepts
(blocks, tabs, sidebar, `wsh`) are the request's nouns, so V1 needs no fork; a fork of
Wave is considered only when a feature cannot be reached through `widgets.json`, `wsh`
and web blocks, and that is a decision then, not now. Rendering the panels as
hub-served pages is what makes the host swappable: if A disappoints, B shows the same
pages in a plugin and nothing in the hub changes.

## 5. What the view needs from the server that nothing else does

`/agents` (roles joined with process and session state), `/folders` (children state
plus a one-level filesystem scan of the node root), `/events` (SSE of ledger rows and
state changes), `/view/*` (the pages), `hub cron --json`. All documented in
`docs/API.md`, all under PLAN-hub.md §8's help-equals-implemented gate. `claude agents
--json` is polled every 3 s while a view is attached and not at all otherwise, since it
"is the supported way to read session state from outside Claude Code" and "The files
under `~/.claude/jobs/<id>/` are not a stable interface"
(<https://code.claude.com/docs/en/agent-view#read-session-state-from-a-script>).
`Notification` hooks with the matchers "`agent_needs_input`, `agent_completed`"
(<https://code.claude.com/docs/en/hooks#notification>) are installed as telemetry-only
HTTP hooks posting to `/hooks/notification`, so a needs-input state reaches the panel at
once rather than at the next poll; HTTP hooks fail open ("Connection failure:
non-blocking error, execution continues",
<https://code.claude.com/docs/en/hooks#http-response-handling>), which is correct for
telemetry and is why no enforcing hook is HTTP (PLAN-group-servers.md §2). Polling and
SSE spend wall clock and no tokens.

## 6. What it does not do

- **No spawning.** The view sends envelopes (`hub send`) and opens tabs; the server
  spawns. A view that could spawn would be a second dispatcher.
- **No reading of the roster.** The red state comes from `hub.json`; PLAN-hub.md §8's
  direction audit covers `tools/hub/view/`.
- **No store.** The view caches nothing between runs but `hub-view.json`'s preferences;
  every panel is a live read (routing-tree §14.1).
- **No writes outside `hub-view.json`** and, on the Wave host, the one `widgets.json`
  entry `hub view` owns (marked, idempotent, removed by `hub view --uninstall`).
- **No settings of Jacob's.** `.claude/settings.json` is never read or written.
- **No approval.** A click in the view is Jacob's action in the view, not an approval
  the server can see: the server stamps `origin` from transcripts, never from the UI.

## Gates

| gate | proves | phase |
|---|---|---|
| **endpoints documented** | a static scan of `tools/hub/view/` finds only paths in `docs/API.md`; every `/view/*` route is served (PLAN-hub.md §8 help == implemented, applied to the client) | V1 |
| **three states, driven** | fixtures for `/agents` saying busy, idle, waiting, absent render green, yellow, yellow with tooltip, red; the same for `/folders` (up and alive, up and empty, down, no `hub.json`, not a repo); the TUI renders the same fixture to the same words | V1 |
| **the switch changes the output** | with a fixture feed of two agents, toggling one removes exactly its lines and toggling back restores them; `feed.default_on: false` starts every switch off | V1 |
| **expand walks, never stores** | expanding a folder in a two-level fixture calls the child's `/agents` and nothing on the parent records the grandchild | V1 |
| **pinned block tracks its source** | changing a file source changes the block within one watch interval; a changed endpoint changes it on the next SSE event; a deleted source shows `source missing` | V3 |
| **settings write one file** | every gear action changes only `hub-view.json` (a checksum of the tree before and after, excluding it); "add folder" with `--github` is refused without a confirmation | V2 |
| **cron panel reads, never writes** | `hub cron --json` against a fixture `chron.py` renders the rows; no gear action produces a `chron.py` write verb | V2 |
| **host probe** | the V0 script's pass conditions, recorded as a result file: a `web` block shows `/view/agents`; `wsh run -m` places a block; `wsh badge` marks a tab; the layout survives a restart. Each is a line in the file with pass or fail; a fail picks B or C | V0 |
| **idempotent host install** | `hub view` run twice leaves one `widgets.json` entry; `hub view --uninstall` leaves none and the rest of the file byte-identical | V1 |
| **direction audit** | PLAN-hub.md §8's audit, run over `tools/hub/view/` too | every phase |

## Phases

All local (each opens a terminal on Jacob's machine), after PLAN-hub.md H3. No phase is
over 200k (PLAN-check-progress.md §7, as in the hub plan).

| # | phase | contents | cost |
|---|---|---|---|
| **V0** | the host probe (Jacob's hour) | with Wave installed: a `web` block at `http://127.0.0.1:<port>/view/agents` against a stub page, `wsh run -m`, `wsh badge`, a restart; the result file in `tools/hub/probes/`. If Wave fails any clause, the same four lines for Tabby (a plugin skeleton that adds one toolbar button and one webview); C needs no probe | 20–40k (1u) |
| **V1** | agents and folders | `/agents`, `/folders`, `/events` (SSE); the hub-served pages for the two panels and the feed; the switch; expand to a child's `/agents`; `hub view` writing the host's layout (two tabs, planner and dispatcher, the sidebar column) and `--uninstall`; `hub view --tui` for the same two panels; the V1 gates | 150–200k (5–7u) |
| **V2** | cron and settings | `hub cron --json` (after `chron.py list --json` exists), the cron panel, the gear with `node`, `tabs`, `folders`, `icons`, `feed.default_on`, "add folder" through `setup <path> --node` with the `--github` confirmation; `hub-view.json`; the V2 gates | 150–200k (5–7u) |
| **V3** | pinned blocks and polish | top and bottom blocks from file, endpoint and text sources; per-state icon overrides; click-to-attach (`claude attach <id>` in a tab); tab badges on `agent_needs_input`; TUI parity for pins and cron; the V3 gates | 120–180k (4–6u) |

Total 440–620k (15–21u), local, after H3. Order: V0 → V1 → V2 → V3. V2's cron panel
waits on cron-scheduler's `list --json`; if that lands late, V2 ships the gear first and
the cron panel joins V3.

## Setup component

Nothing per repo. `hub-view.json` is per machine, written by the gear, and already in
PLAN-hub.md's `.gitignore` list. On the Wave host, `hub view` installs one marked entry
per panel in Wave's `widgets.json` and the default tab layout, idempotently, and `hub
view --uninstall` removes them; on the Tabby host the plugin is the install; the tmux
fallback installs nothing. `setup` gains no component for the view.

## Risks

- **The host is unverified from here.** Wave's documentation site was blocked from the
  cloud container; the quotes in §4 come from the docs' source files on GitHub and from
  the README. V0 exists to settle this before V1 spends anything.
- **The request lives only in a transcript.** The planner never saw Jacob's message;
  this file quotes it in full so the planner can check this plan against his words
  rather than against the first draft's paraphrase.
- **An Electron host is a heavier dependency than anything else in `tools/`.** The
  hub-served pages keep the hub free of it: the view's host is a local preference, and
  the tmux fallback needs nothing.
- **Session state is polled.** Three seconds is the chosen interval; a role that
  starts and finishes inside it shows nothing in the panel but its feed lines and
  ledger row. `/events` carries the server's own state at once; only `window` sessions
  depend on the poll.
- **"Awaiting commands" has two sources** for a window: the poll (`status: idle`) and the
  `Notification` hook (`agent_needs_input`, which the agent-view page says fires "when a
  local background session starts needing your input"). The hook is for background
  sessions; an interactive window's idle state is the poll's. The panel shows whichever
  arrived last and the tooltip says which.

## Decisions

| # | decision (§n pointer first) | hinges on | recommend |
|---|---|---|---|
| 1 | §4: the terminal host: A (Wave Terminal, no fork, hub-served panels in web blocks), B (a Tabby plugin), or C (tmux layout only) | whether the request's icons, switches and spin need a DOM, and V0's result on Jacob's machine | A, with C as the fallback that ships in every case. **Jacob, 2026-10-05: A, "wave with tmux"**; V0 confirms Wave on his machine, and a failed clause falls to C, not B |
| 2 | §2: the on/off switch controls an agent's membership in the feed block, not whether its tab exists | what Jacob meant by "what I am seeing in the single terminal view" | yes. **Jacob, 2026-10-05: yes** |
| 3 | §1: the view lives in `tools/hub/view/`, same repo and CLI (`hub view`), not a separate `tools/hub-view/` | keeping the API and its only client in one commit against the cost of a larger repo | yes |
| 4 | §2: red in the agents panel means "in `hub.json`, not spawned", where Jacob said "in the manifest.json"; `hub.json` is rendered from the manifest so the set is the same, and the view never opens the manifest | the fixed point that the hub reads no roster | yes |
| 5 | §2: the gear's "add folder" runs `setup <path> --node` and asks before `--github`; "change directory" switches the node the view talks to | whether settings may run `setup` from the view | yes |
| 6 | Phases: V0 is Jacob's own hour on his machine before V1 is dispatched, and its result file decides the host | whether Jacob would rather deep-work run the probe in a local session | Jacob runs it |
