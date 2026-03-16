#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PUSH=false
for arg in "$@"; do
  case $arg in
    --push) PUSH=true ;;
  esac
done

cd "$ROOT_DIR/../apps/monitor"
bun install --frozen-lockfile
bun run build

cd "$ROOT_DIR"
cp "$ROOT_DIR/../apps/monitor/dist/monitor" "$ROOT_DIR/monitor"
docker build -t pegasis0/claude-worker:latest .
if [ "$PUSH" = true ]; then
  docker push pegasis0/claude-worker:latest
fi