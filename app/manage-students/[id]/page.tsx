import { notFound, redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { getStudentById } from "@/lib/student-management"
import { StudentDetailView } from "@/components/student-detail-view"

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login")
  }

  // Check user role
  const { data: roleData } = await supabase.from("user_roles").select("role").eq("id", user.id).single()

  const userRole = roleData?.role
  if (!userRole || !["admin", "staff"].includes(userRole)) {
    redirect("/dashboard")
  }

  const student = await getStudentById(id)
  if (!student) {
    notFound()
  }

  return <StudentDetailView student={student} user={user} userRole={userRole} />
}
