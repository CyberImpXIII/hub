#!/usr/bin/env bash
# The one pre-commit command for this repo: ./dev.sh check
#
# The repo is a plan and its inputs today; nothing is built, so the gates are
# about those (devtools/hubcheck.py) plus the shared ones from the sibling tools.
# A sibling tool that is not there (a lone clone, a cloud session) is UNCHECKED,
# printed as such, never counted as ok. Each gate's REPORTED result is read, not
# only its exit code.
#
# `./dev.sh check` hands check.parts.json to the shared suite runner
# devtools/parts.py (PLAN-small-tasks.md §3, §7: a rendered copy of
# tools/checks/checkslib/parts.py, installed by `setup <repo> --only parts`).
# Each part has its own timeout; each result is written to .progress/check.json
# as it ends; `--resume` re-runs only the parts whose files changed since they
# passed; `--json` prints the one schema (tools/checks' check-json.schema.json),
# one check per part. CHECK_PARTS=<file> runs that file's parts instead
# (tools/checks' check-partial hands it a suite of its own). The runner has no
# `unchecked` outcome: a gate that exits 3 (UNCHECKED, a sibling tool absent) is
# a failed part there, named with its last line -- red, never ok.
# tests/test_parts.py holds check.parts.json to the test modules and the gates.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")" || exit 2

SETUP_BIN="${HUB_SETUP_BIN:-../setup/setup}"
CHECKS_BIN="${HUB_CHECKS_BIN:-../checks/checks}"

usage() {
  cat <<'EOF'
./dev.sh <command>

  check      every part of check.parts.json (a part per test module, then hooktests,
             files, inputs, sealed, leaks, plans, checks), each with its own timeout,
             run by devtools/parts.py; ends "check: N of M passed; failed: ...", then
             the drift note; non-zero if any fails. --resume: only the parts whose files
             changed since they passed (and those that did not pass); --only <part>: just
             that part; --json: the one schema, one check per part (drift is a note, not
             a check, so it is not there: ./dev.sh drift --json); CHECK_PARTS=<file>:
             that file's parts instead
  test       the unit tests (tests/), all at once: every hubcheck gate shown red on a
             fixture. `test <part>...`: just those parts of check.parts.json (check
             --only), results in the progress file, so a later check --resume skips them
             while their files are unchanged
  hooktests  the shared hook copies' own tests (.claude/hooks/test-*.sh); one ending
             `UNCHECKED: <why>` with exit 3 makes the gate unchecked, never ok
  files      the files this repo needs are present; dev.sh is executable
  inputs     docs/inputs/ copies match SHA256SUMS; README table, SHA256SUMS and disk agree; brief §2 covered
  sealed     every copy is mode 0444: a marker, not a guard (Edit and Write change a 0444 file);
             the guard is inputs. git does not keep the mode: after a clone, ./dev.sh seal
  leaks      no email address, home-folder path or phone number in what would be committed
  plans      setup plans . (every PLAN-*.md not done has a Setup component heading)
  checks     tools/checks: checks run . --json, every failing line (credential-shaped values, hooks, rules, TODO, help)
  drift      each copy against its original at the workspace top (a note in check, never a fail)
  refresh    copy every original over its copy (leak audit first) at mode 0444, rewrite SHA256SUMS
  seal       set every copy to mode 0444, content untouched (after a clone or a checkout)
EOF
}

# Each gate prints its own lines and returns 0 ok, 1 fail, 3 unchecked.

cmd_test() {
  local out code only=() p
  if [ "$#" -gt 0 ]; then
    for p in "$@"; do only+=(--only "$p"); done
    cmd_check "${only[@]}"; return
  fi
  out=$(python3 -m unittest discover -s tests 2>&1); code=$?
  if [ $code -eq 0 ] && printf '%s\n' "$out" | grep -q '^OK'; then
    echo "  ok    test: $(printf '%s\n' "$out" | grep -E '^Ran ' | head -1)"; return 0
  fi
  printf '%s\n' "$out"; echo "  FAIL  test"; return 1
}

# A test file that exits 3 AND ends on its `UNCHECKED: <why>` line could not find
# what it tests against (a lone clone: no site-scrapers beside it). That is
# UNCHECKED, said out loud, never ok and never a failure of the hook; exit 3
# without that line is a FAIL. Any FAIL makes the gate 1; otherwise any UNCHECKED
# makes it 3. HUB_HOOKS_DIR exists for tests/test_hubcheck.py's fixtures.
cmd_hooktests() {
  local dir="${HUB_HOOKS_DIR:-.claude/hooks}" t out code last fails=0 unchecked=0 n=0
  for t in "$dir"/test-*.sh; do
    [ -e "$t" ] || { echo "  FAIL  hooktests: no $dir/test-*.sh"; return 1; }
    n=$((n+1))
    out=$("$t" 2>&1); code=$?
    last=$(printf '%s\n' "$out" | tail -1)
    if [ $code -eq 0 ] && printf '%s\n' "$last" | grep -q 'all cases passed'; then
      :
    elif [ $code -eq 3 ] && printf '%s\n' "$last" | grep -q '^UNCHECKED: '; then
      echo "  UNCHECKED  hooktests: $t: ${last#UNCHECKED: }"; unchecked=$((unchecked+1))
    else
      # the test's tail under its FAIL line, indented: --json joins it into the message
      echo "  FAIL  $t: exit $code"; printf '%s\n' "$out" | tail -5 | sed 's/^/        /'; fails=$((fails+1))
    fi
  done
  [ $fails -gt 0 ] && return 1
  [ $unchecked -gt 0 ] && { echo "  note  hooktests: $((n-unchecked)) of $n hook test files passed, $unchecked unchecked"; return 3; }
  echo "  ok    hooktests: $n hook test files, all cases passed"
}

cmd_files()   { python3 devtools/hubcheck.py files; }
cmd_inputs()  { python3 devtools/hubcheck.py inputs; }
cmd_sealed()  { python3 devtools/hubcheck.py sealed; }
cmd_seal()    { python3 devtools/hubcheck.py seal; }
cmd_leaks()   { python3 devtools/hubcheck.py leaks "$@"; }
cmd_drift()   { python3 devtools/hubcheck.py drift "$@"; }
cmd_refresh() { python3 devtools/hubcheck.py refresh; }

cmd_plans() {
  local out code
  [ -x "$SETUP_BIN" ] || { echo "  UNCHECKED  plans: $SETUP_BIN not found (set HUB_SETUP_BIN)"; return 3; }
  out=$("$SETUP_BIN" plans . 2>&1); code=$?
  printf '%s\n' "$out"
  if [ $code -eq 0 ] && printf '%s\n' "$out" | grep -q '^  ok '; then return 0; fi
  echo "  FAIL  plans: setup plans . exit $code"; return 1
}

# Its report, not its text: the text run truncates a long check's lines.
cmd_checks() {
  [ -x "$CHECKS_BIN" ] || { echo "  UNCHECKED  checks: $CHECKS_BIN not found (set HUB_CHECKS_BIN)"; return 3; }
  python3 devtools/hubcheck.py checks "$CHECKS_BIN"
}

# The parts, their files, timeouts and roles (PLAN-agent-groups.md §4.1: a test is
# code's; the inputs, the seal and the plans' headings are docs'; the leak audit
# and tools/checks' findings are audit's) are check.parts.json's, not this file's.
# A text run of the repo's own whole suite ends with the drift note; --json, --only
# and CHECK_PARTS runs do not (stdout is one document; a partial run is no verdict).
cmd_check() {
  local a code note=1
  for a in "$@"; do case "$a" in --json|--only) note=0 ;; esac; done
  [ -n "${CHECK_PARTS:-}" ] && note=0
  python3 devtools/parts.py run "${CHECK_PARTS:-check.parts.json}" "$@"; code=$?
  [ $note -eq 1 ] && drift_note
  return $code
}

drift_note() {
  local out code n
  out=$(cmd_drift 2>&1); code=$?
  case $code in
    0) n="in step" ;;
    3) n="unchecked" ;;
    *) n="$(printf '%s\n' "$out" | grep -c -E '^  (DIFF|GONE) ') differ" ;;
  esac
  echo "  note  drift: $n (./dev.sh drift; refresh is a decision, not a gate)"
}

case "${1:-}" in
  check)     shift; cmd_check "$@" ;;
  test)      shift; cmd_test "$@" ;;
  hooktests) cmd_hooktests ;;
  files)     cmd_files ;;
  inputs)    cmd_inputs ;;
  sealed)    cmd_sealed ;;
  seal)      cmd_seal ;;
  leaks)     shift; cmd_leaks "$@" ;;
  plans)     cmd_plans ;;
  checks)    cmd_checks ;;
  drift)     shift; cmd_drift "$@" ;;
  refresh)   cmd_refresh ;;
  ""|-h|--help|help) usage ;;
  *) echo "unknown command: $1"; usage; exit 2 ;;
esac
