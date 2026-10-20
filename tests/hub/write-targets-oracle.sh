#!/usr/bin/env bash
# The parity oracle for src/classify.js: the shared Bash write-target parser
# (tools/hooks' source/lib/write-targets.sh), called as a function on one command.
# usage: write-targets-oracle.sh <lib path> <cwd> <command>
# Prints one absolute target per line, as the parser does. Exit 3 when the lib is
# missing, so the caller can say UNCHECKED rather than pass.
set -u
lib=$1 cwd=$2 cmd=$3
[ -r "$lib" ] || { echo "no write-target parser at $lib" >&2; exit 3; }
# shellcheck source=/dev/null
. "$lib"
bash_write_targets "$cmd" "$cwd"
