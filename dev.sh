#!/usr/bin/env bash
# The one pre-commit command for this repo: ./dev.sh check
#
# The repo is a plan and its inputs today; nothing is built, so the gates are
# about those (devtools/hubcheck.py) plus the shared ones from the sibling tools.
# A sibling tool that is not there (a lone clone, a cloud session) is UNCHECKED,
# printed as such, never counted as ok. Each gate's REPORTED result is read, not
# only its exit code. `./dev.sh check --json` prints only the one schema
# (tools/checks' schema/check-json.schema.json), held by tests/test_checkjson.py.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")" || exit 2

SETUP_BIN="${HUB_SETUP_BIN:-../setup/setup}"
CHECKS_BIN="${HUB_CHECKS_BIN:-../checks/checks}"

usage() {
  cat <<'EOF'
./dev.sh <command>

  check      every gate below, in order; non-zero if any fails (--json: the one schema,
             via devtools/checkjson.py: one check per gate, each finding a failure;
             drift is a note, not a check, so it is not there: ./dev.sh drift --json)
  test       the unit tests (tests/): every hubcheck gate shown red on a fixture
  hooktests  the shared hook copies' own tests (.claude/hooks/test-*.sh)
  files      the files this repo needs are present; dev.sh is executable
  inputs     docs/inputs/ copies match SHA256SUMS; README table, SHA256SUMS and disk agree; brief §2 covered
  leaks      no email address, home-folder path or phone number in what would be committed
  plans      setup plans . (every PLAN-*.md not done has a Setup component heading)
  checks     tools/checks: checks run . --json, every failing line (credential-shaped values, hooks, rules, TODO, help)
  drift      each copy against its original at the workspace top (a note in check, never a fail)
  refresh    copy every original over its copy (leak audit first), rewrite SHA256SUMS
EOF
}

# Each gate prints its own lines and returns 0 ok, 1 fail, 3 unchecked.

cmd_test() {
  local out code
  out=$(python3 -m unittest discover -s tests 2>&1); code=$?
  if [ $code -eq 0 ] && printf '%s\n' "$out" | grep -q '^OK'; then
    echo "  ok    test: $(printf '%s\n' "$out" | grep -E '^Ran ' | head -1)"; return 0
  fi
  printf '%s\n' "$out"; echo "  FAIL  test"; return 1
}

cmd_hooktests() {
  local t out code fails=0 n=0
  for t in .claude/hooks/test-*.sh; do
    [ -e "$t" ] || { echo "  FAIL  hooktests: no .claude/hooks/test-*.sh"; return 1; }
    n=$((n+1))
    out=$("$t" 2>&1); code=$?
    if [ $code -ne 0 ] || ! printf '%s\n' "$out" | tail -1 | grep -q 'all cases passed'; then
      # the test's tail under its FAIL line, indented: --json joins it into the message
      echo "  FAIL  $t: exit $code"; printf '%s\n' "$out" | tail -5 | sed 's/^/        /'; fails=$((fails+1))
    fi
  done
  [ $fails -eq 0 ] && echo "  ok    hooktests: $n hook test files, all cases passed"
  [ $fails -eq 0 ]
}

cmd_files()   { python3 devtools/hubcheck.py files; }
cmd_inputs()  { python3 devtools/hubcheck.py inputs; }
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

GATES="test hooktests files inputs leaks plans checks"

# The role each gate's failure belongs to, in --json (PLAN-agent-groups.md §4.1:
# code, tests, audit, docs). A failing test is code's (as in tools/setup and
# tools/hooks); the inputs and the plans' headings are documents; the leak audit
# and tools/checks' findings are audit's.
gate_role() {
  case "$1" in
    inputs|plans) echo docs ;;
    leaks|checks) echo audit ;;
    *) echo code ;;
  esac
}

# --json: stdout is exactly one document in the one schema (devtools/checkjson.py),
# each gate's output captured to a scratch file so its finding lines become the
# failures. Every gate runs in a subshell, in both modes: it cannot touch this
# loop's variables (setup's cmd_hooks once leaked one, emptying later gates' findings).
cmd_check() {
  local json=0 g code ok=() fail=() unchecked=() out drift_note capdir="" dest rows=()
  [ "${1:-}" = "--json" ] && json=1
  [ $json -eq 1 ] && capdir=$(mktemp -d 2>/dev/null)
  for g in $GATES; do
    if [ $json -eq 1 ]; then
      dest=/dev/null; [ -n "$capdir" ] && dest="$capdir/$g"
      ( "cmd_$g" ) >"$dest" 2>&1; code=$?
      rows+=("$g:$(gate_role "$g"):$code:$dest")
    else
      out=$("cmd_$g" 2>&1); code=$?
      printf '%s\n' "$out"
    fi
    case $code in
      0) ok+=("$g") ;;
      3) unchecked+=("$g") ;;
      *) fail+=("$g") ;;
    esac
  done
  if [ $json -eq 1 ]; then
    python3 devtools/checkjson.py "${rows[@]}"; code=$?
    [ -n "$capdir" ] && rm -rf "$capdir"
    return $code
  fi
  out=$(cmd_drift 2>&1); code=$?
  case $code in
    0) drift_note="in step" ;;
    3) drift_note="unchecked" ;;
    *) drift_note="$(printf '%s\n' "$out" | grep -c -E '^  (DIFF|GONE) ') differ" ;;
  esac
  echo "  note  drift: $drift_note (./dev.sh drift; refresh is a decision, not a gate)"
  echo "check: ${#ok[@]} ok, ${#unchecked[@]} unchecked, ${#fail[@]} fail -> $([ ${#fail[@]} -eq 0 ] && echo green || echo "red (${fail[*]})")"
  [ ${#fail[@]} -eq 0 ]
}

case "${1:-}" in
  check)     shift; cmd_check "$@" ;;
  test)      cmd_test ;;
  hooktests) cmd_hooktests ;;
  files)     cmd_files ;;
  inputs)    cmd_inputs ;;
  leaks)     shift; cmd_leaks "$@" ;;
  plans)     cmd_plans ;;
  checks)    cmd_checks ;;
  drift)     shift; cmd_drift "$@" ;;
  refresh)   cmd_refresh ;;
  ""|-h|--help|help) usage ;;
  *) echo "unknown command: $1"; usage; exit 2 ;;
esac
