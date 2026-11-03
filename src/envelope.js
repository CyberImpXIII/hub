'use strict';
// The envelope (routing-tree §2; PLAN-hub.md §3): one shape, validated at every hop.
// A sender may set id, conversation, from, to, tag, ref, body, approval, hops,
// estimate, checkpoint and session_id; the server sets origin, origin_id, kind and
// refs itself and overwrites whatever a sender wrote there (fixed point 4). A message
// that fails validation is never forwarded: dead-letter, with a notice.

const crypto = require('node:crypto');
const { validate } = require('./schema');

// `from` and `to` are paths like `claudeTest/site-scrapers/tester`: node names and
// role names, slash-separated, no empty segment.
const PATH_RE = '^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*$';
const TAG_RE = '^[a-z][a-z0-9-]*$';

const SCHEMA = {
  type: 'object',
  required: ['from', 'body'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 1 },
    conversation: { type: 'string', minLength: 1 },
    from: { type: 'string', pattern: PATH_RE },
    to: { type: ['string', 'null'], pattern: PATH_RE },
    tag: { type: 'string', pattern: TAG_RE },
    ref: { type: ['string', 'null'] },
    body: { type: 'string', minLength: 1 },
    approval: { type: ['string', 'null'] },
    hops: { type: 'integer', minimum: 0 },
    estimate: { type: 'integer', minimum: 1 },
    checkpoint: { type: ['string', 'null'] },
    session_id: { type: ['string', 'null'] },
    transcript_path: { type: ['string', 'null'] },
    kind_hint: { type: ['string', 'null'] },
    // the server's fields, accepted on the way in and overwritten
    origin: { type: ['string', 'null'] },
    origin_id: { type: ['string', 'null'] },
    kind: { type: ['string', 'null'] },
    refs: { type: 'array' },
    routed_by: { type: ['string', 'null'] },
    released: { type: 'integer' },
    gate: { type: ['string', 'null'] },
  },
};

// Findings for one envelope ([] when it holds), with the one rule the shape cannot
// say: a tag or a `to`, else nothing routes it (rule 4 still takes it, so it is a
// finding only when both are absent AND the body is the whole message).
function findings(env) {
  if (!env || typeof env !== 'object' || Array.isArray(env)) return ['envelope: not a JSON object'];
  const f = validate(SCHEMA, env, 'envelope');
  if (f.length) return f;
  if (!env.tag && !env.to) f.push('envelope: neither a tag nor a `to`: nothing can route it');
  return f;
}

// The item hash admission dedupes on (PLAN-auto-relay.md §4 reason 1; §9 point 3):
// what the message is, not when it was sent. Whitespace collapsed.
function itemHash(env) {
  const norm = (s) => (s === undefined || s === null ? '' : String(s).replace(/\s+/g, ' ').trim());
  return crypto.createHash('sha256').update([norm(env.from), norm(env.to), norm(env.tag), norm(env.ref), norm(env.body)].join('\u0001')).digest('hex').slice(0, 16);
}

// A sender's own values for the server's fields are discarded here, before anything
// reads them (fixed point 4: origin stamped by the server, never by the sender).
function strip(env) {
  const out = { ...env };
  for (const k of ['origin', 'origin_id', 'kind', 'refs', 'routed_by', 'released', 'gate']) delete out[k];
  if (out.hops === undefined) out.hops = 0;
  if (!out.id) out.id = crypto.randomUUID();
  if (!out.conversation) out.conversation = out.id;
  return out;
}

module.exports = { SCHEMA, findings, itemHash, strip };
