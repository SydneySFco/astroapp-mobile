#!/usr/bin/env python3
"""RLOOP-039 schema + lineage validation for ground-truth artifact."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict

REQ_TOP = ["contract_version", "pipeline", "summary", "guards", "metadata"]
REQ_PIPE = [
    "source_connector",
    "source_uri",
    "watermark_field",
    "cursor_previous",
    "cursor_current",
    "transform",
    "artifact",
    "cadence",
    "snapshot_ts",
]
REQ_SUMMARY = ["incidents", "classes", "class_counts"]
REQ_GUARDS = ["global_min_samples", "class_overrides", "class_evaluation", "guard_failed"]
REQ_MD = ["run_id", "source_watermark", "checksum", "generated_at", "lineage", "retention"]


def as_dict(name: str, value: object) -> Dict[str, object]:
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be object")
    return value


def req(name: str, payload: Dict[str, object], fields: list[str]) -> None:
    for f in fields:
        if f not in payload:
            raise ValueError(f"missing field {name}.{f}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    args = ap.parse_args()

    data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    top = as_dict("artifact", data)
    req("artifact", top, REQ_TOP)

    pipeline = as_dict("pipeline", top.get("pipeline"))
    summary = as_dict("summary", top.get("summary"))
    guards = as_dict("guards", top.get("guards"))
    metadata = as_dict("metadata", top.get("metadata"))

    req("pipeline", pipeline, REQ_PIPE)
    req("summary", summary, REQ_SUMMARY)
    req("guards", guards, REQ_GUARDS)
    req("metadata", metadata, REQ_MD)

    classes = summary.get("classes")
    counts = summary.get("class_counts")
    evals = guards.get("class_evaluation")
    if not isinstance(classes, list) or not isinstance(counts, dict) or not isinstance(evals, dict):
        raise ValueError("summary/guards class collections must be list/object/object")

    for cls in classes:
        if cls not in counts:
            raise ValueError(f"class_counts missing class={cls}")
        if cls not in evals:
            raise ValueError(f"class_evaluation missing class={cls}")

    print(f"schema+lineage valid: {args.input}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
