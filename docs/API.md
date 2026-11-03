# hub server API

The routes a node's server serves (PLAN-hub.md §3, H1a-0 and H1a-0b). Each `### METHOD /path`
heading below is one served route, and every served route has one:
`tests/hub/help.test.js` diffs these headings with `src/server.js`'s `ROUTES`, both
ways. The server binds `127.0.0.1:<server.port>` from `hub.json`.

**Every request** carries `Authorization: Bearer <HUB_TOKEN>`, or is answered
`401 {"error": "token refused"}` and nothing else happens. An unknown path is `404`,
a known path with the wrong method `405`. Bodies are JSON both ways.

The program reads `HUB_TOKEN` from its environment only and from no file (hb-69,
answered `env` 2026-10-20; PLAN-hub.md §2, §3 step 1): the harness sets it when it
registers the hook. The program never opens `.claude/` (PLAN-hub.md §8, "direction
audit").

### GET /health

`{"ok": true, "name": <hub.json node>, "pid": <server pid>}`. `hub status` asks this
first, within 800 ms, and `hub up` waits on it.

### GET /status

`{"name", "up": true, "port", "pid", "queued", "held", "dead_letter", "children": [{"name", "registered"}], "stores_json": "present"|"missing"|"invalid"}`.
In H1a-0 the server holds no queue, held message or dead letter, so the three counts are
0; `children` lists `hub.json`'s expected children, none registered (H3 registers them).
`hub status --json` prints this object plus `auth`; when the node is down it prints the
same keys with `up: false` and `pid`, `queued`, `held`, `dead_letter` null.

### GET /routes

`{"node", "routes": [{"tag", "kind", "target", "via", "by"}]}`: the node's tag table,
each tag resolved (PLAN-hub.md §2 `tags`; §8 "vocabulary"). `kind` is the question kind
of a nested entry, else `null`; `via` is `role`, `child` or `reserved` (`@from`,
`@owner`, `@dir`, `@write`, `@check`), or `null` for a target nothing declares, which
`hub check` fails; `by` is `tags` for a `tags` row and `repos` for a tag a `repos` row
declares with no `tags` row, routed to the role or child of the repo's name. `hub routes`
prints the same table; no routing runs through it yet (H1a-2's `/route`).

### POST /write-request

The write gate. Body: `{role, tool, file?, targets?, cli?, verb?, args?, cwd?}`.

- `role`: a `roles` key in `hub.json`; anything else is denied.
- `tool`: `Edit`, `Write`, `NotebookEdit` or `MultiEdit` with `file`; or `Bash` with
  either `cli` and `args` (a call to a CLI a `repos` row names) or `file` and
  `targets` (a Bash write naming no CLI).
- `verb`: optional; when absent the server finds it in `args` (the longest declared
  verb whose words appear as consecutive positional arguments).
- `cwd`: the call's working directory; relative paths and a CLI given by relative path
  resolve against it, and a CLI call naming no path argument writes the stores there.

Answer: `{"decision": "allow"|"deny", "reason": <one line>, "use": {"cli", "verbs"}|null, "ledger": <row id>}`.
An unparseable body is `400` with the same shape and `decision: "deny"`.

**The rule:** allow only a declared verb on a store the role may write.

- What a role may write is derived from `owners` (Decision 17): `workspace` when
  `owners.workspace.roles` names it, and the `repos` row whose directory is the role's
  `dir`. There is no per-role list.
- Which paths are stores is `stores.json` at the node root:
  `{"stores": 1, "entries": [{"path": <root-relative glob>, "declared_by": <repos key>}]}`.
  The verbs are the `declared_by` repo's `cli.json` (`cli`, `verbs`). Until the
  renderer that owns `stores.json` writes it, it is a fixture; with it missing or
  invalid, every CLI write is denied, since its store cannot be placed.
- An Edit, Write, NotebookEdit or MultiEdit of any file is denied. When the file is a
  store, `use` names its declaring CLI and verbs and the reason says
  `write it through <cli> <verb>|<verb>`.
- A Bash write naming no CLI is denied the same way.
- A CLI call is denied when the CLI is no `repos` row's, its `cli.json` is missing, the
  verb is not declared there, no store it declares is named (by a path argument, a
  directory argument, or the working directory), or any store it names is owned by a
  name the role does not derive. Otherwise it is allowed.
- The server never runs the verb (H1b's `write` service does); an allowed call runs as
  the caller's own tool call.

**Every answer is one ledger row** in `<root>/.hub/ledger.jsonl`:
`{id, ts, route, by: "server", role, tool, cli, verb, targets, decision, reason}`. A
row holds the store paths the call was judged on, never its arguments. The hook's own
denies (server down, no token, an unparseable call) are rows with `by: "hook"`.

### POST /read-request

The read route (PLAN-hub.md §3 H1a-0b). Body: `{role, tool, id?, path?, store?, cwd?}`,
one of `id`, `path` or `store`.

- `role`: a `roles` key in `hub.json`; anything else is denied. Nothing else is: **reads
  are never denied for being unowned** (PLAN-services.md §3 step 3, "The hub owner's
  four questions" 3).
- `id`: a word of the form `<prefix>:<rest>`. When `<prefix>` is a key of `hub.json`'s
  `stores` (prefix → repos key, §12) and the owner's declared pattern, if any, matches
  (its `services.json` `ids`: `[{prefix, pattern, get}]`), the answer is `kind:
  "store"` with the store's repos key and its `get` (`{cli, verb}` from that `ids` entry
  and the repo's `cli.json`, or `null` when none is declared). Any other word is prose:
  `kind: "plain"`.
- `path`: resolved against `cwd` (else the node root). A path `stores.json` lists is
  `kind: "store"` with its `declared_by` repo and that repo's `get`; any other path,
  owned or not, is `kind: "plain"`. With `stores.json` missing or invalid every path is
  `plain`, the reason says so, and `hub status` reports the file.
- `store`: a repos key, for a declared CLI's `get` verb called with no id; `kind:
  "store"` with that repo's `get`.

Answer: `{"decision": "allow"|"deny", "kind": "store"|"plain"|null, "store": <repos key>|null, "get": {"cli", "verb"}|null, "reason": <one line>, "ledger": <row id>}`.
An unparseable body is `400` with `decision: "deny"`.

**In H1a-0b the server names the `get` and never runs it:** `hub get <id>` is H1a-2's
(`ctx:`) and R1's. An allowed store read runs as the caller's own tool call, and the
ledger row says which store it read. The hook (`hub hook gate`) sends only store reads
here, classified from disk (`stores.json`, `hub.json`'s `stores`, the owners' `ids`),
so a plain read makes no server call and leaves no row; with the server down a store
read is denied by the hook with the `hub status` line, as a write is, and a plain read
still passes.

**Every answer is one ledger row**, as for `/write-request`, plus `id`, `store` and
`kind`; `verb` is the `get` verb when one is declared and `targets` the store path when
the read named one.

### GET /limits

`{"limits": [{"name", "value", "where", "enforced_in"}]}`: every `limits` key, its
`hub.json` value, where the server reads it and the phase that enforces it (PLAN-hub.md §8
"limits both ways"; `hub limits` prints the same). H1a-2 enforces `hops`,
`budget_per_conversation`, `stub_chars` and `question_max_blocks`; the others are
declared and read from here when their phase lands.

### GET /ledger

`?since=<ts>&kind=<k>&limit=<n>` → `{"total", "rows": [...]}`: the ledger's rows, the last
200 unless `limit`; `kind` matches a row's `kind`, `route` or `decision`. `hub log` reads
the file directly.

### GET /held

`{"held": [{"id", "reason", "ts", "envelope", "decision", "limit"?, "value"?, "gate"?}]}`:
the messages admission holds (the budget, the usage gate), each also a file under
`.hub/held/`. A prompt Jacob types releases them once (`/sessions/:id/prompts`).

### GET /dead-letter

`{"dead_letter": [{"id", "reason", "ts", "envelope"}]}`: where a failed message rests
(invalid, hop limit, unresolvable owner, delivery failed), each a file under
`.hub/dead-letter/`. Its failure went to the owner of its seam kind as a message.

### GET /sessions

`{"sessions": [{"session_id", "agent_type", "role", "cwd", "permission_mode", "socket", "ts"}]}`:
the window and role sessions recorded, the latest per role being the one a delivery
reaches.

### POST /sessions

Body `{session_id, agent_type, cwd?, permission_mode?, socket?}`, from `hub hook
session-start` (PLAN-hub.md §1 `record-session.sh`). `role` is the `roles` key whose
`agent` is `agent_type`, else `agent_type` itself. Answer `{"recorded": true, "role",
"bypass"}` (`bypass`: a permission mode that bypasses prompts, so a relay to that window is
held unseen), or `{"recorded": false, "reason"}`. One ledger row (`kind: session`) and
one file under `.hub/sessions/`.

### POST /sessions/:id/prompts

Body `{hash, ctx_id?}`, from `hub hook user-prompt`: the hash of a prompt the session just
took and the id the prompt store returned. The server says who typed it: `origin:
"model"` when the hash is one of a text the hub itself delivered to that session's socket
(a relay), `"jacob"` otherwise (fixed point 4; PLAN-hub.md §3 origin). A prompt of
Jacob's releases every held message once and resets the budget counts; the answer
carries `released` and each one's result. One ledger row (`kind: prompt`).

### POST /route

Body: one envelope, or `{"envelopes": [...]}` for several in one connection. An envelope
(routing-tree §2): `{from, body, to?, tag?, ref?, approval?, conversation?, id?, hops?,
estimate?, checkpoint?, session_id?, transcript_path?, kind_hint?}`; `origin`,
`origin_id`, `kind`, `refs` and `routed_by` are the server's and overwritten whatever a
sender sent. Answer `{"results": [{id, decision, target, via, rule, routed_by, origin,
origin_id, reason, ledger}], "registry_hash"}`. For each envelope, in this order and with
no model (PLAN-hub.md §3; routing-tree §14.3):

1. **validate**: a shape finding is a dead letter, a `delivery` failure message to the
   `owners` row, and a notice to the sender;
2. **identical**: the item hash (from, to, tag, ref, body) already delivered, queued or
   held → `dropped`, with a notice;
3. **hops**: incremented; past `limits.hops` → dead letter (a `limit` row names it);
4. **origin**: stamped from the sender's session (`session_id`, else the latest session
   recorded for the `from` role): `jacob` only when the turn's prompt (the transcript's
   last user line with string content, else the latest record) is one the user-prompt
   hook recorded as typed; on `jacob` the prompt's `ctx:` id is `origin_id` and its stub
   (the store's first line cut at `stub_chars`) travels in `refs`, never the text; a body
   carrying more than `stub_chars` of the record verbatim is flagged `pasted` in the
   ledger and the sender told, the message still delivered;
5. **route** (routing-tree §3): rule 1 `to` names a role here; rule 2 `to` starts with a
   child's path; rule 3 the tag table (a nested `question` entry by `kind_hint`; `@from`
   back to the sender's role, `@owner` and `@dir` by the ref's path, `@write`/`@check`
   to the service); rule 4 the dispatcher (`routed_by: dispatcher`), or up to the parent
   when one exists and `to` is outside this node; an unresolvable `@owner` is a dead
   letter;
6. **the usage gate** before a delivery that would start a role (a `process` or `driven`
   target): `services.usage.cli <estimate>` (the envelope's `estimate`, else
   `unit_tokens`); exit 0 goes; `warn` holds unless the envelope names a `checkpoint`;
   `hold` holds with the gate's line and one notice to the dispatcher; a missing
   executable holds every spawn and says so; no `services.usage` row: the gate is off;
7. **the budget**: a message that starts a model turn (delivered to a role; not one
   handed to a service, not a `write-request`/`check-request`) counts against
   `limits.budget_per_conversation` per conversation since Jacob last typed; past it →
   `held`, the row names the limit and its value, the sender gets a notice;
8. **deliver**: a `window` role gets one message line on its recorded socket (the shape
   of auto-relay §3's probe), `[hub] <tag> from <from>, origin: <o>[, origin_id: <id>]
   <stub>` then the body then `[ref; approval; id; conversation]`; a `process`/`driven`
   role's message is queued under `.hub/queue/<role>/` for the spawner (H1b); a service's
   under `.hub/queue/@<service>/`; a child's goes to the dispatcher with a notice until
   H3 registers children; a window with no socket, or a socket that refuses, is a dead
   letter and a `delivery` failure message.

**Every decision is one ledger row** (`route: /route`) with the envelope, its item hash,
the registry hash that produced the decision, `decision` (delivered | queued | held |
dropped | dead-letter), `target`, `via`, `rule`, `routed_by`, `origin`; so a row replays
to the same decision against the same registry (§8 "determinism").

**A failure the server detects is a message, not a log line** (routing-tree §13.3,
§14.7): a `delivery`-kind envelope from `<node>/hub` to the `owners.delivery` row (a role:
delivered or queued; a name no role carries: queued under `.hub/queue/<name>/`; no row:
the dispatcher, `routed_by: dispatcher`). `hub status` counts model turns by the step
that caused them (`turns`).

## The pidfile, and the state `hub up` restores

`<root>/.hub/server.json`: `{name, pid, port, started, registry_hash}`, written when the
server listens and removed when it stops on SIGTERM or SIGINT. `registry_hash` is
`sha256:` of `hub.json`'s bytes as read at start.

A server that starts reads its state back from `.hub/` (PLAN-hub.md §3 step 3): held
messages from `.hub/held/<id>.json`, dead letters from `.hub/dead-letter/<id>.json`
(each file one JSON object; `/status` counts them), sessions from `.hub/sessions/`,
queued messages from `.hub/queue/*/`, the prompt records and delivered hashes from the
ledger, and the ledger itself, `.hub/ledger.jsonl`, which is append-only and never
truncated. `hub up` that finds the node down behind a
stale pidfile writes one ledger row of kind `restart` (`stale_pid`, `stale_started`)
before it starts the new process; `hub status --restarts` counts those rows (PLAN-hub.md
§7).
