#! /bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PUSH=false
for arg in "$@"; do
  case $arg in
    --push) PUSH=true ;;
  esac
done

cd "$ROOT_DIR"

./claude-worker/build.sh $([ "$PUSH" = true ] && echo --push)

docker build -t pegasis0/claude-swarm:latest .
if [ "$PUSH" = true ]; then
  docker push pegasis0/claude-swarm:latest
fi