#!/usr/bin/env bash

set -euo pipefail

HOME_DIR="${HOME:-/home/kasm-user}"
WORKSPACE_DIR="${WORKSPACE_DIR:-$HOME_DIR/workers}"
DISPLAY_VALUE="${DISPLAY:-:1}"
VNC_PORT="${WORKER_VNC_PORT:-6901}"
VNC_PASSWORD="${WORKER_VNC_PASSWORD:-computer-use}"
VNC_SCREEN="${WORKER_VNC_RESOLUTION:-1440x900x24}"
X11VNC_PORT="${WORKER_X11VNC_PORT:-5900}"

find_novnc_web_root() {
  local candidate=""

  for candidate in \
    "${NOVNC_WEB_ROOT:-}" \
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

if ! command -v Xvfb >/dev/null 2>&1; then
  echo "Xvfb is required for computer use mode" >&2
  exit 1
fi

if ! command -v x11vnc >/dev/null 2>&1; then
  echo "x11vnc is required for computer use mode" >&2
  exit 1
fi

if ! command -v websockify >/dev/null 2>&1; then
  echo "websockify is required for computer use mode" >&2
  exit 1
fi

NOVNC_WEB_ROOT="$(find_novnc_web_root)"
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
