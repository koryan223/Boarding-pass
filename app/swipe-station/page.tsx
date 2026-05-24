import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { SessionManager } from "@/components/session-manager"
import { MealSwipeInterface } from "@/components/meal-swipe-interface"
import { SignOutButton } from "@/components/sign-out-button"

export default async function SwipeStationPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login")
  }

  // Verify dining_station role
  const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()

  if (roleData?.role !== "dining_station") {
    redirect("/dashboard")
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Meal Swipe Station</h1>
          <p className="text-muted-foreground">Process student meal swipes</p>
        </div>
        <div className="flex items-center gap-4">
          <SessionManager />
          <SignOutButton />
        </div>
      </div>

      <MealSwipeInterface />
    </div>
  )
}
