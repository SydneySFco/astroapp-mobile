#!/usr/bin/env python3
"""RLOOP-038 optional schema validation for ground-truth artifact."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict


REQUIRED_TOP_LEVEL = ["contract_version", "pipeline", "summary", "guards"]
REQUIRED_PIPELINE = ["source", "transform", "artifact", "cadence", "snapshot_ts"]
REQUIRED_SUMMARY = ["incidents", "classes", "class_counts"]
REQUIRED_GUARDS = ["global_min_samples", "class_overrides", "class_evaluation", "guard_failed"]


def expect_dict(name: str, value: object) -> Dict[str, object]:
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be an object")
    return value


def require_fields(name: str, payload: Dict[str, object], fields: list[str]) -> None:
    for f in fields:
        if f not in payload:
            raise ValueError(f"missing field {name}.{f}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    args = ap.parse_args()

    data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    top = expect_dict("artifact", data)
    require_fields("artifact", top, REQUIRED_TOP_LEVEL)

    pipeline = expect_dict("pipeline", top.get("pipeline"))
    summary = expect_dict("summary", top.get("summary"))
    guards = expect_dict("guards", top.get("guards"))

    require_fields("pipeline", pipeline, REQUIRED_PIPELINE)
    require_fields("summary", summary, REQUIRED_SUMMARY)
    require_fields("guards", guards, REQUIRED_GUARDS)

    classes = summary.get("classes")
    class_counts = summary.get("class_counts")
    class_eval = guards.get("class_evaluation")

    if not isinstance(classes, list):
        raise ValueError("summary.classes must be array")
    if not isinstance(class_counts, dict):
        raise ValueError("summary.class_counts must be object")
    if not isinstance(class_eval, dict):
        raise ValueError("guards.class_evaluation must be object")

    for cls in classes:
        if cls not in class_counts:
            raise ValueError(f"summary.class_counts missing class '{cls}'")
        if cls not in class_eval:
            raise ValueError(f"guards.class_evaluation missing class '{cls}'")

    print(f"schema valid: {args.input}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
