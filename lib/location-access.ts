import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Returns the location IDs a user may work with, or `null` when the user is
 * unrestricted (admins). Staff and dining station users are limited to the
 * locations an admin has checked for them in User Management.
 */
export async function getAllowedLocationIds(userId: string, role: string | null | undefined): Promise<string[] | null> {
  if (role === "admin") return null

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from("user_location_access")
    .select("location_id")
    .eq("user_id", userId)

  if (error) {
    console.error("[v0] Error loading location access:", error.message)
    return []
  }

  return (data || []).map((row: { location_id: string }) => row.location_id)
}

export function canAccessLocation(allowed: string[] | null, locationId: string | null | undefined): boolean {
  if (allowed === null) return true
  return !!locationId && allowed.includes(locationId)
}
