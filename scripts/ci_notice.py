#!/usr/bin/env python3
"""Print stdin as one GitHub ::notice annotation (job logs cannot be downloaded, annotations can)."""
import sys

title = sys.argv[1] if len(sys.argv) > 1 else "output"
text = sys.stdin.read().strip()
escaped = text.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
print(f"::notice title={title}::{escaped}")
