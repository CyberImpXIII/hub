"""`./dev.sh check --json` in the one schema every repo prints (the shared checks
tool holds it, schema/check-json.schema.json; PLAN-agent-groups.md §4.4): one
check per gate, each finding line of a red gate a failure with message, file,
line and role (devtools/checkjson.py, called by dev.sh). Modelled on
tools/hooks' tests/test_checkjson.py, the same shape and row format.

Anywhere: canned gate outputs give the reviewed fixtures in tests/fixtures/
exactly, the exit agrees with `ok`, and dev.sh wires each gate through the helper
(a copy with canned gates, one of which assigns the loop's own variables).
Mutants: one per shape rule the emitter can break, each applied to a throwaway
copy, must change the output (anywhere) and fail the real validator under that
rule (in the workspace). The validator is the shared checks CLI, run as a
subprocess on a scratch repo; the old `{"ok", "gates"}` shape is its
counterfactual. No copy of the schema or its validator lives here."""
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

TOOL_ROOT = Path(__file__).resolve().parent.parent
FIX = TOOL_ROOT / "tests" / "fixtures"
HELPER = TOOL_ROOT / "devtools" / "checkjson.py"
# The validator sets this while it runs a repo's suite, and answers UNCHECKED to a
# run nested inside it. Its guard, its decision: a nested live test is skipped, saying so.
GUARD = "CHECKS_CHECK_JSON_ACTIVE"


def _checks_cli():
    """tools/checks/checks in the workspace around this tool, or None (a lone clone)."""
    for top in TOOL_ROOT.parents:
        cli = top / "tools" / "checks" / "checks"
        if os.access(cli, os.X_OK):
            return cli
    return None


CHECKS_CLI = _checks_cli()
LONE = "no shared checks CLI in a workspace around this tool (a lone clone)"

# A hook path that must never exist here: the helper sets `file` only for a file
# that exists, so the red fixture's null depends on it. It was ask-first.sh until
# setup installed that one (2026-10-05); test_absent_hook_is_absent holds it.
ABSENT_HOOK = ".claude/hooks/never-installed.sh"

# (gate, role, exit code, output): one of each finding kind the helper reads, in
# the shapes this repo's gates print them (dev.sh and devtools/hubcheck.py).
RED = [
    ("test", "code", 1,
     "..F.E\n" + "=" * 20 + "\nFAIL: test_clean (test_hubcheck.TestInputs.test_clean)\nTraceback: x\n"
     "ERROR: test_gone (test_nowhere.Gone.test_gone)\nRan 5 tests\nFAILED (failures=1, errors=1)\n  FAIL  test\n"),
    ("hooktests", "code", 1,
     "  FAIL  .claude/hooks/test-no-inline-blobs.sh: exit 1\n"
     "        FAIL  case 7          expected exit 2, got 0\n"
     "        1 FAILED\n"
     "  FAIL  .claude/hooks/test-gone.sh: exit 127\n"),
    ("files", "code", 1, "  FAIL  gone.md: missing\n  FAIL  dev.sh: not executable\n"),
    ("inputs", "docs", 1,
     "  FAIL  docs/inputs/SHA256SUMS:3: docs/inputs/PLAN-a.md does not match its sum\n"
     "  FAIL  PLAN-hub-brief.md:12: item 9 in §3 follows item 9; expected 10\n"
     "  FAIL  PLAN-hub-brief.md §2 names PLAN-z.md; no copy of it in the docs/inputs/README.md table\n"),
    # a file that is not here gets no file; a line 0 is not a line (the schema's minimum is 1)
    ("leaks", "audit", 1, "  FAIL  notes.md:1: email address\n  FAIL  CLAUDE.md:0: phone number\n"),
    ("plans", "docs", 3, "  UNCHECKED  plans: ../setup/setup not found (set HUB_SETUP_BIN)\n"),
    ("checks", "audit", 1,
     f"  FAIL  {ABSENT_HOOK}: missing; not covered by user scope [hooks-installed]\n"
     "  FAIL  dev.sh:4: credential-shaped value [no-secrets]\n"
     "  note  unchecked no-roster: names half not run\n"),
    ("silent", "code", 3, ""),
    ("extra", "code", 2, "Traceback (most recent call last):\n"),
]
GREEN = [
    ("test", "code", 0, "  ok    test: Ran 26 tests in 1.7s\n"),
    ("hooktests", "code", 0, "  FAIL  ignored: the gate exited 0\n  ok    hooktests: 3 hook test files\n"),
    ("files", "code", 0, "  ok    files\n"),
    ("inputs", "docs", 0, "  ok    inputs: 16 copies verify\n"),
    ("leaks", "audit", 0, "  ok    leaks: no email address, home-folder path or phone number\n"),
    ("plans", "docs", 3, "  UNCHECKED  plans: ../setup/setup not found (set HUB_SETUP_BIN)\n"),
    ("checks", "audit", 0, "  note  unchecked no-roster: x\n  ok    checks: checks run . green, 1 unchecked\n"),
]
# fails and no error, and only an error: each alone must make the verdict red
FAILED = [row for row in RED if row[2] != 2]
BROKE =[("test", "code", 0, "  ok    test\n"), ("extra", "code", 2, "Traceback (most recent call last):\n")]


def fixture(name):
    return json.loads((FIX / name).read_text())


def rows(tmp, table):
    out = []
    for gate, role, code, text in table:
        (tmp / f"{gate}.out").write_text(text)
        out.append(f"{gate}:{role}:{code}:{tmp / f'{gate}.out'}")
    return out


def mutated(src, dest, old, new):
    """Copy `src` to `dest` with `old` (exactly once) replaced by `new`."""
    text = src.read_text()
    if text.count(old) != 1:
        raise AssertionError(f"STALE mutant: {old!r} occurs {text.count(old)} time(s) in {src.name}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(text.replace(old, new))
    dest.chmod(0o755)
    return dest


# dev.sh's own check --json with its gates swapped for canned ones. A gate that
# assigns names the loop uses (setup's cmd_hooks once leaked one that way,
# emptying every later gate's findings) must change nothing outside itself.
GATES_LINE = 'GATES="test hooktests files inputs leaks plans checks"\n'
DISPATCH = 'case "${1:-}" in\n'
CANNED = ('cmd_test() { json=0; rows=(); code=0; dest=/dev/null; capdir=/nonexistent; ok=(); fail=(); g=x\n'
          '  echo "FAIL: test_x (test_hubcheck.T.test_x)"; return 1; }\n'
          'cmd_files() { echo "  FAIL  dev.sh:7: canned"; return 1; }\n'
          'cmd_plans() { echo "  UNCHECKED  plans: canned, not here"; return 3; }\n'
          'cmd_leaks() { echo "  ok    leaks"; }\n')
WIRED = [("test", "fail", None, [("FAIL: test_x (test_hubcheck.T.test_x)", None, None, "code")]),
         ("files", "fail", None, [("dev.sh:7: canned", "dev.sh", 7, "code")]),
         ("plans", "unchecked", "plans: canned, not here", []),
         ("leaks", "ok", None, [])]


def wired_copy(d, dev_sh=None):
    """A copy of dev.sh (or of `dev_sh`, a mutated one) and the helper, gates canned."""
    (d / "devtools").mkdir(parents=True, exist_ok=True)
    shutil.copy(HELPER, d / "devtools")
    text = (dev_sh or TOOL_ROOT / "dev.sh").read_text()
    if (text.count(GATES_LINE), text.count(DISPATCH)) != (1, 1):
        raise AssertionError("dev.sh moved: update tests/test_checkjson.py's GATES_LINE / DISPATCH")
    text = text.replace(GATES_LINE, 'GATES="test files plans leaks"\n').replace(DISPATCH, CANNED + DISPATCH)
    (d / "dev.sh").write_text(text)
    (d / "dev.sh").chmod(0o755)
    return d


def run_check(d):
    return subprocess.run(["./dev.sh", "check", "--json"], cwd=d, capture_output=True, text=True,
                          stdin=subprocess.DEVNULL)


class Case(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def validate(self, name, text, code):
        """The real check-json validator, on a scratch repo whose dev.sh prints `text` and exits `code`."""
        repo = self.tmp / "live" / name
        repo.mkdir(parents=True)
        subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
        (repo / "payload.json").write_text(text)
        (repo / "dev.sh").write_text("#!/usr/bin/env bash\n# check --json: prints payload.json, canned\n"
                                     f"cat payload.json\nexit {code}\n")
        (repo / "dev.sh").chmod(0o755)
        r = subprocess.run([str(CHECKS_CLI), "one", "check-json", str(repo), "--json"],
                           capture_output=True, text=True, stdin=subprocess.DEVNULL)
        results = json.loads(r.stdout)["results"]
        self.assertEqual([x["check"] for x in results], ["check-json"], r.stdout)
        if results[0]["status"] == "unchecked" and os.environ.get(GUARD):
            self.skipTest("nested inside a check-json run, which answers UNCHECKED here by design")
        return results[0]["status"], results[0]["lines"]


class Report(Case):
    def helper(self, args, helper=HELPER):
        return subprocess.run([str(helper), *args], capture_output=True, text=True, stdin=subprocess.DEVNULL)

    def test_absent_hook_is_absent(self):
        # the red fixture's `"file": null` for this row holds only while it is not here
        self.assertFalse((TOOL_ROOT / ABSENT_HOOK).exists(), f"{ABSENT_HOOK} exists: pick another stand-in")

    def test_red_report_is_the_fixture_and_exits_red(self):
        r = self.helper(rows(self.tmp, RED))
        self.assertEqual(r.returncode, 1, r.stderr)
        self.assertEqual(len(r.stdout.strip().splitlines()), 1, r.stdout)
        self.assertEqual(json.loads(r.stdout), fixture("check-red.json"))

    def test_green_report_is_the_fixture_and_exits_green(self):
        r = self.helper(rows(self.tmp, GREEN))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(r.stdout), fixture("check-green.json"))

    def test_an_error_alone_is_red(self):
        r = self.helper(rows(self.tmp, BROKE))
        doc = json.loads(r.stdout)
        self.assertEqual((r.returncode, doc["ok"], [c["status"] for c in doc["checks"]]), (1, False, ["ok", "error"]))

    def test_the_role_given_is_the_role_reported(self):
        table = [(g, "tests", c, t) for g, _, c, t in RED[:5]]
        doc = json.loads(self.helper(rows(self.tmp, table)).stdout)
        self.assertEqual({f["role"] for c in doc["checks"] for f in c["failures"]}, {"tests"})

    def test_no_gates_or_a_bad_row_is_refused_not_reported(self):
        for args in ([], ["test:code:x:/dev/null"], ["test::0:/dev/null"], [":code:0:/dev/null"], ["test:code:0"]):
            r = self.helper(args)
            self.assertEqual((r.returncode, r.stdout), (64, ""), args)

    def test_unreadable_output_is_a_failure_not_a_pass(self):
        r = self.helper([f"test:code:1:{self.tmp / 'absent'}", f"files:code:1:{self.tmp / 'absent'}"])
        doc = json.loads(r.stdout)
        self.assertEqual((r.returncode, [(c["status"], c["counts"]["failed"]) for c in doc["checks"]]),
                         (1, [("fail", 1), ("fail", 1)]))

    @unittest.skipIf(CHECKS_CLI is None, LONE)
    def test_fixtures_pass_the_validator_and_the_old_shape_does_not(self):
        for name in ("check-red.json", "check-green.json"):
            doc = fixture(name)
            self.assertEqual(self.validate(name, json.dumps(doc), 0 if doc["ok"] else 1), ("ok", []), name)
        old = '{"ok": false, "gates": {"test": "ok", "checks": "fail"}, "drift": "6 differ"}\n'
        status, lines = self.validate("old", old, 1)
        self.assertEqual(status, "fail")
        self.assertIn("schema: $: missing `checks`", lines)


class Wiring(Case):
    def test_dev_sh_wires_each_gate_through_the_helper(self):
        r = run_check(wired_copy(self.tmp / "copy"))
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertEqual(len(r.stdout.strip().splitlines()), 1, r.stdout)
        doc = json.loads(r.stdout)
        self.assertIs(doc["ok"], False)
        self.assertEqual([(c["name"], c["status"], c.get("reason"),
                           [(f["message"], f["file"], f["line"], f["role"]) for f in c["failures"]])
                          for c in doc["checks"]], WIRED)

    def test_every_gate_has_a_role_from_the_starting_set(self):
        """gate_role answers code, tests, audit or docs for every gate dev.sh runs."""
        text = (TOOL_ROOT / "dev.sh").read_text()
        gates = text.split(GATES_LINE.split("=")[0] + '="', 1)[1].split('"', 1)[0].split()
        probe = self.tmp / "roles.sh"
        probe.write_text(text.replace(DISPATCH, 'for g in "$@"; do echo "$g $(gate_role "$g")"; done; exit 0\n'
                                      + DISPATCH))
        out = subprocess.run(["bash", str(probe), *gates], capture_output=True, text=True).stdout.split()
        roles = dict(zip(out[::2], out[1::2]))
        self.assertEqual(set(roles), set(gates))
        self.assertLessEqual(set(roles.values()), {"code", "tests", "audit", "docs"})

    @unittest.skipIf(CHECKS_CLI is None, LONE)
    def test_dev_sh_output_passes_the_validator(self):
        r = run_check(wired_copy(self.tmp / "copy"))
        self.assertEqual(self.validate("wired", r.stdout, r.returncode), ("ok", []))


# (id, rule the validator must name, file mutated, old, new, scenario)
MUTANTS = [
    ("devsh-leaks-gate-output", "one-document", "dev.sh",
     '( "cmd_$g" ) >"$dest" 2>&1; code=$?', '( "cmd_$g" ) 2>"$dest"; code=$?', "wired"),
    ("devsh-gate-shares-the-loop", "one-document", "dev.sh",
     '( "cmd_$g" ) >"$dest"', '"cmd_$g" >"$dest"', "wired"),
    ("devsh-exit-green", "exit-agrees", "dev.sh",
     'python3 devtools/checkjson.py "${rows[@]}"; code=$?', 'python3 devtools/checkjson.py "${rows[@]}"; code=0', "wired"),
    ("helper-exit-green", "exit-agrees", "helper",
     'return 0 if doc["ok"] else 1', "return 0", "red"),
    ("verdict-fail-passes", "verdict", "helper",
     'all(c["status"] in ("ok", "unchecked") for c in checks)', 'all(c["status"] != "error" for c in checks)', "failed"),
    ("verdict-error-passes", "verdict", "helper",
     'all(c["status"] in ("ok", "unchecked") for c in checks)',
     'all(c["status"] in ("ok", "unchecked", "error") for c in checks)', "broke"),
    ("verdict-unchecked-red", "verdict", "helper",
     'all(c["status"] in ("ok", "unchecked") for c in checks)', 'all(c["status"] == "ok" for c in checks)', "green"),
    ("miscounted", "counted", "helper",
     '"counts": {"failed": len(failures)}', '"counts": {"failed": 1}', "red"),
    ("fail-without-failure", "status-failures", "helper",
     'if status in ("fail", "error") and not found:', "if False:", "red"),
    ("ok-with-failures", "status-failures", "helper",
     'found = findings(gate, text) if status in ("fail", "error") else []', "found = findings(gate, text)", "green"),
    ("unchecked-unsaid", "unchecked-reason", "helper",
     'out["reason"] = why or ', "why or ", "green"),
    ("names-collide", "unique-names", "helper",
     'out = {"name": gate,', 'out = {"name": role,', "red"),
    ("line-without-file", "line-needs-file", "helper",
     "return (rel, line) if rel else (None, None)", "return (rel, line) if rel else (None, line)", "red"),
    ("line-zero", "schema", "helper",
     " and int(m.group(2)) >= 1", "", "red"),
    ("role-dropped", "schema", "helper",
     ', "role": role}', "}", "red"),
]


class Mutants(Case):
    """Each shape rule the emitter can break, broken once: the run must change, and
    in the workspace the real validator must fail it under that rule. The unmutated
    runs pass the validator, so the red is the mutant's."""

    def run_mutant(self, mid, src, old, new, scenario):
        d = self.tmp / mid
        if src == "dev.sh":
            bad = mutated(TOOL_ROOT / "dev.sh", d / "mutated-dev.sh", old, new)
            r = run_check(wired_copy(d / "copy", bad))
            base = run_check(wired_copy(d / "base"))
            return r, (base.stdout, base.returncode)
        # in a copy of the tool, so the files the findings name resolve as they do here
        shutil.copytree(TOOL_ROOT, d / "tool", ignore=shutil.ignore_patterns(".git", "__pycache__"))
        helper = mutated(HELPER, d / "tool" / "devtools" / "checkjson.py", old, new)
        table = {"red": RED, "failed": FAILED, "green": GREEN, "broke": BROKE}[scenario]
        r = subprocess.run([str(helper), *rows(d, table)], capture_output=True, text=True)
        base = subprocess.run([str(HELPER), *rows(d, table)], capture_output=True, text=True)
        return r, (base.stdout, base.returncode)

    def test_each_mutant_changes_the_run(self):
        for mid, rule, src, old, new, scenario in MUTANTS:
            with self.subTest(mid):
                r, base = self.run_mutant(mid, src, old, new, scenario)
                self.assertTrue((r.stdout, r.returncode) != base, f"{mid}: SURVIVED (the run did not change)")

    @unittest.skipIf(CHECKS_CLI is None, LONE)
    def test_each_mutant_fails_the_validator_under_its_rule(self):
        for mid, rule, src, old, new, scenario in MUTANTS:
            with self.subTest(mid):
                r, (base_out, base_code) = self.run_mutant(mid, src, old, new, scenario)
                self.assertEqual(self.validate(f"{mid}-base", base_out, base_code), ("ok", []), f"{mid}: baseline")
                status, lines = self.validate(mid, r.stdout, r.returncode)
                self.assertEqual(status, "fail", f"{mid}: SURVIVED the validator")
                self.assertTrue(any(l.startswith(rule + ":") for l in lines), f"{mid}: not under {rule}: {lines}")

    def test_every_rule_the_schema_names_has_a_mutant(self):
        """The schema's x-rules (from the shared checks tool, when it is there) == the
        rules these mutants break, plus `schema` for the structure."""
        if CHECKS_CLI is None:
            self.skipTest(LONE)
        schema = json.loads((CHECKS_CLI.parent / "schema" / "check-json.schema.json").read_text())
        self.assertEqual({m[1] for m in MUTANTS}, set(schema["x-rules"]) | {"schema"})


if __name__ == "__main__":
    unittest.main()
