#!/usr/bin/env python3
"""Evaluate proposed actions against local guardrails and block unsafe tasks."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple

BASE_DIR = Path(__file__).resolve().parent
GUARDRAILS_PATH = BASE_DIR / "legal_guardrails.md"
LOG_DIR = BASE_DIR / ".data"
LOG_PATH = LOG_DIR / "security_intercepts.jsonl"


def _read_guardrails() -> str:
    if GUARDRAILS_PATH.exists():
        return GUARDRAILS_PATH.read_text(encoding="utf-8")
    return """# Local guardrails\n- Do not assist with malware, phishing, or unauthorized access.\n- Prefer original work over copying protected content.\n- Do not assist with physical harm or illegal acts.\n"""


def _looks_dangerous(task: str) -> Tuple[bool, str]:
    lowered = task.lower()
    dangerous_terms = [
        "malware",
        "ransomware",
        "phishing",
        "credential stuffing",
        "unauthorized access",
        "scan my competitor's server",
        "steal",
        "bypass",
        "exploit",
        "harm",
        "illegal",
        "weapon",
        "poison",
    ]
    for term in dangerous_terms:
        if term in lowered:
            return True, f"The task mentions disallowed content: {term}."
    return False, ""


def verify_action_legality(proposed_task: str) -> Dict[str, str]:
    guardrails = _read_guardrails()
    blocked, reason = _looks_dangerous(proposed_task)
    if blocked:
        result = {
            "legal_status": "BLOCKED",
            "legal_reasoning": f"The task violates the local guardrails.\n\nGuardrails:\n{guardrails}\n\nReason: {reason}",
            "recommended_legal_alternative": "Reframe the task as a public-facing analysis or a locally scoped, reviewable plan that avoids unauthorized access, harm, or copying protected assets.",
        }
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        with LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(result) + "\n")
        return result

    if "similar to" in proposed_task.lower() or "like" in proposed_task.lower():
        alternative = "Study the public structure and layout of the reference, then create an original experience that is materially different in implementation and design."
    else:
        alternative = "Continue with a local, reviewable plan that stays within the repository and avoids any protected system changes."

    return {
        "legal_status": "PASSED",
        "legal_reasoning": f"The task is compatible with local guardrails.\n\nGuardrails:\n{guardrails}",
        "recommended_legal_alternative": alternative,
    }


def main(argv: Optional[list[str]] = None) -> int:
    argv = argv or sys.argv[1:]
    task = argv[0] if argv else "Create a local maintenance report for the repository"
    result = verify_action_legality(task)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
