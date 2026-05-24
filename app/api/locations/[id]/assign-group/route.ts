import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: locationId } = await params
    const supabase = await createServerClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log("[v0] Assign location: Unauthorized")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check user role
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()

    const userRole = roleData?.role
    if (!userRole || userRole !== "admin") {
      console.log("[v0] Assign location: Forbidden - user role:", userRole)
      return NextResponse.json({ error: "Only admins can assign locations to groups" }, { status: 403 })
    }

    const body = await request.json()
    const { group_id } = body

    console.log("[v0] Assign location API called:", { locationId, group_id })

    if (group_id !== null && !group_id) {
      return NextResponse.json({ error: "Group ID is required" }, { status: 400 })
    }

    // Verify the location exists
    const { data: location, error: locationError } = await supabase
      .from("locations")
      .select("*")
      .eq("id", locationId)
      .single()

    if (locationError || !location) {
      console.log("[v0] Location not found:", locationError)
      return NextResponse.json({ error: "Location not found" }, { status: 404 })
    }

    if (group_id === null) {
      // Remove location from all students that have this location assigned
      const { data, error: updateError } = await supabase
        .from("students")
        .update({
          base_location_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("base_location_id", locationId)
        .select()

      if (updateError) {
        console.error("[v0] Error unassigning location:", updateError)
        return NextResponse.json({ error: "Failed to unassign location" }, { status: 500 })
      }

      console.log("[v0] Location unassigned from", data?.length || 0, "students")

      return NextResponse.json({
        success: true,
        message: `Unassigned ${location.name} from ${data?.length || 0} students`,
        students_updated: data?.length || 0,
      })
    }

    // Verify the group exists
    const { data: group, error: groupError } = await supabase.from("groups").select("*").eq("id", group_id).single()

    if (groupError || !group) {
      console.log("[v0] Group not found:", groupError)
      return NextResponse.json({ error: "Group not found" }, { status: 404 })
    }

    console.log("[v0] Assigning location", location.name, "to group", group.name)

    // Update all students in the group with the base location
    const { data, error: updateError } = await supabase
      .from("students")
      .update({
        base_location_id: locationId,
        updated_at: new Date().toISOString(),
      })
      .eq("group_id", group_id)
      .select()

    if (updateError) {
      console.error("[v0] Error assigning location to group:", updateError)
      return NextResponse.json({ error: "Failed to assign location to group" }, { status: 500 })
    }

    console.log("[v0] Successfully assigned location to", data?.length || 0, "students")

    return NextResponse.json({
      success: true,
      message: `Assigned ${location.name} to ${data?.length || 0} students in group ${group.name}`,
      students_updated: data?.length || 0,
    })
  } catch (error) {
    console.error("[v0] Assign location to group API error:", error)
    return NextResponse.json({ error: "Failed to assign location to group" }, { status: 500 })
  }
}
