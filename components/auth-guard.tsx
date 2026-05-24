"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface AuthGuardProps {
  children: React.ReactNode
  allowedRoles?: ("admin" | "staff" | "dining_station")[]
  fallbackPath?: string
}

export function AuthGuard({ children, allowedRoles, fallbackPath = "/auth/login" }: AuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    const checkAuth = async () => {
      try {
        const supabase = createClient()

        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()

        if (!isMounted) return

        if (error) {
          // Ignore network/abort errors caused by redirects or navigation
          if (
            error.message.includes("fetch") || 
            error.message.includes("network") || 
            error.name === "AbortError" ||
            error.name === "TypeError" // Often "TypeError: Failed to fetch"
          ) {
            console.log("[AuthGuard] Network request interrupted (likely redirecting)")
            return
          }
          throw error
        }

        if (!user) {
          console.log("[AuthGuard] No user, redirecting to fallback")
          router.push(fallbackPath)
          return
        }

        if (allowedRoles) {
          const { data: roleData, error: roleError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("id", user.id)
            .single()

          if (!isMounted) return

          // Handle role check errors gracefully
          if (roleError) {
             console.error("[AuthGuard] Role check failed:", roleError)
             // Don't redirect immediately on role error to avoid loops, just access denied
             return 
          }

          const userRole = roleData?.role

          if (!userRole || !allowedRoles.includes(userRole as any)) {
            // Redirect based on role
            switch (userRole) {
              case "admin":
                router.push("/admin")
                break
              case "staff":
                router.push("/dashboard")
                break
              case "dining_station":
                router.push("/swipe-station")
                break
              case "pending":
                router.push("/pending-approval")
                break
              default:
                router.push("/auth/login")
            }
            return
          }
        }

        setIsAuthorized(true)
      } catch (error) {
        if (!isMounted) return
        
        // Final safety check to avoid redirecting on network errors
        const msg = error instanceof Error ? error.message : String(error)
        if (msg.includes("fetch") || msg.includes("network") || msg.includes("AbortError")) {
          return
        }

        console.warn("[AuthGuard] Auth check failed:", error)
        router.push(fallbackPath)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    checkAuth()

    return () => {
      isMounted = false
    }
  }, [router, allowedRoles, fallbackPath])

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return <>{children}</>
}
