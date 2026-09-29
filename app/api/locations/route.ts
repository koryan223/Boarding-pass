import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAllowedLocationIds } from "@/lib/location-access"

// GET all locations. Pass `?accessible=1` to limit the list to locations the
// current user has been granted (admins still receive every location).
export async function GET(request: Request) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const onlyAccessible = new URL(request.url).searchParams.get("accessible") === "1"

    let query = adminClient.from("locations").select("*").order("name", { ascending: true })

    if (onlyAccessible) {
      const { data: roleData } = await adminClient.from("user_roles").select("role").eq("id", user.id).single()
      const allowed = await getAllowedLocationIds(user.id, roleData?.role)
      if (allowed !== null) {
        if (allowed.length === 0) {
          return NextResponse.json({ success: true, locations: [] })
        }
        query = query.in("id", allowed)
      }
    }

    const { data: locations, error } = await query

    if (error) {
      console.error("[v0] Error fetching locations:", error)
      return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 })
    }

    return NextResponse.json({ success: true, locations: locations || [] })
  } catch (error) {
    console.error("[v0] Error in locations API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST create new location
export async function POST(request: Request) {
  try {
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
      .insert({ name: name.trim() })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Location already exists" }, { status: 400 })
      }
      console.error("[v0] Error creating location:", error)
      return NextResponse.json({ error: "Failed to create location" }, { status: 500 })
    }

    return NextResponse.json({ success: true, location: location })
  } catch (error) {
    console.error("[v0] Error in create location API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
