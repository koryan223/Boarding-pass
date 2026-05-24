import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { MenuDisplay } from "@/components/menu-display"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, Pencil } from "lucide-react"

export default async function MenuPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login")
  }

  // Get user role
  const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()

  const role = roleData?.role || "dining_station"
  const canEdit = role === "admin" || role === "staff"

  // Determine back link based on role
  const backLink = role === "admin" ? "/admin" : "/dashboard"

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={backLink}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Weekly Menu</h1>
            <p className="text-muted-foreground text-sm">View this week&#39;s meal options</p>
          </div>
        </div>
        {canEdit && (
          <Button asChild>
            <Link href="/menu/edit">
              <Pencil className="h-4 w-4 mr-2" />
              Edit Menu
            </Link>
          </Button>
        )}
      </div>

      <MenuDisplay />
    </div>
  )
}
