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

## The pidfile

`<root>/.hub/server.json`: `{name, pid, port, started, registry_hash}`, written when the
server listens and removed when it stops on SIGTERM or SIGINT. `registry_hash` is
`sha256:` of `hub.json`'s bytes as read at start.
