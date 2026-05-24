import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getGroupAnalytics } from "@/lib/group-management"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { searchParams } = new URL(request.url)
    const month = searchParams.get("month")

    const analytics = await getGroupAnalytics(id, month ? Number.parseInt(month) : undefined)
    return NextResponse.json({ analytics })
  } catch (error) {
    console.error("[v0] Group analytics API error:", error)
    return NextResponse.json({ error: "Failed to fetch group analytics" }, { status: 500 })
  }
}
