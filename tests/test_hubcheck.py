"""Every gate in devtools/hubcheck.py is shown red on a fixture, and green on a clean one.

A gate that cannot be shown red is not a gate. Leak-shaped strings are built at
run time so this file does not trip the leak audit it tests.
"""
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "devtools"))
import hubcheck as hc  # noqa: E402

EMAIL = "jane" + "@" + "mail" + ".test"
HOME = "/Us" + "ers/" + "jane/notes"
PHONE = "-".join(["555", "123", "4567"])

BRIEF = """# brief

## 2. Inputs

| file | read | why |
|---|---|---|
| this file | all | x |
| `CLAUDE.md` (top level) | all | x |
| `PLAN-a.md` | all | x |

## 3. Next
"""


def sha(text):
    return hashlib.sha256(text.encode()).hexdigest()


class Fixture:
    """A repo (root) and a workspace top (top) holding the originals."""

    def __init__(self):
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.top, self.root = base / "top", base / "top" / "tools" / "hub"
        originals = {"CLAUDE.md": "top rules\n", "PLAN-hub-brief.md": BRIEF, "PLAN-a.md": "plan a\n"}
        self.top.mkdir(parents=True)
        for name, text in originals.items():
            (self.top / name).write_text(text)
        r = self.root
        (r / "docs/inputs").mkdir(parents=True)
        for name in ("CLAUDE.md", "TODO.md", ".gitignore"):
            (r / name).write_text("# x\n")
        (r / "dev.sh").write_text("#!/bin/sh\n")
        (r / "dev.sh").chmod(0o755)
        (r / "PLAN-hub-brief.md").write_text(BRIEF)
        (r / "docs/inputs/claudeTest-CLAUDE.md").write_text(originals["CLAUDE.md"])
        (r / "docs/inputs/PLAN-a.md").write_text(originals["PLAN-a.md"])
        (r / "docs/inputs/README.md").write_text(
            "| copy | original | read by |\n|---|---|---|\n"
            "| `../../PLAN-hub-brief.md` | `PLAN-hub-brief.md` | brief |\n"
            "| `claudeTest-CLAUDE.md` | `CLAUDE.md` | brief §2 |\n"
            "| `PLAN-a.md` | `PLAN-a.md` | brief §2 |\n")
        (r / "docs/inputs/SHA256SUMS").write_text(
            f"{sha(BRIEF)}  PLAN-hub-brief.md\n"
            f"{sha(originals['CLAUDE.md'])}  docs/inputs/claudeTest-CLAUDE.md\n"
            f"{sha(originals['PLAN-a.md'])}  docs/inputs/PLAN-a.md\n")
        subprocess.run(["git", "init", "-q", str(r)], check=True)
        os.environ["HUB_WORKSPACE"] = str(self.top)

    def close(self):
        os.environ.pop("HUB_WORKSPACE", None)
        self.tmp.cleanup()


class Base(unittest.TestCase):
    def setUp(self):
        self.fx = Fixture()
        self.r = self.fx.root

    def tearDown(self):
        self.fx.close()

    def assertFinding(self, findings, needle):
        self.assertTrue(any(needle in f for f in findings), f"no finding with {needle!r} in {findings}")


class TestInputs(Base):
    def test_clean(self):
        self.assertEqual(hc.gate_inputs(self.r), [])
        self.assertEqual(hc.gate_files(self.r), [])

    def test_changed_copy(self):
        (self.r / "docs/inputs/PLAN-a.md").write_text("edited\n")
        self.assertFinding(hc.gate_inputs(self.r), "PLAN-a.md does not match its sum")

    def test_missing_copy(self):
        (self.r / "docs/inputs/PLAN-a.md").unlink()
        self.assertFinding(hc.gate_inputs(self.r), "PLAN-a.md is missing")

    def test_extra_file_on_disk(self):
        (self.r / "docs/inputs/PLAN-b.md").write_text("b\n")
        self.assertFinding(hc.gate_inputs(self.r), "PLAN-b.md: on disk but not in")

    def test_readme_row_missing(self):
        p = self.r / "docs/inputs/README.md"
        p.write_text("\n".join(l for l in p.read_text().splitlines() if "PLAN-a" not in l) + "\n")
        f = hc.gate_inputs(self.r)
        self.assertFinding(f, "lists docs/inputs/PLAN-a.md, which the docs/inputs/README.md table does not")
        self.assertFinding(f, "§2 names PLAN-a.md")

    def test_readme_row_without_sum(self):
        p = self.r / "docs/inputs/README.md"
        p.write_text(p.read_text() + "| `PLAN-c.md` | `PLAN-c.md` | review |\n")
        self.assertFinding(hc.gate_inputs(self.r), "lists docs/inputs/PLAN-c.md, which docs/inputs/SHA256SUMS does not")

    def test_brief_names_an_uncopied_file(self):
        text = BRIEF.replace("## 3. Next", "") + "| `PLAN-z.md` | all | x |\n\n## 3. Next\n"
        (self.r / "PLAN-hub-brief.md").write_text(text)
        names = hc.brief_names(self.r)
        self.assertIn("PLAN-z.md", names)
        self.assertFinding(hc.gate_inputs(self.r), "§2 names PLAN-z.md")

    def test_claude_md_under_docs(self):
        (self.r / "docs/inputs/CLAUDE.md").write_text("x\n")
        self.assertFinding(hc.gate_inputs(self.r), "loads as instructions")

    def _brief_and_plan(self, brief, plan):
        """Write a brief and PLAN-a.md copy, keeping SHA256SUMS true so only the pointer gate speaks."""
        (self.r / "PLAN-hub-brief.md").write_text(brief)
        (self.r / "docs/inputs/PLAN-a.md").write_text(plan)
        (self.r / "docs/inputs/claudeTest-CLAUDE.md").write_text("## Rules here: x\n")
        (self.r / "docs/inputs/SHA256SUMS").write_text(
            f"{sha(brief)}  PLAN-hub-brief.md\n"
            f"{sha('## Rules here: x' + chr(10))}  docs/inputs/claudeTest-CLAUDE.md\n"
            f"{sha(plan)}  docs/inputs/PLAN-a.md\n")

    def test_pointer_into_a_copy_resolves(self):
        brief = (BRIEF.replace("| `PLAN-a.md` | all |", "| `PLAN-a.md` | §1, §2a |")
                 .replace("| `CLAUDE.md` (top level) | all |", '| `CLAUDE.md` (top level) | "Rules here" |')
                 + "1. **Fixed** (PLAN-a §13 and §2a; PLAN-a.md §1).\n")
        plan = "# a\n## 1. One\n## 2a. Two a\n## 13. Thirteen\n"
        self._brief_and_plan(brief, plan)
        self.assertEqual(hc.gate_inputs(self.r), [])
        # table: §1, §2a, "Rules here"; text: §13, §2a, §1 -- all six were looked at
        self.assertEqual(hc.brief_pointers(self.r, hc.readme_rows(self.r))[1], 6)

    def test_pointer_to_a_missing_section(self):
        # the seam this gate exists for: the brief cites a section the copy has not got yet
        brief = BRIEF + "1. **Fixed** (PLAN-a §1 and §13).\n"
        self._brief_and_plan(brief, "# a\n## 1. One\n")
        self.assertFinding(hc.gate_inputs(self.r), "points to PLAN-a.md §13; no '## 13.' heading")
        self._brief_and_plan(brief, "# a\n## 1. One\n## 13. Added\n")
        self.assertEqual(hc.gate_inputs(self.r), [])

    def test_table_section_and_quote_missing(self):
        brief = (BRIEF.replace("| `PLAN-a.md` | all |", "| `PLAN-a.md` | §1, §4 |")
                 .replace("| `CLAUDE.md` (top level) | all |", '| `CLAUDE.md` (top level) | "Gone rule" |'))
        self._brief_and_plan(brief, "# a\n## 1. One\n")
        f = hc.gate_inputs(self.r)
        self.assertFinding(f, "§2 table points to PLAN-a.md §4")
        self.assertFinding(f, '§2 table points to CLAUDE.md "Gone rule"')
        self.assertEqual(len(f), 2, f)

    def test_pointer_into_an_uncopied_plan_is_not_checked(self):
        brief = BRIEF + "See PLAN-hub-review.md §4a and some-thing §9.\n"
        self._brief_and_plan(brief, "plan a\n")
        self.assertEqual(hc.gate_inputs(self.r), [])

    def test_numbering_counts_without_repeat_or_gap(self):
        # two lists in two sections, a nested list, and a second list restarting at 1
        brief = BRIEF + ("1. a\n2. b\n   1. nested\n   7. nested\n3. c\n\nAfter.\n\n1. again\n2. again\n"
                         "\n## 4. More\n\n1. x\n2. y\n")
        self._brief_and_plan(brief, "plan a\n")
        self.assertEqual(hc.gate_inputs(self.r), [])
        self.assertEqual(hc.brief_numbering(self.r), ([], 7))

    def test_duplicate_item_number(self):
        # the seam this gate exists for: a new fixed point written as a second "9."
        items = "".join(f"{k}. x\n" for k in range(1, 10)) + "9. y\n10. z\n"
        self._brief_and_plan(BRIEF + items, "plan a\n")
        f = hc.gate_inputs(self.r)
        self.assertFinding(f, "item 9 in §3 follows item 9; expected 10")
        self.assertEqual(len(f), 1, f)

    def test_skipped_item_number(self):
        self._brief_and_plan(BRIEF + "1. a\n3. b\n", "plan a\n")
        self.assertEqual(hc.gate_inputs(self.r), [f"PLAN-hub-brief.md:{BRIEF.count(chr(10)) + 2}: item 3 in §3 follows item 1; expected 2"])

    def test_malformed_sums_line(self):
        p = self.r / "docs/inputs/SHA256SUMS"
        p.write_text(p.read_text() + "not a sum line\n")
        self.assertFinding(hc.gate_inputs(self.r), "not a '<sha256>  <path>' line")


class TestFiles(Base):
    def test_missing_and_not_executable(self):
        (self.r / "TODO.md").unlink()
        (self.r / "dev.sh").chmod(0o644)
        f = hc.gate_files(self.r)
        self.assertFinding(f, "TODO.md: missing")
        self.assertFinding(f, "dev.sh: not executable")


class TestLeaks(Base):
    def test_clean_repo(self):
        self.assertEqual(hc.gate_leaks(self.r), [])

    def test_each_kind_found_value_never_printed(self):
        (self.r / "notes.md").write_text(f"mail {EMAIL}\npath {HOME}\ncall {PHONE}\n")
        f = hc.gate_leaks(self.r)
        self.assertFinding(f, "notes.md:1: email address")
        self.assertFinding(f, "notes.md:2: home-folder path")
        self.assertFinding(f, "notes.md:3: phone number")
        self.assertFalse(any(EMAIL in x or HOME in x or PHONE in x for x in f), f)

    def test_ignored_file_not_scanned(self):
        (self.r / ".gitignore").write_text("secret.md\n")
        (self.r / "secret.md").write_text(EMAIL + "\n")
        self.assertEqual(hc.gate_leaks(self.r), [])

    def test_placeholders_and_dates_pass(self):
        text = ("`/Users/...` and `/Users/<x>`; noreply@anthropic.com; a@example.com;\n"
                "2026-10-04, 2026-10-04T20:14Z, 250-400k, 29k\n")
        (self.r / "ok.md").write_text(text)
        self.assertEqual(hc.gate_leaks(self.r), [])


class TestChecks(Base):
    """gate_checks reads `checks run --json`'s report: every failing line, never the truncated text."""

    def fake_cli(self, report, code):
        """A stand-in checks CLI: prints `report` (a dict, or raw text) and exits `code`; logs its argv."""
        (self.r / "report.out").write_text(report if isinstance(report, str) else json.dumps(report))
        cli = self.r / "fake-checks"
        cli.write_text(f'#!/usr/bin/env bash\necho "$@" > "{self.r}/argv.out"\n'
                       f'cat "{self.r}/report.out"\necho "a stderr line" >&2\nexit {code}\n')
        cli.chmod(0o755)
        return cli

    def results(self, *rows):
        return {"results": [{"check": c, "status": s, "lines": ls} for c, s, ls in rows]}

    def test_green_with_unchecked_is_ok_and_names_them(self):
        rep = self.results(("a", "ok", []), ("b", "unchecked", ["no node.json"]))
        f, notes = hc.gate_checks(self.fake_cli(rep, 0), self.r)
        self.assertEqual((f, notes), ([], ["b: no node.json"]))
        self.assertEqual((self.r / "argv.out").read_text().split(), ["run", str(self.r), "--json"])

    def test_every_failing_line_is_a_finding_path_first(self):
        lines = [f".claude/hooks/h{i}.sh: missing" for i in range(12)]   # the text run shows 8, then "... and 4 more"
        rep = self.results(("hooks-installed", "fail", lines), ("x", "error", []), ("a", "ok", []))
        f, _ = hc.gate_checks(self.fake_cli(rep, 1), self.r)
        self.assertEqual(f, [f"{l} [hooks-installed]" for l in lines] + ["x: error, with no line saying why"])

    def test_exit_disagreeing_with_the_report_is_a_finding(self):
        f, _ = hc.gate_checks(self.fake_cli(self.results(("a", "ok", [])), 1), self.r)
        self.assertEqual(f, ["checks run . exit 1 disagrees with its report (1 checks)"])
        f, _ = hc.gate_checks(self.fake_cli(self.results(("a", "fail", ["l"])), 0), self.r)
        self.assertEqual(f, ["l [a]", "checks run . exit 0 disagrees with its report (1 checks)"])

    def test_no_report_or_an_empty_one_is_not_a_pass(self):
        f, _ = hc.gate_checks(self.fake_cli("checks run: 1 ok -> green\n", 0), self.r)
        self.assertFinding(f, "printed no report with results (exit 0; a stderr line)")
        f, _ = hc.gate_checks(self.fake_cli(self.results(), 0), self.r)
        self.assertFinding(f, "reported no checks (exit 0)")
        f, _ = hc.gate_checks(self.r / "absent-cli", self.r)
        self.assertFinding(f, "could not start")

    def test_main_prints_findings_in_the_gate_shape(self):
        cli = self.fake_cli(self.results(("a", "fail", ["dev.sh:3: x"])), 1)
        p = subprocess.run([sys.executable, str(Path(hc.__file__)), "checks", str(cli)], capture_output=True,
                           text=True, env={**os.environ, "HUB_ROOT": str(self.r)})
        self.assertEqual((p.returncode, p.stdout), (1, "  FAIL  dev.sh:3: x [a]\n"))


class TestHooktests(unittest.TestCase):
    """dev.sh's hooktests gate on fixture test files: an UNCHECKED test file (exit 3
    ending on `UNCHECKED: <why>`) makes the gate 3, never 0 and never 1; any real
    failure, or an exit 3 that does not say UNCHECKED, makes it 1."""

    DEV = Path(__file__).resolve().parent.parent / "dev.sh"
    BODIES = {
        "pass": 'echo "  ok    a case"\necho "all cases passed"\n',
        "unchecked": 'echo "  UNCHECKED  no sibling"\necho "UNCHECKED: site-scrapers not found"\nexit 3\n',
        "silent3": 'echo "  ok    a case"\nexit 3\n',
        "fail": 'echo "  FAIL  a case"\nexit 1\n',
        "quiet0": 'echo "  ok    a case"\n',
    }

    def run_gate(self, *kinds):
        with tempfile.TemporaryDirectory() as d:
            for i, k in enumerate(kinds):
                t = Path(d) / f"test-{i}-{k}.sh"
                t.write_text("#!/usr/bin/env bash\n" + self.BODIES[k])
                t.chmod(0o755)
            p = subprocess.run([str(self.DEV), "hooktests"], capture_output=True, text=True,
                               env={**os.environ, "HUB_HOOKS_DIR": d})
        return p.returncode, p.stdout

    def test_all_pass_is_ok(self):
        code, out = self.run_gate("pass", "pass")
        self.assertEqual(code, 0, out)
        self.assertIn("ok    hooktests: 2 hook test files, all cases passed", out)

    def test_unchecked_is_3_and_says_why(self):
        code, out = self.run_gate("pass", "unchecked")
        self.assertEqual(code, 3, out)
        self.assertIn("UNCHECKED  hooktests: ", out)
        self.assertIn("site-scrapers not found", out)
        self.assertNotIn("FAIL", out)
        self.assertNotIn("all cases passed", out)
        sys.path.insert(0, str(self.DEV.parent / "devtools"))
        import checkjson
        row = checkjson.check("hooktests", "code", code, out)
        self.assertEqual(row["status"], "unchecked")
        self.assertIn("site-scrapers not found", row["reason"])

    def test_exit_3_without_saying_unchecked_is_a_failure(self):
        code, out = self.run_gate("pass", "silent3")
        self.assertEqual(code, 1, out)
        self.assertIn("FAIL  ", out)

    def test_a_failure_beside_an_unchecked_is_1(self):
        code, out = self.run_gate("unchecked", "fail")
        self.assertEqual(code, 1, out)

    def test_exit_0_without_all_cases_passed_is_a_failure(self):
        code, out = self.run_gate("quiet0")
        self.assertEqual(code, 1, out)

    def test_no_test_files_is_a_failure(self):
        code, out = self.run_gate()
        self.assertEqual(code, 1, out)
        self.assertIn("no ", out)


class TestDriftAndRefresh(Base):
    def test_in_step(self):
        self.assertEqual(hc.drift(self.r), ([], []))

    def test_changed_original_is_drift(self):
        (self.fx.top / "PLAN-a.md").write_text("plan a, v2\n")
        self.assertEqual(hc.drift(self.r), (["docs/inputs/PLAN-a.md"], []))

    def test_unreachable_is_none_not_clean(self):
        os.environ["HUB_WORKSPACE"] = str(self.r / "nowhere")
        self.assertIsNone(hc.drift(self.r))
        self.assertFinding(hc.refresh(self.r), "not reachable")

    def test_refresh_copies_and_rewrites_sums(self):
        (self.fx.top / "PLAN-a.md").write_text("plan a, v2\n")
        self.assertEqual(hc.refresh(self.r), [])
        self.assertEqual((self.r / "docs/inputs/PLAN-a.md").read_text(), "plan a, v2\n")
        self.assertEqual(hc.gate_inputs(self.r), [])
        self.assertEqual(hc.drift(self.r), ([], []))

    def test_refresh_refuses_on_a_leak_and_copies_nothing(self):
        (self.fx.top / "PLAN-a.md").write_text(f"plan a, {EMAIL}\n")
        f = hc.refresh(self.r)
        self.assertFinding(f, "leak audit refused")
        self.assertFinding(f, "PLAN-a.md:1: email address")
        self.assertEqual((self.r / "docs/inputs/PLAN-a.md").read_text(), "plan a\n")
        self.assertEqual(hc.gate_inputs(self.r), [])


if __name__ == "__main__":
    unittest.main()
