import { type Plugin, tool } from "@opencode-ai/plugin"
import { Database } from "bun:sqlite"
import { spawnSync } from "node:child_process"
import { join } from "node:path"

const MAX_QUERY_LENGTH = 200
const MAX_RESULTS = 25
const MAX_TRANSCRIPT_ENTRIES = 200
let databasePath: string | undefined

type SearchArgs = {
  query: string
  days: number
  limit: number
  directory?: string
  role: "both" | "user" | "assistant"
  includeSubagents: boolean
}

function resolveDatabasePath() {
  if (process.env.OPENCODE_DB_PATH) return process.env.OPENCODE_DB_PATH

  const result = spawnSync("opencode", ["db", "path"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
  const path = result.status === 0 ? result.stdout.trim() : ""
  return path || join(process.env.HOME || "", ".local", "share", "opencode", "opencode.db")
}

function openDatabase() {
  databasePath ??= resolveDatabasePath()
  return new Database(databasePath, {
    readonly: true,
    create: false,
    strict: true,
  })
}

function searchIndexedSessions(args: SearchArgs) {
  const command = join(process.env.HOME || "", ".local", "bin", "session-search")
  const commandArgs = [
    args.query,
    "--json",
    "--days",
    String(args.days),
    "--limit",
    String(args.limit),
    "--role",
    args.role,
  ]
  if (args.directory) commandArgs.push("--directory", args.directory)
  if (args.includeSubagents) commandArgs.push("--include-subagents")

  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000,
  })
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `session-search exited with status ${result.status}`)
  }
  return result.stdout.trim()
}

function isoTime(value: number) {
  return new Date(value).toISOString()
}

function getSessionTranscript(args: {
  sessionId: string
  limit: number
  order: "asc" | "desc"
  role: "both" | "user" | "assistant"
}) {
  const db = openDatabase()
  try {
    const session = db
      .query(
        `SELECT id, title, directory, time_created, time_updated
         FROM session WHERE id = ? LIMIT 1`,
      )
      .get(args.sessionId) as
      | { id: string; title: string; directory: string; time_created: number; time_updated: number }
      | null

    if (!session) return { found: false, sessionId: args.sessionId, entries: [] }

    const roleFilter = args.role === "both" ? "" : "AND json_extract(m.data, '$.role') = ?"
    const roleParams = args.role === "both" ? [] : [args.role]
    const rows = db
      .query(
        `SELECT
           p.id,
           p.time_created,
           json_extract(m.data, '$.role') AS role,
           json_extract(p.data, '$.text') AS text
         FROM part p
         JOIN message m ON m.id = p.message_id
         WHERE p.session_id = ?
           AND json_extract(p.data, '$.type') = 'text'
           AND json_extract(m.data, '$.role') IN ('user', 'assistant')
           ${roleFilter}
           AND length(trim(json_extract(p.data, '$.text'))) > 0
         ORDER BY p.time_created ${args.order === "desc" ? "DESC" : "ASC"}
         LIMIT ?`,
      )
      .all(args.sessionId, ...roleParams, args.limit) as Array<{
      id: string
      time_created: number
      role: string
      text: string
    }>

    return {
      found: true,
      session: {
        sessionId: session.id,
        title: session.title,
        directory: session.directory,
        created: isoTime(session.time_created),
        updated: isoTime(session.time_updated),
        resumeCommand: `opencode -s ${session.id}`,
      },
      entries: rows.map((row) => ({
        partId: row.id,
        role: row.role,
        time: isoTime(row.time_created),
        text: row.text.slice(0, 4000),
      })),
    }
  } finally {
    db.close()
  }
}

export const SessionSearchPlugin: Plugin = async () => ({
  tool: {
    session_search: tool({
      description:
        "Search local OpenCode session titles and full user/assistant message history. Use this when the user asks to find previous work or a past conversation. Read-only.",
      args: {
        query: tool.schema.string().trim().min(1).max(MAX_QUERY_LENGTH),
        days: tool.schema.number().int().min(0).max(3650).default(0).describe("Age in days; 0 searches all history."),
        limit: tool.schema.number().int().min(1).max(MAX_RESULTS).default(10),
        directory: tool.schema.string().trim().max(500).optional().describe("Optional directory substring."),
        role: tool.schema.enum(["both", "user", "assistant"]).default("both"),
        includeSubagents: tool.schema.boolean().default(false),
      },
      async execute(args) {
        return searchIndexedSessions(args)
      },
    }),
    session_transcript: tool({
      description:
        "Read the text transcript of one local OpenCode session returned by session_search. Read-only.",
      args: {
        sessionId: tool.schema.string().trim().min(5),
        limit: tool.schema.number().int().min(1).max(MAX_TRANSCRIPT_ENTRIES).default(100),
        order: tool.schema.enum(["asc", "desc"]).default("asc"),
        role: tool.schema.enum(["both", "user", "assistant"]).default("both"),
      },
      async execute(args) {
        return JSON.stringify(getSessionTranscript(args), null, 2)
      },
    }),
  },
})

export default SessionSearchPlugin
