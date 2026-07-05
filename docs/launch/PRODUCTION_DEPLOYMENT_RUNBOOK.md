# Production Deployment Runbook

## Prerequisites
- Node.js 22+
- pnpm
- Docker Engine (optional, for container-based deployment)
- A real `.env.production` file with production values

## 1. Preflight

### Local preflight
```bash
pnpm run typecheck
pnpm run build
```

### Production startup check
```bash
NODE_ENV=production PORT=3001 node dist/app.js
```

Then verify:
```bash
curl http://127.0.0.1:3001/healthz
curl http://127.0.0.1:3001/readyz
curl http://127.0.0.1:3001/api/lumi/status
```

The app should start cleanly and the readiness endpoint should report `ok: true`.

## 2. Container deployment

```bash
cp .env.production.example .env.production
# edit .env.production before continuing

docker compose -f docker/docker-compose.prod.yml up -d --build
```

Verify the container:
```bash
docker compose -f docker/docker-compose.prod.yml ps
docker compose -f docker/docker-compose.prod.yml logs lumi
curl http://127.0.0.1:3001/readyz
```

## 3. Smoke tests

Use the repo smoke test script after the service is up:
```bash
BASE_URL=http://127.0.0.1:3001 bash ./scripts/smoke-test.sh
```

Also verify a real chat request:
```bash
curl -X POST http://127.0.0.1:3001/api/lumi/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Say hello from the production deployment."}'
```

## 4. Rollback

If the rollout fails:
```bash
docker compose -f docker/docker-compose.prod.yml down
```

Then restore the previous deployment artifact or env file and redeploy.

## 5. Production notes
- Do not launch with placeholder secrets or missing provider credentials.
- If production startup fails fast, resolve the listed missing requirements before continuing.
- Keep `.env.production` outside version control and rotate any exposed secrets immediately.
