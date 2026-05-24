import { createClient } from "@/lib/supabase/client"

export type Session = {
  id: string
  user_id: string
  title: string
  description?: string
  started_at: string
  ended_at?: string
  created_at: string
  updated_at: string
  reentry_enabled?: boolean
  location_id?: string
  location_name?: string
  swipe_count?: number
}

export type SessionResume = {
  id: string
  session_id: string
  user_id: string
  resumed_at: string
  created_at: string
}

export async function startSession(
  title: string,
  reentryEnabled = false,
  locationId?: string,
): Promise<{ data: Session | null; error: string | null }> {
  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: "User not authenticated" }
    }

    let result = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        title,
        started_at: new Date().toISOString(),
        reentry_enabled: reentryEnabled,
        location_id: locationId || null,
      })
      .select(`
        *,
        locations (
          name
        )
      `)
      .single()

    // If error mentions reentry_enabled column, try without it
    if (result.error && result.error.message.includes("reentry_enabled")) {
      console.log("[v0] reentry_enabled column not found, inserting without it")
      result = await supabase
        .from("sessions")
        .insert({
          user_id: user.id,
          title,
          started_at: new Date().toISOString(),
          location_id: locationId || null,
        })
        .select(`
          *,
          locations (
            name
          )
        `)
        .single()
    }

    if (result.error) {
      console.log("[v0] startSession database error:", result.error)
      return { data: null, error: result.error.message }
    }

    const sessionWithLocation = {
      ...result.data,
      location_name: (result.data as any).locations?.name || null,
    }

    return { data: sessionWithLocation, error: null }
  } catch (error) {
    console.log("[v0] startSession exception:", error)
    return { data: null, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function endSession(sessionId: string, description?: string): Promise<{ error: string | null }> {
  const supabase = createClient()

  try {
    const endTime = new Date()

    const { error } = await supabase
      .from("sessions")
      .update({
        ended_at: endTime.toISOString(),
        description: description || null,
      })
      .eq("id", sessionId)

    if (error) {
      return { error: error.message }
    }

    return { error: null }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function getCurrentSession(): Promise<{ data: Session | null; error: string | null }> {
  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: "User not authenticated" }
    }

    const { data, error } = await supabase
      .from("sessions")
      .select(`
        *,
        locations (
          name
        )
      `)
      .eq("user_id", user.id)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return { data: null, error: error.message }
    }

    const sessionWithLocation = data
      ? {
          ...data,
          location_name: (data as any).locations?.name || null,
        }
      : null

    return { data: sessionWithLocation, error: null }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function getUserSessions(): Promise<{ data: Session[] | null; error: string | null }> {
  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: "User not authenticated" }
    }

    const { data, error } = await supabase
      .from("sessions")
      .select(`
        *,
        locations (
          name
        ),
        meal_swipes (count)
      `)
      .order("started_at", { ascending: false })

    if (error) {
      return { data: null, error: error.message }
    }

    const sessionsWithLocation = data?.map((session: any) => ({
      ...session,
      location_name: session.locations?.name || null,
      swipe_count: session.meal_swipes?.[0]?.count || 0,
    }))

    return { data: sessionsWithLocation, error: null }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function getAllOpenSessions(): Promise<{ data: Session[] | null; error: string | null }> {
  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: "User not authenticated" }
    }

    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .is("ended_at", null)
      .order("started_at", { ascending: false })

    if (error) {
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function joinSession(sessionId: string): Promise<{ data: Session | null; error: string | null }> {
  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: "User not authenticated" }
    }

    const { data, error } = await supabase.from("sessions").select("*").eq("id", sessionId).single()

    if (error) {
      return { data: null, error: error.message }
    }

    await supabase.from("session_resumes").insert({
      session_id: sessionId,
      user_id: user.id,
      resumed_at: new Date().toISOString(),
    })

    return { data, error: null }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function getSessionSwipeCount(sessionId: string): Promise<{ count: number; error: string | null }> {
  const supabase = createClient()

  try {
    const { count, error } = await supabase
      .from("meal_swipes")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId)

    if (error) {
      return { count: 0, error: error.message }
    }

    return { count: count || 0, error: null }
  } catch (error) {
    return { count: 0, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function autoCloseStaleSessions(): Promise<void> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return
    }

    const response = await fetch("/api/sessions/auto-close", {
      method: "POST",
    })

    if (!response.ok) {
      return
    }
  } catch (error) {
    return
  }
}

export async function deleteSession(sessionId: string): Promise<{ error: string | null }> {
  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { error: "User not authenticated" }
    }

    const { error } = await supabase.from("sessions").delete().eq("id", sessionId)

    if (error) {
      return { error: error.message }
    }

    return { error: null }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export interface AffectedStudent {
  uin: string
  name: string
  credits_to_restore: number
  is_count_plan: boolean
}

export function isWithinCurrentWeeklyPeriod(sessionStartedAt: string): boolean {
  const now = new Date()
  const sessionDate = new Date(sessionStartedAt)

  const centralNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }))
  const centralSession = new Date(sessionDate.toLocaleString("en-US", { timeZone: "America/Chicago" }))

  const lastReset = new Date(centralNow)
  const dayOfWeek = lastReset.getDay()

  const daysToSunday = dayOfWeek
  lastReset.setDate(lastReset.getDate() - daysToSunday)
  lastReset.setHours(23, 45, 0, 0)

  if (centralNow < lastReset) {
    lastReset.setDate(lastReset.getDate() - 7)
  }

  return centralSession >= lastReset
}

export async function getSessionAffectedStudents(sessionId: string): Promise<{
  data: AffectedStudent[] | null
  totalCredits: number
  totalCountSwipes: number
  canRestoreCredits: boolean
  error: string | null
}> {
  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return {
        data: null,
        totalCredits: 0,
        totalCountSwipes: 0,
        canRestoreCredits: false,
        error: "User not authenticated",
      }
    }

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("started_at")
      .eq("id", sessionId)
      .single()

    if (sessionError || !session) {
      return {
        data: null,
        totalCredits: 0,
        totalCountSwipes: 0,
        canRestoreCredits: false,
        error: sessionError?.message || "Session not found",
      }
    }

    const canRestoreCredits = isWithinCurrentWeeklyPeriod(session.started_at)

    const { data: swipes, error: swipesError } = await supabase
      .from("meal_swipes")
      .select("student_uin, status")
      .eq("session_id", sessionId)
      .eq("status", "success")

    if (swipesError) {
      return { data: null, totalCredits: 0, totalCountSwipes: 0, canRestoreCredits: false, error: swipesError.message }
    }

    if (!swipes || swipes.length === 0) {
      return { data: [], totalCredits: 0, totalCountSwipes: 0, canRestoreCredits, error: null }
    }

    const uniqueUins = [...new Set(swipes.map((s) => s.student_uin))]
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("uin, first_name, last_name, meal_plan_type")
      .in("uin", uniqueUins)

    if (studentsError) {
      return {
        data: null,
        totalCredits: 0,
        totalCountSwipes: 0,
        canRestoreCredits: false,
        error: studentsError.message,
      }
    }

    const studentMap = new Map(students?.map((s) => [s.uin, s]) || [])
    const studentCredits = new Map<string, { name: string; credits: number; isCountPlan: boolean }>()

    for (const swipe of swipes) {
      const student = studentMap.get(swipe.student_uin)
      if (!student) continue

      const isCountPlan = student.meal_plan_type === "count"
      const key = swipe.student_uin
      const existing = studentCredits.get(key)

      if (existing) {
        existing.credits += 1
      } else {
        studentCredits.set(key, {
          name: `${student.first_name} ${student.last_name}`,
          credits: 1,
          isCountPlan,
        })
      }
    }

    const affectedStudents: AffectedStudent[] = Array.from(studentCredits.entries()).map(([uin, data]) => ({
      uin,
      name: data.name,
      credits_to_restore: data.credits,
      is_count_plan: data.isCountPlan,
    }))

    const totalCredits = affectedStudents
      .filter((s) => !s.is_count_plan)
      .reduce((sum, s) => sum + s.credits_to_restore, 0)
    const totalCountSwipes = affectedStudents
      .filter((s) => s.is_count_plan)
      .reduce((sum, s) => sum + s.credits_to_restore, 0)

    return { data: affectedStudents, totalCredits, totalCountSwipes, canRestoreCredits, error: null }
  } catch (error) {
    return {
      data: null,
      totalCredits: 0,
      totalCountSwipes: 0,
      canRestoreCredits: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function deleteSessionWithOptions(
  sessionId: string,
  restoreCredits: boolean,
): Promise<{ error: string | null }> {
  const supabase = createClient()

  console.log("[v0] deleteSessionWithOptions called:", { sessionId, restoreCredits })

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      console.log("[v0] deleteSessionWithOptions: User not authenticated")
      return { error: "User not authenticated" }
    }

    if (restoreCredits) {
      const { data: swipes, error: swipesError } = await supabase
        .from("meal_swipes")
        .select("student_uin, status")
        .eq("session_id", sessionId)
        .eq("status", "success")

      if (swipesError) {
        console.log("[v0] deleteSessionWithOptions: Error fetching swipes:", swipesError.message)
        return { error: swipesError.message }
      }

      if (swipes && swipes.length > 0) {
        const uniqueUins = [...new Set(swipes.map((s) => s.student_uin))]
        const { data: students, error: studentsError } = await supabase
          .from("students")
          .select("uin, weekly_credits, meal_plan_type")
          .in("uin", uniqueUins)

        if (studentsError) {
          console.log("[v0] deleteSessionWithOptions: Error fetching students:", studentsError.message)
          return { error: studentsError.message }
        }

        const studentMap = new Map(students?.map((s) => [s.uin, s]) || [])
        const creditsToRestore = new Map<string, number>()

        for (const swipe of swipes) {
          const student = studentMap.get(swipe.student_uin)
          if (!student) continue

          const isCountPlan = student.meal_plan_type === "count"
          if (isCountPlan) continue

          const existing = creditsToRestore.get(swipe.student_uin) || 0
          creditsToRestore.set(swipe.student_uin, existing + 1)
        }

        for (const [uin, credits] of creditsToRestore) {
          const student = studentMap.get(uin)
          if (!student) continue

          const newCredits = (student.weekly_credits || 0) + credits
          console.log(
            "[v0] deleteSessionWithOptions: Updating weekly_credits for",
            uin,
            "from",
            student.weekly_credits,
            "to",
            newCredits,
          )
          const { error: updateErr } = await supabase
            .from("students")
            .update({ weekly_credits: newCredits })
            .eq("uin", uin)
          if (updateErr) {
            console.log("[v0] deleteSessionWithOptions: Error updating weekly_credits:", updateErr.message)
          }
        }
      }
    }

    const { data: existingSession, error: checkError } = await supabase
      .from("sessions")
      .select("id")
      .eq("id", sessionId)
      .maybeSingle()

    console.log("[v0] deleteSessionWithOptions: Session exists before delete?", !!existingSession, checkError?.message)

    console.log("[v0] deleteSessionWithOptions: Deleting session...")
    const { error } = await supabase.from("sessions").delete().eq("id", sessionId)

    if (error) {
      console.log("[v0] deleteSessionWithOptions: Error deleting session:", error.message)
      return { error: error.message }
    }

    const { data: stillExists, error: verifyError } = await supabase
      .from("sessions")
      .select("id")
      .eq("id", sessionId)
      .maybeSingle()

    console.log(
      "[v0] deleteSessionWithOptions: Session still exists after delete?",
      !!stillExists,
      verifyError?.message,
    )

    console.log("[v0] deleteSessionWithOptions: Session deleted successfully")
    return { error: null }
  } catch (error) {
    console.log("[v0] deleteSessionWithOptions: Exception:", error)
    return { error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export function calculateDuration(startedAt: string, endedAt?: string): number | null {
  if (!endedAt) return null

  const start = new Date(startedAt)
  const end = new Date(endedAt)

  return Math.round((end.getTime() - start.getTime()) / (1000 * 60))
}
