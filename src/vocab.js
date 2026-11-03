'use strict';
// The message vocabulary the program consumes (PLAN-hub.md §2, routing-tree §2,
// §14.7; PLAN-question-routing.md §2). hub.schema.json carries the same lists as
// enums, and tests/hub/registry.test.js holds the two equal both ways. Nothing
// here names a repo, a role or a command: these are the KINDS of things, and which
// repo or role answers a kind is hub.json's data.

// A role's mode (what the server does with it) and a process role's lifetime (§4).
const MODES = ['window', 'process', 'driven'];
const LIFETIMES = ['per-task', 'kept'];

// Seam kinds the server sets on a failure it detects (routing-tree §14.7), each an
// `owners` row or the explicit `unowned` default. `bug-report` is the one kind a
// role sets; it routes by `@owner` and has no row.
const SEAM_KINDS = ['delivery', 'lease', 'check-broken', 'check-red', 'hook-broken', 'hook-block', 'tool-result'];
const UNOWNED = 'unowned';
const WORKSPACE = 'workspace';
const OWNER_KEYS = [...SEAM_KINDS, UNOWNED, WORKSPACE];

// Reserved route targets (§2 `tags`): back to the sender, the owner of the path a
// ref names, the role whose dir holds it, and the two services an envelope may be
// handed to instead of a role.
const RESERVED_TARGETS = ['@from', '@owner', '@dir', '@write', '@check'];

// The question kinds a nested `tags` entry routes by (PLAN-question-routing.md §2).
const QUESTION_KINDS = ['dispatch', 'plan', 'context', 'settings'];

// The four services of routing-tree §14.6, each on or off at a node, plus the
// usage gate's CLI row (§3).
const SERVICES = ['route', 'write', 'check', 'hook'];
const USAGE_SERVICE = 'usage';

// How a node's server is kept up (§7): the one value today, and the stage after it.
const KEEP_ALIVE = ['session-start', 'launchd', 'none'];

// Every limit the server enforces is a `limits` value (Decision 4). The server's
// export of what it enforces is diffed against this list both ways (§8 "limits
// both ways"), so a key added here without an enforcer, or an enforcer without a
// key, fails.
const LIMITS = ['hops', 'budget_per_conversation', 'pingpong_hold', 'heartbeat_s', 'heartbeat_misses', 'stub_chars', 'role_silence_s', 'role_daily_budget', 'question_max_blocks'];

// The relay kinds the hooks tag their envelopes with (PLAN-hub.md §1: the first
// entries of a node's tag vocabulary); a node routes them in its `tags`, and a tag
// with no row falls to the dispatcher by rule 4.
const RELAY_TAGS = { dispatch: 'dispatch', malformed: 'dispatch-malformed', question: 'question', report: 'report' };

module.exports = { MODES, LIFETIMES, SEAM_KINDS, UNOWNED, WORKSPACE, OWNER_KEYS, RESERVED_TARGETS, QUESTION_KINDS, SERVICES, USAGE_SERVICE, KEEP_ALIVE, LIMITS, RELAY_TAGS };
