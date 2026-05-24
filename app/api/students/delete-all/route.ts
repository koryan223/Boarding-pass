import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/auth-server"

export async function POST(request: NextRequest) {
  try {
    console.log("[SERVER][v0] Delete all students API called")

    const supabase = await createServerClient()
    const user = await requireRole(supabase, ["admin", "staff"])

    const { data: students, error: fetchError } = await supabase.from("students").select("*")

    if (fetchError) {
      console.error("[SERVER][v0] Error fetching students for deletion:", fetchError)
      return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 })
    }

    if (!students || students.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        message: "No students to delete",
      })
    }

    console.log(`[SERVER][v0] Deleting all ${students.length} students`)

    console.log("[SERVER][v0] Deleting all meal swipes first")
    const { error: mealSwipesDeleteError } = await supabase.from("meal_swipes").delete().neq("student_uin", "") // Delete all meal swipes

    if (mealSwipesDeleteError) {
      console.error("[SERVER][v0] Error deleting all meal swipes:", mealSwipesDeleteError)
      return NextResponse.json({ error: "Failed to delete associated meal swipes" }, { status: 500 })
    }

    const { error: logError } = await supabase.from("student_deletion_log").insert(
      students.map((student) => ({
        deleted_student_uin: student.uin,
        deleted_student_name: `${student.first_name} ${student.last_name}`,
        deleted_student_data: student,
        deleted_by_user_id: user.id,
        deleted_by_user_email: user.email,
        deleted_by_user_role: user.role,
        reason: "Mass deletion - Delete All",
      })),
    )

    if (logError) {
      console.error("[SERVER][v0] Error logging mass deletion:", logError)
    }

    // Delete all students
    const { error: deleteError, count } = await supabase.from("students").delete().neq("uin", "") // Delete all records (using a condition that matches all)

    if (deleteError) {
      console.error("[SERVER][v0] Error deleting all students:", deleteError)
      return NextResponse.json({ error: "Failed to delete all students" }, { status: 500 })
    }

    console.log(`[SERVER][v0] Successfully deleted all ${count} students`)

    return NextResponse.json({
      success: true,
      deletedCount: count,
      message: `Successfully deleted all ${count} students`,
    })
  } catch (error) {
    console.error("[SERVER][v0] Delete all error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
