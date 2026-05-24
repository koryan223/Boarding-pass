"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, AlertTriangle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"

export function MealCreditResetButton() {
  const [isResetting, setIsResetting] = useState(false)
  const { toast } = useToast()

  const handleReset = async () => {
    setIsResetting(true)

    try {
      console.log("[v0] Initiating manual meal credit reset")

      console.log("[v0] Making fetch request to /api/reset-meal-credits")

      const response = await fetch("/api/reset-meal-credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      console.log("[v0] Response status:", response.status)
      console.log("[v0] Response ok:", response.ok)

      const data = await response.json()
      console.log("[v0] Response data:", data)

      if (!response.ok) {
        console.log("[v0] Response not ok, throwing error:", data.error)
        throw new Error(data.error || "Failed to reset meal credits")
      }

      console.log("[v0] Reset successful:", data)

      toast({
        title: "Reset Successful",
        description: data.message,
        duration: 5000,
      })
    } catch (error) {
      console.error("[v0] Reset failed:", error)

      toast({
        title: "Reset Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
          disabled={isResetting}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isResetting ? "animate-spin" : ""}`} />
          {isResetting ? "Resetting..." : "Reset Meal Credits"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Reset All Meal Credits
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will reset all students' weekly meal credits to their meal plan values. This action cannot be undone
            and will affect all students in the system.
            <br />
            <br />
            Are you sure you want to proceed?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleReset} className="bg-amber-600 hover:bg-amber-700">
            Yes, Reset Credits
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
