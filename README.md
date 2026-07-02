# Lumi Intelligence Center

> **Lumi** is the primary AI assistant and intelligence layer of the **Trezzhaus** platform.  
> Live studio: **https://studio.trezzhaus.com** (TrezzWorld Production Studio)

## What Lumi Does

| Capability | Detail |
|---|---|
| **Chat** | Multi-model conversations via OpenRouter, Ollama, or NVIDIA NIM when configured |
| **Text Generation** | Plain-text content generation and document drafting |
| **Document Generation** | Markdown / document outputs saved as artifacts |
| **Memory** | Persistent memory backed by Cloudflare R2 when configured, with GitHub Gists and in-memory fallback |
| **Code Generation** | Full programs, scripts, games in any language |
| **Image Generation** | Stability AI / Hugging Face FLUX.1-schnell |
| **Video Generation** | NVIDIA NIM video generation when available, with FAL.ai, Hugging Face HunyuanVideo, and Replicate fallback |
| **Audio Generation** | Hugging Face MusicGen |
| **Mission Execution** | Multi-step autonomous task pipelines |
| **Roblox Publishing** | Publish games to Roblox via Open Cloud API |
| **Knowledge Bank** | Curated training-resource analysis for expanding Lumi's capabilities and memory, including external browser-based sources such as Yuanbao and self-evolving agent frameworks |
| **External browser sources** | A generic hook for browser-backed research and ideation sources, with a Yuanbao entry and a future-ready automation path |
| **ACAM Security** | Adaptive Content & Access Manager — rate limiting, audit log, auth |

---

## API — Studio-Compatible Endpoints

The API is structurally identical to **TrezzWorld Production Studio** (`AIModelBridge.ts`),
so the Studio's frontend can connect directly to this server.

### Lumi Chat
```
POST /api/lumi/chat
Body: { message, history?, missionId?, useOllama?, ollamaModel?, domain?, externalSources? }
→ { role: "assistant", content, model, ok }

GET  /api/lumi/chat/history?limit=40&mission_id=<id>
→ { history: [{role, content}] }
```

### Models & Prompts
```
GET  /api/lumi/models
→ { cascade: [{id, provider, label, free, contextWindow}] }

POST /api/lumi/enhance-prompt
Body: { prompt, domain?, externalSources? }
→ { domain, detectedDomain, enhancedMessages, systemPromptPreview }
```

### External browser sources
```
GET  /api/lumi/external-sources
→ { sources: [{id, name, url, category, requiresBrowserAutomation, backend, availability, notes, sessionHint}] }

POST /api/lumi/external-sources/plan
Body: { sources?, goal?, sessionMode? }
→ { requestedSources, sources, automationConfigured, workflowNote, nextSteps }

POST /api/lumi/external-sources/query
Body: { source, query, goal?, sessionMode? }
→ { sourceId, ok, status, usedBackend, content?, error? }
```

These endpoints expose a generic hook for browser-based research sources such as Yuanbao. When `EXTERNAL_BROWSER_PROXY_URL` or `EXTERNAL_BROWSER_API_URL` is configured, Lumi can now issue a live retrieval request to that automation endpoint instead of stopping at workflow-only planning.

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
Body: { type: "image"|"video"|"audio"|"code"|"text"|"document", prompt, provider?, ...options }
→ GenerationResult { ..., artifact }
```

For video requests, `provider` can be set to `"auto"` (default), `"nvidia"`, `"fal"`, `"hunyuan"`, or `"replicate"`.
Use `"nvidia"` to target the NVIDIA-backed video path when `NVIDIA_API_BASE` is configured.
Use `"hunyuan"` to explicitly target the Hugging Face-backed HunyuanVideo path when `HUGGINGFACE_API_KEY` is configured.

GET /api/lumi/artifacts/:artifactId
→ downloads the stored artifact from local storage or redirects to R2

### Voice / Speech
```
POST /api/lumi/speech/transcribe
Body: { audioBase64, mimeType? }
→ { ok, text?, error? }

POST /api/lumi/speech/speak
Body: { text, voice?, format? }
→ { ok, audioDataUrl?, mimeType?, error? }

POST /api/lumi/speech/converse
Body: { audioBase64, mimeType?, domain?, missionId? }
→ { ok, transcript?, reply?, braille?, audio? }

POST /api/lumi/speech/braille
Body: { text }
→ { text, braille }
```

Open `/voice` in a browser to try a microphone-driven voice demo that captures your speech, sends it to Lumi via the speech-converse endpoint, and plays the reply back while showing transcript and braille text on screen.

Open `/lumi-panel.html` to launch autonomous missions, track Lumi's live progress, and download finished artifacts.

### Prompt trainer
```
POST /api/lumi/prompt-trainer
Body: { topic?, audience?, goal?, context? }
→ { title, objective, successMetrics, promptTemplate, evaluationChecklist, followUpQuestions }
```

This endpoint turns enterprise AI adoption material into a reusable prompt-training brief with success metrics, guardrails, and evaluation questions.

### Training resources / knowledge bank
```
POST /api/lumi/training-resources
Body: { resources?, goals? }
→ { generatedAt, overview, capabilityTargets, priorityResources, recommendedIngestionPlan, knowledgeBankSummary, aiMaturityFramework, resources }
```

This endpoint analyzes the curated training-resource catalog for Lumi and stores a knowledge-bank summary in memory for later recall.

### Autonomous missions
```
POST /api/lumi/mission/boot
Body: { prompt }
→ { missionId, objective, status, summary, plannerModel, executionQueue, streamUrl }

GET /api/lumi/missions/:missionId/events
→ { mission, events }

GET /api/lumi/artifacts
→ { artifacts: [StoredArtifact] }
```

These endpoints let Lumi plan and execute multi-step work, publish progress into a live transcript, and expose generated artifacts for download.

### Memory
```
GET    /api/lumi/memory/:sessionId
POST   /api/lumi/memory/search       { query, limit? }
DELETE /api/lumi/memory/:sessionId
GET    /api/lumi/memory/stats
```

### Storage
```
GET /api/lumi/storage
→ { artifacts: {backend, configured, bucket}, memory: {backend, configured, bucket, key} }
```

### System
```
GET /api/lumi/status        → LumiStatus
GET /api/lumi/audit         → AuditLog entries
GET /api/ollama/status      → Ollama health & local models
GET /api/lumi/conversations → All ConversationSessions
```

---

## Local media workflows

For local ComfyUI-based video generation, the repository now includes ready-to-use workflow examples under [`docs/comfyui/`](docs/comfyui/):

- [`docs/comfyui/wan2.1_t2v.json`](docs/comfyui/wan2.1_t2v.json) — minimal Wan 2.1 T2V workflow for the 1.3B model
- [`docs/comfyui/wan2.1_native_i2v.json`](docs/comfyui/wan2.1_native_i2v.json) — native Wan 2.1 I2V workflow for image-to-video
- [`docker/docker-compose.muser.yml`](docker/docker-compose.muser.yml) — GPU-enabled compose example for ACE-Step, RVC, and The Muser UI

These files are intended as a starting point for local experimentation and can be adapted to your preferred model names and folder layout.

## Safety and certification

The repository now includes a bounded-autonomy safety package under `docs/` and `tests/` for documenting LUMI's whitepaper, threat model, and certification materials. Run the safety suite with:

```bash
python -m unittest discover -s tests -p 'test_*.py'
```

Guardrails for tutor-style chat and speech flows are now enabled in the core Lumi chat path. A small golden evaluation suite lives in `tests/golden-tutor-cases.json` and can be run with:

```bash
pnpm run test:guardrails
```

## Legal and governance

The repository now includes a LUMI legal and governance package for responsible deployment and contribution:

- [LICENSE](LICENSE) — Apache 2.0 license
- [NOTICE](NOTICE)
- [TERMS_OF_SERVICE.md](TERMS_OF_SERVICE.md)
- [PRIVACY_POLICY.md](PRIVACY_POLICY.md)
- [ACCEPTABLE_USE_POLICY.md](ACCEPTABLE_USE_POLICY.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [SECURITY.md](SECURITY.md)
- [GOVERNANCE.md](GOVERNANCE.md)
- [FOUNDER_IP_ASSIGNMENT.md](FOUNDER_IP_ASSIGNMENT.md)
- [MODEL_CARD_TEMPLATE.md](MODEL_CARD_TEMPLATE.md)

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
# Required for chat (OpenRouter fallback)
OPENROUTER_API_KEY=sk-or-...     # https://openrouter.ai

# Optional — NVIDIA NIM / local free inference (preferred when available)
NVIDIA_API_BASE=http://localhost:8000/v1
NVIDIA_API_KEY=...
NVIDIA_CHAT_MODEL=meta/llama-3.1-8b-instruct
NVIDIA_VIDEO_MODEL=your-nvidia-video-model
NVIDIA_VIDEO_PATH=/video/generations
NVIDIA_ALLOWED_HOSTS=nvidia.com,localhost,127.0.0.1

# Optional — voice / speech support
OPENAI_API_KEY=sk-...            # https://platform.openai.com
OPENAI_API_URL=https://api.openai.com/v1
OPENAI_STT_MODEL=whisper-1
OPENAI_TTS_MODEL=gpt-4o-mini-tts

# Optional — local model support
OLLAMA_HOST=http://localhost:11434

# Optional — browser-backed research / external autonomy
EXTERNAL_BROWSER_PROXY_URL=https://example.com/browser-proxy
EXTERNAL_BROWSER_API_URL=https://example.com/browser-proxy
EXTERNAL_BROWSER_API_KEY=...

# Optional — local command execution for mission jobs
LUMI_ALLOW_LOCAL_TOOL_EXECUTION=true
LUMI_WORKSPACE_DIR=./.data/lumi-workspace

# Image generation (one or both)
HUGGINGFACE_API_KEY=hf_...       # https://huggingface.co/settings/tokens
STABILITY_API_KEY=sk-...         # https://platform.stability.ai

# Video generation
FAL_KEY=...                      # https://fal.ai/dashboard/keys  ← primary (mirrors Studio)
HUGGINGFACE_API_KEY=hf_...       # https://huggingface.co/settings/tokens  ← HunyuanVideo support
REPLICATE_API_KEY=r8_...         # https://replicate.com          ← fallback

# Artifact storage (local by default, Cloudflare R2 optional)
DATA_DIR=./.data
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET=...
CLOUDFLARE_R2_PUBLIC_URL=https://assets.example.com
# Optional: override the object key used for memory snapshots in R2
CLOUDFLARE_R2_MEMORY_KEY=lumi/memory/lumi-memory.json

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
- **Token auth** — optional bearer token auth (`ACAM_REQUIRE_AUTH=true`)
- **Audit log** — every security event is logged (query at `GET /api/lumi/audit`)

---

## Memory — Free Cloud Storage

Memory is persisted to a **private GitHub Gist** using `GITHUB_API_TOKEN`.  
This is completely free and survives redeployments.  
Without the token, memory falls back to in-process storage (lost on restart).
