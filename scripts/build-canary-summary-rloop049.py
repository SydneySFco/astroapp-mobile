#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--fault-jsonl", required=True)
    p.add_argument("--drift-json", required=True)
    p.add_argument("--history-ndjson", required=True)
    p.add_argument("--out-json", required=True)
    p.add_argument("--out-md", required=True)
    p.add_argument("--out-trend-md", required=True)
    p.add_argument("--run-id", required=True)
    p.add_argument("--run-url", default="")
    p.add_argument("--ref", default="")
    return p.parse_args()


def load_fault(path: Path) -> tuple[str, list[str], int]:
    scenarios = []
    issues = []
    if not path.exists():
        return "fail", ["fault harness output missing"], 0

    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            scenarios.append(json.loads(line))
        except json.JSONDecodeError:
            issues.append("invalid JSON line in fault harness output")

    expected = {
        "happy_path": lambda s: s.get("state_after") == "redriven",
        "audit_insert_fail": lambda s: s.get("state_after") == "pending_review" and int(s.get("gate_rows", 1)) == 0,
        "state_transition_fail": lambda s: s.get("state_after") == "pending_review" and int(s.get("gate_rows", 1)) == 0,
    }

    seen = {s.get("scenario"): s for s in scenarios}
    for name, fn in expected.items():
        if name not in seen:
            issues.append(f"missing scenario: {name}")
            continue
        try:
            ok = fn(seen[name])
        except Exception:
            ok = False
        if not ok:
            issues.append(f"scenario expectation failed: {name}")

    status = "pass" if not issues else "fail"
    return status, issues, len(scenarios)


def read_drift(path: Path) -> dict:
    if not path.exists():
        return {"status": "fail", "policy": "fail", "failures": ["drift report missing"]}
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    args = parse_args()
    now = datetime.now(timezone.utc).isoformat()

    fault_status, fault_issues, fault_count = load_fault(Path(args.fault_jsonl))
    drift = read_drift(Path(args.drift_json))

    overall = "pass" if fault_status == "pass" and drift.get("status") in {"pass", "warn"} else "fail"

    row = {
        "generated_at": now,
        "run_id": args.run_id,
        "run_url": args.run_url,
        "ref": args.ref,
        "overall_status": overall,
        "fault_status": fault_status,
        "fault_scenarios": fault_count,
        "fault_issues": fault_issues,
        "drift_status": drift.get("status", "fail"),
        "drift_policy": drift.get("policy", "fail"),
        "drift_failures": drift.get("failures", []),
    }

    hist_path = Path(args.history_ndjson)
    hist_path.parent.mkdir(parents=True, exist_ok=True)
    with hist_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")

    Path(args.out_json).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out_json).write_text(json.dumps(row, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    md = [
        "# Non-prod DB Canary Summary",
        "",
        f"- Overall: **{overall.upper()}**",
        f"- Fault harness: `{fault_status}` ({fault_count} scenario rows)",
        f"- Drift gate: `{drift.get('status', 'fail')}` (policy `{drift.get('policy', 'fail')}`)",
        f"- Run: `{args.run_id}`",
    ]
    if args.run_url:
        md.append(f"- Run URL: {args.run_url}")
    md.append("")
    if fault_issues:
        md += ["## Fault Harness Findings", ""] + [f"- {x}" for x in fault_issues] + [""]
    if drift.get("failures"):
        md += ["## Drift Findings", ""] + [f"- {x}" for x in drift.get("failures", [])] + [""]
    Path(args.out_md).write_text("\n".join(md) + "\n", encoding="utf-8")

    # Trend from local history file
    rows = []
    for line in hist_path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    last = rows[-10:]
    tmd = ["# Canary Trend (last 10 runs)", "", "| run_id | overall | fault | drift |", "|---|---|---|---|"]
    for r in reversed(last):
        tmd.append(f"| {r.get('run_id')} | {r.get('overall_status')} | {r.get('fault_status')} | {r.get('drift_status')} |")
    Path(args.out_trend_md).write_text("\n".join(tmd) + "\n", encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
