#!/usr/bin/env python3
"""RLOOP-038 Ground-truth snapshot artifact builder.

Pipeline shape: source (jsonl incidents) -> transform (class/sample summary) -> artifact (versioned json contract).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
from typing import Dict, List, Tuple


Artifact = Dict[str, object]


def load_rows(path: Path) -> List[dict]:
    rows: List[dict] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def parse_min_samples(raw: str) -> Dict[str, int]:
    out: Dict[str, int] = {}
    if not raw.strip():
        return out
    for chunk in raw.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        if ":" not in chunk:
            raise ValueError(f"invalid --min-class-samples entry: {chunk}")
        cls, n = chunk.split(":", 1)
        out[cls.strip()] = max(0, int(n.strip()))
    return out


def resolve_snapshot_ts(snapshot_date: str) -> dt.datetime:
    if snapshot_date == "today":
        now = dt.datetime.now(dt.timezone.utc)
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if snapshot_date.endswith("Z"):
        snapshot_date = snapshot_date[:-1] + "+00:00"
    parsed = dt.datetime.fromisoformat(snapshot_date)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def build_artifact(
    rows: List[dict],
    *,
    source_path: str,
    cadence: str,
    snapshot_ts: dt.datetime,
    global_min_samples: int,
    class_mins: Dict[str, int],
) -> Tuple[Artifact, bool]:
    counts: Dict[str, int] = {}
    for row in rows:
        cls = str(row.get("actual_class") or "unknown")
        counts[cls] = counts.get(cls, 0) + 1

    classes = sorted(counts.keys())
    guard_failed = False
    guard_eval: Dict[str, dict] = {}

    for cls in classes:
        observed = counts[cls]
        min_required = class_mins.get(cls, global_min_samples)
        passed = observed >= min_required
        guard_failed = guard_failed or (not passed)
        guard_eval[cls] = {
            "observed": observed,
            "min_required": min_required,
            "passed": passed,
        }

    artifact: Artifact = {
        "contract_version": "groundtruth-artifact-rloop-038-v1",
        "pipeline": {
            "source": source_path,
            "transform": "class-count-aggregation",
            "artifact": "groundtruth-snapshot",
            "cadence": cadence,
            "snapshot_ts": snapshot_ts.isoformat().replace("+00:00", "Z"),
        },
        "summary": {
            "incidents": len(rows),
            "classes": classes,
            "class_counts": counts,
        },
        "guards": {
            "global_min_samples": global_min_samples,
            "class_overrides": class_mins,
            "class_evaluation": guard_eval,
            "guard_failed": guard_failed,
        },
    }
    return artifact, guard_failed


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="ground-truth incidents jsonl")
    ap.add_argument("--artifact-root", default="reports/groundtruth-artifacts")
    ap.add_argument("--cadence", choices=["nightly", "weekly"], default="nightly")
    ap.add_argument("--snapshot-date", default="today", help="ISO date/time or 'today'")
    ap.add_argument("--global-min-samples", type=int, default=25)
    ap.add_argument(
        "--min-class-samples",
        default="",
        help="csv format class:min (example: db-lock:30,network:15)",
    )
    ap.add_argument("--out", default="", help="optional explicit output path")
    ap.add_argument("--fail-on-guard", action="store_true")
    args = ap.parse_args()

    src = Path(args.input)
    rows = load_rows(src)
    class_mins = parse_min_samples(args.min_class_samples)
    snapshot_ts = resolve_snapshot_ts(args.snapshot_date)

    artifact, guard_failed = build_artifact(
        rows,
        source_path=str(src),
        cadence=args.cadence,
        snapshot_ts=snapshot_ts,
        global_min_samples=max(0, args.global_min_samples),
        class_mins=class_mins,
    )

    if args.out:
        out_path = Path(args.out)
    else:
        stamp = snapshot_ts.strftime("%Y-%m-%d")
        out_path = Path(args.artifact_root) / args.cadence / stamp / "groundtruth-snapshot.json"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out_path}")

    if args.fail_on_guard and guard_failed:
        print("guard check failed: one or more classes below minimum sample size")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
