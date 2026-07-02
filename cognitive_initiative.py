#!/usr/bin/env python3
"""Generate a bounded self-directed autonomy directive from local state."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from compliance_verifier import verify_action_legality

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_STATE_PATH = BASE_DIR / ".data" / "self_directed_state.json"
DEFAULT_OUTPUT_PATH = BASE_DIR / ".data" / "self_directed_autonomy.json"
DEFAULT_REPORT_PATH = BASE_DIR / ".data" / "self_directed_autonomy.md"


def load_state(state_path: Optional[Path] = None) -> Dict[str, Any]:
    path = state_path or DEFAULT_STATE_PATH
    if path.exists():
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
            if isinstance(data, dict):
                return data
    return {
        "active_projects": ["lumi-memory-learning"],
        "focus": "audit the current local maintenance state and write a bounded review note",
        "notes": ["Keep the change local and reviewable."],
    }


def build_directive(state: Dict[str, Any]) -> Dict[str, Any]:
    projects = state.get("active_projects") or state.get("projects") or ["the workspace"]
    focus = str(state.get("focus") or "review the current local maintenance state")
    notes = state.get("notes") or []
    objective = f"Review the current state for {', '.join(projects)} and write a bounded review note for: {focus}"
    legality = verify_action_legality(objective)
    if legality["legal_status"] != "PASSED":
        return {
            "objective": objective,
            "legal_status": legality["legal_status"],
            "legal_reasoning": legality["legal_reasoning"],
            "recommended_legal_alternative": legality["recommended_legal_alternative"],
            "blocked": True,
        }

    report_lines = [
        "# Self-directed autonomy review",
        "",
        f"- Objective: {objective}",
        f"- Focus: {focus}",
        f"- Projects: {', '.join(projects)}",
        "- Safety: This action is limited to a reviewable local artifact and does not modify protected systems.",
        "",
        "## Notes",
    ]
    for note in notes:
        report_lines.append(f"- {note}")
    if not notes:
        report_lines.append("- No additional notes were supplied.")

    output_payload = {
        "objective": objective,
        "legal_status": legality["legal_status"],
        "legal_reasoning": legality["legal_reasoning"],
        "recommended_legal_alternative": legality["recommended_legal_alternative"],
        "blocked": False,
        "report_path": str(DEFAULT_REPORT_PATH),
    }

    DEFAULT_REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    DEFAULT_REPORT_PATH.write_text("\n".join(report_lines) + "\n", encoding="utf-8")
    DEFAULT_OUTPUT_PATH.write_text(json.dumps(output_payload, indent=2) + "\n", encoding="utf-8")
    return output_payload


def main(argv: Optional[list[str]] = None) -> int:
    argv = argv or sys.argv[1:]
    state_path = Path(argv[0]).expanduser() if argv else DEFAULT_STATE_PATH
    state = load_state(state_path)
    result = build_directive(state)
    print(json.dumps(result, indent=2))
    return 0 if not result.get("blocked") else 1


if __name__ == "__main__":
    raise SystemExit(main())
