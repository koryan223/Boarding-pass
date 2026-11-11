import type { SupabaseClient } from "@supabase/supabase-js"

// Every deleted swipe is copied into the audit log, so deleting all swipes for
// many students in one statement can run past the database's 8 second
// statement limit. Deleting a few students' swipes at a time keeps each
// statement short however many swipes there are.
const STUDENTS_PER_STATEMENT = 20

export async function deleteSwipesForStudents(supabase: SupabaseClient, uins: string[]) {
  for (let start = 0; start < uins.length; start += STUDENTS_PER_STATEMENT) {
    const { error } = await supabase
      .from("meal_swipes")
      .delete()
      .in("student_uin", uins.slice(start, start + STUDENTS_PER_STATEMENT))
    if (error) return { error }
  }
  return { error: null }
}
