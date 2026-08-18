import type { Student, StudentSwipeAnalytics } from "@/lib/types/student"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export type { Student, StudentSwipeAnalytics }

// Helper function to generate signed URLs for a list of students
async function generateSignedPhotoUrls(
  students: Omit<Student, "photo_url"> & { photo_url: string | null }[],
): Promise<Student[]> {
  const adminSupabase = createAdminClient()

  const fallbackUrl = "https://placehold.co/256x256/e2e8f0/64748b?text=No+Image"

  const photoPaths = students
    .map((student) => {
      const path = student.photo_url
      if (path && path.startsWith("http") && path.includes("supabase.co")) {
        try {
          const url = new URL(path)
          const pathIndex = url.pathname.indexOf("/student-photos/")
          if (pathIndex !== -1) {
            return decodeURIComponent(url.pathname.substring(pathIndex + "/student-photos/".length))
          }
        } catch {
          /* Ignore parsing errors */
        }
      }
      return path
    })
    .filter((path): path is string => !!path && !path.includes("/placeholder.svg"))

  if (photoPaths.length === 0) {
    return students.map((student) => ({
      ...student,
      photo_url: fallbackUrl,
    })) as Student[]
  }

  const { data: signedUrlsData, error: signedUrlsError } = await adminSupabase.storage
    .from("student-photos")
    .createSignedUrls(photoPaths, 3600)

  if (signedUrlsError) {
    console.error("Error generating bulk signed URLs for students:", signedUrlsError.message)
    return students.map((student) => ({ ...student, photo_url: fallbackUrl })) as Student[]
  }

  const signedUrlMap = new Map(photoPaths.map((path, index) => [path, signedUrlsData[index]?.signedUrl]))

  return students.map((student) => {
    const path = student.photo_url
    if (path && signedUrlMap.has(path)) {
      student.photo_url = signedUrlMap.get(path) || fallbackUrl
    } else {
      student.photo_url = fallbackUrl
    }
    return student as Student
  })
}

// Server-side functions (called by API routes)
export async function getAllStudents(): Promise<Student[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("students")
    .select("*, groups(name)")
    .order("last_name", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching students:", error)
    throw new Error("Failed to fetch students")
  }

  return generateSignedPhotoUrls(data || [])
}

export async function searchStudents(query: string): Promise<Student[]> {
  const supabase = await createServerClient()

  if (query.includes(" ")) {
    const parts = query.trim().split(/\s+/)
    const firstName = parts[0]
    const lastName = parts.slice(1).join(" ")

    // Search for first name AND last name match
    const { data, error } = await supabase
      .from("students")
      .select("*, groups(name)")
      .ilike("first_name", `%${firstName}%`)
      .ilike("last_name", `%${lastName}%`)
      .order("last_name", { ascending: true })

    if (error) {
      console.error("[v0] Error searching students:", error)
      throw new Error("Failed to search students")
    }

    return generateSignedPhotoUrls(data || [])
  }

  // Single word search - check UIN, first_name, or last_name
  const { data, error } = await supabase
    .from("students")
    .select("*, groups(name)")
    .or(`uin.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
    .order("last_name", { ascending: true })

  if (error) {
    console.error("[v0] Error searching students:", error)
    throw new Error("Failed to search students")
  }

  return generateSignedPhotoUrls(data || [])
}

export async function getStudentById(id: string): Promise<Student | null> {
  const supabase = await createServerClient()
  if (!id || id === "undefined") return null

  const { data, error } = await supabase.from("students").select("*").eq("uin", id).single()

  if (error || !data) {
    console.error("[v0] Error fetching student:", error)
    return null
  }

  const [studentWithUrl] = await generateSignedPhotoUrls([data])
  return studentWithUrl
}

export async function getStudentAnalytics(studentId: string, month?: string): Promise<StudentSwipeAnalytics> {
  const supabase = await createServerClient()
  const targetMonth = month || new Date().toISOString().slice(0, 7)

  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.rpc("get_student_analytics", {
        student_id_param: studentId,
        month_param: targetMonth,
      })

      if (error) {
        // Check if it's a rate limit error
        const errorMessage = error.message || String(error)
        if (errorMessage.includes("rate limit") || errorMessage.includes("too many requests")) {
          console.log(`[v0] Analytics rate limit hit (attempt ${attempt}/${maxRetries}), retrying...`)
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)) // Exponential backoff
            continue
          }
        }

        console.error("Error fetching student analytics from RPC:", error)
        lastError = new Error(`Failed to fetch student analytics: ${errorMessage}`)
        throw lastError
      }

      return data
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if it's a network/rate limit error that should be retried
      const errorMessage = lastError.message
      if (
        errorMessage.includes("rate limit") ||
        errorMessage.includes("too many requests") ||
        errorMessage.includes("Failed to fetch")
      ) {
        console.log(`[v0] Analytics fetch error (attempt ${attempt}/${maxRetries}), retrying...`)
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
          continue
        }
      }

      throw lastError
    }
  }

  throw lastError || new Error("Failed to fetch student analytics after retries")
}

export async function updateStudent(id: string, updates: Partial<Student>): Promise<Student> {
  const supabase = await createServerClient()

  if (updates.photo_url) {
    delete updates.photo_url
  }

  const finalUpdates: Partial<Student> = { ...updates }

  // If switching to count plan, set meal_plan and weekly_credits to 0
  if (finalUpdates.meal_plan_type === "count") {
    finalUpdates.meal_plan = 0
    finalUpdates.weekly_credits = 0
  }

  // If switching to prepaid plan, set weekly_credits equal to meal_plan (total prepaid meals)
  // For prepaid plans, meal_plan represents total purchased meals, weekly_credits is remaining balance
  if (finalUpdates.meal_plan_type === "prepaid" && finalUpdates.meal_plan !== undefined) {
    finalUpdates.weekly_credits = finalUpdates.meal_plan
  }

  const { data, error } = await supabase
    .from("students")
    .update({ ...finalUpdates, updated_at: new Date().toISOString() })
    .eq("uin", id)
    .select()
    .single()

  if (error) throw new Error("Failed to update student")

  const [studentWithUrl] = await generateSignedPhotoUrls([data])
  return studentWithUrl
}

export async function deleteStudent(
  id: string,
  deletedByUserId: string,
  deletedByUserEmail: string,
  deletedByUserRole: string,
  reason?: string,
): Promise<void> {
  const supabase = await createServerClient()
  const adminSupabase = createAdminClient()

  const student = await getStudentById(id)
  if (!student) throw new Error("Student not found")

  const { error: logError } = await supabase.from("student_deletion_log").insert({
    deleted_student_uin: student.uin,
    deleted_student_name: `${student.first_name} ${student.last_name}`,
    deleted_student_data: student,
    deleted_by_user_id: deletedByUserId,
    deleted_by_user_email: deletedByUserEmail,
    deleted_by_user_role: deletedByUserRole,
    reason: reason || "No reason provided",
  })
  if (logError) throw new Error("Failed to log student deletion")

  const { error: swipesDeleteError } = await adminSupabase.from("meal_swipes").delete().eq("student_uin", id)
  if (swipesDeleteError) {
    console.error("[v0] Error deleting meal swipes:", swipesDeleteError)
    throw new Error("Failed to delete student's meal swipes")
  }

  const { error: deleteError } = await adminSupabase.from("students").delete().eq("uin", id)
  if (deleteError) {
    console.error("[v0] Error deleting student:", deleteError)
    throw new Error("Failed to delete student")
  }
}

// --- Client-side functions ---

export async function getAllStudentsClient(): Promise<Student[]> {
  const response = await fetch("/api/students")
  if (!response.ok) {
    console.error("[v0] Error fetching students:", response.statusText)
    throw new Error("Failed to fetch students")
  }
  const data = await response.json()
  return data.students || []
}

export async function searchStudentsClient(query: string): Promise<Student[]> {
  const response = await fetch(`/api/students?q=${encodeURIComponent(query)}`)
  if (!response.ok) {
    console.error("[v0] Error searching students:", response.statusText)
    throw new Error("Failed to search students")
  }
  const data = await response.json()
  return data.students || []
}

export async function getStudentByIdClient(id: string): Promise<Student | null> {
  if (!id || id === "undefined") {
    console.error("[v0] Invalid student ID:", id)
    return null
  }
  const response = await fetch(`/api/students/${id}`)
  if (!response.ok) {
    if (response.status === 404) return null
    console.error("[v0] Error fetching student:", response.statusText)
    return null
  }
  const data = await response.json()
  return data.student || null
}

export async function getStudentAnalyticsClient(studentId: string, month?: string): Promise<StudentSwipeAnalytics> {
  const url = `/api/students/${studentId}/analytics?month=${month || new Date().toISOString().slice(0, 7)}`
  const response = await fetch(url)
  if (!response.ok) {
    console.error("Failed to fetch student analytics:", response.statusText)
    throw new Error("Failed to fetch student analytics")
  }
  const data = await response.json()
  return data.analytics
}

export async function updateStudentClient(id: string, updates: Partial<Student>): Promise<Student> {
  const response = await fetch(`/api/students/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  })
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || "Failed to update student")
  }
  const data = await response.json()
  return data.student
}

export async function deleteStudentClient(
  id: string,
  deletedByUserId: string,
  deletedByUserEmail: string,
  deletedByUserRole: string,
  reason?: string,
): Promise<void> {
  const response = await fetch(`/api/students/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  })
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || "Failed to delete student")
  }
}
