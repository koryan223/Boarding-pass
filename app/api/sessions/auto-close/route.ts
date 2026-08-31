import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    const supabase = await createServerClient()

    // Find sessions that have been open for more than 2 hours with no recent swipes.
    // NOTE: The authoritative auto-close now runs server-side via the pg_cron job
    // "auto-close-stale-sessions" (calls auto_close_stale_sessions() every 5 minutes),
    // which works even when no browser is open. This route is a redundant client-side
    // trigger kept in sync at the same 2-hour window.
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    // Get sessions that are still open
    const { data: openSessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("id, started_at")
      .is("ended_at", null)

    if (sessionsError) {
      console.error("[v0] Error fetching open sessions:", sessionsError)
      return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
    }

    if (!openSessions || openSessions.length === 0) {
      return NextResponse.json({
        message: "No open sessions to check",
        closed: 0,
      })
    }

    const sessionsToClose: string[] = []

    // Check each session for recent activity
    for (const session of openSessions) {
      // Get the most recent swipe for this session
      const { data: recentSwipes, error: swipesError } = await supabase
        .from("meal_swipes")
        .select("swiped_at")
        .eq("session_id", session.id)
        .order("swiped_at", { ascending: false })
        .limit(1)

      if (swipesError) {
        console.error(`[v0] Error fetching swipes for session ${session.id}:`, swipesError)
        continue
      }

      // Determine the last activity time
      const lastActivityTime = recentSwipes && recentSwipes.length > 0 ? recentSwipes[0].swiped_at : session.started_at

      // If last activity was more than 2 hours ago, mark for closure
      if (lastActivityTime < cutoff) {
        sessionsToClose.push(session.id)
      }
    }

    // Close the stale sessions
    if (sessionsToClose.length > 0) {
      const { error: updateError } = await supabase
        .from("sessions")
        .update({ ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .in("id", sessionsToClose)

      if (updateError) {
        console.error("[v0] Error closing stale sessions:", updateError)
        return NextResponse.json({ error: "Failed to close sessions" }, { status: 500 })
      }

      console.log(`[v0] Auto-closed ${sessionsToClose.length} stale sessions`)
    }

    return NextResponse.json({
      message: `Auto-closed ${sessionsToClose.length} stale sessions`,
      closed: sessionsToClose.length,
    })
  } catch (error) {
    console.error("[v0] Auto-close sessions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
