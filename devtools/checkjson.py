#!/usr/bin/env python3
"""This repo's `./dev.sh check --json`: one document in the one schema every
repo's check prints (ok, checks[] of name/status/counts/failures, each failure
with message, file, line and role; the shared checks tool holds the schema,
tools/checks/schema/check-json.schema.json, PLAN-agent-groups.md §4.4). Same
shape and row format as tools/setup's and tools/hooks' devtools/checkjson.py;
the finding lines read here are this repo's own gates'.

  devtools/checkjson.py <gate>:<role>:<exit code>:<output file> ...

One check per gate, in the order given. The exit code is the gate's own verdict
(dev.sh: 0 ok, 1 fail, 3 unchecked), never re-judged from the output:

  0      `ok`, no failures, whatever the output says
  3      `unchecked`, `reason` from its `UNCHECKED  <why>` line; `ok` stays true
  1      `fail`, one failure per finding line in the gate's captured output
  other  `error` (the gate broke: a usage error, a crash, a kill), same findings

Finding lines:

  test       unittest's `FAIL: name (module.Class.name)` / `ERROR: ...`
  any other  `  FAIL  <finding>` (two spaces in), with the lines under it indented
             six or more joined into its message (hooktests prints a test's tail so)

`file`/`line` are set only where the line itself says them and the file exists in
this repo: a leading `<path>:` or `<path>:<line>:`, or a unittest module (under
the repo or tests/, which unittest discovers as the top). Otherwise both are null
(prefer null to a guess). A red gate with no finding line still gets one failure
naming the gate, so a `fail` always says what. Prints the document and exits 0
iff `ok` (the exit agrees with ok).

tests/test_checkjson.py holds this against tests/fixtures/, with a mutant per
shape rule, and in the workspace against the real validator."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FAIL = re.compile(r"^  FAIL\s+(.*\S)")
DETAIL = re.compile(r"^ {6,}(\S.*)")
UNCHECKED = re.compile(r"^\s*UNCHECKED\s+(.*\S)")
UNITTEST = re.compile(r"^(FAIL|ERROR): (\S+) \(([\w.]+)\)")
AT = re.compile(r"^([^\s:]+):(?:(\d+):)?")
STATUS = {0: "ok", 1: "fail", 3: "unchecked"}


def _repo_file(path):
    """`path` repo-relative when it is a file inside this repo, else None."""
    try:
        p = Path(path).resolve()
        return p.relative_to(ROOT).as_posix() if p.is_file() else None
    except (ValueError, OSError):
        return None


def _place(msg):
    """(file, line) from a leading `<path>:` or `<path>:<line>:` naming a file here."""
    m = AT.match(msg)
    rel = _repo_file(ROOT / m.group(1)) if m else None
    line = int(m.group(2)) if m and m.group(2) and int(m.group(2)) >= 1 else None
    return (rel, line) if rel else (None, None)


def _module_file(dotted):
    parts = dotted.split(".")
    for base in (ROOT, ROOT / "tests"):
        for i in range(len(parts), 0, -1):
            rel = _repo_file(base / ("/".join(parts[:i]) + ".py"))
            if rel:
                return rel
    return None


def _test(lines):
    return [(l, _module_file(m.group(3)), None) for l in lines if (m := UNITTEST.match(l))]


def _generic(lines):
    found = []   # [head, [detail]]
    cur = None
    for l in lines:
        m = FAIL.match(l)
        if m:
            cur = [m.group(1), []]
            found.append(cur)
        elif cur and (d := DETAIL.match(l)):
            cur[1].append(" ".join(d.group(1).split()))
        else:
            cur = None
    return [(head + (": " + " | ".join(detail) if detail else ""), *_place(head)) for head, detail in found]


READERS = {"test": _test}


def findings(gate, text):
    """[(message, file, line)] for every finding line in a red gate's output."""
    return READERS.get(gate, _generic)(text.splitlines())


def check(gate, role, code, text):
    status = STATUS.get(code, "error")
    found = findings(gate, text) if status in ("fail", "error") else []
    if status in ("fail", "error") and not found:
        found = [(f"gate {gate} {'failed' if status == 'fail' else 'broke'} (exit {code}) with no finding line;"
                  " ./dev.sh check prints its output", None, None)]
    failures = [{"message": m, "file": f, "line": ln, "role": role} for m, f, ln in found]
    out = {"name": gate, "status": status}
    if status == "unchecked":
        why = next((m.group(1) for l in text.splitlines() if (m := UNCHECKED.match(l))), None)
        out["reason"] = why or f"gate {gate} exited 3 (unchecked) without saying why"
    out.update({"counts": {"failed": len(failures)}, "failures": failures})
    return out


def parse(args):
    rows = []
    for a in args:
        parts = a.split(":", 3)
        if len(parts) != 4 or not parts[0] or not parts[1]:
            raise ValueError(a)
        gate, role, code, path = parts
        rows.append((gate, role, int(code), path))
    return rows


def _read(path):
    try:
        return Path(path).read_text(errors="replace")
    except OSError as e:
        return f"  FAIL  the gate's output could not be read: {e}"


def main(argv):
    try:
        rows = parse(argv)
    except ValueError:
        print(f"usage: devtools/checkjson.py <gate>:<role>:<exit code>:<output file> ... (got {argv})", file=sys.stderr)
        return 64
    if not rows:
        print("checkjson: no gates: a report of nothing is not a pass", file=sys.stderr)
        return 64
    checks = [check(g, r, c, _read(p)) for g, r, c, p in rows]
    doc = {"ok": all(c["status"] in ("ok", "unchecked") for c in checks), "checks": checks}
    print(json.dumps(doc))
    return 0 if doc["ok"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
