import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Helper to get Monday of a week from a date string (YYYY-MM-DD)
function getMonday(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00")
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  return date.toISOString().split("T")[0]
}

// Helper to get current week's Monday
function getCurrentWeekMonday(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  now.setDate(diff)
  return now.toISOString().split("T")[0]
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.log("[v0] Menu API auth error:", authError?.message || "No user")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get("location_id")
    const weekDate = searchParams.get("week_start_date") || getCurrentWeekMonday()

    // Get the user's location if not provided
    let effectiveLocationId = locationId
    if (!effectiveLocationId) {
      const { data: roleData } = await supabase.from("user_roles").select("location_id").eq("id", user.id).single()
      effectiveLocationId = roleData?.location_id || null
    }

    if (!effectiveLocationId) {
      return NextResponse.json([])
    }

    console.log("[v0] Menu GET - location_id:", effectiveLocationId, "week_start_date:", weekDate)

    const { data, error } = await supabase
      .from("menus")
      .select("*")
      .eq("location_id", effectiveLocationId)
      .eq("week_start_date", weekDate)
      .order("day_of_week")
      .order("meal_type")

    if (error) {
      console.log("[v0] Menu fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[v0] Menu GET - found", data?.length || 0, "menus")
    return NextResponse.json(data || [])
  } catch (error) {
    console.error("[v0] Menu API error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is admin or staff
  const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()

  if (!roleData || !["admin", "staff"].includes(roleData.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { day_of_week, meal_type, menu_items, location_id, week_start_date } = await request.json()

  if (!day_of_week || !meal_type || !week_start_date) {
    return NextResponse.json({ error: "day_of_week, meal_type, and week_start_date are required" }, { status: 400 })
  }

  // Try to update existing record
  let query = supabase
    .from("menus")
    .update({
      menu_items,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("day_of_week", day_of_week)
    .eq("meal_type", meal_type)
    .eq("week_start_date", week_start_date)

  if (location_id) {
    query = query.eq("location_id", location_id)
  }

  const { data, error } = await query.select().single()

  // If no row was updated, insert a new one
  if (error && error.code === "PGRST116") {
    const { data: insertData, error: insertError } = await supabase
      .from("menus")
      .insert({
        location_id,
        week_start_date,
        day_of_week,
        meal_type,
        menu_items,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json(insertData)
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is admin or staff
  const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()

  if (!roleData || !["admin", "staff"].includes(roleData.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { menus, location_id, week_start_date } = await request.json()

  if (!Array.isArray(menus)) {
    return NextResponse.json({ error: "menus array is required" }, { status: 400 })
  }

  if (!location_id) {
    return NextResponse.json({ error: "location_id is required" }, { status: 400 })
  }

  if (!week_start_date) {
    return NextResponse.json({ error: "week_start_date is required" }, { status: 400 })
  }

  const menuRecords = menus.map((menu: { day_of_week: string; meal_type: string; menu_items: string }) => ({
    location_id,
    week_start_date,
    day_of_week: menu.day_of_week,
    meal_type: menu.meal_type,
    menu_items: menu.menu_items,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }))

  console.log("[v0] Menu POST - location_id:", location_id, "week_start_date:", week_start_date, "menus count:", menuRecords.length)

  const { error } = await supabase.from("menus").upsert(menuRecords, {
    onConflict: "location_id,week_start_date,day_of_week,meal_type",
    ignoreDuplicates: false,
  })

  if (error) {
    console.log("[v0] Menu upsert error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log("[v0] Menu POST - success")
  return NextResponse.json({ success: true })
}
