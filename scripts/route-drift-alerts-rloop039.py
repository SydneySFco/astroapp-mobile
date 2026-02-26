#!/usr/bin/env python3
"""RLOOP-039 alert routing hardening.

- Standard alert payload for webhook/slack
- Dedup/suppression window
- Severity + class based route table
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
from typing import Dict, List

SEVERITY_ORDER = {"ok": 0, "warn": 1, "critical": 2}

DEFAULT_ROUTES = {
    "default": {"warn": "slack://reliability-warn", "critical": "slack://reliability-critical"},
    "db-lock": {"warn": "slack://db-oncall", "critical": "pagerduty://db-critical"},
    "network": {"warn": "slack://network-warn", "critical": "pagerduty://network-critical"},
}


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def moving_average(values: List[float], window: int) -> float:
    if not values:
        return 0.0
    span = values[-window:] if window > 0 else values
    return sum(span) / max(1, len(span))


def classify(latest: float, baseline: float, *, warn_delta: float, critical_delta: float, warn_abs: float, critical_abs: float) -> Dict[str, object]:
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


def route_for(route_table: dict, cls: str, severity: str) -> str:
    if severity == "ok":
        return "none"
    scoped = route_table.get(cls) or route_table.get("default") or {}
    return str(scoped.get(severity) or "none")


def dedup_key(cls: str, severity: str, route: str) -> str:
    digest = hashlib.sha1(f"{cls}|{severity}|{route}".encode("utf-8")).hexdigest()
    return digest[:20]


def load_state(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_state(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_route_table(path: str) -> dict:
    if not path:
        return DEFAULT_ROUTES
    return json.loads(Path(path).read_text(encoding="utf-8"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--window", type=int, default=7)
    ap.add_argument("--warn-delta", type=float, default=0.015)
    ap.add_argument("--critical-delta", type=float, default=0.03)
    ap.add_argument("--warn-abs", type=float, default=0.08)
    ap.add_argument("--critical-abs", type=float, default=0.12)
    ap.add_argument("--route-table", default="")
    ap.add_argument("--suppression-window-minutes", type=int, default=60)
    ap.add_argument("--state-file", default="reports/drift-alert-state-rloop039.json")
    ap.add_argument("--out-json", default="reports/drift-alert-routing-rloop039.json")
    ap.add_argument("--out-slack", default="reports/drift-alert-routing-rloop039.slack.json")
    ap.add_argument("--out-webhook", default="reports/drift-alert-routing-rloop039.webhook.json")
    ap.add_argument("--fail-on-critical", action="store_true")
    args = ap.parse_args()

    report = json.loads(Path(args.input).read_text(encoding="utf-8"))
    trend = report.get("classwise_ece_trend") or {}
    route_table = parse_route_table(args.route_table)

    class_alerts: Dict[str, dict] = {}
    emitted: List[dict] = []
    global_severity = "ok"

    state_path = Path(args.state_file)
    state = load_state(state_path)
    last_sent = state.get("last_sent") or {}

    now = dt.datetime.now(dt.timezone.utc)
    suppress_sec = max(0, args.suppression_window_minutes) * 60

    for cls in sorted(trend.keys()):
        points = trend.get(cls) or []
        series = [float(p.get("ece", 0.0)) for p in points]
        if not series:
            class_alerts[cls] = {"severity": "ok", "suppressed": False, "reasons": ["no trend data"]}
            continue

        alert = classify(
            series[-1],
            moving_average(series[:-1], args.window),
            warn_delta=args.warn_delta,
            critical_delta=args.critical_delta,
            warn_abs=args.warn_abs,
            critical_abs=args.critical_abs,
        )

        severity = str(alert["severity"])
        route = route_for(route_table, cls, severity)
        key = dedup_key(cls, severity, route)

        suppressed = False
        if severity != "ok" and route != "none":
            prev = last_sent.get(key)
            if prev:
                prev_dt = dt.datetime.fromisoformat(prev.replace("Z", "+00:00"))
                suppressed = (now - prev_dt).total_seconds() < suppress_sec

            payload = {
                "version": "alert-routing-rloop-039-v1",
                "event_id": f"evt-{key}-{int(now.timestamp())}",
                "dedup_key": key,
                "occurred_at": now_iso(),
                "severity": severity,
                "alert_class": cls,
                "route": route,
                "summary": f"Reliability drift {severity} for class={cls}",
                "details": {
                    "latest_ece": alert.get("latest_ece"),
                    "moving_avg_ece": alert.get("moving_avg_ece"),
                    "delta": alert.get("delta"),
                    "reasons": alert.get("reasons") or [],
                    "source": args.input,
                },
                "suppressed": suppressed,
                "suppression_window_minutes": args.suppression_window_minutes,
            }
            emitted.append(payload)
            if not suppressed:
                last_sent[key] = now_iso()

        class_alerts[cls] = {**alert, "route": route, "dedup_key": key, "suppressed": suppressed}

        if SEVERITY_ORDER[severity] > SEVERITY_ORDER[global_severity]:
            global_severity = severity

    out = {
        "version": "rloop-039-v1",
        "source": args.input,
        "global_severity": global_severity,
        "suppression_window_minutes": args.suppression_window_minutes,
        "class_alerts": class_alerts,
        "emitted_alerts": emitted,
    }

    out_json = Path(args.out_json)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    slack_payload = {
        "text": f"[drift-routing] global_severity={global_severity}",
        "attachments": [
            {
                "color": "danger" if a["severity"] == "critical" else "warning",
                "title": a["summary"],
                "text": f"route={a['route']} dedup_key={a['dedup_key']} suppressed={a['suppressed']}",
                "fields": [
                    {"title": "class", "value": a["alert_class"], "short": True},
                    {"title": "severity", "value": a["severity"], "short": True},
                ],
            }
            for a in emitted
            if a["severity"] != "ok"
        ],
    }
    Path(args.out_slack).write_text(json.dumps(slack_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    webhook_payload = {"alerts": emitted, "global_severity": global_severity, "generated_at": now_iso()}
    Path(args.out_webhook).write_text(json.dumps(webhook_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    save_state(state_path, {"last_sent": last_sent, "updated_at": now_iso()})
    print(json.dumps(out))
    return 1 if args.fail_on_critical and global_severity == "critical" else 0


if __name__ == "__main__":
    raise SystemExit(main())
