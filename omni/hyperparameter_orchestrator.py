import itertools
import json
import os
from typing import Dict, List, Optional

try:  # pragma: no cover - optional dependency
    import torch
except Exception:  # pragma: no cover - optional dependency
    torch = None


class AutonomousGridOrchestrator:
    """Builds a small search grid over learning-rate and regularization settings."""

    def __init__(self, configs_base_dir: str = "configs/") -> None:
        self.configs_base_dir = configs_base_dir
        os.makedirs(self.configs_base_dir, exist_ok=True)
        self.parameter_grid = {
            "learning_rate": [1e-5, 5e-5, 1e-4],
            "weight_decay": [0.01, 0.05],
            "gradient_clipping": [0.5, 1.0],
        }

    def generate_search_matrix(self) -> List[str]:
        keys, values = zip(*self.parameter_grid.items())
        combinations = [dict(zip(keys, value_tuple)) for value_tuple in itertools.product(*values)]
        generated_paths: List[str] = []
        for index, config in enumerate(combinations):
            path = os.path.join(self.configs_base_dir, f"grid_config_run_{index}.json")
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(config, handle, indent=2)
            generated_paths.append(path)
        return generated_paths

    @staticmethod
    def adjust_optimizer_on_the_fly(optimizer: Optional[object], telemetry_path: str) -> None:
        if not os.path.exists(telemetry_path):
            return
        with open(telemetry_path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        recent_losses = data.get("metrics", {}).get("loss_total", [])
        if len(recent_losses) <= 5:
            return
        if recent_losses[-1] > recent_losses[-3]:
            if optimizer is None:
                return
            for param_group in getattr(optimizer, "param_groups", []):
                param_group["lr"] *= 0.5
