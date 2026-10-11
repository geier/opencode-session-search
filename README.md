# OpenCode Session Search

Fast local full-text search across OpenCode sessions. The tool keeps a separate SQLite FTS5 index, exposes a token-free CLI, and adds search tools plus a `/session-search` command to OpenCode.

## Features

- Searches session titles, directories, user messages, and assistant messages.
- Incrementally refreshes only changed sessions before each search.
- Keeps the OpenCode database read-only.
- Filters by age, directory, role, and top-level/subagent session.
- Uses `fzf` to select and resume a session interactively.
- Exposes `session_search` and `session_transcript` to OpenCode.

## Requirements

- OpenCode
- Bun
- `fzf` for interactive selection with `--pick`

## Install

```bash
./scripts/install.sh
session-search --rebuild --sync-only
```

Restart OpenCode after installation.

The installer creates symlinks at:

- `~/.local/bin/session-search`
- `~/.config/opencode/plugins/session-search.ts`
- `~/.config/opencode/commands/session-search.md`

## CLI Usage

Search without using an LLM or tokens:

```bash
session-search "dev dashboard"
session-search "dashboard CVE" --days 7
session-search dashboard --role user --directory dev-dashboard
```

Select a result with `fzf` and resume it in OpenCode:

```bash
session-search "dev dashboard" --pick
```

Useful maintenance commands:

```bash
session-search --sync-only
session-search --rebuild --sync-only
```

Run `session-search --help` for all options.

## OpenCode Usage

After restarting OpenCode:

```text
/session-search dev dashboard
```

Natural-language requests also work because the plugin registers `session_search` and `session_transcript` tools. OpenCode-based searches use model tokens for interpretation and formatting; direct CLI searches do not.

## Storage

The source database is discovered through `OPENCODE_DB_PATH`, the default OpenCode data path, or `opencode db path`. It is always opened read-only.

The generated index defaults to:

```text
~/.cache/opencode/session-search.db
```

Set `OPENCODE_SESSION_SEARCH_INDEX` to use another index path.

## Development

```bash
bun install
bun run check
```

The initial full index build can take a few minutes. Subsequent searches synchronize only sessions whose `time_updated` value changed.
