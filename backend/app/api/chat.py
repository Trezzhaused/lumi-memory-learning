from fastapi import APIRouter

router = APIRouter()


@router.post("/chat")
async def chat(payload: dict):
    return {
        "role": "assistant",
        "content": payload.get("message", ""),
        "model": "lumi-local",
        "ok": True,
    }
