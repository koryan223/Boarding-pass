import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const publicRoutes = ["/", "/auth/login", "/auth/sign-up", "/auth/sign-up-success"]
const pendingRoute = "/pending-approval"
const adminRoutes = ["/admin"]
const diningStationRoutes = ["/swipe-station"]
const diningStationApiRoutes = [
  "/api/meal-swipe",
  "/api/session-swipes",
  "/api/auth/me",
  "/api/menu",
  "/api/sessions/auto-close",
  // Read-only access so dining station users can pick a location when starting a
  // session. Creating/managing locations stays admin-only (enforced in the route).
  "/api/locations",
]
const assetRoutes = ["/placeholder.svg", "/_next/static", "/favicon.ico", "/images"]

export async function updateSession(request: NextRequest) {
  console.log("[MIDDLEWARE][v0] Request to:", request.nextUrl.pathname)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("[MIDDLEWARE][v0] Supabase not configured, allowing all requests")
    return NextResponse.next({ request })
  }

  const pathname = request.nextUrl.pathname

  // Sign out and auth routes should not require valid session
  if (pathname.startsWith("/auth/signout") || pathname.startsWith("/auth/")) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
      },
    },
  })

  let user = null
  let shouldClearSession = false
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      const errorMsg = error.message.toLowerCase()
      if (errorMsg.includes("session_not_found") || errorMsg.includes("jwt") || errorMsg.includes("expired") || errorMsg.includes("invalid")) {
        shouldClearSession = true
        const authCookies = request.cookies
          .getAll()
          .filter((cookie) => cookie.name.includes("auth-token") || cookie.name.includes("sb-"))
        authCookies.forEach((cookie) => {
          supabaseResponse.cookies.delete(cookie.name)
        })
      }
    }
    user = data.user
  } catch (error) {
    // Session is invalid or expired
    shouldClearSession = true
  }

  // If session is invalid/expired and user is trying to access protected route, redirect to login
  if (shouldClearSession && !publicRoutes.includes(pathname) && !pathname.startsWith("/auth/")) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  // Get user role if authenticated
  let userRole = null
  if (user) {
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()
    userRole = roleData?.role
  }

  // Redirect unauthenticated users to login
  if (!user && !publicRoutes.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  // Role-based access control
  if (user && userRole) {
    // Pending users can only access pending approval page
    if (userRole === "pending") {
      // Allow specific API routes that are called globally (e.g. by SessionProvider)
      // This prevents the middleware from returning HTML for an API call, which crashes the client
      const allowedPendingApiRoutes = [
        "/api/sessions/auto-close", 
        "/api/auth/me"
      ]

      if (
        pathname !== pendingRoute && 
        !publicRoutes.includes(pathname) && 
        !pathname.startsWith("/auth/") &&
        !allowedPendingApiRoutes.includes(pathname)
      ) {
        console.log("[MIDDLEWARE][v0] Pending user redirected from:", pathname, "to:", pendingRoute)
        const url = request.nextUrl.clone()
        url.pathname = pendingRoute
        return NextResponse.redirect(url)
      }
      return supabaseResponse
    }
    
    // Non-pending users should not access pending-approval page
    if (pathname === pendingRoute) {
      const url = request.nextUrl.clone()
      switch (userRole) {
        case "admin":
          url.pathname = "/admin"
          break
        case "staff":
          url.pathname = "/dashboard"
          break
        case "dining_station":
          url.pathname = "/swipe-station"
          break
        default:
          url.pathname = "/"
      }
      return NextResponse.redirect(url)
    }
    
    // Admin has access to everything
    if (userRole === "admin") {
      return supabaseResponse
    }

    // Staff cannot access admin or dining station routes
    if (userRole === "staff") {
      if (
        adminRoutes.some((route) => pathname.startsWith(route)) ||
        diningStationRoutes.some((route) => pathname.startsWith(route))
      ) {
        const url = request.nextUrl.clone()
        url.pathname = "/dashboard"
        return NextResponse.redirect(url)
      }
    }

    // Dining station can only access swipe station
    if (userRole === "dining_station") {
      const allowedForDiningStation =
        diningStationRoutes.some((route) => pathname.startsWith(route)) ||
        diningStationApiRoutes.some((route) => pathname.startsWith(route)) ||
        assetRoutes.some((route) => pathname.startsWith(route)) ||
        publicRoutes.includes(pathname)

      if (!allowedForDiningStation) {
        const url = request.nextUrl.clone()
        url.pathname = "/swipe-station"
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
