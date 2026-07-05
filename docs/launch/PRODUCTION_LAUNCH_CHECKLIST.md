# Production Launch Checklist

This checklist is intentionally strict. Treat anything still unchecked as a launch blocker unless a documented exception has been approved.

## Priority 0 — Must-have before launch

### 1. Production configuration
- [ ] Copy `.env.production.example` to `.env.production` and replace placeholder values.
- [ ] Set `LUMI_BRIDGE_SECRET` to a long random value.
- [ ] Set at least one chat provider:
  - [ ] `OPENROUTER_API_KEY`, or
  - [ ] `OLLAMA_HOST`, or
  - [ ] `NVIDIA_API_BASE` + `NVIDIA_API_KEY` + `NVIDIA_CHAT_MODEL`.
- [ ] Review `ACAM_ALLOWED_ORIGINS` and decide whether public access should be restricted.
- [ ] Review `ACAM_REQUIRE_AUTH` and set it to `true` if the deployment is externally reachable.

### 2. Runtime health
- [ ] Start the service with `NODE_ENV=production`.
- [ ] Confirm `/healthz` returns `200`.
- [ ] Confirm `/readyz` returns `200` and reports no missing requirements.
- [ ] Confirm `/api/lumi/status` returns the expected provider and bridge state.

### 3. Core product paths
- [ ] Public chat works end-to-end.
- [ ] `/api/lumi/chat` returns a normal assistant response.
- [ ] Mission booting works for at least one sample prompt.
- [ ] Memory read/write flows work for a test session.
- [ ] Artifact generation and retrieval work as expected.

### 4. Deployment safety
- [ ] The deployment target is using the production env file, not a local dev env file.
- [ ] Logs are being collected and can be inspected during rollout.
- [ ] A rollback plan is documented and tested.

## Priority 1 — Nice-to-have before public launch

- [ ] Configure Cloudflare R2 storage for durable artifacts and memory.
- [ ] Configure external browser automation for research-backed workflows.
- [ ] Configure Roblox publishing credentials if publishing is part of the launch scope.
- [ ] Configure media generation providers (Hugging Face, FAL, Replicate, or NVIDIA video path).
- [ ] Wire Render/GitHub webhooks if external automation is part of the rollout.
- [ ] Add monitoring and alerting for startup failures, 5xx responses, and mission stalls.

## Definition of done

The launch is ready only when all Priority 0 items are checked and the service has passed at least one successful end-to-end smoke test against the real deployment target.
