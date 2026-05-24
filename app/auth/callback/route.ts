import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next")
  const token_hash = requestUrl.searchParams.get("token_hash")
  const type = requestUrl.searchParams.get("type")

  console.log("[v0] Auth callback triggered with:", {
    hasCode: !!code,
    next,
    hasTokenHash: !!token_hash,
    type,
  })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    },
  )

  if (token_hash && type === "recovery") {
    console.log("[v0] Processing password recovery with token_hash")
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: "recovery",
    })

    if (!error) {
      console.log("[v0] Password recovery token verified, redirecting to reset-password")
      return NextResponse.redirect(new URL("/auth/reset-password", requestUrl.origin))
    } else {
      console.error("[v0] Token verification error:", error)
    }
  }

  if (code) {
    console.log("[v0] Exchanging code for session")
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log("[v0] Code exchange result:", {
      hasSession: !!data?.session,
      hasUser: !!data?.user,
      userEmail: data?.user?.email,
      error: error?.message,
    })

    if (!error && data?.session) {
      // or if there's a recovery indicator in the session
      if (next === "/auth/reset-password" || next?.includes("reset-password")) {
        console.log("[v0] Password recovery code exchanged, redirecting to reset-password")
        return NextResponse.redirect(new URL("/auth/reset-password", requestUrl.origin))
      }

      if (next) {
        console.log("[v0] Auth callback - redirecting to next:", next)
        return NextResponse.redirect(new URL(next, requestUrl.origin))
      }

      // Get user and their role for default redirect
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()

        const role = roleData?.role
        console.log("[v0] Auth callback - user role:", role)

        // Redirect based on role
        switch (role) {
          case "admin":
            return NextResponse.redirect(new URL("/admin", requestUrl.origin))
          case "staff":
            return NextResponse.redirect(new URL("/dashboard", requestUrl.origin))
          case "dining_station":
            return NextResponse.redirect(new URL("/swipe-station", requestUrl.origin))
          default:
            return NextResponse.redirect(new URL("/dashboard", requestUrl.origin))
        }
      }
    } else {
      console.error("[v0] Auth callback error:", error)
    }
  }

  // Default redirect to login if something goes wrong
  console.log("[v0] Auth callback - no valid auth params, redirecting to login")
  return NextResponse.redirect(new URL("/auth/login", requestUrl.origin))
}
