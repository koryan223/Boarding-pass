import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Sign out initiated")
    const supabase = await createServerClient()

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error("[v0] Sign out error:", error.message)
      // Even if there's an error, we should still redirect to clear any local state
    } else {
      console.log("[v0] Sign out successful")
    }

    // Clear any additional cookies or session data if needed
    // The Supabase client should handle cookie cleanup automatically
  } catch (error) {
    console.error("[v0] Unexpected sign out error:", error)
  }

  // Always redirect to home page regardless of errors
  // This ensures the user is logged out from the UI perspective
  redirect("/")
}

export async function GET() {
  // Handle GET requests by redirecting to POST
  // This provides a fallback for direct navigation
  redirect("/")
}
