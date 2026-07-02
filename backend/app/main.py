from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.chat import router as chat_router
from app.mcp.server import router as mcp_router

app = FastAPI(title="LUMI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api")
app.include_router(mcp_router, prefix="/mcp")


@app.get("/health")
async def health():
    return {"status": "LUMI backend online"}
