export interface Location {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Group {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  student_count?: number
}

export interface GroupAssignment {
  group_id: string
  group_name: string
  student_count: number
}

// Client-side functions
export async function getAllLocationsClient(): Promise<Location[]> {
  const response = await fetch("/api/locations")
  if (!response.ok) {
    console.error("[v0] Error fetching locations:", response.statusText)
    throw new Error("Failed to fetch locations")
  }
  const data = await response.json()
  const locationsList = data.locations || data || []
  return Array.isArray(locationsList) ? locationsList : []
}

export async function getAllGroupsClient(): Promise<Group[]> {
  const response = await fetch("/api/groups")
  if (!response.ok) {
    console.error("[v0] Error fetching groups:", response.statusText)
    throw new Error("Failed to fetch groups")
  }
  const data = await response.json()
  return data.groups || []
}

export async function createLocationClient(name: string): Promise<Location> {
  const response = await fetch("/api/locations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || "Failed to create location")
  }
  return response.json()
}

export async function updateLocationClient(id: string, name: string): Promise<Location> {
  const response = await fetch(`/api/locations/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || "Failed to update location")
  }
  return response.json()
}

export async function deleteLocationClient(id: string): Promise<void> {
  const response = await fetch(`/api/locations/${id}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || "Failed to delete location")
  }
}

export async function assignLocationToGroupClient(
  locationId: string,
  groupId: string | null,
): Promise<{ studentsUpdated: number }> {
  const response = await fetch(`/api/locations/${locationId}/assign-group`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId }),
  })
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || "Failed to assign location to group")
  }
  return response.json()
}
