#!/usr/bin/env python3
"""RLOOP-038 drift alert routing based on moving-average + delta gate."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List


SEVERITY_ORDER = {"ok": 0, "warn": 1, "critical": 2}


def moving_average(values: List[float], window: int) -> float:
    if not values:
        return 0.0
    span = values[-window:] if window > 0 else values
    return sum(span) / max(1, len(span))


def classify(
    latest: float,
    baseline: float,
    *,
    warn_delta: float,
    critical_delta: float,
    warn_abs: float,
    critical_abs: float,
) -> Dict[str, object]:
    delta = latest - baseline
    severity = "ok"
    reasons: List[str] = []

    if latest >= critical_abs:
        severity = "critical"
        reasons.append(f"latest_ece({latest:.6f}) >= critical_abs({critical_abs:.6f})")
    elif latest >= warn_abs:
        severity = "warn"
        reasons.append(f"latest_ece({latest:.6f}) >= warn_abs({warn_abs:.6f})")

    if delta >= critical_delta:
        severity = "critical"
        reasons.append(f"delta({delta:.6f}) >= critical_delta({critical_delta:.6f})")
    elif delta >= warn_delta and severity != "critical":
        severity = "warn"
        reasons.append(f"delta({delta:.6f}) >= warn_delta({warn_delta:.6f})")

    return {
        "severity": severity,
        "latest_ece": round(latest, 6),
        "moving_avg_ece": round(baseline, 6),
        "delta": round(delta, 6),
        "reasons": reasons,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="reliability eval json")
    ap.add_argument("--window", type=int, default=7, help="moving average window over previous slices")
    ap.add_argument("--warn-delta", type=float, default=0.015)
    ap.add_argument("--critical-delta", type=float, default=0.03)
    ap.add_argument("--warn-abs", type=float, default=0.08)
    ap.add_argument("--critical-abs", type=float, default=0.12)
    ap.add_argument("--warn-route", default="reliability-warn-channel")
    ap.add_argument("--critical-route", default="reliability-critical-channel")
    ap.add_argument("--out-json", default="reports/drift-alert-routing-rloop038.json")
    ap.add_argument("--out-md", default="reports/drift-alert-routing-rloop038.md")
    ap.add_argument("--fail-on-critical", action="store_true")
    args = ap.parse_args()

    report = json.loads(Path(args.input).read_text(encoding="utf-8"))
    trend = report.get("classwise_ece_trend") or {}

    class_alerts: Dict[str, dict] = {}
    global_severity = "ok"
    routes: List[str] = []

    for cls in sorted(trend.keys()):
        points = trend.get(cls) or []
        series = [float(p.get("ece", 0.0)) for p in points]
        if not series:
            class_alerts[cls] = {
                "severity": "ok",
                "latest_ece": None,
                "moving_avg_ece": None,
                "delta": None,
                "reasons": ["no trend data"],
            }
            continue

        latest = series[-1]
        baseline = moving_average(series[:-1], args.window)
        alert = classify(
            latest,
            baseline,
            warn_delta=args.warn_delta,
            critical_delta=args.critical_delta,
            warn_abs=args.warn_abs,
            critical_abs=args.critical_abs,
        )
        class_alerts[cls] = alert
        if SEVERITY_ORDER[alert["severity"]] > SEVERITY_ORDER[global_severity]:
            global_severity = str(alert["severity"])

    if global_severity == "critical":
        routes.append(args.critical_route)
    elif global_severity == "warn":
        routes.append(args.warn_route)

    out = {
        "version": "rloop-038-v1",
        "source": args.input,
        "window": args.window,
        "thresholds": {
            "warn_delta": args.warn_delta,
            "critical_delta": args.critical_delta,
            "warn_abs": args.warn_abs,
            "critical_abs": args.critical_abs,
        },
        "global_severity": global_severity,
        "routes": routes,
        "class_alerts": class_alerts,
    }

    out_json = Path(args.out_json)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    md_lines = [
        "# Drift Alert Routing (RLOOP-038)",
        f"- Global severity: **{global_severity.upper()}**",
        f"- Routes: `{', '.join(routes) if routes else 'none'}`",
        "",
        "## Class Alerts",
    ]
    for cls, alert in sorted(class_alerts.items()):
        md_lines.append(
            f"- {cls}: severity=`{alert['severity']}` latest=`{alert['latest_ece']}` "
            f"moving_avg=`{alert['moving_avg_ece']}` delta=`{alert['delta']}`"
        )
        for reason in alert.get("reasons") or []:
            md_lines.append(f"  - {reason}")

    Path(args.out_md).write_text("\n".join(md_lines) + "\n", encoding="utf-8")
    print(json.dumps(out))
    return 1 if args.fail_on_critical and global_severity == "critical" else 0


if __name__ == "__main__":
    raise SystemExit(main())
