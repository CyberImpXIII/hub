"""Every gate in devtools/hubcheck.py is shown red on a fixture, and green on a clean one.

A gate that cannot be shown red is not a gate. Leak-shaped strings are built at
run time so this file does not trip the leak audit it tests.
"""
import hashlib
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
        brief = BRIEF + "9. **Fixed** (PLAN-a §1 and §13).\n"
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
