'use strict';
// The reply-section parsers the hooks run (PLAN-hub.md §1: the relay parser moves
// here as `hub grammar` and the planner-stop hook; the question gate as the
// dispatcher-stop and planner-stop hooks), rebuilt from their contracts:
// PLAN-auto-relay.md §2 (the Dispatch section), §9 (a malformed line still goes,
// labelled), PLAN-question-routing.md §3 (the dispatcher's `## Needs Jacob`) and
// §4 (the planner's `## Decisions`, noticed never blocked). Pure functions over a
// reply's text.

const V = require('./vocab');

const DISPATCH_HEADING = '## Dispatch';
const NEEDS_HEADING = '## Needs Jacob';
const DECISIONS_HEADING = '## Decisions';

// PLAN-auto-relay.md §2's contract, printed by `hub grammar` and carried in every
// dispatch-malformed relay; tests/hub/section.test.js holds §2's example to it.
const GRAMMAR = `${DISPATCH_HEADING}

1. <pointer: FILE §section or TODO.md "item title"> -- <one line: what> -- approved: Jacob <date>
2. ...

One item per numbered line; the line is a pointer and a one-line summary, never pasted
plan text. A line without \`approved:\` is malformed. No section, no relay. Lines after a
blank line are not items.`;

// The section under `heading`: the lines after it up to the first blank line or
// the next heading; `found` false when the heading is absent. A near-miss heading
// (`### Dispatch`, `## dispatch:`) is reported, not read (auto-relay §9 point 1).
function section(text, heading) {
  const lines = String(text || '').split('\n');
  const want = heading.toLowerCase().replace(/^#+\s*/, '').replace(/:$/, '');
  let start = -1;
  const nearMisses = [];
  let count = 0;
  lines.forEach((l, i) => {
    const t = l.trim();
    if (t === heading) { count++; if (start === -1) start = i; return; }
    const m = /^(#+)\s*(.+?)\s*:?\s*$/.exec(t);
    if (m && m[2].toLowerCase() === want && t !== heading) nearMisses.push(`line ${i + 1}: \`${t}\` is not \`${heading}\``);
  });
  if (start === -1) return { found: false, lines: [], nearMisses, extraSections: 0 };
  const body = [];
  let i = start + 1;
  while (i < lines.length && lines[i].trim() === '') i++; // the blank line under the heading
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() === '') break;
    if (/^#+\s/.test(l)) break;
    body.push(l);
  }
  return { found: true, lines: body, nearMisses, extraSections: count - 1 };
}

// One Dispatch line: `N. <pointer> -- <what> -- approved: Jacob <date>`.
const ITEM_RE = /^\s*(\d+)\.\s+(.+?)\s+--\s+(.+?)\s+--\s+approved:\s*Jacob\s+(\d{4}-\d{2}-\d{2})\s*$/;
const POINTER_RE = /^(\S+\.md\s+§\S+|TODO\.md\s+"[^"]+"|[\w./-]+:\d+|[0-9a-f]{7,40})$/;

function parseDispatchLine(line) {
  const m = ITEM_RE.exec(line);
  if (!m) {
    if (!/^\s*\d+\.\s/.test(line)) return { ok: false, reason: 'not a numbered line (`N. `)' };
    if (!/--/.test(line)) return { ok: false, reason: 'no ` -- ` separators (pointer -- what -- approved: Jacob DATE)' };
    if (!/approved:/.test(line)) return { ok: false, reason: 'no `approved:`' };
    if (!/approved:\s*Jacob\s+\d{4}-\d{2}-\d{2}/.test(line)) return { ok: false, reason: 'the approval is not `approved: Jacob YYYY-MM-DD`' };
    return { ok: false, reason: 'does not match the grammar' };
  }
  const [, n, ref, what, date] = m;
  if (!POINTER_RE.test(ref.trim())) return { ok: false, reason: `the pointer \`${ref.trim()}\` is not FILE §section, TODO.md "title", file:line or a commit` };
  return { ok: true, n: Number(n), ref: ref.trim(), body: what.trim(), approval: date };
}

// The Dispatch section as relay items: parsed lines as `dispatch`, rejected ones
// as `dispatch-malformed` with the reason and the grammar (auto-relay §9); near-miss
// headings and extra sections as malformed notes; no section, nothing.
function dispatchItems(text) {
  const s = section(text, DISPATCH_HEADING);
  const items = [];
  for (const line of s.lines) {
    const p = parseDispatchLine(line);
    if (p.ok) items.push({ tag: 'dispatch', ref: p.ref, body: p.body, approval: p.approval, raw: line.trim() });
    else items.push({ tag: 'dispatch-malformed', ref: null, body: `${line.trim()} || reason: ${p.reason} || grammar: ${GRAMMAR.split('\n')[2]}`, approval: null, raw: line.trim(), reason: p.reason });
  }
  for (const note of s.nearMisses) items.push({ tag: 'dispatch-malformed', ref: null, body: `${note} || reason: near-miss heading || grammar: ${GRAMMAR.split('\n')[0]}`, approval: null, raw: note, reason: 'near-miss heading' });
  if (s.extraSections > 0) items.push({ tag: 'dispatch-malformed', ref: null, body: `${s.extraSections + 1} Dispatch sections in one reply || reason: a second section || grammar: one ${DISPATCH_HEADING} per reply`, approval: null, raw: `${s.extraSections + 1} sections`, reason: 'a second section' });
  return { found: s.found || s.nearMisses.length > 0, items };
}

// The dispatcher's `## Needs Jacob`: `N. [<type>] <question> -- blocks: <pointer>`.
const NEEDS_RE = /^\s*(\d+)\.\s+\[([a-z]+)\]\s+(.+?)\s+--\s+blocks:\s+(.+?)\s*$/;

function needsJacob(text) {
  const s = section(text, NEEDS_HEADING);
  const items = [];
  for (const line of s.lines) {
    const m = NEEDS_RE.exec(line);
    if (!m) { items.push({ ok: false, raw: line.trim(), reason: /^\s*\d+\.\s+\[/.test(line) ? 'off the shape (`N. [type] question -- blocks: pointer`)' : 'no `[type]`' }); continue; }
    const [, n, type, question, pointer] = m;
    if (!V.QUESTION_KINDS.includes(type)) { items.push({ ok: false, raw: line.trim(), reason: `unknown type [${type}]; types: ${V.QUESTION_KINDS.join(', ')}` }); continue; }
    items.push({ ok: true, n: Number(n), type, question: question.trim(), pointer: pointer.trim(), raw: line.trim() });
  }
  return { found: s.found, items };
}

// Lines ending in `?` outside the named section (lexical, question-routing §3).
function questionsOutside(text, heading) {
  const lines = String(text || '').split('\n');
  const s = section(text, heading);
  const inside = new Set(s.lines.map((l) => l.trim()));
  const out = [];
  let inFence = false;
  for (const l of lines) {
    if (/^\s*```/.test(l)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const t = l.trim();
    if (!t.endsWith('?') || inside.has(t) || t === heading) continue;
    if (/^>/.test(t)) continue; // a quotation
    out.push(t);
  }
  return out;
}

// The planner's `## Decisions` table rows: `| # | decision | hinges on | recommend |`
// (question-routing §4). Returns the rows off the shape, for a notice.
function decisionsOffShape(text) {
  const lines = String(text || '').split('\n');
  const i = lines.findIndex((l) => l.trim() === DECISIONS_HEADING);
  if (i === -1) return { found: false, bad: [] };
  const bad = [];
  for (let k = i + 1; k < lines.length; k++) {
    const t = lines[k].trim();
    if (t === '') { if (bad.length || k > i + 1) break; continue; }
    if (/^#+\s/.test(t)) break;
    if (!t.startsWith('|')) continue;
    const cells = t.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length && (cells[0] === '#' || /^-+$/.test(cells[0]))) continue;
    if (cells.length !== 4) { bad.push(`${t.slice(0, 60)}: ${cells.length} cells, not 4`); continue; }
    if (!/^(\S+\.md\s+§\S+|TODO\.md\s+"[^"]+")/.test(cells[1]) && !/^§/.test(cells[1])) bad.push(`row ${cells[0]}: the decision cell does not start with a FILE §n pointer`);
    const rec = cells[3].toLowerCase();
    if (!/^(yes|no)\b/.test(rec) && !cells[2].toLowerCase().includes(rec.split(/[.,;(]/)[0].trim())) bad.push(`row ${cells[0]}: recommend is neither yes, no nor an option named in hinges on`);
  }
  return { found: true, bad };
}

module.exports = { GRAMMAR, DISPATCH_HEADING, NEEDS_HEADING, DECISIONS_HEADING, section, parseDispatchLine, dispatchItems, needsJacob, questionsOutside, decisionsOffShape };
