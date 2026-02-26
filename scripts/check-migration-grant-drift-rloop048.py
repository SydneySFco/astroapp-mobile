#!/usr/bin/env python3
"""RLOOP migration/grant drift guard.

Checks:
1) Latest migration version aligns with optional EXPECTED_MIGRATION_VERSION env/arg.
2) For CREATE OR REPLACE FUNCTION lines, verify GRANT EXECUTE ON FUNCTION coverage.

Policies:
- fail: drift => exit 1
- warn: drift => exit 0 (status=warn in outputs)

Outputs:
- stdout log
- optional JSON/Markdown report files
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

MIGRATIONS_DIR = Path("docs/supabase/migrations")
FUNCTION_RE = re.compile(r"create\s+or\s+replace\s+function\s+([a-zA-Z0-9_.]+)\s*\(", re.IGNORECASE)
GRANT_RE = re.compile(r"grant\s+execute\s+on\s+function\s+([a-zA-Z0-9_.]+)\s*\(", re.IGNORECASE)


def migration_files() -> list[Path]:
    return sorted(MIGRATIONS_DIR.glob("*.sql"))


def extract_version(path: Path) -> str:
    return path.name.split("_", 1)[0]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--policy", choices=["warn", "fail"], default=os.getenv("DRIFT_POLICY", "fail"))
    parser.add_argument("--expected-version", default=os.getenv("EXPECTED_MIGRATION_VERSION"))
    parser.add_argument("--out-json", default=os.getenv("DRIFT_OUT_JSON"))
    parser.add_argument("--out-md", default=os.getenv("DRIFT_OUT_MD"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    failures: list[str] = []
    latest_name = None
    latest_version = None
    functions: set[str] = set()
    granted: set[str] = set()

    if not MIGRATIONS_DIR.exists():
        failures.append(f"missing migrations dir: {MIGRATIONS_DIR}")
    else:
        files = migration_files()
        if not files:
            failures.append("no migration files found")
        else:
            latest = files[-1]
            latest_name = latest.name
            latest_version = extract_version(latest)

            for file in files:
                text = file.read_text(encoding="utf-8", errors="ignore")
                functions.update(m.group(1).lower() for m in FUNCTION_RE.finditer(text))
                granted.update(m.group(1).lower() for m in GRANT_RE.finditer(text))

            if args.expected_version and args.expected_version != latest_version:
                failures.append(
                    f"migration version drift: expected={args.expected_version} actual={latest_version}"
                )

            missing_grants = sorted(fn for fn in functions if fn not in granted)
            if missing_grants:
                failures.append(
                    "grant coverage drift: missing GRANT EXECUTE for functions: " + ", ".join(missing_grants)
                )

    has_drift = len(failures) > 0
    status = "pass"
    if has_drift and args.policy == "warn":
        status = "warn"
    elif has_drift:
        status = "fail"

    report = {
        "kind": "migration_grant_drift_gate",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "policy": args.policy,
        "status": status,
        "drift_detected": has_drift,
        "latest_migration": latest_name,
        "latest_migration_version": latest_version,
        "expected_migration_version": args.expected_version,
        "function_count": len(functions),
        "granted_function_count": len(granted),
        "failures": failures,
    }

    print(f"drift_policy={args.policy}")
    if latest_name:
        print(f"latest_migration={latest_name}")

    if has_drift:
        for item in failures:
            print(f"DRIFT: {item}")
    else:
        print("OK: no migration/grant drift detected")

    if args.out_json:
        out_json = Path(args.out_json)
        out_json.parent.mkdir(parents=True, exist_ok=True)
        out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.out_md:
        lines = [
            "# Migration/Grant Drift Gate",
            "",
            f"- Status: **{status.upper()}**",
            f"- Policy: `{args.policy}`",
            f"- Latest migration: `{latest_name or 'n/a'}`",
            f"- Expected migration version: `{args.expected_version or 'n/a'}`",
            f"- Drift detected: `{str(has_drift).lower()}`",
            "",
        ]
        if failures:
            lines.append("## Findings")
            lines.append("")
            for f in failures:
                lines.append(f"- {f}")
        else:
            lines.append("No drift findings.")
        out_md = Path(args.out_md)
        out_md.parent.mkdir(parents=True, exist_ok=True)
        out_md.write_text("\n".join(lines) + "\n", encoding="utf-8")

    return 0 if status in {"pass", "warn"} else 1


if __name__ == "__main__":
    sys.exit(main())
