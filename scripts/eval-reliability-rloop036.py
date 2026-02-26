#!/usr/bin/env python3
"""RLOOP-036 class-wise reliability + ECE utility."""

from __future__ import annotations
import argparse
import json
from pathlib import Path
from typing import Dict, List


def load_rows(path: Path) -> List[dict]:
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def reliability_for_class(rows: List[dict], cls: str, bins: int) -> Dict[str, object]:
    groups = [{"n": 0, "conf_sum": 0.0, "acc_sum": 0.0} for _ in range(bins)]
    for r in rows:
        score = float((r.get("scores") or {}).get(cls, 0.0))
        y = 1.0 if str(r.get("actual_class")) == cls else 0.0
        i = min(bins - 1, int(score * bins))
        g = groups[i]
        g["n"] += 1
        g["conf_sum"] += score
        g["acc_sum"] += y

    curve = []
    total = max(1, len(rows))
    ece = 0.0
    for i, g in enumerate(groups):
        if g["n"] == 0:
            curve.append({"bin": i, "count": 0, "avg_conf": None, "emp_acc": None})
            continue
        avg_conf = g["conf_sum"] / g["n"]
        emp_acc = g["acc_sum"] / g["n"]
        ece += (g["n"] / total) * abs(emp_acc - avg_conf)
        curve.append({
            "bin": i,
            "count": g["n"],
            "avg_conf": round(avg_conf, 6),
            "emp_acc": round(emp_acc, 6),
        })

    return {"ece": round(ece, 6), "curve": curve}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="labelled incidents JSONL")
    ap.add_argument("--bins", type=int, default=10)
    ap.add_argument("--out", default="reports/reliability-eval-rloop036.json")
    args = ap.parse_args()

    rows = load_rows(Path(args.input))
    classes = sorted({str(r.get("actual_class")) for r in rows} | {k for r in rows for k in (r.get("scores") or {}).keys()})

    out = {
        "version": "rloop-036-v1",
        "input": args.input,
        "incidents": len(rows),
        "bins": args.bins,
        "classwise": {},
    }

    macro = 0.0
    for cls in classes:
        v = reliability_for_class(rows, cls, args.bins)
        out["classwise"][cls] = v
        macro += v["ece"]

    out["macro_ece"] = round(macro / max(1, len(classes)), 6)

    p = Path(args.out)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
