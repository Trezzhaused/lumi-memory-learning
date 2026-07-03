#!/bin/sh
set -eu

pnpm install --frozen-lockfile
pnpm run build

exec node dist/app.js
