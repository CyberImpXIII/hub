"""`./dev.sh check` runs its parts through the shared suite runner
(PLAN-small-tasks.md §3, §7): devtools/parts.py, a rendered copy of
tools/checks/checkslib/parts.py that `setup <repo> --only parts` installs.

The seams held here:
  - check.parts.json is valid, and its parts are exactly one per tests/test_*.py
    plus one per gate dev.sh dispatches and documents (both directions);
  - the runner copy agrees with its source byte for byte (setup renders it so);
  - .progress/ is ignored by git;
  - dev.sh hands its parts to the runner: `check` (text, with the drift note),
    `check --json`, `check --resume` and `test <part>` on a scratch copy of this
    repo whose canned two-part suite is the input, so the output changes with it;
  - the shared validators pass that scratch copy: check-json and check-partial.
A lone clone (no tools/checks beside it) skips the last two, saying so.
"""
import json
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

TOOL_ROOT = Path(__file__).resolve().parent.parent
RUNNER = TOOL_ROOT / "devtools" / "parts.py"
# Set by the outer runner's caller, they would point a nested run at the outer
# run's progress file or suite: every subprocess here runs without them.
SCRUB = ("CHECK_PARTS", "PROGRESS_FILE")


def _workspace_file(rel):
    for top in TOOL_ROOT.parents:
        p = top / rel
        if p.exists():
            return p
    return None


CHECKS_CLI = _workspace_file("tools/checks/checks")
SOURCE = _workspace_file("tools/checks/checkslib/parts.py")
LONE = "no tools/checks in a workspace around this tool (a lone clone)"


def env(**extra):
    e = {k: v for k, v in os.environ.items() if k not in SCRUB}
    e.update(extra)
    return e


def documented_gates():
    """(the gates dev.sh's case dispatches, the commands its usage lists)."""
    text = (TOOL_ROOT / "dev.sh").read_text()
    usage = text.split("cat <<'EOF'", 1)[1].split("\nEOF", 1)[0]
    listed = set(re.findall(r"^  ([a-z]+) ", usage, re.M))
    dispatched = set(re.findall(r"^  ([a-z]+)\)\s", text, re.M))
    return dispatched, listed


class ThisRepo(unittest.TestCase):
    def test_check_parts_is_valid(self):
        p = subprocess.run(["python3", str(RUNNER), "validate", "check.parts.json"], cwd=TOOL_ROOT,
                           capture_output=True, text=True, env=env(), stdin=subprocess.DEVNULL)
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertRegex(p.stdout, r"^ok: \d+ parts")

    def test_parts_are_the_test_modules_and_the_gates(self):
        parts = json.loads((TOOL_ROOT / "check.parts.json").read_text())["parts"]
        names = [p["name"] for p in parts]
        modules = sorted(f.stem[len("test_"):] for f in (TOOL_ROOT / "tests").glob("test_*.py"))
        tests = sorted(n[len("test."):] for n in names if n.startswith("test."))
        self.assertEqual(tests, modules, "one part per tests/test_*.py, both ways")
        for p in parts:
            if p["name"].startswith("test."):
                self.assertEqual(p["run"], f"python3 -m unittest discover -s tests -p test_{p['name'][5:]}.py")
        gates = [n for n in names if not n.startswith("test.")]
        dispatched, listed = documented_gates()
        for g in gates:
            self.assertEqual(next(p["run"] for p in parts if p["name"] == g), f"./dev.sh {g}")
            self.assertIn(g, dispatched, f"part {g}: dev.sh does not dispatch it")
            self.assertIn(g, listed, f"part {g}: dev.sh's usage does not list it")
        # the other way: every command dev.sh has that is a gate is a part. The
        # commands that are not gates, by name: check and test run the parts; drift
        # is a note; refresh and seal write.
        not_gates = {"check", "test", "drift", "refresh", "seal"}
        self.assertEqual(sorted(dispatched - not_gates), sorted(gates), "dev.sh's gates == the gate parts")
        self.assertEqual(dispatched, listed, "usage lists exactly what dev.sh dispatches")

    def test_the_runner_copy_agrees_with_its_source(self):
        if SOURCE is None:
            self.skipTest(LONE)
        self.assertEqual(RUNNER.read_bytes(), SOURCE.read_bytes(),
                         f"devtools/parts.py differs from {SOURCE}: `setup <repo> --only parts --rebuild`")

    def test_the_progress_folder_is_ignored_by_git(self):
        p = subprocess.run(["git", "-C", str(TOOL_ROOT), "check-ignore", "-q", ".progress/check.json"])
        self.assertEqual(p.returncode, 0, ".progress/ must be in .gitignore")


CANNED = {"parts": [
    {"name": "a", "run": "echo a >> ran", "files": ["a.txt"], "timeout_s": 60, "role": "docs"},
    {"name": "b", "run": "echo b >> ran; test -e b.ok || { echo '  FAIL  b: canned'; exit 1; }",
     "files": ["b.txt"], "timeout_s": 60, "role": "audit"},
]}


class Wired(unittest.TestCase):
    """dev.sh, the runner and hubcheck.py copied into a scratch git repo whose
    check.parts.json is the canned suite above."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self._tmp.name) / "hub"
        (self.repo / "devtools").mkdir(parents=True)
        shutil.copy2(TOOL_ROOT / "dev.sh", self.repo / "dev.sh")
        for f in ("parts.py", "hubcheck.py"):
            shutil.copy2(TOOL_ROOT / "devtools" / f, self.repo / "devtools" / f)
        (self.repo / "check.parts.json").write_text(json.dumps(CANNED))
        (self.repo / "a.txt").write_text("a\n")
        (self.repo / "b.txt").write_text("b\n")
        (self.repo / ".gitignore").write_text(".progress/\nran\n")
        subprocess.run(["git", "init", "-q"], cwd=self.repo, check=True)

    def tearDown(self):
        self._tmp.cleanup()

    def dev(self, *args, **extra):
        return subprocess.run(["./dev.sh", *args], cwd=self.repo, capture_output=True, text=True,
                              env=env(**extra), stdin=subprocess.DEVNULL, timeout=300)

    def ran(self):
        p = self.repo / "ran"
        out = p.read_text().split() if p.exists() else []
        p.unlink(missing_ok=True)
        return out

    def test_text_names_the_failed_part_then_the_drift_note(self):
        p = self.dev("check")
        self.assertEqual(p.returncode, 1, p.stdout + p.stderr)
        self.assertEqual(self.ran(), ["a", "b"])
        self.assertIn("check: 1 of 2 passed; failed: b", p.stdout)
        self.assertIn("FAIL  b: canned", p.stdout)
        self.assertTrue(p.stdout.splitlines()[-1].startswith("  note  drift: "), p.stdout)
        (self.repo / "b.ok").write_text("")
        p = self.dev("check")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertIn("check: 2 of 2 passed", p.stdout)

    def test_json_is_one_document_one_check_per_part(self):
        p = self.dev("check", "--json")
        self.assertEqual(p.returncode, 1, p.stderr)
        doc = json.loads(p.stdout)
        self.assertFalse(doc["ok"])
        self.assertEqual([(c["name"], c["status"]) for c in doc["checks"]], [("a", "ok"), ("b", "fail")])
        # a part's role is on its failures: b's is the canned FAIL line, audit's
        self.assertEqual([(f["message"], f["role"]) for f in doc["checks"][1]["failures"]],
                         [("FAIL  b: canned", "audit")])

    def test_resume_reruns_only_what_did_not_pass_or_changed(self):
        self.dev("check")
        self.ran()
        p = self.dev("check", "--resume")
        self.assertEqual(self.ran(), ["b"], p.stdout)
        self.assertIn("resume: re-running 1 of 2", p.stdout)
        (self.repo / "a.txt").write_text("changed\n")
        (self.repo / "b.ok").write_text("")
        p = self.dev("check", "--resume")
        self.assertEqual(p.returncode, 0, p.stdout)
        self.assertEqual(self.ran(), ["a", "b"])

    def test_test_with_a_part_runs_just_that_part_and_a_resume_keeps_it(self):
        p = self.dev("test", "a")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertEqual(self.ran(), ["a"])
        self.assertEqual(p.stdout.splitlines()[-1], "check: 1 of 1 passed; not run: 1 (--only)")
        self.assertNotIn("note  drift", p.stdout)
        p = self.dev("check", "--resume")
        self.assertEqual(self.ran(), ["b"], p.stdout)

    def test_check_parts_env_runs_that_suite_instead(self):
        other = Path(self._tmp.name) / "other.json"
        other.write_text(json.dumps({"parts": [{"name": "c", "run": "echo c >> ran", "files": ["c.txt"],
                                                "timeout_s": 60}]}))
        (Path(self._tmp.name) / "c.txt").write_text("c\n")
        p = self.dev("check", CHECK_PARTS=str(other), PROGRESS_FILE=str(Path(self._tmp.name) / "p.json"))
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertIn("check: 1 of 1 passed", p.stdout)
        self.assertEqual(self.ran(), [])
        self.assertEqual((Path(self._tmp.name) / "ran").read_text().split(), ["c"])

    def shared(self, check):
        if CHECKS_CLI is None:
            self.skipTest(LONE)
        (self.repo / "b.ok").write_text("")
        p = subprocess.run([str(CHECKS_CLI), "one", check, str(self.repo), "--json"], capture_output=True,
                           text=True, env=env(), stdin=subprocess.DEVNULL, timeout=600)
        results = json.loads(p.stdout)["results"]
        self.assertEqual([r["check"] for r in results], [check], p.stdout)
        if results[0]["status"] == "unchecked" and os.environ.get(f"CHECKS_{check.upper().replace('-', '_')}_ACTIVE"):
            self.skipTest(f"nested inside a {check} run, which answers UNCHECKED here by design")
        self.assertEqual(results[0]["status"], "ok", results[0].get("lines"))

    def test_the_shared_check_json_validator_passes_it(self):
        self.shared("check-json")

    def test_the_shared_check_partial_gate_passes_it(self):
        self.shared("check-partial")


if __name__ == "__main__":
    unittest.main()
