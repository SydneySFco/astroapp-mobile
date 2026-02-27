#!/usr/bin/env python3
"""
RLOOP-036 ground-truth calibration skeleton.

Input JSONL format (one incident per line):
{
  "incident_id": "inc-001",
  "actual_class": "db-lock",
  "scores": {"network": 0.21, "db-lock": 0.76, "stale-race": 0.18, "unknown": 0.04}
}

Outputs calibration params for per-class one-vs-rest calibration.
Supports:
- logistic (Platt-style, 1D)
- isotonic (PAV bins)
"""

from __future__ import annotations
import argparse
import json
import math
from pathlib import Path
from typing import Dict, List, Tuple


def clamp(v: float) -> float:
    return max(0.0, min(1.0, v))


def sigmoid(z: float) -> float:
    if z >= 0:
        ez = math.exp(-z)
        return 1.0 / (1.0 + ez)
    ez = math.exp(z)
    return ez / (1.0 + ez)


def fit_logistic_1d(xs: List[float], ys: List[int], lr: float = 0.2, steps: int = 600) -> Dict[str, float]:
    a, b = 1.0, 0.0
    n = max(1, len(xs))
    for _ in range(steps):
        ga = 0.0
        gb = 0.0
        for x, y in zip(xs, ys):
            p = sigmoid(a * x + b)
            d = p - y
            ga += d * x
            gb += d
        a -= lr * (ga / n)
        b -= lr * (gb / n)
    return {"a": round(a, 6), "b": round(b, 6)}


def fit_isotonic_pav(xs: List[float], ys: List[int]) -> List[Dict[str, float]]:
    pairs = sorted(zip(xs, ys), key=lambda t: t[0])
    blocks: List[Dict[str, float]] = []
    for x, y in pairs:
        blocks.append({"sum_y": float(y), "n": 1.0, "left": x, "right": x})
        while len(blocks) >= 2:
            a = blocks[-2]["sum_y"] / blocks[-2]["n"]
            b = blocks[-1]["sum_y"] / blocks[-1]["n"]
            if a <= b:
                break
            r = blocks.pop()
            l = blocks.pop()
            blocks.append({
                "sum_y": l["sum_y"] + r["sum_y"],
                "n": l["n"] + r["n"],
                "left": l["left"],
                "right": r["right"],
            })
    return [
        {
            "left": round(b["left"], 6),
            "right": round(b["right"], 6),
            "value": round(clamp(b["sum_y"] / b["n"]), 6),
            "count": int(b["n"]),
        }
        for b in blocks
    ]


def load_rows(path: Path) -> Tuple[List[dict], List[str]]:
    rows: List[dict] = []
    classes = set()
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            if "actual_class" not in row or "scores" not in row:
                continue
            classes.add(str(row["actual_class"]))
            classes.update((row.get("scores") or {}).keys())
            rows.append(row)
    return rows, sorted(classes)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="ground-truth incident JSONL")
    ap.add_argument("--method", choices=["logistic", "isotonic"], default="isotonic")
    ap.add_argument("--out", default="reports/groundtruth-calibration-rloop036.json")
    args = ap.parse_args()

    rows, classes = load_rows(Path(args.input))
    out = {
        "version": "rloop-036-v1",
        "method": args.method,
        "input": args.input,
        "incidents": len(rows),
        "classes": classes,
        "per_class": {},
        "notes": [
            "one-vs-rest calibration using labelled incidents",
            "safe to combine with existing confidence pipeline as post-transform",
        ],
    }

    for cls in classes:
        xs = [float((r.get("scores") or {}).get(cls, 0.0)) for r in rows]
        ys = [1 if str(r.get("actual_class")) == cls else 0 for r in rows]
        if args.method == "logistic":
            out["per_class"][cls] = {
                "type": "logistic",
                "params": fit_logistic_1d(xs, ys),
                "support": len(xs),
            }
        else:
            out["per_class"][cls] = {
                "type": "isotonic",
                "bins": fit_isotonic_pav(xs, ys),
                "support": len(xs),
            }

    p = Path(args.out)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
