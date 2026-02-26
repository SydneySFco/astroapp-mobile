#!/usr/bin/env python3
"""RLOOP-037 reliability gate (macro ECE warn/fail bands)."""

from __future__ import annotations
import argparse
import json
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="reliability eval json")
    ap.add_argument("--warn-threshold", type=float, default=0.08)
    ap.add_argument("--fail-threshold", type=float, default=0.12)
    ap.add_argument("--out-json", default="reports/reliability-gate-rloop037.json")
    ap.add_argument("--out-md", default="reports/reliability-gate-rloop037.md")
    args = ap.parse_args()

    report = json.loads(Path(args.input).read_text(encoding="utf-8"))
    macro = float(report.get("macro_ece", 0.0))

    status = "pass"
    if macro >= args.fail_threshold:
        status = "fail"
    elif macro >= args.warn_threshold:
        status = "warn"

    detail = {
        "version": "rloop-037-v1",
        "source": args.input,
        "macro_ece": round(macro, 6),
        "warn_threshold": args.warn_threshold,
        "fail_threshold": args.fail_threshold,
        "status": status,
        "classwise_ece": {k: (v or {}).get("ece") for k, v in (report.get("classwise") or {}).items()},
    }

    out_json = Path(args.out_json)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(detail, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# Reliability Gate (RLOOP-037)",
        f"- Status: **{status.upper()}**",
        f"- macro_ece: `{detail['macro_ece']}`",
        f"- warn/fail thresholds: `{args.warn_threshold}` / `{args.fail_threshold}`",
        "",
        "## Class-wise ECE",
    ]
    for cls, ece in sorted(detail["classwise_ece"].items()):
        lines.append(f"- {cls}: `{ece}`")
    Path(args.out_md).write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(json.dumps(detail))
    return 1 if status == "fail" else 0


if __name__ == "__main__":
    raise SystemExit(main())
