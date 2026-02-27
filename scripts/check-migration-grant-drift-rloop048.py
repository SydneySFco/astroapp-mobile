#!/usr/bin/env python3
"""RLOOP-048 migration/grant drift guard (draft).

Checks:
1) Latest migration version aligns with optional EXPECTED_MIGRATION_VERSION env.
2) For CREATE OR REPLACE FUNCTION lines, verify at least one GRANT EXECUTE ON FUNCTION appears
   in the migration set (coarse coverage check).

Exit codes:
- 0: pass
- 1: drift detected
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

MIGRATIONS_DIR = Path("docs/supabase/migrations")
FUNCTION_RE = re.compile(r"create\s+or\s+replace\s+function\s+([a-zA-Z0-9_.]+)\s*\(", re.IGNORECASE)
GRANT_RE = re.compile(r"grant\s+execute\s+on\s+function\s+([a-zA-Z0-9_.]+)\s*\(", re.IGNORECASE)


def migration_files() -> list[Path]:
    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    return files


def extract_version(path: Path) -> str:
    return path.name.split("_", 1)[0]


def main() -> int:
    if not MIGRATIONS_DIR.exists():
        print(f"ERROR: missing migrations dir: {MIGRATIONS_DIR}")
        return 1

    files = migration_files()
    if not files:
        print("ERROR: no migration files found")
        return 1

    latest = files[-1]
    latest_version = extract_version(latest)
    expected = os.getenv("EXPECTED_MIGRATION_VERSION")

    functions: set[str] = set()
    granted: set[str] = set()

    for file in files:
        text = file.read_text(encoding="utf-8", errors="ignore")
        functions.update(m.group(1).lower() for m in FUNCTION_RE.finditer(text))
        granted.update(m.group(1).lower() for m in GRANT_RE.finditer(text))

    print(f"latest_migration={latest.name}")

    failures: list[str] = []
    if expected and expected != latest_version:
        failures.append(
            f"migration version drift: expected={expected} actual={latest_version}"
        )

    # coarse guard: any declared function should have explicit execute grant statement in migrations.
    missing_grants = sorted(fn for fn in functions if fn not in granted)
    if missing_grants:
        failures.append(
            "grant coverage drift: missing GRANT EXECUTE for functions: "
            + ", ".join(missing_grants)
        )

    if failures:
        for item in failures:
            print(f"DRIFT: {item}")
        return 1

    print("OK: no migration/grant drift detected")
    return 0


if __name__ == "__main__":
    sys.exit(main())
