import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getAllGroups, createGroup } from "@/lib/group-management"

export async function GET(request: NextRequest) {
  try {
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

    const groups = await getAllGroups()
    return NextResponse.json({ groups })
  } catch (error) {
    console.error("[v0] Groups API error:", error)
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
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
    const { name, description } = body

    if (!name) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 })
    }

    const group = await createGroup(name, description)
    return NextResponse.json({ group }, { status: 201 })
  } catch (error) {
    console.error("[v0] Create group API error:", error)
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 })
  }
}
