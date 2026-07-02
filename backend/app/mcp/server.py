import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ToolCall(BaseModel):
    tool: str
    args: dict[str, Any] = {}


ALLOWED_ROOT = Path(os.getenv("MCP_ALLOWED_ROOT", ".")).expanduser().resolve()
MCP_ALLOW_CODE_EXECUTION = os.getenv("MCP_ALLOW_CODE_EXECUTION", "false").lower() in {"1", "true", "yes", "on"}


def _resolve_path(candidate: str | None) -> Path:
    raw = (candidate or ".").strip()
    if not raw or raw == ".":
        return ALLOWED_ROOT

    if raw.startswith(("/", "\\", "~")):
        raise HTTPException(status_code=403, detail="Absolute paths are not allowed")

    normalized_segments = [segment for segment in raw.replace("\\", "/").split("/") if segment and segment != "."]
    if not normalized_segments or any(segment in {"..", ""} for segment in normalized_segments):
        raise HTTPException(status_code=403, detail="Path traversal is not allowed")

    candidate_path = ALLOWED_ROOT.joinpath(*normalized_segments)
    resolved_path = candidate_path.resolve(strict=False)
    allowed_root = str(ALLOWED_ROOT)
    if os.path.commonpath([allowed_root, str(resolved_path)]) != allowed_root:
        raise HTTPException(status_code=403, detail="Path is outside the allowed MCP root")

    return resolved_path


@router.post("/call")
async def call_tool(call: ToolCall):
    tool_name = (call.tool or "").lower()
    args = call.args or {}

    if tool_name == "read_file":
        file_path = _resolve_path(args.get("path"))
        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")
        return {"result": file_path.read_text(encoding="utf-8", errors="replace")}

    if tool_name == "list_dir":
        target_path = _resolve_path(args.get("path", "."))
        if not target_path.exists() or not target_path.is_dir():
            raise HTTPException(status_code=404, detail="Directory not found")
        return {"result": [entry.name for entry in sorted(target_path.iterdir(), key=lambda item: item.name)]}

    if tool_name == "web_search":
        query = args.get("query")
        if not query:
            raise HTTPException(status_code=400, detail="query is required")
        endpoint = os.getenv("EXTERNAL_BROWSER_PROXY_URL") or os.getenv("EXTERNAL_BROWSER_API_URL")
        if endpoint:
            try:
                import urllib.request

                request = urllib.request.Request(
                    endpoint,
                    data=json.dumps({
                        "sourceId": args.get("sourceId", "mcp"),
                        "query": query,
                        "goal": args.get("goal"),
                        "sessionMode": args.get("sessionMode", "anonymous"),
                    }).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(request, timeout=10) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                    content = payload.get("content") or payload.get("text") or payload.get("result")
                    return {"result": content or "No content returned."}
            except Exception:
                return {"result": "Search endpoint failed."}
        return {
            "result": (
                f"Search queued for: {query}. Configure EXTERNAL_BROWSER_PROXY_URL or EXTERNAL_BROWSER_API_URL "
                "to get live retrieval results."
            )
        }

    if tool_name == "run_code":
        if not MCP_ALLOW_CODE_EXECUTION:
            return {
                "result": "Code execution is disabled. Set MCP_ALLOW_CODE_EXECUTION=true to enable it in a sandboxed workflow.",
                "safety": "disabled",
            }
        snippet = args.get("code")
        if not snippet:
            raise HTTPException(status_code=400, detail="code is required")
        try:
            completed = subprocess.run(
                [sys.executable, "-c", snippet],
                cwd=str(ALLOWED_ROOT),
                capture_output=True,
                text=True,
                timeout=20,
                check=False,
            )
            return {
                "result": completed.stdout or completed.stderr or "Code executed without output.",
                "exit_code": completed.returncode,
                "safety": "bounded",
            }
        except subprocess.TimeoutExpired:
            return {"result": "Code execution timed out.", "safety": "bounded"}

    return {"error": "Unknown tool"}
