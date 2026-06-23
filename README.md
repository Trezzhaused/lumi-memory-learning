# Lumi Intelligence Center

> **Lumi** is the primary AI assistant and intelligence layer of the **Trezzhaus** platform.  
> Live studio: **https://studio.trezzhaus.com** (TrezzWorld Production Studio)

## What Lumi Does

| Capability | Detail |
|---|---|
| **Chat** | Multi-model conversations via OpenRouter (free-tier cascade) |
| **Memory** | Persistent memory backed by GitHub Gists (free cloud storage) |
| **Code Generation** | Full programs, scripts, games in any language |
| **Image Generation** | Stability AI / Hugging Face FLUX.1-schnell |
| **Video Generation** | FAL.ai (Wan 2.2 / Kling) with Replicate fallback |
| **Audio Generation** | Hugging Face MusicGen |
| **Mission Execution** | Multi-step autonomous task pipelines |
| **Roblox Publishing** | Publish games to Roblox via Open Cloud API |
| **ACAM Security** | Adaptive Content & Access Manager — rate limiting, audit log, auth |

---

## API — Studio-Compatible Endpoints

The API is structurally identical to **TrezzWorld Production Studio** (`AIModelBridge.ts`),
so the Studio's frontend can connect directly to this server.

### Lumi Chat
```
POST /api/lumi/chat
Body: { message, history?, missionId?, useOllama?, ollamaModel?, domain? }
→ { role: "assistant", content, model, ok }

GET  /api/lumi/chat/history?limit=40&mission_id=<id>
→ { history: [{role, content}] }
```

### Models & Prompts
```
GET  /api/lumi/models
→ { cascade: [{id, provider, label, free, contextWindow}] }

POST /api/lumi/enhance-prompt
Body: { prompt, domain? }
→ { domain, detectedDomain, enhancedMessages, systemPromptPreview }
```

### Mission / Pipeline (Studio Control Plane)
```
POST /api/studio/control-plane/boot
Body: { prompt }
→ { missionId, objective, status, summary, plannerModel, executionQueue }

GET  /api/pipeline/:id/status
→ MissionStatus { id, prompt, status, jobs, progress }

GET  /api/pipeline/missions
→ { missions: [MissionStatus] }
```

### Video Creator
```
POST /api/video/create
Body: { concept, durationSeconds?, style?, resolution?, fps? }
→ VideoJob

GET  /api/video/:id/status    → VideoJob
GET  /api/video/:id/download  → 302 redirect to MP4
GET  /api/video/jobs          → { jobs: [VideoJob] }
```

### Generation (direct)
```
POST /api/lumi/generate
Body: { type: "image"|"video"|"audio"|"code", prompt, ...options }
→ GenerationResult
```

### Memory
```
GET    /api/lumi/memory/:sessionId
POST   /api/lumi/memory/search       { query, limit? }
DELETE /api/lumi/memory/:sessionId
GET    /api/lumi/memory/stats
```

### System
```
GET /api/lumi/status        → LumiStatus
GET /api/lumi/audit         → AuditLog entries
GET /api/ollama/status      → Ollama health & local models
GET /api/lumi/conversations → All ConversationSessions
```

---

## Setup

### 1. Clone & install
```bash
git clone https://github.com/Trezzhaused/lumi-memory-learning
cd lumi-memory-learning
pnpm install
```

### 2. Configure environment variables

Copy and fill in `.env`:

```bash
# Required for chat
OPENROUTER_API_KEY=sk-or-...     # https://openrouter.ai

# Optional — local model support
OLLAMA_HOST=http://localhost:11434

# Image generation (one or both)
HUGGINGFACE_API_KEY=hf_...       # https://huggingface.co/settings/tokens
STABILITY_API_KEY=sk-...         # https://platform.stability.ai

# Video generation
FAL_KEY=...                      # https://fal.ai/dashboard/keys  ← primary (mirrors Studio)
REPLICATE_API_KEY=r8_...         # https://replicate.com          ← fallback

# Roblox publishing
ROBLOX_API_KEY=...
ROBLOX_UNIVERSE_ID=...
ROBLOX_PLACE_ID=...

# Memory (GitHub Gists — free)
GITHUB_API_TOKEN=ghp_...

# Render webhook (optional)
RENDER_WEBHOOK_SECRET=...
RENDER_API_KEY=...
```

### 3. Run
```bash
# Development
pnpm run dev

# Production
pnpm run build
pnpm run start
```

---

## Deploying to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Trezzhaused/lumi-memory-learning/tree/main)

All environment variables are declared in `render.yaml`.

---

## Architecture

```
lumi-memory-learning/
├── app.ts                  ← Express server + all API routes
├── lumi.ts                 ← Core intelligence: chat, missions, OpenRouter
├── lumi-conversation.ts    ← ConversationManager (Studio-compatible)
├── lumi-memory.ts          ← Persistent memory (GitHub Gists)
├── lumi-generators.ts      ← Image / video / audio / code generation
├── lumi-studio.ts          ← Studio orchestration + Roblox publishing
├── lumi-acam.ts            ← ACAM security (AuditLog, AuthManager)
├── render.ts               ← Render API types
└── render.yaml             ← Render deployment config
```

The **TrezzWorld Production Studio** (`trezzworld-production-studio`) connects to this
server via its `AIModelBridge.ts`. All API shapes are kept structurally identical.

---

## ACAM — Security

All requests pass through the **Adaptive Content & Access Manager**:

- **Rate limiting** — configurable per-minute per-IP (default: 60 req/min)
- **Origin enforcement** — optional allow-list via `ACAM_ALLOWED_ORIGINS`
- **Content safety** — heuristic filters for unsafe categories
- **Token auth** — optional ****** auth (`ACAM_REQUIRE_AUTH=true`)
- **Audit log** — every security event is logged (query at `GET /api/lumi/audit`)

---

## Memory — Free Cloud Storage

Memory is persisted to a **private GitHub Gist** using `GITHUB_API_TOKEN`.  
This is completely free and survives redeployments.  
Without the token, memory falls back to in-process storage (lost on restart).
