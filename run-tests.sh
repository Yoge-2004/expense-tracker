#!/usr/bin/env bash
#
# run-tests.sh — Convenience wrapper for running all Expense Tracker test suites.
#
# This is a thin wrapper around scripts/run-all-tests.sh so you can run:
#   ./run-tests.sh          # from the repo root
#   ./run-tests.sh --help   # see all options
#
# For the full-featured script with all options, see:
#   scripts/run-all-tests.sh
#
exec "$(dirname "$0")/scripts/run-all-tests.sh" "$@"
