"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut, RefreshCw } from "lucide-react"

export function PendingApprovalActions() {
  const [isChecking, setIsChecking] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleCheckStatus = async () => {
    setIsChecking(true)
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

  return (
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
  )
}
