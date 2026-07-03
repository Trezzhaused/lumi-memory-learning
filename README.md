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

These endpoints expose a generic hook for browser-based research sources such as Yuanbao. The default catalog now also includes free Hugging Face and GitHub-backed model repositories such as ShareGPT-4o-Image, UniWorld, Qwen Omni, and Qwen2.5 Omni so Lumi can plan around both browser-assisted research and model-reference workflows. When `EXTERNAL_BROWSER_PROXY_URL` or `EXTERNAL_BROWSER_API_URL` is configured, Lumi can now issue a live retrieval request to that automation endpoint instead of stopping at workflow-only planning.

To enable live browser-backed retrieval, set one of the following in your environment:

- `EXTERNAL_BROWSER_PROXY_URL` — preferred, points to a proxy endpoint that accepts `{sourceId, query, goal?, sessionMode?}`
- `EXTERNAL_BROWSER_API_URL` — fallback for direct automation endpoints
- `EXTERNAL_BROWSER_API_KEY` — optional bearer token for authenticated automation endpoints

A starter template is available in [`.env.example`](.env.example). You can keep everything in a single `.env` file if you prefer; Lumi loads `.env` first and only uses `.env.production`/`.env.development` as optional overrides for environment-specific values. If you want to share a single master env file across repos or branches, set `LUMI_ENV_FILE=/path/to/master.env` (or `LUMI_MASTER_ENV_FILE`) and Lumi will load that file before the local project files.

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

For video requests, `provider` can be set to `"auto"` (default), `"nvidia"`, `"fal"`, `"hunyuan"`, `"replicate"`, or `"comfyui"`.
Use `"nvidia"` to target the NVIDIA-backed video path when `NVIDIA_API_BASE` is configured.
Use `"hunyuan"` to explicitly target the Hugging Face-backed HunyuanVideo path when `HUGGINGFACE_API_KEY` is configured, or a local checkout/script when `HUNYUAN_VIDEO_SCRIPT_PATH` or `HUNYUAN_VIDEO_REPO_PATH` is configured.
Use `"comfyui"` to submit the request to a local ComfyUI instance using the bundled Wan 2.1 workflows.

To plug in a local checkout of Tencent HunyuanVideo, clone the upstream repository into `vendor/hunyuan-video/` or point `HUNYUAN_VIDEO_REPO_PATH` at another location. Lumi will look for a Python entrypoint such as `scripts/hunyuan_video_generate.py`, `hunyuan_video_generate.py`, `generate.py`, `run.py`, or `infer.py`. If you want to use a custom wrapper, set `HUNYUAN_VIDEO_SCRIPT_PATH` to its absolute path and make sure it writes an MP4 file to the `--output` argument.

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
Body: { resources?: string | string[] | {id?: string, resourceId?: string} | Array<...>, goals?: string | string[] }
→ { generatedAt, overview, capabilityTargets, priorityResources, recommendedIngestionPlan, knowledgeBankSummary, aiMaturityFramework, resources }
```

`resources` and `goals` can each be supplied as either a single string or an array of strings. The endpoint also accepts structured selectors such as `{resourceId: "yuanbao"}`, nested objects/arrays like `[{resource: {"resource-id": "yuanbao"}}]`, and case-insensitive aliases with punctuation or whitespace separators. This endpoint analyzes the curated training-resource catalog for Lumi and stores a knowledge-bank summary in memory for later recall.

### Local file ingestion and organization

```
POST /api/lumi/ingestion/process
Body: { filename?, sourcePath?, mimeType?, content?, contentBase64?, sessionId? }
→ { status, filename, category, artifactId?, artifactPath?, extractedText?, totalChunks?, moved?, finalPath? }

POST /api/lumi/ingestion/guide
→ { status, artifactId?, artifactPath?, message }
```

This local-first workflow accepts plain text, CSV, JSON, log files, and PDF paths; it extracts text, classifies the file into Financials / Manuscripts / System_Logs / General_Reference, stores the original artifact, persists the extracted text into Lumi memory, and moves the source file into the matching local folder under `.data/ingestion/`.

The repository also includes companion helper scripts under `scripts/` for a local parser, a file sorter, a directory watcher, and a PDF guide generator so the flow can be replayed outside the API as well.

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

For a lower-touch workflow, Lumi now also supports mission approval/resume through:

```
POST /api/lumi/missions/:missionId/approve
POST /api/lumi/missions/:missionId/resume
```

and the `/api/lumi/status` payload now includes an `independentMode` block so you can see whether local inference, local generation fallback, storage, and bridge execution are ready.

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

## Production deployment and smoke testing

Lumi now includes a production-oriented deployment path that keeps the runtime configurable through environment variables and exposes a lightweight health surface for automated checks.

- Container entrypoint: `docker/Dockerfile.lumi` and `docker/entrypoint.sh`
- Production compose template: `docker/docker-compose.prod.yml`
- Environment bundle: `.env.production.example`
- Smoke test script: `scripts/smoke-test.sh`

### Quick deployment recipe

1. If you want a single-file workflow, keep the values in `.env` and skip `.env.production`; otherwise copy `.env.production.example` to `.env.production` and fill the values you want to use.
2. Build and start the container stack:

```bash
docker compose -f docker/docker-compose.prod.yml up -d --build
```

3. Smoke test the deployment:

```bash
bash ./scripts/smoke-test.sh
```

The app now exposes:
- `GET /healthz` — lightweight liveness probe
- `GET /readyz` — readiness summary with bridge/storage/provider status

### Container behavior

The container entrypoint installs dependencies, builds the TypeScript app, validates the runtime configuration in production mode, prints a startup readiness summary, and exits fast if required deployment settings are missing.

## Local media workflows

For local ComfyUI-based video generation, the repository now includes ready-to-use workflow examples under [`docs/comfyui/`](docs/comfyui/):

- [`docs/comfyui/wan2.1_t2v.json`](docs/comfyui/wan2.1_t2v.json) — minimal Wan 2.1 T2V workflow for the 1.3B model
- [`docs/comfyui/wan2.1_native_i2v.json`](docs/comfyui/wan2.1_native_i2v.json) — native Wan 2.1 I2V workflow for image-to-video
- [`docker/docker-compose.muser.yml`](docker/docker-compose.muser.yml) — GPU-enabled compose example for ACE-Step, RVC, and The Muser UI
- [`docker/docker-compose.local-studio.yml`](docker/docker-compose.local-studio.yml) — a local AI MV studio stack with Redis, ComfyUI, RVC, Whisper, and a lightweight web UI

These files are intended as a starting point for local experimentation and can be adapted to your preferred model names and folder layout.

### Local AI MV studio quick start

1. Create local folders for `models/`, `input/`, and `output/` next to the compose file.
2. Start the stack with PowerShell:

```powershell
docker compose -f docker/docker-compose.local-studio.yml up -d --build
```

3. Generate a local pipeline plan from the API:

```powershell
$body = @{
  title = "Neon Ghost"
  audioPath = "input/neon_ghost.wav"
  sceneManifest = @{
    title = "Neon Ghost"
    scenes = @(
      @{ startBeat = 0; endBeat = 16; character = "hero"; faceVideo = "models/synthv/hero_idle.mp4"; rvcModel = "models/rvc/hero.pth" },
      @{ startBeat = 16; endBeat = 32; character = "villain"; faceVideo = "models/synthv/villain_closeup.mp4"; rvcModel = "models/rvc/villain.pth" }
    )
  }
} | ConvertTo-Json -Depth 8

Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/lumi/local-studio/run -ContentType 'application/json' -Body $body
```

The endpoint writes a `scenes.json` manifest, a `pipeline-plan.json` file, and a `run-local-studio.sh` helper into `output/local-studio/` so the workflow can be reviewed before execution. The Docker web UI also renders a scene-preview gallery with a character selector so you can inspect the manifest before launching the stack.

### Optional knowledge-graph memory

The local studio stack now includes a Neo4j service for graph-backed memory. After bringing the stack up, the browser UI at `http://localhost:7474` exposes the graph database, and the ingestion workflow will attempt to create a `CLASSIFIED_AS` relationship between each ingested file and its inferred category when `LUMI_ENABLE_GRAPH` is not set to `false`.

- Start the graph service with `NEO4J_AUTH=neo4j/YourStrongPassword docker compose -f docker/docker-compose.local-studio.yml up -d neo4j`.
- Set `NEO4J_PASSWORD=YourStrongPassword` (or export the matching `NEO4J_AUTH` values) before triggering the first graph write.
- Install the Python driver with `pip install -r backend/requirements.txt` before triggering the first graph write.

### Production-ready quickstart

- Local desktop use: start the default browser-friendly stack with `docker compose -f docker/docker-compose.local-studio.yml up -d --build`.
- Cloud GPU / heavier voice workflows: add the `voice` profile with `docker compose -f docker/docker-compose.local-studio.yml --profile voice up -d --build` when you want Whisper and RVC services.
- One-click deployment path: use the compose stack as the baseline for a cloud GPU host, then point the app at your cloud-hosted model endpoints (NVIDIA, OpenRouter, Hugging Face, etc.).
- Optional graph memory: the local studio stack now ships with Neo4j so you can add graph-backed links to ingested assets without changing the main ingestion API surface.

Status summary:
- Fully working now: chat routing, prompt enhancement, memory fallback, local-studio plan generation, speech formatting, and guardrails.
- Experimental / requires external setup: full cloud-provider generation, GPU-backed local video generation, and voice-stack execution.

### Autonomy note

Lumi can orchestrate a fully self-hosted local studio workflow without Claude or OpenRouter, but not every step is truly "API-free" unless you also self-host the generation models. The new stack is designed for local-first execution with Docker containers and local model weights, while the existing `POST /api/lumi/generate` path still supports external providers when they are configured.

## Hybrid local and browser runtime

LUMI can now be used in a hybrid mode:

- Open `/public-chat` in a browser for the public-facing chat experience.
- Keep the local runtime responsible for real file-system access, scripts, and owner-side actions.
- Enable local tool execution with `LUMI_ALLOW_LOCAL_TOOL_EXECUTION=true`.
- Allow browser-triggered actions with `LUMI_ALLOW_CLOUD_TOOL_REQUESTS=true`.
- Protect the secure bridge with `LUMI_BRIDGE_SECRET` and call `/api/lumi/bridge/execute` with that token.

The shared LUMI chat core is used by both the local/internal API and the public browser API, while the bridge is the only pathway for approved owner-side actions.

### Remote-owner runtime connector

LUMI now includes a tiny remote-owner runtime connector for future owner-side execution over a networked endpoint. It is intentionally minimal and opt-in:

- Set `LUMI_REMOTE_OWNER_RUNTIME_URL` to point the bridge at an HTTP endpoint that accepts JSON payloads.
- Optional bearer auth can be supplied with `LUMI_REMOTE_OWNER_RUNTIME_TOKEN`.
- Trigger it through the existing bridge with `action: "remote-owner-runtime"` and any parameters you need for the remote runtime.

This is a good fit for future work such as a private Windows desktop listener, a Tailscale-backed owner bridge, or a remote execution service inside a self-hosted cloud stack.

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

# Optional — local ComfyUI video generation
COMFYUI_BASE_URL=http://127.0.0.1:8188
COMFYUI_API_KEY=optional-api-key
COMFYUI_WORKFLOW_T2V=docs/comfyui/wan2.1_t2v.json
COMFYUI_WORKFLOW_I2V=docs/comfyui/wan2.1_native_i2v.json

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
