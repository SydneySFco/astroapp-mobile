#!/usr/bin/env python3
"""
RLOOP-035 offline confidence calibration draft.

Reads harness history NDJSON and emits per-class affine params:
  calibrated_score = clamp(raw_score * scale + shift)

Usage:
  python3 scripts/calibrate-contention-confidence-rloop035.py \
    --history reports/concurrency-harness-history.ndjson \
    --out reports/confidence-calibration.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

CLASSES = ("network", "db-lock", "stale-race", "unknown")


def clamp(v: float) -> float:
    return max(0.0, min(1.0, v))


def load_history(path: Path) -> list[dict]:
    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def infer_actual_class(row: dict) -> str | None:
    cc = row.get("contention_classes") or {}
    if not isinstance(cc, dict) or not cc:
        return None
    try:
        return max(CLASSES, key=lambda k: float(cc.get(k, 0)))
    except Exception:
        return None


def extract_scores(row: dict) -> dict[str, float]:
    conf = (row.get("contention_confidence") or row.get("confidence") or {})
    before = conf.get("confidence_before_calibration") or conf.get("contention_class_confidence") or {}
    out: dict[str, float] = {}
    for c in CLASSES:
        val = before.get(c, {}).get("score", 0.0) if isinstance(before, dict) else 0.0
        try:
            out[c] = float(val)
        except Exception:
            out[c] = 0.0
    return out


def calibrate(rows: list[dict]) -> dict:
    per_class = {}
    used = 0

    for cls in CLASSES:
        pos_scores: list[float] = []
        neg_scores: list[float] = []
        for r in rows:
            actual = infer_actual_class(r)
            scores = extract_scores(r)
            if actual is None:
                continue
            used += 1
            s = clamp(scores.get(cls, 0.0))
            if actual == cls:
                pos_scores.append(s)
            else:
                neg_scores.append(s)

        pos_mean = sum(pos_scores) / len(pos_scores) if pos_scores else 0.70
        neg_mean = sum(neg_scores) / len(neg_scores) if neg_scores else 0.30

        margin = max(pos_mean - neg_mean, 0.05)
        scale = clamp(0.9 + margin)
        shift = clamp(0.05 - (neg_mean * 0.15))

        per_class[cls] = {
            "scale": round(scale, 4),
            "shift": round(shift, 4),
            "pos_mean": round(pos_mean, 4),
            "neg_mean": round(neg_mean, 4),
            "samples": {"positive": len(pos_scores), "negative": len(neg_scores)},
        }

    return {
        "version": "rloop035-v1",
        "history_runs_used": len(rows),
        "note": "Heuristic offline calibration. Refit when labelled incident truth grows.",
        "per_class": per_class,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--history", default="reports/concurrency-harness-history.ndjson")
    ap.add_argument("--out", default="reports/confidence-calibration.json")
    args = ap.parse_args()

    history = Path(args.history)
    if not history.exists():
        print(json.dumps({"error": "history_not_found", "path": str(history)}))
        return 1

    rows = load_history(history)
    result = calibrate(rows)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "out": str(out), "history_runs_used": len(rows)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
