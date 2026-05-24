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

    console.log("[v0] Role update request - User ID:", user?.id)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()

    console.log("[v0] Current user role:", roleData?.role)

    if (roleData?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const { role } = await request.json()

    console.log("[v0] Updating user ID:", id, "to role:", role)

    // Validate role
    if (!["admin", "staff", "dining_station"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    // Prevent admin from removing their own admin role
    if (id === user.id && role !== "admin") {
      return NextResponse.json({ error: "Cannot remove your own admin role" }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { data: updateData, error: updateError } = await adminClient
      .from("user_roles")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()

    if (updateError) {
      console.error("[v0] Error updating user role:", updateError)
      return NextResponse.json({ error: "Failed to update user role" }, { status: 500 })
    }

    console.log("[v0] Role update successful:", updateData)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in role update API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
