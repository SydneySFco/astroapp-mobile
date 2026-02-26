#!/usr/bin/env python3
"""RLOOP-039 productionization draft for ground-truth artifact pipeline.

Adds:
- Source connector abstraction (jsonl / db-view draft / object-store draft)
- Watermark cursor handling
- Artifact lineage + retention metadata
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import sqlite3
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Protocol, Tuple


@dataclass
class ReadResult:
    rows: List[dict]
    source_watermark: str


class SourceConnector(Protocol):
    def read_since(self, cursor: Optional[str], *, watermark_field: str) -> ReadResult: ...


def parse_iso(value: str) -> dt.datetime:
    raw = value[:-1] + "+00:00" if value.endswith("Z") else value
    parsed = dt.datetime.fromisoformat(raw)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def normalize_ts(value: str) -> str:
    return parse_iso(value).isoformat().replace("+00:00", "Z")


class JsonlConnector:
    def __init__(self, source: str) -> None:
        self.path = Path(source)

    def read_since(self, cursor: Optional[str], *, watermark_field: str) -> ReadResult:
        rows: List[dict] = []
        max_wm = cursor or ""
        with self.path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                row = json.loads(line)
                wm = str(row.get(watermark_field) or "")
                if cursor and wm and wm <= cursor:
                    continue
                rows.append(row)
                if wm > max_wm:
                    max_wm = wm
        return ReadResult(rows=rows, source_watermark=max_wm)


class DbViewConnector:
    """Draft DB/view connector.

    Production expectation: SQL should return JSON records and include watermark_field.
    For local dev we support sqlite URIs: sqlite:///absolute/path.db
    """

    def __init__(self, uri: str, query: str) -> None:
        self.uri = uri
        self.query = query

    def read_since(self, cursor: Optional[str], *, watermark_field: str) -> ReadResult:
        if not self.uri.startswith("sqlite:///"):
            raise RuntimeError(
                "db-view connector draft supports sqlite:///... for local use; "
                "production adapters (postgres/bigquery) should be implemented in infra layer"
            )

        db_path = self.uri[len("sqlite:///") :]
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        try:
            q = self.query
            params: Tuple[object, ...] = ()
            if cursor:
                q = f"{self.query} WHERE {watermark_field} > ? ORDER BY {watermark_field} ASC"
                params = (cursor,)
            cur = conn.execute(q, params)
            rows = [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

        max_wm = cursor or ""
        for row in rows:
            wm = str(row.get(watermark_field) or "")
            if wm > max_wm:
                max_wm = wm
        return ReadResult(rows=rows, source_watermark=max_wm)


class ObjectStoreConnector:
    """Draft object-store connector for file:// prefixed local bucket mirror.

    Reads *.jsonl files under source path and applies watermark filtering.
    """

    def __init__(self, source: str) -> None:
        if not source.startswith("file://"):
            raise RuntimeError("object-store connector draft currently supports file:// paths")
        self.root = Path(source[len("file://") :])

    def read_since(self, cursor: Optional[str], *, watermark_field: str) -> ReadResult:
        rows: List[dict] = []
        max_wm = cursor or ""
        for p in sorted(self.root.rglob("*.jsonl")):
            with p.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    row = json.loads(line)
                    wm = str(row.get(watermark_field) or "")
                    if cursor and wm and wm <= cursor:
                        continue
                    rows.append(row)
                    if wm > max_wm:
                        max_wm = wm
        return ReadResult(rows=rows, source_watermark=max_wm)


def load_cursor(path: Path) -> Optional[str]:
    if not path.exists():
        return None
    payload = json.loads(path.read_text(encoding="utf-8"))
    cursor = payload.get("cursor")
    return str(cursor) if cursor else None


def save_cursor(path: Path, cursor: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "cursor": cursor,
        "updated_at": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_class_mins(raw: str) -> Dict[str, int]:
    out: Dict[str, int] = {}
    if not raw.strip():
        return out
    for chunk in raw.split(","):
        if not chunk.strip():
            continue
        cls, n = chunk.split(":", 1)
        out[cls.strip()] = max(0, int(n.strip()))
    return out


def sha256_json(payload: dict) -> str:
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def resolve_connector(source_type: str, source_uri: str, query: str) -> SourceConnector:
    if source_type == "jsonl":
        return JsonlConnector(source_uri)
    if source_type == "db-view":
        return DbViewConnector(source_uri, query)
    if source_type == "object-store":
        return ObjectStoreConnector(source_uri)
    raise ValueError(f"unsupported source_type={source_type}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-type", choices=["jsonl", "db-view", "object-store"], default="jsonl")
    ap.add_argument("--source-uri", required=True)
    ap.add_argument("--db-query", default="SELECT * FROM incidents_groundtruth")
    ap.add_argument("--watermark-field", default="timestamp")
    ap.add_argument("--watermark-state", default="reports/groundtruth-watermarks/default.json")
    ap.add_argument("--cadence", choices=["nightly", "weekly"], default="nightly")
    ap.add_argument("--snapshot-date", default="today")
    ap.add_argument("--artifact-root", default="reports/groundtruth-artifacts")
    ap.add_argument("--out", default="")
    ap.add_argument("--global-min-samples", type=int, default=25)
    ap.add_argument("--min-class-samples", default="")
    ap.add_argument("--retention-days-nightly", type=int, default=30)
    ap.add_argument("--retention-days-weekly", type=int, default=90)
    ap.add_argument("--fail-on-guard", action="store_true")
    args = ap.parse_args()

    now = dt.datetime.now(dt.timezone.utc)
    run_id = f"gt-run-{uuid.uuid4()}"

    snapshot_dt = now.replace(hour=0, minute=0, second=0, microsecond=0) if args.snapshot_date == "today" else parse_iso(args.snapshot_date)
    snapshot_ts = snapshot_dt.isoformat().replace("+00:00", "Z")

    connector = resolve_connector(args.source_type, args.source_uri, args.db_query)
    cursor_path = Path(args.watermark_state)
    previous_cursor = load_cursor(cursor_path)
    result = connector.read_since(previous_cursor, watermark_field=args.watermark_field)

    counts: Dict[str, int] = {}
    for row in result.rows:
        cls = str(row.get("actual_class") or "unknown")
        counts[cls] = counts.get(cls, 0) + 1

    classes = sorted(counts.keys())
    class_mins = parse_class_mins(args.min_class_samples)
    guard_eval: Dict[str, dict] = {}
    guard_failed = False
    for cls in classes:
        observed = counts.get(cls, 0)
        min_required = class_mins.get(cls, args.global_min_samples)
        passed = observed >= min_required
        guard_eval[cls] = {"observed": observed, "min_required": min_required, "passed": passed}
        guard_failed = guard_failed or (not passed)

    base_payload = {
        "contract_version": "groundtruth-artifact-rloop-039-v1",
        "pipeline": {
            "source_connector": args.source_type,
            "source_uri": args.source_uri,
            "watermark_field": args.watermark_field,
            "cursor_previous": previous_cursor,
            "cursor_current": result.source_watermark,
            "transform": "class-count-aggregation",
            "artifact": "groundtruth-snapshot",
            "cadence": args.cadence,
            "snapshot_ts": snapshot_ts,
        },
        "summary": {
            "incidents": len(result.rows),
            "classes": classes,
            "class_counts": counts,
        },
        "guards": {
            "global_min_samples": max(0, args.global_min_samples),
            "class_overrides": class_mins,
            "class_evaluation": guard_eval,
            "guard_failed": guard_failed,
        },
    }
    checksum = sha256_json(base_payload)

    artifact = {
        **base_payload,
        "metadata": {
            "run_id": run_id,
            "source_watermark": result.source_watermark,
            "checksum": checksum,
            "generated_at": now.isoformat().replace("+00:00", "Z"),
            "lineage": {
                "upstream": args.source_uri,
                "stage": "groundtruth-artifact",
                "version": "rloop-039",
            },
            "retention": {
                "policy_days": args.retention_days_weekly if args.cadence == "weekly" else args.retention_days_nightly,
                "cleanup_strategy": "time-based-delete-with-lineage-validation",
            },
        },
    }

    if args.out:
        out_path = Path(args.out)
    else:
        stamp = snapshot_dt.strftime("%Y-%m-%d")
        out_path = Path(args.artifact_root) / args.cadence / stamp / "groundtruth-snapshot.json"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if result.source_watermark:
        save_cursor(cursor_path, result.source_watermark)

    print(f"wrote {out_path}")
    print(f"run_id={run_id} source_watermark={result.source_watermark or 'n/a'}")

    if args.fail_on_guard and guard_failed:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
