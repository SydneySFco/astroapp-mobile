#!/usr/bin/env python3
"""
RLOOP-033 lock telemetry parser skeleton.

Input (NDJSON), one sample per line, e.g.:
{"timestamp_unix":1700000000,"waiting_count":2,"blocked_queries":1,"lock_waiters":1,"sample_source":"pg_locks+pg_stat_activity"}

Usage:
  python3 scripts/lock-telemetry-parser-rloop033.py reports/lock-telemetry.ndjson
"""

import json
import sys
from pathlib import Path


def parse(path: Path):
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage", "message": "path required"}))
        return 2

    path = Path(sys.argv[1])
    if not path.exists():
        print(json.dumps({"error": "not_found", "path": str(path)}))
        return 1

    rows = parse(path)
    windows = []
    for r in rows:
        wait = int(r.get("waiting_count", 0))
        blocked = int(r.get("blocked_queries", 0))
        lock_wait = int(r.get("lock_waiters", 0))
        if wait > 0 or blocked > 0 or lock_wait > 0:
            ts = int(r.get("timestamp_unix", 0))
            windows.append(
                {
                    "start_unix": ts,
                    "end_unix": ts + 5,
                    "waiting_count": wait,
                    "blocked_queries": blocked,
                    "lock_waiters": lock_wait,
                    "sample_source": r.get("sample_source", "pg_locks+pg_stat_activity"),
                }
            )

    print(
        json.dumps(
            {
                "telemetry_samples": len(rows),
                "contention_windows": windows,
                "note": "skeleton output for harness contention_correlation integration",
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
