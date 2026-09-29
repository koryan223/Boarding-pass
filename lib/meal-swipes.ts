import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Student } from "./student-management"
import { canAccessLocation, getAllowedLocationIds } from "./location-access"

export interface MealSwipe {
  id: string
  student_uin: string
  session_id: string | null
  swiped_by: string
  swiped_at: string
  status: "success" | "failed" | "insufficient_credits" | "reentry"
  students?: Student
  sessions?: any
}

// Helper function to generate signed URLs for student photos within swipe data
async function generateSignedUrlsForSwipes(swipes: MealSwipe[]): Promise<MealSwipe[]> {
  console.log("[v0] generateSignedUrlsForSwipes called with:", typeof swipes, Array.isArray(swipes), swipes?.length)

  if (!swipes) {
    console.log("[v0] generateSignedUrlsForSwipes: No swipes provided (null/undefined)")
    return []
  }

  // Convert to array if it's not already (handles Proxy objects and other iterables)
  let swipesArray: MealSwipe[]
  try {
    if (Array.isArray(swipes)) {
      swipesArray = swipes
    } else if (swipes && typeof swipes === "object" && typeof swipes[Symbol.iterator] === "function") {
      // Handle iterable objects (like Proxy arrays from Supabase)
      swipesArray = Array.from(swipes as Iterable<MealSwipe>)
    } else {
      console.error("[v0] generateSignedUrlsForSwipes: Invalid swipes type:", typeof swipes)
      return []
    }
  } catch (error) {
    console.error("[v0] generateSignedUrlsForSwipes: Error converting to array:", error)
    return []
  }

  if (swipesArray.length === 0) {
    console.log("[v0] generateSignedUrlsForSwipes: Empty array")
    return []
  }

  console.log("[v0] generateSignedUrlsForSwipes: Processing", swipesArray.length, "swipes")

  const adminSupabase = createAdminClient()

  const fallbackUrl = "https://placehold.co/128x128/e2e8f0/64748b?text=No+Image"

  let photoPaths: string[]
  try {
    photoPaths = swipesArray
      .map((swipe) => {
        console.log("[v0] Processing swipe:", swipe?.id, "student photo:", swipe?.students?.photo_url)
        return swipe.students?.photo_url
      })
      .filter((path): path is string => !!path && !path.includes("/placeholder.svg"))
  } catch (error) {
    console.error("[v0] generateSignedUrlsForSwipes: Error in map operation:", error)
    return swipesArray.map((swipe) => {
      if (swipe.students) swipe.students.photo_url = fallbackUrl
      return swipe
    })
  }

  if (photoPaths.length === 0) {
    return swipesArray.map((swipe) => {
      if (swipe.students) swipe.students.photo_url = fallbackUrl
      return swipe
    })
  }

  const { data: signedUrlsData, error: signedUrlsError } = await adminSupabase.storage
    .from("student-photos")
    .createSignedUrls(photoPaths, 3600)

  if (signedUrlsError) {
    console.error("Error generating bulk signed URLs for swipes:", signedUrlsError.message)
    return swipesArray.map((swipe) => {
      if (swipe.students) swipe.students.photo_url = fallbackUrl
      return swipe
    })
  }

  const signedUrlMap = new Map(photoPaths.map((path, index) => [path, signedUrlsData[index]?.signedUrl]))

  return swipesArray.map((swipe) => {
    if (swipe.students) {
      const path = swipe.students.photo_url
      if (path && signedUrlMap.has(path)) {
        swipe.students.photo_url = signedUrlMap.get(path) || fallbackUrl
      } else {
        swipe.students.photo_url = fallbackUrl
      }
    }
    return swipe
  })
}

export async function getStudentByUin(uin: string): Promise<Student | null> {
  console.log("[v0] Looking up student with UIN:", uin)
  const supabase = await createServerClient()

  const { data, error } = await supabase.from("students").select("*").eq("uin", uin).maybeSingle()

  if (error) {
    console.log("[v0] Student lookup error:", error)
    return null
  }

  if (!data) {
    console.log("[v0] No student found with UIN:", uin)
    return null
  }

  console.log("[v0] Found student:", data)
  return data
}

export async function processSwipe(
  studentUin: string,
  sessionId: string | null = null,
): Promise<{ success: boolean; message: string; student?: Student; weeklySwipes?: number; isReentry?: boolean }> {
  console.log("[SERVER][v0] Processing swipe for UIN:", studentUin, "Session:", sessionId)

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, message: "User not authenticated" }
  }
  if (!sessionId) {
    return { success: false, message: "Session is required to process swipes" }
  }

  const { data: sessionData, error: sessionError } = await supabase
    .from("sessions")
    .select("reentry_enabled")
    .eq("id", sessionId)
    .single()

  if (sessionError) {
    console.error("[SERVER][v0] Error fetching session:", sessionError)
  }

  const reentryEnabled = sessionData?.reentry_enabled === true
  console.log("[SERVER][v0] Session reentry_enabled:", reentryEnabled)

  const studentData = await getStudentByUin(studentUin)
  if (!studentData) {
    return { success: false, message: "Student not found" }
  }

  const { data: swiperRole } = await supabase.from("user_roles").select("role").eq("id", user.id).single()
  const allowedLocations = await getAllowedLocationIds(user.id, swiperRole?.role)
  if (!canAccessLocation(allowedLocations, studentData.base_location_id)) {
    return { success: false, message: "Student is not assigned to a location you can serve" }
  }

  const isCountPlan =
    studentData.meal_plan_type === "count" || (studentData.meal_plan_type == null && studentData.meal_plan === 0)
  const isPrepaidPlan = studentData.meal_plan_type === "prepaid"

  console.log(
    "[SERVER][v0] Student meal_plan:",
    studentData.meal_plan,
    "meal_plan_type:",
    studentData.meal_plan_type,
    "isCountPlan:",
    isCountPlan,
    "isPrepaidPlan:",
    isPrepaidPlan,
  )

  let isReentry = false
  if (reentryEnabled) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recentSwipes, error: recentSwipeError } = await supabase
      .from("meal_swipes")
      .select("id, swiped_at")
      .eq("student_uin", studentUin)
      .eq("session_id", sessionId)
      .in("status", ["success", "reentry"])
      .gte("swiped_at", oneHourAgo)
      .order("swiped_at", { ascending: false })
      .limit(1)

    if (recentSwipeError) {
      console.error("[SERVER][v0] Error checking recent swipes:", recentSwipeError)
    }

    isReentry = !!recentSwipes && recentSwipes.length > 0
    console.log("[SERVER][v0] Is re-entry:", isReentry, "Recent swipes:", recentSwipes?.length || 0)
  }

  // If re-entry, record it but don't deduct credits
  if (isReentry) {
    await supabase.from("meal_swipes").insert({
      student_uin: studentUin,
      session_id: sessionId,
      swiped_by: user.id,
      status: "reentry",
    })

    // Get weekly swipes count
    const startOfWeek = new Date()
    startOfWeek.setHours(0, 0, 0, 0)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())

    const { count } = await supabase
      .from("meal_swipes")
      .select("*", { count: "exact", head: true })
      .eq("student_uin", studentUin)
      .in("status", ["success", "reentry"])
      .gte("swiped_at", startOfWeek.toISOString())

    const weeklySwipes = count || 0

    // Generate signed URL for photo
    const adminSupabase = createAdminClient()
    const needsFallback = !studentData.photo_url || studentData.photo_url.includes("/placeholder.svg")
    let signedUrl = "https://placehold.co/256x256/e2e8f0/64748b?text=No+Image"

    if (!needsFallback) {
      const { data: signedUrlData } = await adminSupabase.storage
        .from("student-photos")
        .createSignedUrl(studentData.photo_url, 3600)
      if (signedUrlData?.signedUrl) signedUrl = signedUrlData.signedUrl
    }

    const studentForResponse = {
      ...studentData,
      photo_url: signedUrl,
      meal_plan_type: isCountPlan ? ("count" as const) : isPrepaidPlan ? ("prepaid" as const) : ("standard" as const),
    }

    return {
      success: true,
      message: "Re-entry - No credit deducted",
      student: studentForResponse,
      weeklySwipes: weeklySwipes,
      isReentry: true,
    }
  }

  // Check for credits and handle insufficient credits case (for standard and prepaid plans)
  if (!isCountPlan && studentData.weekly_credits <= 0) {
    await supabase.from("meal_swipes").insert({
      student_uin: studentUin,
      session_id: sessionId,
      swiped_by: user.id,
      status: "insufficient_credits",
    })

    const adminSupabase = createAdminClient()
    const needsFallback = !studentData.photo_url || studentData.photo_url.includes("/placeholder.svg")

    let signedUrl = "https://placehold.co/256x256/e2e8f0/64748b?text=No+Image"

    if (!needsFallback) {
      const { data: signedUrlData } = await adminSupabase.storage
        .from("student-photos")
        .createSignedUrl(studentData.photo_url, 3600)
      if (signedUrlData?.signedUrl) signedUrl = signedUrlData.signedUrl
    }

    studentData.photo_url = signedUrl

    return {
      success: false,
      message: `Insufficient credit: ${studentData.weekly_credits} of ${studentData.meal_plan} left`,
      student: studentData,
    }
  }

  // Deduct atomically in the database so overlapping swipes can't read the same
  // balance and overwrite each other (which previously lost deductions).
  let remainingCredits = studentData.weekly_credits
  if (!isCountPlan) {
    const { data: newBalance, error: updateError } = await supabase.rpc("decrement_student_credit", {
      p_uin: studentUin,
    })

    if (updateError) {
      return { success: false, message: "Failed to update credits" }
    }

    if (newBalance === null || newBalance === undefined) {
      // The balance read above is stale here; report the real one so the screen
      // never shows "credits left" next to a rejection.
      const { data: current } = await supabase
        .from("students")
        .select("weekly_credits, meal_plan")
        .eq("uin", studentUin)
        .maybeSingle()
      const actualCredits = current?.weekly_credits ?? 0

      if (actualCredits > 0) {
        console.error("[SERVER] Credit decrement matched no row despite a positive balance", {
          studentUin,
          actualCredits,
        })
        return { success: false, message: "Could not deduct credit, please swipe again", student: studentData }
      }

      await supabase.from("meal_swipes").insert({
        student_uin: studentUin,
        session_id: sessionId,
        swiped_by: user.id,
        status: "insufficient_credits",
      })
      return {
        success: false,
        message: `Insufficient credit: 0 of ${current?.meal_plan ?? studentData.meal_plan} left`,
        student: { ...studentData, weekly_credits: actualCredits },
      }
    }

    remainingCredits = newBalance as number
  }

  await supabase.from("meal_swipes").insert({
    student_uin: studentUin,
    session_id: sessionId,
    swiped_by: user.id,
    status: "success",
  })

  const startOfWeek = new Date()
  startOfWeek.setHours(0, 0, 0, 0)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())

  const { count } = await supabase
    .from("meal_swipes")
    .select("*", { count: "exact", head: true })
    .eq("student_uin", studentUin)
    .in("status", ["success", "reentry"])
    .gte("swiped_at", startOfWeek.toISOString())

  const weeklySwipes = count || 0
  console.log("[SERVER][v0] Weekly swipes:", weeklySwipes)

  const adminSupabase = createAdminClient()
  const needsFallbackOnSuccess = !studentData.photo_url || studentData.photo_url.includes("/placeholder.svg")

  let signedUrlOnSuccess = "https://placehold.co/256x256/e2e8f0/64748b?text=No+Image"

  if (!needsFallbackOnSuccess) {
    const { data: signedUrlDataOnSuccess } = await adminSupabase.storage
      .from("student-photos")
      .createSignedUrl(studentData.photo_url, 3600)
    if (signedUrlDataOnSuccess?.signedUrl) signedUrlOnSuccess = signedUrlDataOnSuccess.signedUrl
  }

  const studentForResponse = {
    ...studentData,
    photo_url: signedUrlOnSuccess,
    weekly_credits: remainingCredits,
    meal_plan_type: isCountPlan ? ("count" as const) : isPrepaidPlan ? ("prepaid" as const) : ("standard" as const),
  }

  return {
    success: true,
    message: isCountPlan ? "Swipe recorded!" : isPrepaidPlan ? "Prepaid meal used!" : "Swipe successful!",
    student: studentForResponse,
    weeklySwipes: weeklySwipes,
    isReentry: false,
  }
}

export async function getSessionSwipes(sessionId: string): Promise<MealSwipe[]> {
  console.log("[v0] getSessionSwipes called with sessionId:", sessionId)

  if (!sessionId) {
    console.error("[v0] getSessionSwipes: No sessionId provided")
    return []
  }

  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("meal_swipes")
    .select(`
      *,
      students (
        uin,
        first_name,
        last_name,
        room_number,
        meal_plan,
        weekly_credits,
        photo_url
      )
    `)
    .eq("session_id", sessionId)
    .order("swiped_at", { ascending: false })

  if (error) {
    console.error("[v0] getSessionSwipes database error:", error)
    return []
  }

  if (!data) {
    console.log("[v0] getSessionSwipes: No data returned from database")
    return []
  }

  console.log("[v0] getSessionSwipes: Found", data.length, "swipes")
  console.log("[v0] getSessionSwipes: Data type:", typeof data, "Is array:", Array.isArray(data))

  try {
    const result = await generateSignedUrlsForSwipes(data)
    console.log("[v0] getSessionSwipes: Successfully processed signed URLs")
    return result
  } catch (error) {
    console.error("[v0] Error in generateSignedUrlsForSwipes:", error)
    return data // Return raw data if signed URL generation fails
  }
}

export async function getSessionSwipesTextOnly(sessionId: string): Promise<MealSwipe[]> {
  console.log("[v0] getSessionSwipesTextOnly called with sessionId:", sessionId)

  if (!sessionId) {
    console.error("[v0] getSessionSwipesTextOnly: No sessionId provided")
    return []
  }

  const adminSupabase = createAdminClient()

  try {
    const { data, error } = await adminSupabase
      .from("meal_swipes")
      .select(`
        *,
        students (
          uin,
          first_name,
          last_name,
          room_number,
          meal_plan,
          meal_plan_type,
          weekly_credits
        )
      `)
      .eq("session_id", sessionId)
      .order("swiped_at", { ascending: false })

    if (error) {
      console.error("[v0] getSessionSwipesTextOnly database error:", error)
      return []
    }

    if (!data) {
      console.log("[v0] getSessionSwipesTextOnly: No data returned from database")
      return []
    }

    console.log("[v0] getSessionSwipesTextOnly: Found", data.length, "swipes")
    console.log("[v0] First swipe students data:", data[0]?.students)
    return data
  } catch (error) {
    console.error("[v0] getSessionSwipesTextOnly exception:", error)
    return []
  }
}

export async function getStudentSwipeHistory(studentUin: string): Promise<MealSwipe[]> {
  console.log("[v0] getStudentSwipeHistory called with studentUin:", studentUin)

  if (!studentUin) {
    console.error("[v0] getStudentSwipeHistory: No studentUin provided")
    return []
  }

  const adminSupabase = createAdminClient()

  try {
    const { data, error } = await adminSupabase
      .from("meal_swipes")
      .select(`
        *,
        sessions (
          id,
          title,
          started_at,
          ended_at
        )
      `)
      .eq("student_uin", studentUin)
      .order("swiped_at", { ascending: false })

    if (error) {
      const errorMessage = typeof error === "object" && error !== null ? JSON.stringify(error) : String(error)

      if (errorMessage.includes("Too Many") || errorMessage.includes("rate limit")) {
        console.error("[v0] getStudentSwipeHistory: Rate limit exceeded, retrying after delay")
        // Return empty array for now, component will retry
        return []
      }

      console.error("[v0] getStudentSwipeHistory database error:", errorMessage)
      return []
    }

    if (!data) {
      console.log("[v0] getStudentSwipeHistory: No data returned from database")
      return []
    }

    console.log("[v0] getStudentSwipeHistory: Found", data.length, "swipes")
    return data
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error("[v0] getStudentSwipeHistory unexpected error:", errorMessage)

    // If it's a rate limit error, log it specifically
    if (
      errorMessage.includes("Too Many") ||
      errorMessage.includes("rate limit") ||
      errorMessage.includes("not valid JSON")
    ) {
      console.error("[v0] Rate limit or parsing error detected")
    }

    return []
  }
}
