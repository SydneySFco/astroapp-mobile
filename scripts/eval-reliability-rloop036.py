#!/usr/bin/env python3
"""RLOOP-036 class-wise reliability + ECE utility."""

from __future__ import annotations
import argparse
import datetime as dt
import json
from pathlib import Path
from typing import Dict, List, Optional


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


def parse_ts(value: object) -> Optional[dt.datetime]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        try:
            return dt.datetime.fromtimestamp(float(value), tz=dt.timezone.utc)
        except Exception:
            return None
    s = str(value).strip()
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return dt.datetime.fromisoformat(s).astimezone(dt.timezone.utc)
    except Exception:
        return None


def slice_label(row: dict, time_field: str, slice_by: str) -> Optional[str]:
    ts = parse_ts(row.get(time_field))
    if ts is None:
        return None
    if slice_by == "day":
        return ts.strftime("%Y-%m-%d")
    if slice_by == "week":
        iso = ts.isocalendar()
        return f"{iso.year}-W{iso.week:02d}"
    return ts.strftime("%Y-%m")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="labelled incidents JSONL")
    ap.add_argument("--bins", type=int, default=10)
    ap.add_argument("--out", default="reports/reliability-eval-rloop036.json")
    ap.add_argument("--time-field", default="timestamp", help="row field used for timesliced trend")
    ap.add_argument("--slice-by", choices=["day", "week", "month"], default="day")
    args = ap.parse_args()

    rows = load_rows(Path(args.input))
    classes = sorted({str(r.get("actual_class")) for r in rows} | {k for r in rows for k in (r.get("scores") or {}).keys()})

    out = {
        "version": "rloop-037-v1",
        "input": args.input,
        "incidents": len(rows),
        "bins": args.bins,
        "classwise": {},
        "timeslice": {"field": args.time_field, "slice_by": args.slice_by},
        "classwise_ece_trend": {},
    }

    macro = 0.0
    for cls in classes:
        v = reliability_for_class(rows, cls, args.bins)
        out["classwise"][cls] = v
        macro += v["ece"]

    out["macro_ece"] = round(macro / max(1, len(classes)), 6)

    buckets: Dict[str, List[dict]] = {}
    for r in rows:
        label = slice_label(r, args.time_field, args.slice_by)
        if label is None:
            continue
        buckets.setdefault(label, []).append(r)

    for cls in classes:
        trend = []
        for label in sorted(buckets.keys()):
            slice_rows = buckets[label]
            ece = reliability_for_class(slice_rows, cls, args.bins)["ece"]
            trend.append({"slice": label, "ece": ece, "count": len(slice_rows)})
        out["classwise_ece_trend"][cls] = trend

    p = Path(args.out)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
