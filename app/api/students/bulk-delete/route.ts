import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireRole } from "@/lib/auth-server"

export async function POST(request: NextRequest) {
  try {
    console.log("[SERVER][v0] Bulk delete students API called")

    const { user } = await requireRole(["admin", "staff"])

    const adminSupabase = createAdminClient()

    const { uins } = await request.json()

    if (!Array.isArray(uins) || uins.length === 0) {
      return NextResponse.json({ error: "Invalid UINs provided" }, { status: 400 })
    }

    console.log(`[SERVER][v0] Deleting ${uins.length} students:`, uins)

    // First get the student data before deletion for audit trail
    const { data: studentsToDelete, error: fetchError } = await adminSupabase
      .from("students")
      .select("*")
      .in("uin", uins)

    if (fetchError) {
      console.error("[SERVER][v0] Error fetching students for deletion:", fetchError)
      return NextResponse.json({ error: "Failed to fetch students for deletion" }, { status: 500 })
    }

    const { data: existingSwipes, error: checkError } = await adminSupabase
      .from("meal_swipes")
      .select("id, student_uin")
      .in("student_uin", uins)

    if (checkError) {
      console.error("[SERVER][v0] Error checking existing meal swipes:", checkError)
    } else {
      console.log(`[SERVER][v0] Found ${existingSwipes?.length || 0} meal swipes to delete for students:`, uins)
    }

    console.log(`[SERVER][v0] Deleting meal swipes using admin client for students:`, uins)
    const { error: mealSwipesDeleteError, count: deletedSwipesCount } = await adminSupabase
      .from("meal_swipes")
      .delete()
      .in("student_uin", uins)

    if (mealSwipesDeleteError) {
      console.error("[SERVER][v0] Error deleting meal swipes:", mealSwipesDeleteError)
      return NextResponse.json({ error: "Failed to delete associated meal swipes" }, { status: 500 })
    }

    console.log(`[SERVER][v0] Successfully deleted ${deletedSwipesCount || 0} meal swipes`)

    const { data: remainingSwipes, error: verifyError } = await adminSupabase
      .from("meal_swipes")
      .select("id, student_uin")
      .in("student_uin", uins)

    if (verifyError) {
      console.error("[SERVER][v0] Error verifying meal swipes deletion:", verifyError)
    } else if (remainingSwipes && remainingSwipes.length > 0) {
      console.error("[SERVER][v0] WARNING: Some meal swipes still exist:", remainingSwipes)
      return NextResponse.json({ error: "Failed to completely delete associated meal swipes" }, { status: 500 })
    }

    // Log the deletion for audit trail with correct column names
    if (studentsToDelete && studentsToDelete.length > 0) {
      const { error: logError } = await adminSupabase.from("student_deletion_log").insert(
        studentsToDelete.map((student) => ({
          deleted_student_uin: student.uin,
          deleted_student_name: `${student.first_name} ${student.last_name}`,
          deleted_student_data: student,
          deleted_by_user_id: user.id,
          deleted_by_user_email: user.email,
          deleted_by_user_role: user.role,
          reason: "Bulk deletion",
        })),
      )

      if (logError) {
        console.error("[SERVER][v0] Error logging bulk deletion:", logError)
      }
    }

    const { error: deleteError, count } = await adminSupabase.from("students").delete().in("uin", uins)

    if (deleteError) {
      console.error("[SERVER][v0] Error deleting students:", deleteError)
      return NextResponse.json({ error: "Failed to delete students" }, { status: 500 })
    }

    console.log(`[SERVER][v0] Successfully deleted ${count} students`)

    return NextResponse.json({
      success: true,
      deletedCount: count,
      message: `Successfully deleted ${count} students`,
    })
  } catch (error) {
    console.error("[SERVER][v0] Bulk delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
