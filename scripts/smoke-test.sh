#!/bin/bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"

curl -fsS "$BASE_URL/healthz" >/dev/null
curl -fsS "$BASE_URL/readyz" >/dev/null
curl -fsS "$BASE_URL/api/lumi/status" >/dev/null
curl -fsS "$BASE_URL/api/lumi/models" >/dev/null

printf 'Smoke test passed against %s\n' "$BASE_URL"
