"use client"

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react"
import { getCurrentSession, autoCloseStaleSessions, getSessionSwipeCount, type Session } from "@/lib/sessions"
import { createClient } from "@/lib/supabase/client"

interface SessionContextType {
  currentSession: Session | null
  setCurrentSession: (session: Session | null) => void
  refreshSession: () => Promise<void>
  sessionSwipeCount: number
  incrementSwipeCount: () => void
  resetSwipeCount: () => void
  setSwipeCount: (count: number) => void
  isAuthenticated: boolean
  setIsAuthenticated: (isAuthenticated: boolean) => void
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [sessionSwipeCount, setSessionSwipeCount] = useState(0)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const isMountedRef = useRef(true)

  const refreshSession = async () => {
    if (!isAuthenticated) return

    try {
      const { data, error } = await getCurrentSession()

      if (!isMountedRef.current) return

      if (!error) {
        setCurrentSession(data)
        if (data?.id) {
          const { count } = await getSessionSwipeCount(data.id)
          if (isMountedRef.current) {
            setSessionSwipeCount(count)
          }
        } else {
          setSessionSwipeCount(0)
        }
      } else {
        setCurrentSession(null)
        setSessionSwipeCount(0)
      }
    } catch (error) {
      if (isMountedRef.current) {
        setCurrentSession(null)
        setSessionSwipeCount(0)
      }
    }
  }

  const incrementSwipeCount = () => {
    setSessionSwipeCount((prev) => prev + 1)
  }

  const resetSwipeCount = () => {
    setSessionSwipeCount(0)
  }

  const setSwipeCount = (count: number) => {
    setSessionSwipeCount(count)
  }

  useEffect(() => {
    isMountedRef.current = true

    const initializeSession = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))

      if (!isMountedRef.current) return

      try {
        const supabase = createClient()
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()

        if (!isMountedRef.current) return

        if (error) {
           const msg = (error.message || "").toLowerCase()
           const errorName = (error.name || "").toLowerCase()
           // Ignore network errors and abort errors (happens during navigation/unmount)
           if (msg.includes("fetch") || msg.includes("network") || msg.includes("abort") || 
               errorName === "aborterror" || error.name === "AbortError" || error.name === "TypeError") {
             return
           }
           // Handle expired/invalid JWT by clearing state and redirecting
           if (msg.includes("jwt") || msg.includes("expired") || msg.includes("invalid") || msg.includes("session_not_found")) {
             setIsAuthenticated(false)
             // Redirect to login if on protected page
             if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth/")) {
               window.location.href = "/auth/login"
             }
             return
           }
           setIsAuthenticated(false)
           return
        }

        if (user) {
          setIsAuthenticated(true)
          try {
             await autoCloseStaleSessions()
          } catch (e) {
             // ignore
          }
          await refreshSession()
        } else {
          setIsAuthenticated(false)
        }
      } catch (error: unknown) {
        // Ignore abort errors - they happen during navigation/unmount
        if (error instanceof Error) {
          const msg = error.message.toLowerCase()
          const name = error.name.toLowerCase()
          if (msg.includes("abort") || msg.includes("fetch") || msg.includes("network") || name === "aborterror") {
            return
          }
        }
        if (isMountedRef.current) {
          setIsAuthenticated(false)
        }
      }
    }

    initializeSession()

    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    const interval = setInterval(
      () => {
        autoCloseStaleSessions().catch(() => {})
      },
      5 * 60 * 1000,
    )

    return () => clearInterval(interval)
  }, [isAuthenticated])

  return (
    <SessionContext.Provider
      value={{
        currentSession,
        setCurrentSession,
        refreshSession,
        sessionSwipeCount,
        incrementSwipeCount,
        resetSwipeCount,
        setSwipeCount,
        isAuthenticated,
        setIsAuthenticated,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider")
  }
  return context
}
