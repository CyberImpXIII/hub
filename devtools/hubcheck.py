#!/usr/bin/env python3
"""The gates of this repo as it is today: a plan-and-inputs repo, nothing built.

Called by ./dev.sh; every function takes the repo root so tests/ can point it
at a throwaway fixture. Findings name a file, a line and a KIND, never a value.

  inputs  docs/inputs/: SHA256SUMS verify; the README table, SHA256SUMS and
          the files on disk list the same copies; every file the brief's §2
          names is a copy; no CLAUDE.md is stored under docs/ (it would load
          as instructions)
  files   the files this repo needs are present (dev.sh executable)
  leaks   public-safety half of the leak audit: email addresses, home-folder
          paths, phone numbers. The credential half is tools/checks'
          no-secrets (run by `checks run .`), not re-implemented here.
  drift   each copy against its original at the workspace top (informational)
  refresh copy every original over its copy, leak audit first, then rewrite
          SHA256SUMS
"""
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

INPUTS = Path("docs/inputs")
README = INPUTS / "README.md"
SUMS = INPUTS / "SHA256SUMS"
BRIEF = Path("PLAN-hub-brief.md")
NOT_COPIES = {"README.md", "SHA256SUMS"}
REQUIRED = ["CLAUDE.md", "PLAN-hub-brief.md", "TODO.md", "dev.sh", ".gitignore",
            str(README), str(SUMS)]

# Public-safety terms. The repo is public; these are the shapes that identify a
# person or a machine. Allowed addresses are generic, not anyone's own.
EMAIL_RX = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")
EMAIL_ALLOW = re.compile(r"^(noreply@anthropic\.com|[^@]+@(example\.(com|org|net)|users\.noreply\.github\.com))$", re.I)
HOME_RX = re.compile(r"(?<![\w.])(/Users/|/home/)[A-Za-z0-9_][A-Za-z0-9._-]*")  # `/Users/...` and `/Users/<x>` are placeholders
PHONE_RX = re.compile(r"(?<![\d-])(?:\+1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}(?![\d-])")
LEAK_KINDS = [(EMAIL_RX, "email address"), (HOME_RX, "home-folder path"), (PHONE_RX, "phone number")]

ROW_RX = re.compile(r"^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|")


def sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def readme_rows(root: Path):
    """[(copy path relative to the repo, original name)] from the README's table."""
    rows = []
    for line in (root / README).read_text().splitlines():
        m = ROW_RX.match(line)
        if m:
            copy = os.path.normpath(str(INPUTS / m.group(1)))
            rows.append((copy, m.group(2)))
    return rows


def sums_rows(root: Path):
    rows = []
    for n, line in enumerate((root / SUMS).read_text().splitlines(), 1):
        if not line.strip():
            continue
        m = re.match(r"^([0-9a-f]{64})  (\S.*)$", line)
        rows.append((n, m.group(1), m.group(2)) if m else (n, None, line))
    return rows


def brief_names(root: Path):
    """Backticked file names in the first column of the brief's §2 table."""
    text = (root / BRIEF).read_text()
    m = re.search(r"^## 2\..*?$(.*?)^## ", text, re.S | re.M)
    if not m:
        return None
    names = []
    for line in m.group(1).splitlines():
        if line.startswith("|") and not line.startswith("|---"):
            first = line.split("|")[1]
            names += re.findall(r"`([^`]+\.md)`", first)
    return names


def gate_inputs(root: Path):
    f = []
    for need in (README, SUMS, BRIEF):
        if not (root / need).is_file():
            return [f"{need}: missing"]
    sums = sums_rows(root)
    listed = []
    for n, digest, path in sums:
        if digest is None:
            f.append(f"{SUMS}:{n}: not a '<sha256>  <path>' line")
            continue
        listed.append(path)
        p = root / path
        if not p.is_file():
            f.append(f"{SUMS}:{n}: {path} is missing")
        elif sha256(p) != digest:
            f.append(f"{SUMS}:{n}: {path} does not match its sum")
    if not listed:
        f.append(f"{SUMS}: lists no files")
    rows = readme_rows(root)
    copies = [c for c, _ in rows]
    for c in sorted(set(copies) - set(listed)):
        f.append(f"{README}: lists {c}, which {SUMS} does not")
    for c in sorted(set(listed) - set(copies)):
        f.append(f"{SUMS}: lists {c}, which the {README} table does not")
    on_disk = {str(INPUTS / p.name) for p in (root / INPUTS).iterdir()
               if p.is_file() and p.name not in NOT_COPIES}
    for c in sorted(on_disk - set(listed)):
        f.append(f"{c}: on disk but not in {SUMS}")
    originals = {o for _, o in rows}
    names = brief_names(root)
    if names is None:
        f.append(f"{BRIEF}: no '## 2.' section to read the inputs from")
    else:
        for name in names:
            if name not in originals:
                f.append(f"{BRIEF} §2 names {name}; no copy of it in the {README} table")
    for p in (root / "docs").rglob("CLAUDE.md"):
        f.append(f"{p.relative_to(root)}: a CLAUDE.md under docs/ loads as instructions; store it renamed")
    return f


def gate_files(root: Path):
    f = [f"{r}: missing" for r in REQUIRED if not (root / r).is_file()]
    if (root / "dev.sh").is_file() and not os.access(root / "dev.sh", os.X_OK):
        f.append("dev.sh: not executable")
    return f


def leaks_in(paths, base: Path):
    f = []
    for p in paths:
        try:
            text = p.read_text()
        except (UnicodeDecodeError, OSError):
            continue
        for n, line in enumerate(text.splitlines(), 1):
            for rx, kind in LEAK_KINDS:
                for m in rx.finditer(line):
                    if rx is EMAIL_RX and EMAIL_ALLOW.match(m.group(0)):
                        continue
                    try:
                        name = p.relative_to(base)
                    except ValueError:
                        name = p
                    f.append(f"{name}:{n}: {kind}")
    return f


def repo_files(root: Path):
    """What would be committed: tracked plus untracked-not-ignored."""
    out = subprocess.run(["git", "-C", str(root), "ls-files", "-co", "--exclude-standard", "-z"],
                         capture_output=True, text=True)
    if out.returncode != 0:
        return None
    return [root / p for p in out.stdout.split("\0") if p and (root / p).is_file()]


def gate_leaks(root: Path):
    files = repo_files(root)
    if files is None:
        return ["not a git repo: cannot list what would be committed"]
    return leaks_in(files, root)


def workspace(root: Path):
    """The claudeTest top: HUB_WORKSPACE, else two folders up. None if it is not one."""
    top = Path(os.environ.get("HUB_WORKSPACE") or (root / ".." / "..")).resolve()
    if (top / "CLAUDE.md").is_file() and (top / BRIEF.name).is_file():
        return top
    return None


def pairs(root: Path, top: Path):
    return [(root / c, top / o) for c, o in readme_rows(root)]


def drift(root: Path):
    """(differing copy names, missing originals) or None when the originals are unreachable."""
    top = workspace(root)
    if top is None:
        return None
    diff, gone = [], []
    for copy, orig in pairs(root, top):
        if not orig.is_file():
            gone.append(orig.name)
        elif not copy.is_file() or sha256(copy) != sha256(orig):
            diff.append(str(copy.relative_to(root)))
    return diff, gone


def refresh(root: Path):
    top = workspace(root)
    if top is None:
        return ["the workspace top is not reachable (set HUB_WORKSPACE)"]
    ps = pairs(root, top)
    missing = [str(o) for _, o in ps if not o.is_file()]
    if missing:
        return [f"original missing: {m}" for m in missing]
    found = leaks_in([o for _, o in ps], top)
    if found:
        return ["leak audit refused the refresh, nothing copied:"] + found
    for copy, orig in ps:
        copy.parent.mkdir(parents=True, exist_ok=True)
        copy.write_bytes(orig.read_bytes())
    lines = [f"{sha256(c)}  {c.relative_to(root)}" for c, _ in ps]
    (root / SUMS).write_text("\n".join(lines) + "\n")
    return []


def main(argv):
    root = Path(os.environ.get("HUB_ROOT") or Path(__file__).resolve().parent.parent)
    cmd, args = (argv[0], argv[1:]) if argv else ("", [])
    if cmd in ("inputs", "files"):
        f = gate_inputs(root) if cmd == "inputs" else gate_files(root)
        for x in f:
            print(f"  FAIL  {x}")
        n = len(sums_rows(root)) if cmd == "inputs" and (root / SUMS).is_file() else 0
        if not f:
            print(f"  ok    {cmd}" + (f": {n} copies verify against {SUMS}, the README table and the brief's §2" if n else ""))
        return 1 if f else 0
    if cmd == "leaks":
        f = leaks_in([Path(a).resolve() for a in args], Path.cwd()) if args else gate_leaks(root)
        for x in f:
            print(f"  FAIL  {x}")
        if not f:
            print("  ok    leaks: no email address, home-folder path or phone number")
        return 1 if f else 0
    if cmd == "drift":
        r = drift(root)
        if r is None:
            print("  UNCHECKED  drift: the originals are not reachable here (a clone); set HUB_WORKSPACE")
            return 3
        diff, gone = r
        for d in diff:
            print(f"  DIFF  {d}")
        for g in gone:
            print(f"  GONE  original {g}")
        if not diff and not gone:
            print("  ok    drift: every copy equals its original")
        if "--json" in args:
            print(json.dumps({"differ": diff, "gone": gone}))
        return 1 if (diff or gone) else 0
    if cmd == "refresh":
        f = refresh(root)
        for x in f:
            print(f"  FAIL  {x}" if not x.endswith(":") else f"  {x}")
        if not f:
            print(f"  ok    refresh: {len(readme_rows(root))} copies written, {SUMS} rewritten")
        return 1 if f else 0
    print("usage: hubcheck.py inputs|files|leaks [FILE...]|drift [--json]|refresh", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
