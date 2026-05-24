import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { PastSessions } from "@/components/past-sessions"

export default async function PastSessionsPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login")
  }

  const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()
  const role = roleData?.role || "staff"
  const backUrl = role === "admin" ? "/admin" : "/dashboard"

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={backUrl}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Past Sessions</h1>
          <p className="text-muted-foreground">View completed meal swipe sessions</p>
        </div>
      </div>

      <PastSessions />
    </div>
  )
}
