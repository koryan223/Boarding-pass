import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// PUT update location
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin role
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()
    if (roleData?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const { name } = await request.json()

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Location name is required" }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data: location, error } = await adminClient
      .from("locations")
      .update({ name: name.trim() })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Location name already exists" }, { status: 400 })
      }
      console.error("[v0] Error updating location:", error)
      return NextResponse.json({ error: "Failed to update location" }, { status: 500 })
    }

    return NextResponse.json(location)
  } catch (error) {
    console.error("[v0] Error in update location API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE location
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin role
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()
    if (roleData?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Note: Students with this base_location_id will have it set to NULL automatically
    // due to ON DELETE SET NULL constraint in the database schema

    const { count: usersCount, error: usersError } = await adminClient
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("location_id", id)

    if (usersError) {
      console.error("[v0] Error checking users for location:", usersError)
      return NextResponse.json({ error: "Failed to check location usage" }, { status: 500 })
    }

    if (usersCount && usersCount > 0) {
      return NextResponse.json({ error: "Cannot delete location with assigned users" }, { status: 400 })
    }

    const { error } = await adminClient.from("locations").delete().eq("id", id)

    if (error) {
      console.error("[v0] Error deleting location:", error)
      return NextResponse.json({ error: "Failed to delete location" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in delete location API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
