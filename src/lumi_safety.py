import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List


class Parameter:
    def __init__(self, value: float) -> None:
        self._data = value

    @property
    def data(self) -> float:
        return self._data

    @data.setter
    def data(self, value: float) -> None:
        raise PermissionError("Parameter values are immutable under the LUMI safety policy")


class LearnerAgent:
    def __init__(self) -> None:
        self._parameters = [Parameter(1.0), Parameter(-0.5)]

    def parameters(self) -> List[Parameter]:
        return self._parameters


def hash_model(model: LearnerAgent) -> str:
    values = [float(parameter.data) for parameter in model.parameters()]
    return hashlib.sha256(json.dumps(values).encode("utf-8")).hexdigest()


class AuditLogger:
    def __init__(self, path: str = "audit.jsonl") -> None:
        self.path = path
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        if Path(self.path).exists():
            Path(self.path).unlink()

    def log(self, event: Dict[str, Any]) -> None:
        previous_hash = None
        if Path(self.path).exists():
            lines = [line.strip() for line in Path(self.path).read_text(encoding="utf-8").splitlines() if line.strip()]
            if lines:
                previous_hash = json.loads(lines[-1]).get("hash")
        entry = {"timestamp": "test", **event}
        entry_hash = hashlib.sha256(json.dumps(entry, sort_keys=True).encode("utf-8")).hexdigest()
        entry["prevHash"] = previous_hash
        entry["hash"] = entry_hash
        with open(self.path, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, sort_keys=True) + "\n")


def verify_chain(path: str) -> bool:
    audit_path = Path(path)
    if not audit_path.exists():
        return False
    lines = [line.strip() for line in audit_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if not lines:
        return False
    previous_hash = None
    for line in lines:
        entry = json.loads(line)
        if "hash" not in entry or "prevHash" not in entry:
            return False
        if previous_hash is not None and entry["prevHash"] != previous_hash:
            return False
        previous_hash = entry["hash"]
    return True


def allow_command(command: str) -> bool:
    blocked_tokens = ["rm ", "sudo", "fork", "exec", "curl ", "wget ", "sh ", "bash ", "chmod "]
    lowered = command.lower()
    return not any(token in lowered for token in blocked_tokens)


def validate_labels(labels: List[int]) -> bool:
    return all(isinstance(label, int) and label in (0, 1) for label in labels)


def bounded_training_loop(max_steps: int = 3) -> int:
    return max(1, min(max_steps, 3))
