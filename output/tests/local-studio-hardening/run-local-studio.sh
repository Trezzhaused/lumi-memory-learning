#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT='/home/runner/work/lumi-memory-learning/lumi-memory-learning'
COMPOSE_FILE='/home/runner/work/lumi-memory-learning/lumi-memory-learning/docker/docker-compose.local-studio.yml'
OUTPUT_DIR='/home/runner/work/lumi-memory-learning/lumi-memory-learning/output/tests/local-studio-hardening'

if command -v docker >/dev/null 2>&1; then
  docker compose -f "$COMPOSE_FILE" --profile voice up -d --build
else
  echo "Docker CLI was not detected; please install Docker and rerun this helper."
  exit 1
fi

echo "Local studio stack started"
echo "Scene manifest: $OUTPUT_DIR/scenes.json"
echo "Pipeline plan: $OUTPUT_DIR/pipeline-plan.json"
