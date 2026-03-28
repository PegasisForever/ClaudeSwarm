#!/usr/bin/env bash

set -euo pipefail

HOME_DIR="${HOME:-/home/kasm-user}"
WORKSPACE_DIR="${WORKSPACE_DIR:-$HOME_DIR/workers}"
DISPLAY_VALUE="${DISPLAY:-:1}"
COMPUTER_USE_STATE_DIR="$HOME_DIR/.agentswarm/computer-use"
COMPUTER_USE_PROFILE="$HOME_DIR/.agentswarm/profiles/computer-use"
COMPUTER_USE_STAMP_FILE="$COMPUTER_USE_STATE_DIR/flake-ref"
DEFAULT_COMPUTER_USE_FLAKE="${WORKER_COMPUTER_USE_FLAKE:-/opt/agent-worker-flake#computerUseEnv}"
EXTRA_COMPUTER_USE_FLAKE="${WORKER_COMPUTER_USE_EXTRA_FLAKE_REF:-}"
LOG_FILE="$COMPUTER_USE_STATE_DIR/provision.log"
ERROR_FILE="$COMPUTER_USE_STATE_DIR/error"
STATUS_FILE="$COMPUTER_USE_STATE_DIR/status"
VNC_PORT="${WORKER_VNC_PORT:-6901}"
VNC_PASSWORD="${WORKER_VNC_PASSWORD:-computer-use}"
VNC_SCREEN="${WORKER_VNC_RESOLUTION:-1440x900x24}"
X11VNC_PORT="${WORKER_X11VNC_PORT:-5900}"

mkdir -p "$COMPUTER_USE_STATE_DIR" "$(dirname "$COMPUTER_USE_PROFILE")"
: > "$LOG_FILE"
: > "$ERROR_FILE"
printf 'preparing\n' > "$STATUS_FILE"

exec > >(tee -a "$LOG_FILE") 2>&1

set_status() {
  printf '%s\n' "$1" > "$STATUS_FILE"
}

set_error() {
  printf '%s\n' "$1" > "$ERROR_FILE"
}

clear_error() {
  : > "$ERROR_FILE"
}

fail() {
  local message="$1"

  echo "$message" >&2
  set_error "$message"
  set_status "error"
  exit 1
}

find_novnc_web_root() {
  local candidate=""

  for candidate in \
    "${NOVNC_WEB_ROOT:-}" \
    "$COMPUTER_USE_PROFILE/share/novnc" \
    "$COMPUTER_USE_PROFILE/share/webapps/novnc" \
    /opt/novnc \
    /usr/share/novnc \
    /usr/share/webapps/novnc \
    /run/current-system/sw/share/novnc
  do
    if [ -n "$candidate" ] && [ -f "$candidate/vnc.html" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  candidate="$(find /nix/store \( -path '*/share/novnc' -o -path '*/share/webapps/novnc' \) -type d 2>/dev/null | head -n 1)"
  if [ -n "$candidate" ] && [ -f "$candidate/vnc.html" ]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  return 1
}

wait_for_x_display() {
  local attempt=0

  until xset -display "$DISPLAY_VALUE" q >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 30 ]; then
      echo "Timed out waiting for X display $DISPLAY_VALUE" >&2
      return 1
    fi
    sleep 1
  done
}

launch_terminal() {
  local title="$1"
  local session_name="$2"

  if command -v xfce4-terminal >/dev/null 2>&1; then
    xfce4-terminal \
      --title="$title" \
      --working-directory="$WORKSPACE_DIR" \
      --command="sh -lc 'mkdir -p \"$WORKSPACE_DIR\"; exec tmux new-session -A -s \"$session_name\" -c \"$WORKSPACE_DIR\"'" \
      >/tmp/"$session_name"-terminal.log 2>&1 &
    return 0
  fi

  xterm \
    -title "$title" \
    -fa Monospace \
    -fs 11 \
    -e sh -lc "mkdir -p \"$WORKSPACE_DIR\"; exec tmux new-session -A -s \"$session_name\" -c \"$WORKSPACE_DIR\"" \
    >/tmp/"$session_name"-terminal.log 2>&1 &
}

launch_browser() {
  if command -v chromium >/dev/null 2>&1; then
    chromium --no-sandbox --disable-dev-shm-usage about:blank >/tmp/browser.log 2>&1 &
    return 0
  fi

  if command -v firefox >/dev/null 2>&1; then
    firefox about:blank >/tmp/browser.log 2>&1 &
  fi
}

start_desktop_session() {
  if command -v startxfce4 >/dev/null 2>&1; then
    startxfce4 >/tmp/desktop-session.log 2>&1 &
    return 0
  fi

  openbox-session >/tmp/desktop-session.log 2>&1 &
}

activate_computer_use_profile() {
  local next_path="$COMPUTER_USE_PROFILE/bin:$COMPUTER_USE_PROFILE/sbin"

  export PATH="$next_path:$PATH"
}

prepare_flake_environment() {
  local requested_stamp="${DEFAULT_COMPUTER_USE_FLAKE}|${EXTRA_COMPUTER_USE_FLAKE}"
  local current_stamp=""

  if [ -f "$COMPUTER_USE_STAMP_FILE" ]; then
    current_stamp="$(cat "$COMPUTER_USE_STAMP_FILE")"
  fi

  if [ -d "$COMPUTER_USE_PROFILE/bin" ] && [ "$requested_stamp" = "$current_stamp" ]; then
    echo "Reusing existing computer-use profile"
    activate_computer_use_profile
    return 0
  fi

  rm -rf "$COMPUTER_USE_PROFILE"
  mkdir -p "$(dirname "$COMPUTER_USE_PROFILE")"

  echo "Installing default computer-use environment from ${DEFAULT_COMPUTER_USE_FLAKE}"
  nix profile install \
    --accept-flake-config \
    --profile "$COMPUTER_USE_PROFILE" \
    "$DEFAULT_COMPUTER_USE_FLAKE"

  if [ -n "$EXTRA_COMPUTER_USE_FLAKE" ]; then
    echo "Installing extra computer-use environment from ${EXTRA_COMPUTER_USE_FLAKE}"
    nix profile install \
      --accept-flake-config \
      --profile "$COMPUTER_USE_PROFILE" \
      "$EXTRA_COMPUTER_USE_FLAKE"
  fi

  printf '%s\n' "$requested_stamp" > "$COMPUTER_USE_STAMP_FILE"
  activate_computer_use_profile
}

prepare_flake_environment || fail "Failed to prepare computer use environment"

if ! command -v Xvfb >/dev/null 2>&1; then
  fail "Xvfb is required for computer use mode"
fi

if ! command -v x11vnc >/dev/null 2>&1; then
  fail "x11vnc is required for computer use mode"
fi

if ! command -v websockify >/dev/null 2>&1; then
  fail "websockify is required for computer use mode"
fi

NOVNC_WEB_ROOT="$(find_novnc_web_root)"
if [ -z "$NOVNC_WEB_ROOT" ]; then
  fail "Could not locate noVNC web assets after provisioning"
fi

mkdir -p "$HOME_DIR/.vnc" "$HOME_DIR/.config/openbox" "$HOME_DIR/Desktop" "$HOME_DIR/Downloads"

Xvfb "$DISPLAY_VALUE" -screen 0 "$VNC_SCREEN" -ac +extension RANDR >/tmp/xvfb.log 2>&1 &

wait_for_x_display

export DISPLAY="$DISPLAY_VALUE"

start_desktop_session
xsetroot -solid "#1f1f1f" >/dev/null 2>&1 || true

launch_terminal "codex" "codex"
launch_terminal "terminal" "terminal"
launch_browser

x11vnc -storepasswd "$VNC_PASSWORD" "$HOME_DIR/.vnc/passwd" >/dev/null
x11vnc \
  -display "$DISPLAY_VALUE" \
  -rfbport "$X11VNC_PORT" \
  -rfbauth "$HOME_DIR/.vnc/passwd" \
  -forever \
  -shared \
  -xkb \
  -noxdamage \
  >/tmp/x11vnc.log 2>&1 &

websockify --web "$NOVNC_WEB_ROOT" "$VNC_PORT" "127.0.0.1:${X11VNC_PORT}" >/tmp/novnc.log 2>&1 &

clear_error
set_status "ready"
