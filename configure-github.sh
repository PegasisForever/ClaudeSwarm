#!/usr/bin/env bash

set -euo pipefail

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/agentswarm"
ENV_FILE="$CONFIG_DIR/github.env"
ASKPASS_DIR="$HOME/.local/bin"
ASKPASS_SCRIPT="$ASKPASS_DIR/github-askpass"
SHELL_RC=""
UPDATE_SHELL_RC=1
GITHUB_USERNAME_VALUE="${GITHUB_USERNAME:-}"
GITHUB_TOKEN_VALUE="${GITHUB_TOKEN:-}"

usage() {
  cat <<EOF
Usage: $0 [--username USERNAME] [--token TOKEN] [--shellrc PATH] [--no-shellrc]

Configures GitHub authentication for the current machine by:
  - storing GITHUB_USERNAME and GITHUB_TOKEN in $ENV_FILE
  - creating $ASKPASS_SCRIPT for git HTTPS auth
  - configuring global git credential settings
  - logging in to gh and running gh auth setup-git when gh is installed

Options:
  --username USERNAME  GitHub username to save
  --token TOKEN        GitHub personal access token to save
  --shellrc PATH       Shell rc file to update
  --no-shellrc         Do not modify any shell rc file
  -h, --help           Show this help message
EOF
}

detect_shell_rc() {
  local shell_name
  shell_name="$(basename "${SHELL:-}")"

  case "$shell_name" in
    zsh)
      printf "%s\n" "$HOME/.zshrc"
      ;;
    bash)
      printf "%s\n" "$HOME/.bashrc"
      ;;
    *)
      printf "%s\n" "$HOME/.profile"
      ;;
  esac
}

prompt_for_missing_values() {
  if [ -z "$GITHUB_USERNAME_VALUE" ]; then
    printf "GitHub username: " >&2
    read -r GITHUB_USERNAME_VALUE
  fi

  if [ -z "$GITHUB_TOKEN_VALUE" ]; then
    printf "GitHub token: " >&2
    read -rs GITHUB_TOKEN_VALUE
    printf "\n" >&2
  fi

  if [ -z "$GITHUB_USERNAME_VALUE" ] || [ -z "$GITHUB_TOKEN_VALUE" ]; then
    echo "GitHub username and token are required." >&2
    exit 1
  fi
}

write_env_file() {
  mkdir -p "$CONFIG_DIR" "$ASKPASS_DIR"
  chmod 700 "$CONFIG_DIR" "$ASKPASS_DIR"

  cat > "$ENV_FILE" <<EOF
export GITHUB_USERNAME="$GITHUB_USERNAME_VALUE"
export GITHUB_TOKEN="$GITHUB_TOKEN_VALUE"
export GIT_ASKPASS="$ASKPASS_SCRIPT"
export GIT_TERMINAL_PROMPT=0
EOF

  chmod 600 "$ENV_FILE"
}

write_askpass_script() {
  cat > "$ASKPASS_SCRIPT" <<'EOF'
#!/usr/bin/env bash

case "${1:-}" in
  *Username*github.com*)
    printf "%s\n" "${GITHUB_USERNAME:-git}"
    ;;
  *Password*github.com*)
    printf "%s\n" "${GITHUB_TOKEN}"
    ;;
  *)
    exit 1
    ;;
esac
EOF

  chmod 700 "$ASKPASS_SCRIPT"
}

configure_git() {
  if ! command -v git >/dev/null 2>&1; then
    echo "git not found; skipped git configuration" >&2
    return
  fi

  git config --global credential.helper ""
  git config --global core.askPass "$ASKPASS_SCRIPT"
  git config --global credential.username "$GITHUB_USERNAME_VALUE"
}

configure_gh() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "gh not found; skipped gh configuration" >&2
    return
  fi

  if ! GH_TOKEN="$GITHUB_TOKEN_VALUE" gh auth status >/dev/null 2>&1; then
    printf "%s\n" "$GITHUB_TOKEN_VALUE" | gh auth login --hostname github.com --with-token
  fi

  GH_TOKEN="$GITHUB_TOKEN_VALUE" gh auth setup-git
}

update_shell_rc() {
  local start_marker end_marker source_line tmp_file

  if [ "$UPDATE_SHELL_RC" -ne 1 ]; then
    return
  fi

  if [ -z "$SHELL_RC" ]; then
    SHELL_RC="$(detect_shell_rc)"
  fi

  start_marker="# >>> AgentSwarm GitHub auth >>>"
  end_marker="# <<< AgentSwarm GitHub auth <<<"
  source_line="[ -f \"$ENV_FILE\" ] && source \"$ENV_FILE\""

  mkdir -p "$(dirname "$SHELL_RC")"
  touch "$SHELL_RC"

  tmp_file="$(mktemp)"
  awk -v start="$start_marker" -v end="$end_marker" '
    $0 == start { skip = 1; next }
    $0 == end { skip = 0; next }
    !skip { print }
  ' "$SHELL_RC" > "$tmp_file"

  mv "$tmp_file" "$SHELL_RC"

  {
    printf "\n%s\n" "$start_marker"
    printf "%s\n" "$source_line"
    printf "%s\n" "$end_marker"
  } >> "$SHELL_RC"
}

while (($# > 0)); do
  case "$1" in
    --username)
      shift
      GITHUB_USERNAME_VALUE="${1:-}"
      ;;
    --token)
      shift
      GITHUB_TOKEN_VALUE="${1:-}"
      ;;
    --shellrc)
      shift
      SHELL_RC="${1:-}"
      ;;
    --no-shellrc)
      UPDATE_SHELL_RC=0
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

prompt_for_missing_values
write_env_file
write_askpass_script
configure_git
configure_gh
update_shell_rc

echo "Saved GitHub auth env to $ENV_FILE"
echo "Configured git global credentials and askpass helper"
if command -v gh >/dev/null 2>&1; then
  echo "Configured gh auth"
fi
if [ "$UPDATE_SHELL_RC" -eq 1 ]; then
  echo "Updated shell rc: ${SHELL_RC:-$(detect_shell_rc)}"
  echo "Run: source \"$ENV_FILE\""
else
  echo "Run: source \"$ENV_FILE\""
fi
