import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { AUDIT_ACTION_LABELS, AUDIT_AREA_LABELS, type AuditEntry, type AuditLogPage } from "@/lib/audit-log"

const PAGE_SIZE = 50
const MAX_SEARCH_LENGTH = 100
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLUMNS =
  "id, occurred_at, actor_type, actor_id, actor_email, actor_role, action, table_name, record_id, record_label, changed_fields, old_data, new_data, metadata"

const NAME_SOURCES = [
  { fields: ["group_id"], table: "groups", column: "name" },
  { fields: ["location_id", "base_location_id"], table: "locations", column: "name" },
  { fields: ["session_id"], table: "sessions", column: "title" },
]

type ServerClient = Awaited<ReturnType<typeof createServerClient>>

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

async function lookUpNames(supabase: ServerClient, entries: AuditEntry[]) {
  const names: Record<string, string> = {}

  await Promise.all(
    NAME_SOURCES.map(async (source) => {
      const ids = new Set<string>()
      for (const entry of entries) {
        for (const data of [entry.old_data, entry.new_data]) {
          for (const field of source.fields) {
            const value = data?.[field]
            if (typeof value === "string" && UUID.test(value)) ids.add(value)
          }
        }
      }
      if (ids.size === 0) return

      const { data } = await supabase.from(source.table).select(`id, ${source.column}`).in("id", [...ids])
      for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
        const name = row[source.column]
        if (typeof row.id === "string" && typeof name === "string" && name) names[row.id] = name
      }
    }),
  )

  return names
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()
    if (roleData?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const params = request.nextUrl.searchParams

    // Read with the admin's own session, so the database's admin-only rule
    // applies here as well as the role check above.
    let query = supabase.from("audit_log").select(COLUMNS).order("id", { ascending: false }).limit(PAGE_SIZE + 1)

    const cursor = params.get("cursor")
    if (cursor !== null) {
      const before = Number(cursor)
      if (!Number.isSafeInteger(before) || before <= 0) return badRequest("Invalid cursor")
      query = query.lt("id", before)
    }

    const actor = params.get("actor")
    if (actor === "system") {
      query = query.is("actor_id", null)
    } else if (actor !== null) {
      if (!UUID.test(actor)) return badRequest("Invalid user")
      query = query.eq("actor_id", actor)
    }

    const action = params.get("action")
    if (action !== null) {
      if (!Object.hasOwn(AUDIT_ACTION_LABELS, action)) return badRequest("Invalid action")
      query = query.eq("action", action)
    }

    const area = params.get("area")
    if (area !== null) {
      if (!Object.hasOwn(AUDIT_AREA_LABELS, area)) return badRequest("Invalid area")
      query = query.eq("table_name", area)
    }

    const from = params.get("from")
    if (from !== null) {
      const date = new Date(from)
      if (Number.isNaN(date.getTime())) return badRequest("Invalid start date")
      query = query.gte("occurred_at", date.toISOString())
    }

    const to = params.get("to")
    if (to !== null) {
      const date = new Date(to)
      if (Number.isNaN(date.getTime())) return badRequest("Invalid end date")
      query = query.lt("occurred_at", date.toISOString())
    }

    // Quotes and backslashes would end the quoted value in the filter below.
    const search = (params.get("q") ?? "").replace(/["\\]/g, "").trim().slice(0, MAX_SEARCH_LENGTH)
    if (search) {
      const pattern = `"*${search}*"`
      query = query.or(`record_label.ilike.${pattern},record_id.ilike.${pattern},actor_email.ilike.${pattern}`)
    }

    const { data, error } = await query
    if (error) {
      console.error("[v0] Error reading audit log:", error)
      return NextResponse.json({ error: "Failed to load the audit log" }, { status: 500 })
    }

    const rows = (data ?? []) as unknown as AuditEntry[]
    const entries = rows.slice(0, PAGE_SIZE)
    const page: AuditLogPage = {
      entries,
      nextCursor: rows.length > PAGE_SIZE ? entries[entries.length - 1].id : null,
      names: await lookUpNames(supabase, entries),
    }

    return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[v0] Error in audit log API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
