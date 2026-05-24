"use client"

import { Button } from "@/components/ui/button"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface SignOutButtonProps {
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg"
  className?: string
}

export function SignOutButton({ variant = "outline", size = "default", className }: SignOutButtonProps) {
  const [isSigningOut, setIsSigningOut] = useState(false)
  const router = useRouter()

  const handleSignOut = async () => {
    if (isSigningOut) return

    setIsSigningOut(true)
    console.log("[v0] Initiating sign out")

    try {
      // Use fetch to call the sign out API
      const response = await fetch("/auth/signout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        redirect: "manual",
      })

      if (response.ok || response.status === 302) {
        console.log("[v0] Sign out successful, redirecting...")
        // Force a hard refresh to clear all client-side state
        window.location.href = "/"
      } else {
        console.error("[v0] Sign out failed with status:", response.status)
        // Still redirect on failure to ensure user appears logged out
        window.location.href = "/"
      }
    } catch (error) {
      console.error("[v0] Sign out error:", error)
      // Fallback: redirect anyway to clear UI state
      window.location.href = "/"
    }
  }

  return (
    <Button variant={variant} size={size} className={className} onClick={handleSignOut} disabled={isSigningOut}>
      {isSigningOut ? "Signing Out..." : "Sign Out"}
    </Button>
  )
}
