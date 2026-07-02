from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class ToolCall(BaseModel):
    tool: str
    args: dict


@router.post("/call")
async def call_tool(call: ToolCall):
    if call.tool == "read_file":
        return {"result": "File contents here"}
    if call.tool == "run_code":
        return {"result": "Code executed safely"}
    if call.tool == "web_search":
        return {"result": "Search results"}
    return {"error": "Unknown tool"}
