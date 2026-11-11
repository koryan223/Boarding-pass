import { type NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createServerClient } from "@/lib/supabase/server"
import { getAllowedLocationIds } from "@/lib/location-access"
import { toCsv } from "@/lib/csv"

const MAX_RANGE_DAYS = 366
const MAX_ROWS = 100_000
const PAGE_SIZE = 1000
const ID_CHUNK = 100
const TIME_ZONE = "America/Chicago"

const STATUS_LABELS: Record<string, string> = {
  success: "Success",
  reentry: "Re-entry",
  insufficient_credits: "Insufficient credits",
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export async function GET(request: NextRequest) {
  let user
  try {
    ;({ user } = await requireRole(["admin", "staff"]))
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const params = request.nextUrl.searchParams
    const from = new Date(params.get("from") ?? "")
    const to = new Date(params.get("to") ?? "")
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      return NextResponse.json({ error: "Choose a valid start and end date" }, { status: 400 })
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
      return NextResponse.json({ error: `Date range can be at most ${MAX_RANGE_DAYS} days` }, { status: 400 })
    }

    const requested = (params.get("locations") ?? "").split(",").map((id) => id.trim()).filter(Boolean)
    const allowed = await getAllowedLocationIds(user.id, user.role)
    const locationIds = allowed === null ? requested : requested.filter((id) => allowed.includes(id))
    if (locationIds.length === 0) {
      return NextResponse.json({ error: "Select at least one location you have access to" }, { status: 403 })
    }

    const admin = createAdminClient()

    const [{ data: locations }, { data: sessions, error: sessionsError }] = await Promise.all([
      admin.from("locations").select("id, name").in("id", locationIds),
      admin
        .from("sessions")
        .select("id, title, location_id")
        .in("location_id", locationIds)
        .lte("started_at", to.toISOString())
        .or(`ended_at.is.null,ended_at.gte.${from.toISOString()}`),
    ])
    if (sessionsError) throw sessionsError

    const locationNames = new Map((locations ?? []).map((l) => [l.id as string, l.name as string]))
    const sessionMap = new Map((sessions ?? []).map((s) => [s.id as string, s]))

    type SwipeRow = { student_uin: string; swiped_at: string; status: string; session_id: string }
    const swipes: SwipeRow[] = []

    for (const ids of chunk([...sessionMap.keys()], ID_CHUNK)) {
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await admin
          .from("meal_swipes")
          .select("student_uin, swiped_at, status, session_id")
          .in("session_id", ids)
          .gte("swiped_at", from.toISOString())
          .lt("swiped_at", to.toISOString())
          .order("swiped_at", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)
        if (error) throw error
        swipes.push(...((data ?? []) as SwipeRow[]))
        if (swipes.length > MAX_ROWS) {
          return NextResponse.json(
            { error: `More than ${MAX_ROWS.toLocaleString()} swipes in this range. Choose a shorter date range.` },
            { status: 400 },
          )
        }
        if (!data || data.length < PAGE_SIZE) break
      }
    }
    swipes.sort((a, b) => a.swiped_at.localeCompare(b.swiped_at))

    const uins = [...new Set(swipes.map((s) => s.student_uin))]
    const students = new Map<string, { first_name: string; last_name: string; meal_plan_type: string | null }>()
    for (const ids of chunk(uins, ID_CHUNK)) {
      const { data, error } = await admin
        .from("students")
        .select("uin, first_name, last_name, meal_plan_type")
        .in("uin", ids)
      if (error) throw error
      for (const s of data ?? []) students.set(s.uin, s)
    }

    const dateFmt = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
    const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit", second: "2-digit" })

    const rows = swipes.map((swipe) => {
      const at = new Date(swipe.swiped_at)
      const session = sessionMap.get(swipe.session_id)
      const student = students.get(swipe.student_uin)
      return [
        dateFmt.format(at),
        timeFmt.format(at),
        swipe.student_uin,
        student?.first_name ?? "",
        student?.last_name ?? "",
        student?.meal_plan_type ?? "",
        session ? (locationNames.get(session.location_id) ?? "") : "",
        session?.title ?? "",
        STATUS_LABELS[swipe.status] ?? swipe.status,
      ]
    })

    const csv = toCsv(
      ["Date", "Time", "UIN", "First Name", "Last Name", "Meal Plan", "Location", "Session", "Status"],
      rows,
    )

    // An export changes no data, so the database cannot record it on its own.
    // If it cannot be recorded, the file is not handed out.
    const supabase = await createServerClient()
    const { error: auditError } = await supabase.rpc("log_audit_event", {
      p_action: "EXPORT",
      p_label: "Meal swipes (CSV)",
      p_details: {
        from: from.toISOString(),
        to: to.toISOString(),
        locations: locationIds.map((id) => locationNames.get(id) ?? id),
        rows: rows.length,
      },
    })
    if (auditError) {
      console.error("[v0] Could not record swipe export in the audit log:", auditError)
      return NextResponse.json(
        { error: "The export could not be recorded in the audit log, so it was not downloaded. Please try again." },
        { status: 500 },
      )
    }

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="meal-swipes.csv"`,
        "Cache-Control": "no-store",
        "X-Row-Count": String(rows.length),
      },
    })
  } catch (error) {
    console.error("[v0] Swipe export error:", error)
    return NextResponse.json({ error: "Export failed. Please try again." }, { status: 500 })
  }
}
