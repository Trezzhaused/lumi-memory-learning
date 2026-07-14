# Lumi Intelligence Center

> **Lumi** is the primary AI assistant and intelligence layer of the **Trezzhaus** platform.  
> Live studio: **https://studio.trezzhaus.com** (TrezzWorld Production Studio)

## What Lumi Does

### K-12 curriculum design and MIT resources

Lumi can now incorporate MIT Learn's competency-based education materials, MIT OpenCourseWare educator content, MIT Open Learning K-12 teacher resources, the Valdosta State K-12 OER LibGuide, Core Knowledge free curriculum materials, and the K12-KGraph curriculum-aligned dataset into its training and planning prompts. These inputs help with curriculum design, competency mapping, unit planning, pedagogy, teacher-facing resource curation, open educational resource discovery, and curriculum-aware question generation.

### Sample prompt pattern: K-12 curriculum planner

When you want Lumi to turn these resources into a classroom-ready unit or lesson plan, use the following instruction pattern:

```text
You are Lumi acting as a K-12 curriculum planner.
First confirm the grade band, subject, standards, timeframe, and learner profile.
Use MIT Learn competency-based education materials to define outcomes, evidence of mastery, and learner agency.
Use MIT OpenCourseWare educator content and MIT Open Learning K-12 teacher resources to shape pacing, activities, and teacher supports.
Use Valdosta State K-12 OER, Core Knowledge, and the K12-KGraph benchmark dataset to find open materials, scope-and-sequence patterns, and curriculum-aware question ideas.
Deliver a concise plan with learning goals, essential questions, unit sequence, assessment ideas, differentiation, and a short list of cited resources.
```

A compact instruction set for the same workflow:

- Start by confirming the grade band, subject, standards, and duration.
- Translate the request into measurable learning outcomes and evidence of mastery.
- Select one or two high-value resources from the curated set for each planning layer.
- Keep the output classroom-ready and note where local standards or district policy may require adaptation.
- End with a short reflection on how the plan can be differentiated for diverse learners.

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

### Media / branding pipeline
```
POST /api/lumi/media/branding/pipeline
Body: { brief, generateAssets? }
→ { brandName, summary, positioning, audience, tone, visualDirection, contentPillars, channelPlan, deliverables, generatedAt, mode }

POST /api/lumi/branding/pipeline
POST /api/lumi/media/branding/full-independence
POST /api/lumi/media/branding/execute
```

These routes turn a brand brief into a structured, independence-first media/branding plan with asset briefs and optional generation attempts when the relevant providers are configured.

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
→ { generatedAt, overview, capabilityTargets, priorityResources, recommendedIngestionPlan, knowledgeBankSummary, promptPatterns, aiMaturityFramework, resources }
```

This endpoint analyzes the curated training-resource catalog for Lumi and stores a knowledge-bank summary in memory for later recall. The catalog now includes the open-source Awesome AI Agents repository and curated language-learning resources such as GoBooks so Lumi can discover free agent implementations, programming-learning pathways, and agentic patterns before leaning on Claude, GPT, or paid services.

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

### Persistent autonomy runtime
```
POST /api/lumi/autonomy/queue
Body: { objective, steps?, metadata? }
→ { task }

GET /api/lumi/autonomy/tasks
→ { tasks: [AutonomyTask] }

GET /api/lumi/autonomy/tasks/:taskId
→ { task }

POST /api/lumi/autonomy/benchmark
→ { results: [AutonomyBenchmarkResult] }
```

These endpoints add a persistent background autonomy loop with durable task state, policy-checked tool execution, checkpointing, and an evaluation harness for lightweight autonomous workflows.

### Memory
```
GET    /api/lumi/memory/:sessionId?maxSensitivity=medium&includeSensitive=false
POST   /api/lumi/memory/search       { query, limit?, includeQuarantined?, minConfidence?, maxSensitivity?, includeSensitive? }
POST   /api/lumi/memory/ingest       { source, content, sessionId?, tags?, chunkSize?, reviewStatus?, confidence?, qualityScore?, sensitivity?, license?, owner?, isSeedItem? }
POST   /api/lumi/knowledge/ingest    { rootDir?, paths?, sessionId?, tags?, reviewStatus?, confidence?, qualityScore?, sensitivity?, isSeedItem? }
POST   /api/lumi/memory/quarantine/:id { reason? }
POST   /api/lumi/memory/review/:id   { status, reviewer?, confidence?, qualityScore? }
POST   /api/lumi/memory/cleanup      { maxAgeDays?, minQuality? }
POST   /api/lumi/memory/feedback     { query, entryIds, outcome, confidence? }
GET    /api/lumi/memory/entries     ?limit=50&includeQuarantined=true&includeSensitive=true
GET    /api/lumi/memory/calibration
DELETE /api/lumi/memory/:sessionId
GET    /api/lumi/memory/stats
GET    /api/lumi/audit
GET    /api/lumi/observability
```

These endpoints add provenance-aware memory entries, quarantine/review handling, lightweight retrieval feedback, ingestion support, and observability for the adaptive-learning workflow. The new knowledge-ingestion endpoint will scan repository files (or any supplied directories such as `../Master-File` and `../Production-Studio`) and turn them into Lumi knowledge entries.

Open `/memory-ops.html` to review memory entries, quarantine or approve them, and record feedback from a lightweight operator UI. Retrieval ranking now also honors `LUMI_RETRIEVAL_*` environment values (for example `LUMI_RETRIEVAL_MATCH_THRESHOLD` and `LUMI_RETRIEVAL_SEED_ITEM_BOOST`) so the calibration loop can be tuned from real validation runs.

### Adaptive-learning validation + K-College workflow
```
POST /api/lumi/validation/bootstrap
GET  /api/lumi/observability/evaluate
POST /api/lumi/kcollege/plan
POST /api/lumi/kcollege/assessment
POST /api/lumi/kcollege/resources/ingest
```

Use `POST /api/lumi/validation/bootstrap` (or `pnpm run validate:bootstrap -- /path/to/repo`) to run the existing launch-readiness, ecosystem bootstrap, and repository knowledge-ingestion path end to end. The evaluation endpoint returns a lightweight summary for retrieval usefulness, quarantine rate, seed-item hit rate, and review backlog so the adaptive loop can be tracked from the same observability surface.

### Storage
```
GET /api/lumi/storage
→ { artifacts: {backend, configured, bucket}, memory: {backend, configured, bucket, key} }
```

### System
```
GET /api/lumi/status        → LumiStatus
GET /api/lumi/bridge/contract → Shared local/online bridge contract for Lumi + Studio
GET /api/lumi/audit         → AuditLog entries
GET /api/ollama/status      → Ollama health & local models
GET /api/lumi/conversations → All ConversationSessions
```

Lumi now exposes a shared bridge contract at `/api/lumi/bridge/contract` so the Lumi repo and TrezzWorld Production Studio can share the same local/online runtime assumptions. The same contract is captured in `lumi-bridge.ts` and `.env.example` for reuse across repos.

---

## Production rollout controls

For production rollouts, Lumi now defaults to a deny-by-default posture for elevated autonomy actions:

- Least-privilege deployment access: GitHub Actions workflows now use `permissions: contents: read` and the production environment so rollout jobs inherit the minimum write scope.
- Review gates: `.github/CODEOWNERS` requires owner review for rollout-sensitive and security-sensitive files, and the production workflow is configured to use the protected `production` environment.
- Network controls: outbound URL fetches are blocked unless the destination host is explicitly allow-listed through `LUMI_NETWORK_ALLOWLIST`.
- Approval policy: elevated actions such as destructive writes, owner-only actions, and network calls require explicit approval under the rollout policy. Set `LUMI_AUTONOMY_APPROVAL_REQUIRED=true` to enforce this in production.

Recommended production values:

- `ACAM_REQUIRE_AUTH=true`
- `LUMI_AUTONOMY_ALLOW_OWNER_ACTIONS=false`
- `LUMI_AUTONOMY_ALLOW_DESTRUCTIVE=false`
- `LUMI_AUTONOMY_ALLOW_NETWORK=false`
- `LUMI_AUTONOMY_APPROVAL_REQUIRED=true`
- `LUMI_NETWORK_ALLOWLIST=api.openrouter.ai,api.openai.com,api.github.com,localhost,127.0.0.1`

## Setup

### 1. Clone & install
```bash
git clone https://github.com/Trezzhaused/lumi-memory-learning
cd lumi-memory-learning
pnpm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the values you want to use:

```bash
cp .env.example .env
```

The runtime defaults to `LUMI_RUNTIME_MODE=auto`, which prefers local Ollama when available and falls back to OpenRouter online chat when it is not.

You can also set `LUMI_RUNTIME_MODE=local` or `LUMI_RUNTIME_MODE=online` to force a provider mode.

The environment file is intentionally aligned with the shared bridge contract so both Lumi and the Production Studio repo can use the same environment shape.

Fill in `.env`:

```bash
# Required for chat
OPENROUTER_API_KEY=sk-or-...     # https://openrouter.ai
```

For multi-repo Trezzhaus setups, a shared environment source is also supported from `Master-File/.env.shared` (or `../Master-File/.env.shared`). Lumi will load those values automatically when present, so you can keep one shared env location for all repos.

Launch-readiness checks are exposed at:

```bash
GET /api/lumi/launch/readiness
POST /api/lumi/launch/bootstrap
```

Those endpoints validate the shared env source, load the approved seed corpus and reviewed launch assets from `Master-File/`, and report chat/memory/storage health so you can confirm the launch posture before training.

### Ecosystem bootstrap (multi-repo rollout)

To connect multiple repos into one shared Lumi ecosystem, use the ecosystem bootstrap endpoint or the CLI helper:

```bash
POST /api/lumi/ecosystem/bootstrap
Body: { "repos": ["/path/to/repo-a", {"repoPath": "/path/to/repo-b", "includePaths": ["."]}] }
```

```bash
pnpm run build
pnpm run bootstrap:ecosystem -- /path/to/repo-a /path/to/repo-b
```

The bootstrap flow loads shared environment values from `Master-File/.env.shared` (or sibling `../Master-File/.env.shared`), ingests the repo's launch assets, and imports each repo's knowledge into Lumi memory so the repos can act like one coordinated runtime. This improves cohesion and reduces configuration drift, while the existing ACAM, quarantine, audit, and reviewed-seed controls help keep the ecosystem safer and more auditable.

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

- **K-12 guidance layer** — ACAM is treated as a lightweight guardrail for K-12 and internal learning flows.
- **Production Studio access** — the Studio domain can opt out via `ACAM_EXCLUDED_ORIGINS` / `ACAM_EXCLUDED_HOSTS` so `studio.trezzhaus.com` remains unrestricted while you define the rest of your access model.
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
