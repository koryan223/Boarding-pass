import { createServerClient } from "@supabase/ssr"
import type { EmailOtpType } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? "/"

  console.log("[v0] Auth confirm triggered:", { hasTokenHash: !!token_hash, type, next })

  if (token_hash && type) {
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

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      console.log(
        "[v0] OTP verified successfully, redirecting to:",
        type === "recovery" ? "/auth/reset-password" : next,
      )
      // For password recovery, always go to reset-password page
      if (type === "recovery") {
        redirect("/auth/reset-password")
      }
      redirect(next)
    } else {
      console.error("[v0] OTP verification error:", error.message)
      redirect(`/auth/login?error=${encodeURIComponent(error.message)}`)
    }
  }

  console.log("[v0] No token_hash or type, redirecting to login")
  redirect("/auth/login?error=Invalid+reset+link")
}
