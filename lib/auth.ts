"use client"

import { createBrowserClient } from "@/lib/supabase/client"
import { useState, useEffect } from "react"

export type UserRole = "admin" | "staff" | "dining_station"

export interface AuthUser {
  id: string
  email: string
  role: UserRole
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      try {
        const supabase = createBrowserClient()
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()

        if (authUser) {
          const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", authUser.id).single()

          if (roleData) {
            setUser({
              id: authUser.id,
              email: authUser.email!,
              role: roleData.role as UserRole,
            })
          }
        }
      } catch (error) {
        console.error("[v0] Auth error:", error)
      } finally {
        setIsLoading(false)
      }
    }

    getUser()
  }, [])

  return {
    user,
    userRole: user?.role || null,
    isLoading,
  }
}
