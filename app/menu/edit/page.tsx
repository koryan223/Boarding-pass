import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { MenuEditor } from "@/components/menu-editor"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function EditMenuPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login")
  }

  // Check if user is admin or staff
  const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()

  if (!roleData || !["admin", "staff"].includes(roleData.role)) {
    redirect("/menu")
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/menu">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Menu
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Weekly Menu</h1>
          <p className="text-muted-foreground text-sm">Update meal options for this week</p>
        </div>
      </div>

      <MenuEditor />
    </div>
  )
}
