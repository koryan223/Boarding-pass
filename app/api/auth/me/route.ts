import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let roleData = null
  let locationName = null

  // Try new schema with location_id foreign key
  const { data: newSchemaData, error: newSchemaError } = await supabase
    .from("user_roles")
    .select("role, location_id, locations(name)")
    .eq("id", user.id)
    .single()

  if (!newSchemaError && newSchemaData) {
    roleData = newSchemaData
    locationName = (newSchemaData.locations as any)?.name || null
  } else {
    // Fallback to old schema with base_location string
    const { data: oldSchemaData } = await supabase
      .from("user_roles")
      .select("role, base_location")
      .eq("id", user.id)
      .single()

    if (oldSchemaData) {
      roleData = oldSchemaData
      locationName = (oldSchemaData as any).base_location || null

      // If old schema has location name, try to find location_id
      if (locationName) {
        const { data: locationData } = await supabase.from("locations").select("id").eq("name", locationName).single()

        if (locationData) {
          roleData = { ...roleData, location_id: locationData.id }
        }
      }
    }
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: roleData?.role || "dining_station",
    location_id: roleData?.location_id || null,
    location_name: locationName,
  })
}
