#!/usr/bin/env python3
"""Turn a failed `mvn test` log into GitHub annotations.

CI log blobs cannot be downloaded from the API, so a failing "Run Maven tests" step used to show
only "exit code 1". This reads the saved log and emits ::error annotations for compiler errors
(with file and line) and for failed tests, which show up on the run page and through the API.

Usage: annotate_maven_failures.py backend-test.log
"""
import re
import sys

MAX_INDIVIDUAL = 10  # GitHub shows at most 10 error annotations per step


def escape(text: str) -> str:
    return text.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def relative(path: str) -> str:
    # /home/runner/work/<repo>/<repo>/src/... -> src/...
    m = re.search(r"/work/[^/]+/[^/]+/(.*)$", path)
    return m.group(1) if m else path


def parse(lines):
    compile_errors, test_failures = [], []
    in_summary = False
    for raw in lines:
        line = re.sub(r"\x1b\[[0-9;]*m", "", raw.rstrip("\n"))
        m = re.match(r"^\[ERROR\] (?P<path>\S+\.java):\[(?P<line>\d+),(?P<col>\d+)\] (?P<msg>.+)$", line)
        if m:
            compile_errors.append((relative(m["path"]), int(m["line"]), int(m["col"]), m["msg"].strip()))
            continue
        if re.match(r"^\[ERROR\] (Failures|Errors|Tests in error|Failed tests):\s*$", line):
            in_summary = True
            continue
        if in_summary:
            m = re.match(r"^\[ERROR\]\s{2,}(?P<text>\S.*)$", line)
            if m:
                test_failures.append(m["text"].strip())
                continue
            if line.startswith("[ERROR]") and not line.strip() == "[ERROR]":
                continue
            in_summary = False
    return compile_errors, test_failures


def main(path: str) -> int:
    with open(path, encoding="utf-8", errors="replace") as handle:
        lines = handle.readlines()
    compile_errors, test_failures = parse(lines)

    emitted = 0
    for file, line, col, msg in compile_errors[:MAX_INDIVIDUAL]:
        print(f"::error file={escape(file)},line={line},col={col},title=Compile error::{escape(msg)}")
        emitted += 1
    if len(compile_errors) > MAX_INDIVIDUAL:
        print(f"::error title=More compile errors::{len(compile_errors) - MAX_INDIVIDUAL} further compile errors not shown")

    room = max(0, MAX_INDIVIDUAL - emitted)
    for text in test_failures[:room]:
        print(f"::error title=Test failure::{escape(text[:600])}")
        emitted += 1
    if len(test_failures) > room:
        rest = "\n".join(t[:200] for t in test_failures[room:room + 40])
        print(f"::error title=More test failures ({len(test_failures) - room})::{escape(rest)}")

    if emitted == 0 and not compile_errors and not test_failures:
        tail = [re.sub(r"\x1b\[[0-9;]*m", "", l.rstrip()) for l in lines if "[ERROR]" in l][-15:]
        if tail:
            print(f"::error title=Maven failed::{escape(chr(10).join(tail))}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "backend-test.log"))
