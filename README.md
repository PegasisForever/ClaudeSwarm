# AgentSwarm

[![Docker](https://github.com/zangjiucheng/AgentSwarm/actions/workflows/docker.yml/badge.svg)](https://github.com/zangjiucheng/AgentSwarm/actions/workflows/docker.yml)
[![Nix Worker](https://img.shields.io/badge/Nix-worker-5277C3?logo=nixos&logoColor=white)](./agent-worker/flake.nix)

## Run

Build the images:

```bash
./build.sh
```

Or build and start everything in one step:

```bash
./run.sh
```

GitHub Actions now builds both Docker images on every push. Pushes to the repository publish multi-arch images to `ghcr.io/zangjiucheng/agentswarm` and `ghcr.io/zangjiucheng/agentswarm-worker`. Pull requests run the same builds without publishing.

By default, `./run.sh` preserves existing worker containers. If you explicitly want to remove existing workers before rebuilding the worker image, use:

```bash
./run.sh --cleanup-workers
```

Build scripts now prune Docker build cache before each build to keep local disk usage under control.

On Apple Silicon macOS, the build defaults to `linux/arm64`. If needed, override `DOCKER_PLATFORMS` with a single platform such as `linux/amd64` or `linux/arm64`.

Start the app:

```bash
docker run -d \
  --name agentswarm \
  -e PORT=14000 \
  -p 14000:14000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v agentswarm-data:/app/data \
  -v "$(pwd)/apps/backend/config.json:/app/config.json" \
  agent-swarm:latest
```

Then open `http://localhost:14000`.

The runtime image already includes a default config, so mounting [`/apps/backend/config.json`](./apps/backend/config.json) is optional unless you want to override it.
The backend secret store is persisted under `/app/data`, so keep that path on a Docker volume if you want GitHub accounts and other stored settings to survive container rebuilds.

When you create a worker from the UI, the default image tag is `agent-worker:latest`. The required env vars are:

- none by default

`OPENAI_API_KEY` is optional. It is available inside the worker so you can use Codex from the integrated terminal in `code-server`.

`GITHUB_TOKEN` is also optional. GitHub-specific operations such as PR inspection or authenticated remote access will only work when a token is available.

You can configure `GITHUB_USERNAME` and `GITHUB_TOKEN` from the dashboard's global settings. They are stored in AgentSwarm's own persistent data volume, not in [`apps/backend/config.json`](./apps/backend/config.json), and are injected into newly created workers automatically.

Each worker now exposes a single `code-server` web IDE on its published port. The dashboard embeds that IDE directly instead of showing a desktop/VNC session or custom terminal panes.

Workers are persistent Docker containers until you explicitly destroy them. From the dashboard you can pause a worker without deleting its workspace and start it again later from the same UI.

Each newly created worker now gets its own Docker volume mounted at `/home/kasm-user/workers`, so its workspace survives stop/start cycles and can be migrated to a fresh container later.

The dashboard also includes a `Migrate` action. It recreates the worker from the latest image while reusing the same persisted workspace volume. Older workers created before workspace volumes were introduced cannot be migrated automatically.

When creating a worker from the dashboard, you can optionally provide a repository URL. The worker will clone that repository on first boot and open `code-server` directly in the cloned directory.

For GitHub repositories, a configured `GITHUB_TOKEN` is also used for the initial clone. This means private GitHub repos can be cloned at worker startup without requiring an SSH key inside the worker.

The worker image is Nix-based and declares its toolchain in [`agent-worker/flake.nix`](./agent-worker/flake.nix). The pinned package set lives in [`agent-worker/flake.lock`](./agent-worker/flake.lock).

Preset suggestions included in the default config:

- `frontend`: frontend-focused default with `NODE_ENV=development` and `BROWSER=none`
- `fullstack`: general app development preset with `NODE_ENV=development`
- `oss-contrib`: tuned for GitHub-driven contribution flows and gh CLI usage
- `ai-agent`: agent-oriented preset that requires `OPENAI_API_KEY`

## Credits

AgentSwarm is a fork of [PegasisForever/ClaudeSwarm](https://github.com/PegasisForever/ClaudeSwarm.git).
