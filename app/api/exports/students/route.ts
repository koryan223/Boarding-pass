import { type NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createServerClient } from "@/lib/supabase/server"
import { canAccessLocation, getAllowedLocationIds } from "@/lib/location-access"
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows"
import { toCsv } from "@/lib/csv"

const MAX_STUDENTS = 50_000

// The same columns, in the same order, as the student import file.
const HEADERS = ["UIN", "Fname", "Lname", "room_number", "meal_plan", "base_location", "meal_plan_type", "group"]

type StudentRow = {
  uin: string
  first_name: string
  last_name: string
  room_number: string | null
  meal_plan: number
  meal_plan_type: string | null
  base_location_id: string | null
  groups: { name: string } | null
}

export async function POST(request: NextRequest) {
  let user
  try {
    ;({ user } = await requireRole(["admin", "staff"]))
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    const uins: unknown = body?.uins
    if (
      !Array.isArray(uins) ||
      uins.length === 0 ||
      uins.length > MAX_STUDENTS ||
      !uins.every((uin) => typeof uin === "string")
    ) {
      return NextResponse.json({ error: "There are no students to export" }, { status: 400 })
    }
    const requested = new Set<string>(uins)

    const admin = createAdminClient()
    const [allowed, { data: locations, error: locationsError }, students] = await Promise.all([
      getAllowedLocationIds(user.id, user.role),
      admin.from("locations").select("id, name"),
      fetchAllRows((from, to) =>
        admin
          .from("students")
          .select("uin, first_name, last_name, room_number, meal_plan, meal_plan_type, base_location_id, groups(name)", {
            count: "exact",
          })
          .order("last_name", { ascending: true })
          .order("uin", { ascending: true })
          .range(from, to),
      ) as Promise<unknown> as Promise<StudentRow[]>,
    ])
    if (locationsError) throw locationsError

    const locationNames = new Map((locations ?? []).map((l) => [l.id as string, l.name as string]))
    const accessible = students.filter((student) => canAccessLocation(allowed, student.base_location_id))
    const exported = accessible.filter((student) => requested.has(student.uin))
    if (exported.length === 0) {
      return NextResponse.json({ error: "None of these students could be exported" }, { status: 400 })
    }

    const rows = exported.map((student) => [
      student.uin,
      student.first_name,
      student.last_name,
      student.room_number ?? "",
      student.meal_plan,
      student.base_location_id ? (locationNames.get(student.base_location_id) ?? "") : "",
      student.meal_plan_type ?? (student.meal_plan === 0 ? "count" : "standard"),
      student.groups?.name ?? "",
    ])
    const csv = toCsv(HEADERS, rows)

    // An export changes no data, so the database cannot record it on its own.
    // If it cannot be recorded, the file is not handed out.
    const supabase = await createServerClient()
    const { error: auditError } = await supabase.rpc("log_audit_event", {
      p_action: "EXPORT",
      p_label: "Students (CSV)",
      p_details: { rows: rows.length, students_available: accessible.length },
    })
    if (auditError) {
      console.error("[v0] Could not record student export in the audit log:", auditError)
      return NextResponse.json(
        { error: "The export could not be recorded in the audit log, so it was not downloaded. Please try again." },
        { status: 500 },
      )
    }

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="students.csv"`,
        "Cache-Control": "no-store",
        "X-Row-Count": String(rows.length),
      },
    })
  } catch (error) {
    console.error("[v0] Student export error:", error)
    return NextResponse.json({ error: "Export failed. Please try again." }, { status: 500 })
  }
}
