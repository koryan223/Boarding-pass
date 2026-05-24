import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getStudentAnalytics } from "@/lib/student-management"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log("[v0] Student analytics API called for ID:", id)

    const supabase = await createServerClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check user role
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()

    const userRole = roleData?.role
    if (!userRole || !["admin", "staff"].includes(userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get("month")

    const analytics = await getStudentAnalytics(id, month || undefined)

    console.log("[v0] Analytics data returned:", JSON.stringify(analytics, null, 2))

    return NextResponse.json({ analytics })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[v0] Student analytics API error:", errorMessage)
    return NextResponse.json({ error: errorMessage || "Failed to fetch analytics" }, { status: 500 })
  }
}
