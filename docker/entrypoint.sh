#!/bin/sh
set -eu

pnpm install --frozen-lockfile
pnpm run build

exec node scripts/launcher.cjs
