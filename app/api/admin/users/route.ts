import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const supabase = await createServerClient()

    // Verify admin role
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

    const adminClient = createAdminClient()
    const { data: users, error } = await adminClient
      .from("user_roles")
      .select("id, role, location_id, created_at, updated_at, locations(name)")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching users:", error)
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
    }

    console.log("[v0] Fetched users from database:", users?.length || 0)

    // Get user emails from auth.users using admin client
    const usersWithEmails = await Promise.all(
      users.map(async (user: any) => {
        const { data: authUser } = await adminClient.auth.admin.getUserById(user.id)
        return {
          id: user.id,
          email: authUser?.user?.email || "Unknown",
          role: user.role,
          location_id: user.location_id,
          location_name: user.locations?.name || null,
          created_at: user.created_at,
          updated_at: user.updated_at,
        }
      }),
    )

    console.log("[v0] Users with emails:", usersWithEmails.length)
    return NextResponse.json(usersWithEmails)
  } catch (error) {
    console.error("[v0] Error in users API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
