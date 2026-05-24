import { type NextRequest, NextResponse } from "next/server"
import { getSessionSwipesTextOnly } from "@/lib/meal-swipes"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")

    if (!sessionId) {
      return NextResponse.json({ success: false, message: "Session ID is required" }, { status: 400 })
    }

    const swipes = await getSessionSwipesTextOnly(sessionId)

    const supabase = await createClient()
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
