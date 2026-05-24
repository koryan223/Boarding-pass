"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, LogOut, RefreshCw, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function PendingApprovalPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  // Create client once
  const [supabase] = useState(() => createClient())

  const checkAuth = useCallback(async () => {
    try {
      setError(null)
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        // ROBUST ERROR HANDLING:
        // Ignore "Failed to fetch", "AbortError", and "Network request failed"
        const msg = authError.message || ""
        if (
          msg.includes("fetch") || 
          msg.includes("network") || 
          msg.includes("abort") || 
          authError.name === "AbortError" || 
          authError.name === "TypeError"
        ) {
          console.log("[PendingPage] Network interrupted, staying on page.")
          // Stop loading but DO NOT redirect. This breaks the loop.
          setIsLoading(false)
          setError("Network connection unstable. Please refresh if needed.")
          return
        }
        throw authError
      }
      
      if (!user) {
        console.log("No user found, redirecting to login")
        router.replace("/auth/login")
        return
      }
      
      setUserEmail(user.email || null)
      setIsLoading(false)
    } catch (err) {
      console.error("Error checking auth:", err)
      // Double check catch block for fetch errors
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("fetch") || msg.includes("network")) {
         setIsLoading(false)
         return
      }
      
      setError(msg || "Authentication failed")
      setIsLoading(false)
    }
  }, [supabase, router])

  useEffect(() => {
    let isMounted = true
    
    checkAuth()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return
      
      if (event === "SIGNED_OUT") {
        router.replace("/auth/login")
      } else if (session?.user) {
        setUserEmail(session.user.email || null)
        setIsLoading(false)
      }
    })
    
    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase, router, checkAuth])

  const handleCheckStatus = async () => {
    setIsChecking(true)
    setError(null)
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error || !user) {
        throw error || new Error("No user found")
      }

      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("id", user.id)
        .single()
      
      if (roleError) throw roleError
      
      if (roleData && roleData.role !== "pending") {
        switch (roleData.role) {
          case "admin":
            router.push("/admin")
            break
          case "staff":
            router.push("/dashboard")
            break
          case "dining_station":
            router.push("/swipe-station")
            break
          default:
            router.push("/")
        }
      }
    } catch (error) {
      console.error("Error checking status:", error)
      setError("Failed to check status. Please try again.")
    } finally {
      setIsChecking(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error("Error signing out:", error)
    } finally {
      router.push("/auth/login")
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="text-2xl">Pending Approval</CardTitle>
          <CardDescription>
            Your account is awaiting administrator approval
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-muted p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Signed in as</p>
            <p className="font-medium">{userEmail || "Loading..."}</p>
          </div>
          
          <p className="text-sm text-muted-foreground text-center">
            An administrator will review your account and assign you the appropriate role. 
            You will be able to access the system once your account has been approved.
          </p>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-3">
            <Button 
              onClick={handleCheckStatus} 
              disabled={isChecking}
              className="w-full"
            >
              {isChecking ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Check Approval Status
                </>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleSignOut}
              className="w-full bg-transparent"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
