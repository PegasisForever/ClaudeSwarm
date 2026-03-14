# Claude Worker Docker Image

`pegasis0/claude-worker:latest`

## Image Hierarchy

- `pegasis0/claude-worker:base` - Created manually from `kasmweb/ubuntu-jammy-dind:1.18.0` with the following customizations:
  1. In settings, change taskbar to bottom, reduce workspace count to 1, and remove workspace switcher from task bar
  2. Install papirus icon theme from https://github.com/PapirusDevelopmentTeam/papirus-icon-theme
  3. Download zorin blue light theme from https://github.com/ZorinOS/zorin-desktop-themes/releases/tag/5.2.2 and install to /usr/share/themes/
  4. Set terminal theme to white
  5. Run "ln -s /home/kasm-user/ Home" under ~/Desktop
  6. Reorganize desktop
  7. Change desktop background

- `pegasis0/claude-worker:latest` - Built on top of `:base` with Claude Code and additional automation. Includes:
  - Ubuntu 22.04 LTS with XFCE Desktop Environment, fixed 1080p resolution
  - Node.js 22.x LTS
  - Screen record skill for Claude
  - Computer use MCP
  - Chrome DevTools MCP
  - Pre-installed Claude Code and GitHub CLI
  - Docker in Docker

## Usage

This image (`pegasis0/claude-worker:latest`) is intended to be used as a **starting point**. End users should build their own images on top of this to add their development tools, project dependencies, and custom configurations.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token for authenticating with Claude Code, get from `claude setup-token` |
| `GITHUB_TOKEN` | GitHub personal access token for repository operations |
| `CLAUDE_PROMPT` | Initial prompt to send to Claude Code on startup |

## Container Initialization

When the container starts, the monitor process initializes the workspace in this order:

1. It waits for `/tmp/monitor_flag` to disappear. The base container startup clears `/tmp`, so this prevents the monitor from racing the desktop startup sequence.
2. It ensures two tmux sessions exist: `claude` and `terminal`.
3. It runs `source ~/setup.sh` inside the `claude` tmux session.
4. It starts Claude Code in that same `claude` session, appending `CLAUDE_PROMPT` when provided.
5. It watches for the Claude trust prompt and automatically confirms it when needed.
6. It reads Claude's current working directory and changes the `terminal` tmux session into the same directory.

For end-user customization, the most important hook is `~/setup.sh`. Build your own image on top of this one and replace that file to install dependencies, export environment variables, clone repositories, or prepare the workspace before Claude starts.

## API Endpoints

The monitor exposes tRPC HTTP queries under `/monitor/trpc/*` and a terminal websocket at `/monitor/ws`.

### `GET /monitor/trpc/status`

Returns the current state of the Claude Code session as a tRPC query response.

**Response:**
```json
{
  "result": {
    "data": {
      "status": "working",
      "pr": {
        "name": "Add new feature",
        "number": "42",
        "link": "https://github.com/user/repo/pull/42",
        "branch": "feature-branch",
        "baseBranch": "main"
      }
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"idle" \| "waiting" \| "working"` | Claude session state |
| `pr` | `object \| undefined` | Open PR for the current branch, if one can be resolved with `gh pr view` |

**Status values:**
- `idle` — Claude is not running (bash prompt visible)
- `waiting` — Claude is waiting for user input
- `working` — Claude is actively processing

### `GET /monitor/trpc/health`

Health check query used by Docker.

**Response:**
```json
{
  "result": {
    "data": {
      "ok": true
    }
  }
}
```

### Removed endpoints

The older REST-style monitor endpoints such as `/monitor/api/status`, `/monitor/api/health`, and `/monitor/api/stop` are no longer served by the current monitor implementation.

### `WS /monitor/ws?cmd=<command>`

WebSocket endpoint for interactive terminal access via xterm.js. Connects to a PTY running the specified command (defaults to `bash`).

**Query Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `cmd` | `bash` | Command to run in the terminal |

**Message Protocol:**

Client → Server:
```json
{ "type": "input", "data": "ls\n" }
{ "type": "resize", "cols": 120, "rows": 40 }
```

Server → Client:
```json
{ "type": "output", "data": "terminal output here" }
{ "type": "exit", "exitCode": 0 }
```

## Example

```bash
docker run --rm -d \
  --shm-size=512m \
  -p 51300:51300 \
  --privileged \
  -e GITHUB_TOKEN=ghp_xxx \
  -e CLAUDE_CODE_OAUTH_TOKEN=sk-ant-xxx \
  -e CLAUDE_PROMPT='hi' \
  --hostname worker1 \
  pegasis0/claude-worker:latest
```

Note: `--privileged` is required for Docker in Docker.

After the container is running, you can access the desktop at `http://localhost:51300/monitor`.