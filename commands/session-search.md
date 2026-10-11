---
description: Search local OpenCode sessions with the fast full-text index
---

Search my local OpenCode session history for: $ARGUMENTS

Call `session_search` exactly once with:

- `query`: `$ARGUMENTS`
- `days`: `0`
- `limit`: `10`
- `role`: `both`
- `includeSubagents`: `false`

Show the matching title, date, directory, a short matching snippet, and the resume command. Do not call `session_transcript` unless I ask to inspect a specific result.
