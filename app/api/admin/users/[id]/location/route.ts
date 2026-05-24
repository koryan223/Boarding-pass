import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerClient()
    const { id } = await params

    // Verify admin role
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

    const { location_id } = await request.json()

    if (location_id !== null && typeof location_id !== "string") {
      return NextResponse.json({ error: "Location ID must be a string or null" }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { data: updateData, error: updateError } = await adminClient
      .from("user_roles")
      .update({ location_id, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()

    if (updateError) {
      console.error("[v0] Error updating user location:", updateError)
      return NextResponse.json({ error: "Failed to update user location" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in location update API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
