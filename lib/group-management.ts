import { createServerClient } from "@/lib/supabase/server"

export interface Group {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface GroupWithStats extends Group {
  student_count: number
}

export interface GroupAnalytics {
  total_swipes: number
  student_count: number
  week_1_swipes: number
  week_2_swipes: number
  week_3_swipes: number
  week_4_swipes: number
  week_5_swipes: number
  average_swipes_per_student: number
}

// Helper function for safe error stringification
function safeStringify(error: unknown): string {
  try {
    if (error instanceof Error) {
      return error.message
    }
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

// Helper function to check if error is rate limit related
function isRateLimitError(error: unknown): boolean {
  const errorStr = safeStringify(error).toLowerCase()
  return errorStr.includes("too many") || errorStr.includes("rate limit") || errorStr.includes("429")
}

// Retry helper with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (isRateLimitError(error) && attempt < maxRetries - 1) {
        const delay = initialDelay * (attempt + 1)
        console.log(`[v0] Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      throw error
    }
  }

  throw lastError
}

// Server-side functions
export async function getAllGroups(): Promise<GroupWithStats[]> {
  return withRetry(async () => {
    const supabase = await createServerClient()

    const { data: groups, error } = await supabase.from("groups").select("*").order("name", { ascending: true })

    if (error) {
      console.error("[v0] Error fetching groups:", safeStringify(error))
      throw new Error("Failed to fetch groups")
    }

    // Get student count for each group
    const groupsWithStats = await Promise.all(
      (groups || []).map(async (group) => {
        const { count } = await supabase
          .from("students")
          .select("*", { count: "exact", head: true })
          .eq("group_id", group.id)

        return {
          ...group,
          student_count: count || 0,
        }
      }),
    )

    return groupsWithStats
  })
}

export async function getGroupById(id: string): Promise<GroupWithStats | null> {
  if (!id || id === "undefined") {
    console.error("[v0] getGroupById called with invalid id:", id)
    return null
  }

  return withRetry(async () => {
    const supabase = await createServerClient()

    const { data: group, error } = await supabase.from("groups").select("*").eq("id", id).single()

    if (error || !group) {
      console.error("[v0] Error fetching group:", safeStringify(error))
      return null
    }

    // Get student count
    const { count } = await supabase.from("students").select("*", { count: "exact", head: true }).eq("group_id", id)

    return {
      ...group,
      student_count: count || 0,
    }
  })
}

export async function createGroup(name: string, description?: string): Promise<Group> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("groups")
    .insert({
      name,
      description: description || null,
    })
    .select()
    .single()

  if (error) {
    console.error("[v0] Error creating group:", error)
    throw new Error("Failed to create group")
  }

  return data
}

export async function updateGroup(id: string, updates: { name?: string; description?: string }): Promise<Group> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("groups")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("[v0] Error updating group:", error)
    throw new Error("Failed to update group")
  }

  return data
}

export async function deleteGroup(id: string): Promise<void> {
  const supabase = await createServerClient()

  // First, unassign all students from this group
  await supabase.from("students").update({ group_id: null }).eq("group_id", id)

  // Then delete the group
  const { error } = await supabase.from("groups").delete().eq("id", id)

  if (error) {
    console.error("[v0] Error deleting group:", error)
    throw new Error("Failed to delete group")
  }
}

export async function getGroupAnalytics(groupId: string, month?: number): Promise<GroupAnalytics> {
  return withRetry(async () => {
    const supabase = await createServerClient()
    const targetMonth = month || new Date().getMonth() + 1

    const { data, error } = await supabase.rpc("get_group_analytics", {
      group_id_param: groupId,
      month_param: targetMonth,
    })

    if (error) {
      console.error("[v0] Error fetching group analytics:", safeStringify(error))
      throw new Error("Failed to fetch group analytics")
    }

    // PostgreSQL table-returning functions return arrays, so we need to get the first element
    const analytics = Array.isArray(data) ? data[0] : data

    if (!analytics) {
      // Return empty analytics if no data
      return {
        total_swipes: 0,
        student_count: 0,
        week_1_swipes: 0,
        week_2_swipes: 0,
        week_3_swipes: 0,
        week_4_swipes: 0,
        week_5_swipes: 0,
        average_swipes_per_student: 0,
      }
    }

    return analytics
  })
}

export async function assignStudentToGroup(studentUin: string, groupId: string | null): Promise<void> {
  const supabase = await createServerClient()

  const { error } = await supabase
    .from("students")
    .update({
      group_id: groupId,
      updated_at: new Date().toISOString(),
    })
    .eq("uin", studentUin)

  if (error) {
    console.error("[v0] Error assigning student to group:", error)
    throw new Error("Failed to assign student to group")
  }
}

// Client-side functions
export async function getAllGroupsClient(): Promise<GroupWithStats[]> {
  const response = await fetch("/api/groups")
  if (!response.ok) {
    console.error("[v0] Error fetching groups:", response.statusText)
    throw new Error("Failed to fetch groups")
  }
  const data = await response.json()
  return data.groups || []
}

export async function getGroupByIdClient(id: string): Promise<GroupWithStats | null> {
  const response = await fetch(`/api/groups/${id}`)
  if (!response.ok) {
    if (response.status === 404) return null
    console.error("[v0] Error fetching group:", response.statusText)
    return null
  }
  const data = await response.json()
  return data.group || null
}

export async function createGroupClient(name: string, description?: string): Promise<Group> {
  const response = await fetch("/api/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  })
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || "Failed to create group")
  }
  const data = await response.json()
  return data.group
}

export async function updateGroupClient(id: string, updates: { name?: string; description?: string }): Promise<Group> {
  const response = await fetch(`/api/groups/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  })
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || "Failed to update group")
  }
  const data = await response.json()
  return data.group
}

export async function deleteGroupClient(id: string): Promise<void> {
  const response = await fetch(`/api/groups/${id}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || "Failed to delete group")
  }
}

export async function getGroupAnalyticsClient(groupId: string, month?: number): Promise<GroupAnalytics> {
  const targetMonth = month || new Date().getMonth() + 1
  const response = await fetch(`/api/groups/${groupId}/analytics?month=${targetMonth}`)
  if (!response.ok) {
    console.error("[v0] Error fetching group analytics:", response.statusText)
    throw new Error("Failed to fetch group analytics")
  }
  const data = await response.json()
  return data.analytics
}

export async function assignStudentToGroupClient(studentUin: string, groupId: string | null): Promise<void> {
  const response = await fetch(`/api/students/${studentUin}/assign-group`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ group_id: groupId }),
  })
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || "Failed to assign student to group")
  }
}
