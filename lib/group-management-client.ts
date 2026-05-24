// Client-side only group management functions
// This file should be imported by client components

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

export async function getAllGroupsClient(): Promise<GroupWithStats[]> {
  const response = await fetch("/api/groups")
  if (!response.ok) {
    console.error("Error fetching groups:", response.statusText)
    throw new Error("Failed to fetch groups")
  }
  const data = await response.json()
  return data.groups || []
}

export async function getGroupByIdClient(id: string): Promise<GroupWithStats | null> {
  const response = await fetch(`/api/groups/${id}`)
  if (!response.ok) {
    if (response.status === 404) return null
    console.error("Error fetching group:", response.statusText)
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
    console.error("Error fetching group analytics:", response.statusText)
    throw new Error("Failed to fetch group analytics")
  }
  const data = await response.json()

  const analytics = Array.isArray(data.analytics) ? data.analytics[0] : data.analytics

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
