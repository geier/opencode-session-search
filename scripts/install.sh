#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
bin_dir="$HOME/.local/bin"

command -v bun >/dev/null || {
  echo "bun is required" >&2
  exit 1
}

mkdir -p "$bin_dir" "$config_dir/plugins" "$config_dir/commands"
chmod +x "$root/bin/session-search"

ln -sfn "$root/bin/session-search" "$bin_dir/session-search"
ln -sfn "$root/plugins/session-search.ts" "$config_dir/plugins/session-search.ts"
ln -sfn "$root/commands/session-search.md" "$config_dir/commands/session-search.md"

if [[ ! -d "$config_dir/node_modules/@opencode-ai/plugin" ]]; then
  bun --cwd "$config_dir" add @opencode-ai/plugin
fi

echo "Installed session-search. Restart OpenCode to load the plugin and slash command."
