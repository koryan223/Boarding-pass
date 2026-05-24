import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"

export type UserRole = "admin" | "staff" | "dining_station" | "pending"

export interface AuthUser {
  id: string
  email: string
  role: UserRole
}

export async function getCurrentUser(supabase: any): Promise<AuthUser | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  // Get user role
  const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()

  if (!roleData) {
    return null
  }

  return {
    id: user.id,
    email: user.email!,
    role: roleData.role as UserRole,
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const supabase = await createServerClient()
  const user = await getCurrentUser(supabase)

  if (!user) {
    redirect("/auth/login")
  }

  return user
}

export async function requireRole(allowedRoles: UserRole[]): Promise<{ user: AuthUser }> {
  const supabase = await createServerClient()
  const user = await getCurrentUser(supabase)

  if (!user) {
    redirect("/auth/login")
  }

  const authUser: AuthUser = {
    id: user.id,
    email: user.email!,
    role: user.role,
  }

  if (!allowedRoles.includes(authUser.role)) {
    // Redirect based on user role
    switch (authUser.role) {
      case "admin":
        redirect("/admin")
      case "staff":
        redirect("/dashboard")
      case "dining_station":
        redirect("/swipe-station")
      case "pending":
        redirect("/pending-approval")
      default:
        redirect("/")
    }
  }

  return { user: authUser }
}
