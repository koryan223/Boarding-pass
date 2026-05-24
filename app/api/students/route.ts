import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getAllStudents, searchStudents } from "@/lib/student-management"

function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj)
  } catch {
    return String(obj)
  }
}

async function checkAuthWithRetry(supabase: any, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) {
        const errorMsg = safeStringify(authError)
        // Check if it's a rate limit error
        if (errorMsg.includes("Too Many") || errorMsg.includes("rate limit") || errorMsg.includes("429")) {
          if (attempt < maxRetries) {
            console.log(`[v0] Rate limit hit, retrying (${attempt}/${maxRetries})...`)
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
            continue
          }
        }
        return { user: null, error: authError }
      }

      return { user, error: null }
    } catch (err) {
      const errorMsg = safeStringify(err)
      if (
        (errorMsg.includes("Too Many") || errorMsg.includes("rate limit") || errorMsg.includes("429")) &&
        attempt < maxRetries
      ) {
        console.log(`[v0] Rate limit exception, retrying (${attempt}/${maxRetries})...`)
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
        continue
      }
      throw err
    }
  }
  return { user: null, error: new Error("Max retries exceeded") }
}

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Students API called")

    const supabase = await createServerClient()

    const { user, error: authError } = await checkAuthWithRetry(supabase)

    if (authError || !user) {
      console.log("[v0] Authentication failed:", safeStringify(authError))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check user role
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()

    const userRole = roleData?.role
    if (!userRole || !["admin", "staff"].includes(userRole)) {
      console.log("[v0] Insufficient permissions:", userRole)
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    console.log("[v0] User authorized:", userRole)

    // Get search query and filters if provided
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")
    const groupId = searchParams.get("group_id")
    const baseLocationId = searchParams.get("base_location_id")

    let students
    if (query) {
      console.log("[v0] Searching students with query:", query)
      students = await searchStudents(query)
    } else if (groupId) {
      console.log("[v0] Fetching students for group:", groupId)
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("group_id", groupId)
        .order("last_name", { ascending: true })

      if (error) {
        throw error
      }
      students = data || []
    } else if (baseLocationId) {
      console.log("[v0] Fetching students for base location:", baseLocationId)
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("base_location_id", baseLocationId)
        .order("last_name", { ascending: true })

      if (error) {
        throw error
      }
      students = data || []
    } else {
      console.log("[v0] Fetching all students")
      students = await getAllStudents()
    }

    console.log("[v0] Found students:", students.length)
    return NextResponse.json({ students })
  } catch (error) {
    console.error("[v0] Students API error:", safeStringify(error))
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Create student API called")

    const supabase = await createServerClient()

    const { user, error: authError } = await checkAuthWithRetry(supabase)

    if (authError || !user) {
      console.log("[v0] Authentication failed:", safeStringify(authError))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check user role
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()

    const userRole = roleData?.role
    if (!userRole || !["admin", "staff"].includes(userRole)) {
      console.log("[v0] Insufficient permissions:", userRole)
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    console.log("[v0] User authorized:", userRole)

    // Parse request body
    const body = await request.json()
    const { uin, first_name, last_name, room_number, meal_plan, meal_plan_type = "standard", group_id } = body

    // Validate required fields - meal_plan not required for count plans
    if (!uin || !first_name || !last_name) {
      return NextResponse.json({ error: "UIN and name are required" }, { status: 400 })
    }

    if (!/^\d{2,9}$/.test(uin)) {
      return NextResponse.json({ error: "UIN must be 2-9 digits" }, { status: 400 })
    }

    if (!["standard", "count", "prepaid"].includes(meal_plan_type)) {
      return NextResponse.json({ error: "Invalid meal plan type" }, { status: 400 })
    }

    if (meal_plan_type === "standard" || meal_plan_type === "prepaid") {
      if (!meal_plan || !Number.isInteger(meal_plan) || meal_plan <= 0) {
        return NextResponse.json({ error: "Meal plan must be a positive integer for standard and prepaid plans" }, { status: 400 })
      }
    }

    console.log("[v0] Creating student:", { uin, first_name, last_name, room_number, meal_plan, meal_plan_type })

    const { data: existingStudent } = await supabase.from("students").select("uin").eq("uin", uin).maybeSingle()

    if (existingStudent) {
      return NextResponse.json({ error: "Student with this UIN already exists" }, { status: 409 })
    }

    // For prepaid plans, meal_plan stores total purchased, weekly_credits stores remaining
    // For standard plans, meal_plan is weekly allowance and weekly_credits starts at that value
    // For count plans, both are 0
    const mealPlanValue = meal_plan_type === "count" ? 0 : meal_plan
    const weeklyCreditsValue = meal_plan_type === "count" ? 0 : meal_plan

    const { data: newStudent, error: insertError } = await supabase
      .from("students")
      .insert({
        uin,
        first_name,
        last_name,
        room_number: room_number?.trim() || null,
        meal_plan: mealPlanValue,
        weekly_credits: weeklyCreditsValue,
        meal_plan_type: meal_plan_type,
        photo_url: "/placeholder.svg?height=150&width=150",
        group_id: group_id || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error("[v0] Error creating student:", insertError)
      return NextResponse.json({ error: "Failed to create student" }, { status: 500 })
    }

    console.log("[v0] Student created successfully:", newStudent.uin)
    return NextResponse.json({ student: newStudent }, { status: 201 })
  } catch (error) {
    console.error("[v0] Create student API error:", safeStringify(error))
    return NextResponse.json({ error: "Failed to create student" }, { status: 500 })
  }
}
