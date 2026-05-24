"use client"

import { useEffect, useRef } from "react"

export function ErrorBoundaryClient() {
  const hasRedirectedRef = useRef(false)

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason
      const errorMessage = (error?.message || String(error)).toLowerCase()
      const errorStack = error?.stack || ""

      // Check if this is an auth-related fetch error from Supabase
      const isAuthError = errorStack.includes("auth-js") || errorStack.includes("supabase")
      const isSessionError = 
        errorMessage.includes("jwt") || 
        errorMessage.includes("expired") || 
        errorMessage.includes("session") ||
        errorMessage.includes("refresh")

      // If it's a Supabase auth error, handle by redirecting to login
      if (isAuthError && (errorMessage.includes("failed to fetch") || isSessionError)) {
        event.preventDefault()
        
        // Only redirect once to avoid loops
        if (!hasRedirectedRef.current && !window.location.pathname.startsWith("/auth/")) {
          hasRedirectedRef.current = true
          
          // Clear auth cookies
          document.cookie.split(";").forEach((c) => {
            const name = c.trim().split("=")[0]
            if (name.includes("sb-") || name.includes("auth")) {
              document.cookie = `${name}=; Max-Age=-1; path=/`
            }
          })
          
          // Redirect to login
          window.location.href = "/auth/login"
        }
        return
      }

      // Suppress other fetch errors that occur during page navigation
      if (
        errorMessage.includes("failed to fetch") ||
        errorMessage.includes("fetch failed") ||
        errorMessage.includes("aborted") ||
        error?.name === "AbortError"
      ) {
        event.preventDefault()
        return
      }
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection)

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
    }
  }, [])

  return null
}
