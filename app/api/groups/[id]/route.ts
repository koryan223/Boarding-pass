import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getGroupById, updateGroup, deleteGroup } from "@/lib/group-management"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!id || id === "undefined") {
      console.error("[v0] GET /api/groups/[id] received invalid id:", id)
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const group = await getGroupById(id)
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 })
    }

    return NextResponse.json({ group })
  } catch (error) {
    console.error("[v0] Get group API error:", error)
    return NextResponse.json({ error: "Failed to fetch group" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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

    const body = await request.json()
    const group = await updateGroup(id, body)
    return NextResponse.json({ group })
  } catch (error) {
    console.error("[v0] Update group API error:", error)
    return NextResponse.json({ error: "Failed to update group" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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

    await deleteGroup(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Delete group API error:", error)
    return NextResponse.json({ error: "Failed to delete group" }, { status: 500 })
  }
}
