'use strict';
// `hub hook gate`'s classifier: a PreToolUse call is a read, a write, or
// unparseable. HEURISTIC for Bash, and its reach is stated in HOOK_GATE_HELP.
//
// Bash write targets follow a SUBSET of the shared write-target parser's reach
// (named in tests/hub/classify.test.js, which compares the
// two on the same commands and lists each known difference): redirection (`>`,
// `>>`, `>|`, `N>`, `&>`, `>&file`; not `>&N` or /dev/null),
// tee/rm/unlink/truncate/touch/chmod/chown/chgrp/chattr/shred/mv (every operand,
// a mode or owner included, as the shared parser does), chflags (after the
// flags), cp/install/rsync/ln/scp/ditto (the last operand), sed -i and perl -i (every file operand, the
// program skipped) and dd of=, after splitting on ; & && || | |& ( ) and
// newlines, skipping sudo/env/command/nohup/time/exec/builtin and VAR=value
// prefixes. Quotes are parsed; a heredoc body is data unless a shell reads it. A
// target built at run time (a `$` other than HOME or CLAUDE_PROJECT_DIR, a
// backtick) is not emitted. A call to a CLI a `repos` row names is a write
// request too, carried with its arguments; the server finds the verb.

const path = require('node:path');
const os = require('node:os');
const reg = require('./registry');
const { EDIT_TOOLS } = require('./gate');

const PREFIXES = new Set(['sudo', 'env', 'command', 'nohup', 'time', 'exec', 'builtin']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh']);
const EVERY = new Set(['tee', 'rm', 'unlink', 'truncate', 'touch', 'chmod', 'chown', 'chgrp', 'chattr', 'shred', 'mv']);
const AFTER_FIRST = new Set(['chflags']);
const LAST = new Set(['cp', 'install', 'rsync', 'ln', 'scp', 'ditto']);
const UNKNOWN = '\0unknown';

// ---------------------------------------------------------------- lexer --
// Tokens: {t:'W', v} a word (quotes removed, `$` and backticks kept);
// {t:'S'} a segment boundary; {t:'O'} an output redirection (the next W is its
// target); {t:'I'} an input redirection (the next W is read); {t:'H', v} a
// heredoc body, with {shellFed} decided later by the segment's command.
function lex(s) {
  const toks = [];
  let word = '';
  let inWord = false;
  let i = 0;
  const pending = []; // heredocs opened on this line: {delim, strip}
  let wantDelim = null;
  const flush = () => {
    if (!inWord) return;
    if (wantDelim) { pending.push({ delim: word, strip: wantDelim.strip }); wantDelim = null; }
    else toks.push({ t: 'W', v: word });
    word = ''; inWord = false;
  };
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (c === '\\') {
      if (s[i + 1] === '\n') { i += 2; continue; }
      if (i + 1 < n) word += s[i + 1];
      inWord = true; i += 2; continue;
    }
    if (c === "'") {
      const j = s.indexOf("'", i + 1);
      const end = j === -1 ? n : j;
      word += s.slice(i + 1, end); inWord = true; i = end + 1; continue;
    }
    if (c === '"') {
      let k = i + 1;
      while (k < n && s[k] !== '"') {
        if (s[k] === '\\' && '"\\$`'.includes(s[k + 1])) { word += s[k + 1]; k += 2; continue; }
        if (s[k] === '\\' && s[k + 1] === '\n') { k += 2; continue; }
        word += s[k]; k++;
      }
      inWord = true; i = k + 1; continue;
    }
    if (c === '`') {
      const j = s.indexOf('`', i + 1);
      const end = j === -1 ? n : j;
      word += s.slice(i, end + 1); inWord = true; i = end + 1; continue;
    }
    if (c === '$' && s[i + 1] === '(') {
      // command substitution: kept whole in the word, so the word is run-time built
      let depth = 0; let k = i + 1;
      for (; k < n; k++) { if (s[k] === '(') depth++; else if (s[k] === ')') { depth--; if (depth === 0) break; } }
      word += s.slice(i, k + 1); inWord = true; i = k + 1; continue;
    }
    if (c === '#' && !inWord) { while (i < n && s[i] !== '\n') i++; continue; }
    if (c === ' ' || c === '\t') { flush(); i++; continue; }
    if (c === '\n') {
      flush();
      let p = i + 1;
      for (const h of pending) {
        let body = '';
        while (p <= n) {
          const nl = s.indexOf('\n', p);
          const line = s.slice(p, nl === -1 ? n : nl);
          p = (nl === -1 ? n : nl) + 1;
          const cmp = h.strip ? line.replace(/^\t+/, '') : line;
          if (cmp === h.delim) break;
          body += `${line}\n`;
          if (nl === -1) break;
        }
        toks.push({ t: 'H', v: body });
      }
      pending.length = 0;
      toks.push({ t: 'S' }); i = p; continue;
    }
    if (c === ';' || c === '(' || c === ')') { flush(); toks.push({ t: 'S' }); i++; continue; }
    if (c === '|') { flush(); toks.push({ t: 'S' }); i += (s[i + 1] === '|' || s[i + 1] === '&') ? 2 : 1; continue; }
    if (c === '&') {
      flush();
      if (s[i + 1] === '>') { toks.push({ t: 'O' }); i += s[i + 2] === '>' ? 3 : 2; continue; }
      toks.push({ t: 'S' }); i += s[i + 1] === '&' ? 2 : 1; continue;
    }
    if (c === '>') {
      if (inWord && /^\d+$/.test(word)) { word = ''; inWord = false; } // N> : the fd is not a word
      flush();
      let k = i + 1;
      if (s[k] === '>' || s[k] === '|') k++;
      if (s[k] === '&') {
        k++;
        const m = /^(\d+|-)/.exec(s.slice(k));
        if (m) { i = k + m[0].length; continue; } // >&N, >&- : a dup, not a file
      }
      toks.push({ t: 'O' }); i = k; continue;
    }
    if (c === '<') {
      flush();
      if (s[i + 1] === '<' && s[i + 2] === '<') { toks.push({ t: 'I' }); i += 3; continue; }
      if (s[i + 1] === '<') {
        let k = i + 2; let strip = false;
        if (s[k] === '-') { strip = true; k++; }
        while (s[k] === ' ' || s[k] === '\t') k++;
        wantDelim = { strip }; i = k; continue;
      }
      if (s[i + 1] === '(') { toks.push({ t: 'S' }); i += 2; continue; } // <( ... ): a command list
      toks.push({ t: 'I' }); i++; continue;
    }
    word += c; inWord = true; i++;
  }
  flush();
  return toks;
}

// Segments: [{words: [..], outs: [..], heredocs: [..]}].
function segments(toks) {
  const segs = [];
  let cur = { words: [], outs: [], heredocs: [] };
  let next = null; // 'O' or 'I'
  const end = () => { if (cur.words.length || cur.outs.length || cur.heredocs.length) segs.push(cur); cur = { words: [], outs: [], heredocs: [] }; next = null; };
  for (const t of toks) {
    if (t.t === 'S') { end(); continue; }
    if (t.t === 'H') { cur.heredocs.push(t.v); continue; }
    if (t.t === 'O' || t.t === 'I') { next = t.t; continue; }
    if (next === 'O') { cur.outs.push(t.v); next = null; continue; }
    if (next === 'I') { next = null; continue; }
    cur.words.push(t.v);
  }
  end();
  return segs;
}

// ---------------------------------------------------------------- paths --
function expand(p) {
  const home = process.env.HOME || os.homedir();
  const proj = process.env.CLAUDE_PROJECT_DIR || '';
  if (p === '~' || p === '$HOME' || p === '${HOME}') return home;
  for (const [pre, val] of [['~/', home], ['$HOME/', home], ['${HOME}/', home], ['$CLAUDE_PROJECT_DIR/', proj], ['${CLAUDE_PROJECT_DIR}/', proj]]) {
    if (p.startsWith(pre)) return `${val}/${p.slice(pre.length)}`;
  }
  return p;
}
const runtime = (p) => p.includes('$') || p.includes('`');

// An absolute path for a word, or null when it is built at run time.
function resolveWord(w, base) {
  const x = expand(w);
  if (runtime(x)) return null;
  if (!path.isAbsolute(x) && (base === UNKNOWN || runtime(base))) return null;
  return path.resolve(path.isAbsolute(x) ? '/' : base, x);
}

function emit(out, w, base) {
  if (!w || w.startsWith('&') || w === '/dev/null' || w.startsWith('/dev/std') || w.startsWith('/dev/fd/')) return;
  const r = resolveWord(w, base);
  if (r) out.push(r);
}

// Drops the command's prefixes; returns {cmd, args} or null for an empty segment.
function command(words) {
  let k = 0;
  while (k < words.length) {
    const w = words[k];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) { k++; continue; }
    if (PREFIXES.has(w)) { k++; while (k < words.length && words[k].startsWith('-')) k++; continue; }
    break;
  }
  if (k >= words.length) return null;
  return { cmd: words[k], args: words.slice(k + 1) };
}

function operands(args) {
  const out = []; let opts = true;
  for (const a of args) {
    if (opts && a === '--') { opts = false; continue; }
    if (opts && a.startsWith('-') && a !== '-') continue;
    out.push(a);
  }
  return out;
}

// sed -i / perl -i file operands, the program skipped; [] when not in place.
function inPlaceFiles(name, args) {
  let inPlace = false; let program = false; const files = []; let k = 0;
  while (k < args.length) {
    const a = args[k];
    if (name === 'sed') {
      if (a === '-i' && args[k + 1] === '') { inPlace = true; k += 2; continue; }
      if (a === '-i' || a.startsWith('-i') || a.startsWith('--in-place') || (/^-[a-zA-Z]+$/.test(a) && a.includes('i') && !a.startsWith('--'))) { inPlace = true; k++; continue; }
      if (a === '-e' || a === '--expression' || a === '-f' || a === '--file') { program = true; k += 2; continue; }
    } else {
      // a bundle holding i (-i, -pi, -0pi, -i.bak); not -I, -M or -m, whose
      // argument may hold an i (-Mstrict)
      if (/^-(?![IMmEe])[0-9a-zA-Z]*i/.test(a)) { inPlace = true; k++; continue; }
      if (a === '-e' || a === '-E') { program = true; k += 2; continue; }
    }
    if (a.startsWith('-') && a !== '-') { k++; continue; }
    if (!program) { program = true; k++; continue; }
    files.push(a); k++;
  }
  return inPlace ? files : [];
}

// Every write target of a Bash command, absolute, in order; CLI calls are not
// targets (see classify). `cwd` is the base of the first segment.
function analyse(commandText, cwd, isCli) {
  const targets = [];
  const clis = [];
  let base = cwd;
  for (const seg of segments(lex(commandText))) {
    for (const o of seg.outs) emit(targets, o, base);
    const c = command(seg.words);
    if (!c) continue;
    const name = path.basename(c.cmd);
    if (name === 'cd') {
      const to = c.args[0];
      if (to === undefined) base = process.env.HOME || os.homedir();
      else if (to === '-') base = cwd;
      else base = resolveWord(to, base) || UNKNOWN;
      continue;
    }
    if (SHELLS.has(name)) {
      for (const body of seg.heredocs) {
        const inner = analyse(body, base, isCli);
        targets.push(...inner.targets); clis.push(...inner.clis);
      }
    }
    if (isCli && base !== UNKNOWN && isCli(c.cmd, base)) { clis.push({ cli: c.cmd, args: c.args, cwd: base }); continue; }
    if (EVERY.has(name)) for (const a of operands(c.args)) emit(targets, a, base);
    else if (AFTER_FIRST.has(name)) for (const a of operands(c.args).slice(1)) emit(targets, a, base);
    else if (LAST.has(name)) { const ops = operands(c.args); if (ops.length > 0) emit(targets, ops[ops.length - 1], base); }
    else if (name === 'sed' || name === 'perl') for (const a of inPlaceFiles(name, c.args)) emit(targets, a, base);
    else if (name === 'dd') for (const a of c.args) if (a.startsWith('of=')) emit(targets, a.slice(3), base);
  }
  return { targets, clis };
}

function bashWriteTargets(commandText, cwd) { return analyse(commandText, cwd, null).targets; }

// A PreToolUse input -> {kind: 'read'} | {kind: 'bad', why} |
// {kind: 'write', requests: [{tool, file?, targets?, cli?, args?, cwd}]}.
// `registry` (hub.json data, or null) is only used to recognise a declared CLI.
function classify(input, root, registry) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { kind: 'bad', why: 'the hook input is not a JSON object' };
  const tool = input.tool_name;
  const ti = input.tool_input;
  if (typeof tool !== 'string' || !tool) return { kind: 'bad', why: 'the hook input has no tool_name' };
  if (ti !== undefined && (ti === null || typeof ti !== 'object' || Array.isArray(ti))) return { kind: 'bad', why: 'tool_input is not an object' };
  const cwd = typeof input.cwd === 'string' && input.cwd ? input.cwd : null;
  if (EDIT_TOOLS.includes(tool)) {
    const file = ti && (ti.file_path || ti.notebook_path);
    if (typeof file !== 'string' || !file) return { kind: 'bad', why: `${tool} names no file` };
    return { kind: 'write', requests: [{ tool, file: path.resolve(cwd || root || '/', file), cwd }] };
  }
  if (tool === 'Bash') {
    const cmd = ti && ti.command;
    if (typeof cmd !== 'string') return { kind: 'bad', why: 'Bash call has no command' };
    if (!cwd) return { kind: 'bad', why: 'Bash call has no cwd' };
    const isCli = registry && root ? (word, base) => reg.cliRow(registry, root, word, base) !== null : null;
    const { targets, clis } = analyse(cmd, cwd, isCli);
    const requests = clis.map((c) => ({ tool: 'Bash', cli: c.cli, args: c.args, cwd: c.cwd }));
    if (targets.length) requests.push({ tool: 'Bash', file: targets[0], targets, cwd });
    return requests.length ? { kind: 'write', requests } : { kind: 'read' };
  }
  return { kind: 'read' };
}

const HOOK_GATE_HELP = `hub hook gate [--role <role>] [--root <dir>]

A PreToolUse hook: reads the call as JSON on stdin and answers as the tool
decision. Nothing is decided here: every write goes to the server's
/write-request and its answer is returned; every read passes with no server call.

  read     Read, Grep, Glob and every tool not named below; a Bash command whose
           writes the classifier does not see. Passes: no output, exit 0.
  write    Edit, Write, NotebookEdit, MultiEdit (always); a Bash command calling a
           CLI that a hub.json repos row names (by path, or a bare word by
           basename); a Bash command with a visible write target. Sent to the
           server; an allow passes with no output, a deny is a PreToolUse deny
           naming the verb to use.
  bad      input that is not a JSON object, no tool_name, an Edit naming no file,
           a Bash call with no command or no cwd: denied.

Visible Bash writes: redirection (>, >>, >|, N>, &>, >&file; not >&N or
/dev/null), tee rm unlink truncate touch chmod chown chgrp chattr shred mv
(every operand), chflags (after the flags), cp install rsync ln scp ditto (the
last operand), sed -i and perl -i (file operands) and dd of=, after splitting on
; & && || | |& ( ) and newlines, skipping sudo env command nohup time exec
builtin and VAR=value. Quotes are parsed; a heredoc body is data unless a shell
reads it; cd moves the base for later segments.
NOT seen, so it passes as a read: a script or interpreter writing a file itself
(python3 <script>, node <script>, awk's print > f), git (checkout, restore, apply),
tar -x, patch, ex/vi/vim/ed and sqlite3 (the shared parser sees these; this one
does not yet), a path built at run time ($VAR
other than HOME and CLAUDE_PROJECT_DIR, $(...), backticks), and every tool that
is not one of the above (an MCP tool among them).

Fails CLOSED for writes, the one exception to "every hook fails open": with the
server down, unreachable, or HUB_TOKEN unset, a write is denied with one line
naming \`hub status\`; a read still passes. Each deny the hook gives itself is one
ledger row, as is each answer the server gives.
The role is --role, else the input's agent_type; a write with neither is denied.
The node is --root, else the nearest hub.json above the input's cwd.`;

module.exports = { classify, bashWriteTargets, lex, segments, HOOK_GATE_HELP };
