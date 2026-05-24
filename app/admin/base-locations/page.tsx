import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { BaseLocationManager } from "@/components/base-location-manager"

export default async function BaseLocationsPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login")
  }

  // Verify admin role
  const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()

  if (roleData?.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8 flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Base Location Management</h1>
          <p className="text-muted-foreground">Manage dining locations for student assignments</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
          <CardDescription>View and add dining locations</CardDescription>
        </CardHeader>
        <CardContent>
          <BaseLocationManager />
        </CardContent>
      </Card>
    </div>
  )
}
