import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SessionManager } from "@/components/session-manager"
import Link from "next/link"
import { MealSwipeInterface } from "@/components/meal-swipe-interface"
import { MealCreditResetButton } from "@/components/meal-credit-reset-button"
import { SignOutButton } from "@/components/sign-out-button"

export default async function AdminPage() {
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">System administration and management</p>
        </div>
        <div className="flex items-center gap-4">
          <MealCreditResetButton />
          <SessionManager />
          <SignOutButton />
        </div>
      </div>

      <div className="mb-8">
        <MealSwipeInterface />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Menu Management</CardTitle>
            <CardDescription>View and edit weekly meal menus</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/menu">View & Edit Menu</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Student Management</CardTitle>
            <CardDescription>View, edit, and manage all student records</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/manage-students">Manage Students</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Past Sessions</CardTitle>
            <CardDescription>View completed meal swipe sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/dashboard/past-sessions">View Past Sessions</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Manage user accounts and roles</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/users">Manage Users</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Group Management</CardTitle>
            <CardDescription>Organize students into groups and teams</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/groups">Manage Groups</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Base Locations</CardTitle>
            <CardDescription>Manage dining location assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/base-locations">Manage Locations</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reports</CardTitle>
            <CardDescription>Generate comprehensive reports</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/reports">Admin Reports</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
