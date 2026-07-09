# Lumi Intelligence Center

> **Lumi** is the primary AI assistant and intelligence layer of the **Trezzhaus** platform.  
> Live studio: **https://studio.trezzhaus.com** (TrezzWorld Production Studio)

## What Lumi Does

| Capability | Detail |
|---|---|
| **Chat** | Multi-model conversations via OpenRouter (free-tier cascade) |
| **Text Generation** | Plain-text content generation and document drafting |
| **Document Generation** | Markdown / document outputs saved as artifacts |
| **Memory** | Persistent memory backed by Cloudflare R2 when configured, with GitHub Gists and in-memory fallback |
| **Code Generation** | Full programs, scripts, games in any language |
| **Image Generation** | Stability AI / Hugging Face FLUX.1-schnell |
| **Video Generation** | FAL.ai (Wan 2.2 / Kling) with Replicate fallback |
| **Audio Generation** | Hugging Face MusicGen |
| **Mission Execution** | Multi-step autonomous task pipelines |
| **Roblox Publishing** | Publish games to Roblox via Open Cloud API |
| **Knowledge Bank** | Curated training-resource analysis for expanding Lumi's capabilities and memory |
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
Body: { type: "image"|"video"|"audio"|"code"|"text"|"document", prompt, ...options }
→ GenerationResult { ..., artifact }
```

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

Open `/voice` in a browser to try a simple voice demo that uses browser speech recognition and the Lumi chat API.

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

### Voxel51 Dataset Zoo catalog
 
Run `pnpm run fetch:voxel51-zoo` to refresh the archived Dataset Zoo metadata and preview images in `data/voxel51-dataset-zoo/`. The fetched catalog also feeds Lumi's training-resource analysis as a high-priority multimodal dataset source.
 
### Training dataset catalogs (Open Images + Deep Blue)
  
Run `pnpm run fetch:training-datasets` to refresh the Open Images and Deep Blue training-resource manifests in `data/training-datasets/`. The generated catalog feeds a lightweight viewer at `/dataset-viewer.html` (or `public/dataset-viewer.html`) so Lumi can browse dataset sources and download targets without opening the raw sites directly.

### Educational schema builder
 
Run `pnpm run build:education-schema` to generate an AI-ready JSONL dataset for a K-12 or OpenStax-style curriculum node. The script writes a compact JSONL file to `data/educational-datasets/education-schema.jsonl` plus a manifest in `data/educational-datasets/manifest.json`.
 
For K-12 curriculum design references, the repo now includes `data/educational-datasets/mit-k12-resource-catalog.json`, which captures MIT Open Learning, OCW educator resources, MITx course patterns, and pK-12/playful-learning guidance that can inform LUMI lesson planning, competency sequencing, and assessment generation.
 
### Self-paced learning engine

Run `pnpm run build:self-paced-bank` to generate a JSONL question bank and tier-alignment matrix in `data/self-paced-learning/`. Run `pnpm run self-paced:demo` to simulate routing and adaptive tier updates for a sample learner.

### Adaptive self-paced API

The existing app now exposes adaptive-learning endpoints for the self-paced bank:

```
POST /api/lumi/self-paced/select-next
Body: { history?, candidates?, tierLevel?, subject?, topic?, excludeIds?, limit?, targetProportions? }
→ { selectedQuestion, routing: { eapTheta, klInformation, priorityScore, exposureCounts } }

POST /api/lumi/self-paced/audit-question
Body: { question, studentResponses }
→ { question_id, total_sample_size, point_biserial_correlation, outfit_mean_square, flags, action_required }
```

These routes reuse the repository's existing self-paced question bank and add KL-based routing plus content-balancing and item-audit logic on top of it.

For the next-stage assessment platform roadmap, see `K-College-Upgrade.md` for deferred enhancements such as Sympson-Hetter exposure control, scheduled audits, seed-item calibration, telemetry, and MIRT support.
    
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

# Optional — voice / speech support
OPENAI_API_KEY=sk-...            # https://platform.openai.com
OPENAI_API_URL=https://api.openai.com/v1
OPENAI_STT_MODEL=whisper-1
OPENAI_TTS_MODEL=gpt-4o-mini-tts

# Optional — local model support
OLLAMA_HOST=http://localhost:11434

# Image generation (one or both)
HUGGINGFACE_API_KEY=hf_...       # https://huggingface.co/settings/tokens
STABILITY_API_KEY=sk-...         # https://platform.stability.ai

# Video generation
FAL_KEY=...                      # https://fal.ai/dashboard/keys  ← primary (mirrors Studio)
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
