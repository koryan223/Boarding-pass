import { type NextRequest, NextResponse } from "next/server"
import { getSessionSwipesTextOnly } from "@/lib/meal-swipes"
import { createClient } from "@/lib/supabase/server"
import { canAccessLocation, getAllowedLocationIds } from "@/lib/location-access"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")

    if (!sessionId) {
      return NextResponse.json({ success: false, message: "Session ID is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const [{ data: roleData }, { data: sessionRow }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("id", user.id).single(),
      supabase.from("sessions").select("location_id").eq("id", sessionId).single(),
    ])
    if (!sessionRow) {
      return NextResponse.json({ success: false, message: "Session not found" }, { status: 404 })
    }

    const allowed = await getAllowedLocationIds(user.id, roleData?.role)
    if (!canAccessLocation(allowed, sessionRow.location_id)) {
      return NextResponse.json(
        { success: false, message: "You don't have access to this session's location" },
        { status: 403 },
      )
    }

    const swipes = await getSessionSwipesTextOnly(sessionId)

    const { data: resumes, error: resumesError } = await supabase
      .from("session_resumes")
      .select("*")
      .eq("session_id", sessionId)
      .order("resumed_at", { ascending: true })

    if (resumesError) {
      console.error("[v0] Error fetching session resumes:", resumesError)
    }

    console.log("[v0] API returning swipes count:", swipes?.length)
    if (swipes && swipes.length > 0) {
      console.log("[v0] API first swipe full object:", JSON.stringify(swipes[0]))
    }

    return NextResponse.json({ success: true, swipes, resumes: resumes || [] })
  } catch (error) {
    console.error("Session swipes error:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}
