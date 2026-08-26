import { createServerClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[SERVER][v0] Manual meal credit reset API called")

    const supabase = await createServerClient()

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.log("[SERVER][v0] User authentication failed:", userError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[SERVER][v0] User authenticated:", user.id)

    // Check if user has admin or staff role
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (roleError || !userRole || !["admin", "staff"].includes(userRole.role)) {
      console.log("[SERVER][v0] User does not have required permissions:", userRole?.role, "Error:", roleError)
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    console.log("[SERVER][v0] User has permission to reset credits:", userRole.role)

    console.log("[SERVER][v0] About to call reset_weekly_credits function")

    // Parameter names must match the SQL function signature exactly:
    // reset_weekly_credits(p_reset_type text, p_user_id uuid) returns integer
    const { data: resetResult, error: resetError } = await supabase.rpc("reset_weekly_credits", {
      p_reset_type: "manual",
      p_user_id: user.id,
    })

    console.log("[SERVER][v0] Reset function result:", resetResult)

    if (resetError) {
      console.log("[SERVER][v0] Reset function error details:", JSON.stringify(resetError, null, 2))
      return NextResponse.json({ error: "Failed to reset meal credits" }, { status: 500 })
    }

    // The function returns the number of students affected (an integer),
    // not an object, so read it directly.
    const studentsUpdated = typeof resetResult === "number" ? resetResult : 0

    console.log("[SERVER][v0] Meal credits reset successfully. Students updated:", studentsUpdated)

    return NextResponse.json({
      success: true,
      message: `Reset weekly credits for ${studentsUpdated} student${studentsUpdated === 1 ? "" : "s"} on standard meal plans. Prepaid balances were not changed.`,
      studentsUpdated,
    })
  } catch (error) {
    console.error("[SERVER][v0] Unexpected error in reset API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
