import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerClient()
    const { id } = await params

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

    const { location_id, enabled } = await request.json()
    if (typeof location_id !== "string" || !location_id || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "location_id (string) and enabled (boolean) are required" }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { data: target } = await adminClient.from("user_roles").select("role").eq("id", id).maybeSingle()
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    if (!["staff", "dining_station"].includes(target.role)) {
      return NextResponse.json(
        { error: "Location access only applies to staff and dining station users" },
        { status: 400 },
      )
    }

    const { error } = enabled
      ? await adminClient
          .from("user_location_access")
          .upsert({ user_id: id, location_id }, { onConflict: "user_id,location_id", ignoreDuplicates: true })
      : await adminClient.from("user_location_access").delete().eq("user_id", id).eq("location_id", location_id)

    if (error) {
      console.error("[v0] Error updating location access:", error)
      return NextResponse.json({ error: "Failed to update location access" }, { status: 500 })
    }

    const { data: rows } = await adminClient.from("user_location_access").select("location_id").eq("user_id", id)

    return NextResponse.json({
      success: true,
      access_location_ids: (rows || []).map((r: { location_id: string }) => r.location_id),
    })
  } catch (error) {
    console.error("[v0] Error in location access API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
