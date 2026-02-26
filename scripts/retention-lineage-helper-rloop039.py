#!/usr/bin/env python3
"""RLOOP-039 retention cleanup + lineage validation helper (skeleton)."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import shutil
from pathlib import Path


def parse_day(name: str) -> dt.datetime:
    return dt.datetime.strptime(name, "%Y-%m-%d").replace(tzinfo=dt.timezone.utc)


def cleanup(root: Path, keep_days: int, dry_run: bool) -> int:
    now = dt.datetime.now(dt.timezone.utc)
    removed = 0
    for cadence_dir in root.iterdir() if root.exists() else []:
        if not cadence_dir.is_dir():
            continue
        for day_dir in cadence_dir.iterdir():
            if not day_dir.is_dir():
                continue
            try:
                day = parse_day(day_dir.name)
            except ValueError:
                continue
            age = (now - day).days
            if age > keep_days:
                print(f"cleanup candidate: {day_dir} age_days={age}")
                removed += 1
                if not dry_run:
                    shutil.rmtree(day_dir)
    return removed


def validate_lineage(root: Path) -> int:
    checked = 0
    invalid = 0
    for artifact in root.rglob("groundtruth-snapshot.json"):
        checked += 1
        data = json.loads(artifact.read_text(encoding="utf-8"))
        md = data.get("metadata") or {}
        required = ["run_id", "source_watermark", "checksum", "generated_at"]
        missing = [k for k in required if k not in md]
        if missing:
            invalid += 1
            print(f"invalid lineage: {artifact} missing={','.join(missing)}")
    print(f"lineage validation checked={checked} invalid={invalid}")
    return 1 if invalid else 0


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("cleanup")
    c.add_argument("--artifact-root", default="reports/groundtruth-artifacts")
    c.add_argument("--keep-days", type=int, default=90)
    c.add_argument("--dry-run", action="store_true")

    v = sub.add_parser("validate-lineage")
    v.add_argument("--artifact-root", default="reports/groundtruth-artifacts")

    args = ap.parse_args()

    if args.cmd == "cleanup":
        removed = cleanup(Path(args.artifact_root), args.keep_days, args.dry_run)
        print(f"cleanup done removed={removed} dry_run={args.dry_run}")
        return 0

    if args.cmd == "validate-lineage":
        return validate_lineage(Path(args.artifact_root))

    return 2


if __name__ == "__main__":
    raise SystemExit(main())
