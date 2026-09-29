import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getStudentById, updateStudent, deleteStudent } from "@/lib/student-management"
import { canAccessLocation, getAllowedLocationIds } from "@/lib/location-access"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log("[v0] Student detail API called for ID:", id)

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

    const student = await getStudentById(id)
    const allowed = await getAllowedLocationIds(user.id, userRole)
    if (!student || !canAccessLocation(allowed, student.base_location_id)) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    return NextResponse.json({ student })
  } catch (error) {
    console.error("[v0] Student detail API error:", error)
    return NextResponse.json({ error: "Failed to fetch student" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log("[v0] Student update API called for ID:", id)

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

    const updates = await request.json()

    const allowed = await getAllowedLocationIds(user.id, userRole)
    const existing = await getStudentById(id)
    if (!existing || !canAccessLocation(allowed, existing.base_location_id)) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    if ("base_location_id" in updates) {
      if (!updates.base_location_id) {
        return NextResponse.json({ error: "Base location is required" }, { status: 400 })
      }
      if (!canAccessLocation(allowed, updates.base_location_id)) {
        return NextResponse.json({ error: "You don't have access to that base location" }, { status: 403 })
      }
    }

    const updatedStudent = await updateStudent(id, updates)

    return NextResponse.json({ student: updatedStudent })
  } catch (error) {
    console.error("[v0] Student update API error:", error)
    return NextResponse.json({ error: "Failed to update student" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log("[v0] Student delete API called for ID:", id)

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

    const { reason } = await request.json()

    const allowed = await getAllowedLocationIds(user.id, userRole)
    const existing = await getStudentById(id)
    if (!existing || !canAccessLocation(allowed, existing.base_location_id)) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    await deleteStudent(id, user.id, user.email || "", userRole, reason)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Student delete API error:", error)
    return NextResponse.json({ error: "Failed to delete student" }, { status: 500 })
  }
}
