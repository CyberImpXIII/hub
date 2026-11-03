'use strict';
// The routing decision (routing-tree §3, in order; PLAN-hub.md §2 `tags`), pure over
// the registry and the envelope so the same envelope and the same registry hash
// always give the same decision (§8 "determinism"): no model, no clock, no state.
//
// decide(d, env) -> {rule, target, via, kind, routed_by, reason}
//   rule 1  `to` names one of this node's roles             via 'role'
//   rule 2  `to` starts with a direct child's path          via 'child'
//   rule 3  this node's tag table names a role, a child, or a reserved target
//   rule 4  otherwise: the node's dispatcher, routed_by: dispatcher
// A reserved target is resolved here as far as the registry allows: @from to the
// sender's role, @owner and @dir to the role whose repo or dir holds the ref's path,
// @write and @check to the service of that name. What a reserved target needs and
// the registry lacks (an unresolvable @owner) is a dead letter, said in `reason`.

const reg = require('./registry');
const V = require('./vocab');

function dispatcherOf(d) {
  const roles = d.roles || {};
  const name = Object.keys(roles).find((r) => roles[r] && roles[r].fallback === true);
  return name || null;
}

function lastSegment(p) { const s = String(p || '').split('/'); return s[s.length - 1]; }

// The path a ref names, root-relative, or null (a `FILE §n` pointer names FILE).
function refPath(d, ref) {
  if (typeof ref !== 'string' || !ref) return null;
  const m = /^(\S+?)(?:\s+§.*|:\d+)?$/.exec(ref.trim());
  const p = m ? m[1] : ref.trim();
  if (/^TODO\.md$/.test(p) || /\.md$/.test(p) || p.includes('/')) return reg.cleanRel(p);
  return null;
}

function roleForDir(d, rel) {
  if (rel === null) return null;
  const roles = d.roles || {};
  let best = null;
  for (const [name, r] of Object.entries(roles)) {
    if (typeof r.dir !== 'string') continue;
    const dir = reg.cleanRel(r.dir);
    if (dir && (rel === dir || rel.startsWith(`${dir}/`)) && (!best || dir.length > best.dir.length)) best = { name, dir };
  }
  return best ? best.name : null;
}

function resolveReserved(d, env, target) {
  const rel = refPath(d, env.ref);
  switch (target) {
    case '@from': {
      const role = lastSegment(env.from);
      if (d.roles && d.roles[role]) return { target: role, via: 'role', reason: `@from: back to ${role}` };
      return { target: null, via: null, reason: `@from: ${env.from} names no role of this node` };
    }
    case '@owner': {
      const owner = reg.ownerOf(d, rel);
      if (!owner) return { target: null, via: null, reason: `@owner: the ref ${JSON.stringify(env.ref)} names no path a repos row or the workspace owns` };
      if (owner === V.WORKSPACE) return { target: dispatcherOf(d), via: 'role', reason: `@owner: ${rel} is a workspace path; its roles' fallback, the dispatcher` };
      const role = roleForDir(d, rel) || Object.keys(d.roles).find((n) => d.roles[n].dir && reg.cleanRel(d.roles[n].dir) === reg.repoRows(d).find((x) => x.key === owner).dir);
      if (role) return { target: role, via: 'role', reason: `@owner: ${rel} is ${owner}'s; its role ${role}` };
      const child = (d.children || []).find((c) => c.name === owner);
      if (child) return { target: child.name, via: 'child', reason: `@owner: ${rel} is child ${owner}'s` };
      return { target: null, via: null, reason: `@owner: ${owner} owns ${rel} but no role or child carries it` };
    }
    case '@dir': {
      const role = roleForDir(d, rel);
      if (role) return { target: role, via: 'role', reason: `@dir: ${rel} is under ${role}'s dir` };
      return { target: dispatcherOf(d), via: 'role', reason: `@dir: ${rel === null ? 'no path in the ref' : `${rel} is under no role's dir`}; the folder agent at the top is the dispatcher` };
    }
    case '@write': return { target: 'write', via: 'service', reason: '@write: handed to the write service' };
    case '@check': return { target: 'check', via: 'service', reason: '@check: handed to the check service' };
    default: return { target: null, via: null, reason: `${target} is no reserved target` };
  }
}

function decide(d, env) {
  const roles = d.roles || {};
  const children = Array.isArray(d.children) ? d.children : [];
  const node = d.node;
  const fallback = dispatcherOf(d);
  const to = typeof env.to === 'string' && env.to ? env.to : null;
  if (to) {
    const segs = to.split('/');
    // rule 1: addressed here: `<node>/<role>` or a bare role name
    const role = segs.length === 1 ? segs[0] : (segs[0] === node && segs.length === 2 ? segs[1] : null);
    if (role && roles[role]) return { rule: 1, target: role, via: 'role', kind: null, routed_by: null, reason: `addressed to this node's role ${role}` };
    // rule 2: addressed below: `<node>/<child>/...` or `<child>/...`
    const first = segs[0] === node ? segs[1] : segs[0];
    const child = children.find((c) => c.name === first);
    if (child && (segs[0] !== node || segs.length >= 2)) return { rule: 2, target: child.name, via: 'child', kind: null, routed_by: null, reason: `addressed below, to child ${child.name}` };
  }
  if (env.tag) {
    const rows = reg.routeTable(d).filter((r) => r.tag === env.tag && r.via);
    let row = rows.find((r) => r.kind === null) || null;
    if (!row && rows.length) {
      const k = typeof env.kind_hint === 'string' ? env.kind_hint : null;
      row = rows.find((r) => r.kind === k) || null;
      if (!row) return { rule: 3, target: fallback, via: fallback ? 'role' : null, kind: null, routed_by: fallback, reason: `tag ${env.tag} routes by question kind and the envelope names none of ${rows.map((r) => r.kind).join(', ')}` };
    }
    if (row) {
      if (row.via === 'reserved') {
        const r = resolveReserved(d, env, row.target);
        if (r.target) return { rule: 3, target: r.target, via: r.via, kind: row.kind, routed_by: null, reason: `tag ${env.tag} -> ${row.target}; ${r.reason}` };
        return { rule: 3, target: null, via: null, kind: row.kind, routed_by: null, reason: `tag ${env.tag} -> ${row.target}; ${r.reason}`, dead: 'unresolvable owner' };
      }
      return { rule: 3, target: row.target, via: row.via, kind: row.kind, routed_by: null, reason: `tag ${env.tag} -> ${row.target} (${row.via}${row.by === 'repos' ? ', declared by the repo' : ''})` };
    }
  }
  // rule 4: outside this node, or unresolved: up when a parent exists, else the dispatcher
  if (d.parent && to && to.split('/')[0] !== node) return { rule: 4, target: d.parent, via: 'parent', kind: null, routed_by: null, reason: `addressed outside this node: forwarded up to ${d.parent}` };
  if (!fallback) return { rule: 4, target: null, via: null, kind: null, routed_by: null, reason: 'no route and no fallback dispatcher (no role has fallback: true)', dead: 'no route' };
  // routed_by names the fallback role (routing-tree §3 rule 4: the node's dispatcher), read from the registry
  return { rule: 4, target: fallback, via: 'role', kind: null, routed_by: fallback, reason: to ? `${to} is no role or child here: the fallback ${fallback}` : env.tag ? `tag ${env.tag} has no route here: the fallback ${fallback}` : `no tag and no address: the fallback ${fallback}` };
}

// Whether a delivered envelope starts a model turn (PLAN-hub.md §2 `limits`,
// `budget_per_conversation`): one handed to a service, or a result returning to its
// requester, costs no tokens and does not count.
const FREE_TAGS = new Set(['write-request', 'check-request', 'report', 'tool-result']);
function startsModelTurn(env, decision) {
  if (decision.via === 'service') return false;
  if (env.tag && FREE_TAGS.has(env.tag) && env.kind === 'tool-result') return false;
  if (env.tag === 'write-request' || env.tag === 'check-request') return false;
  return true;
}

module.exports = { decide, dispatcherOf, resolveReserved, refPath, startsModelTurn, FREE_TAGS };
