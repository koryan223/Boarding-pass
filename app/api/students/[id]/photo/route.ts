import { type NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-server"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin", "staff"])

    const { id: studentId } = await params
    const formData = await request.formData()
    const file = formData.get("photo") as File

    if (!file) {
      return NextResponse.json({ error: "No photo file provided" }, { status: 400 })
    }

    // Validation for file type and size remains the same
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPEG, PNG, and WebP are allowed." }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size too large. Maximum 5MB allowed." }, { status: 400 })
    }

    const supabase = await createServerClient()
    const adminSupabase = await createAdminClient()

    const { data: student } = await supabase.from("students").select("photo_url").eq("uin", studentId).single()
    if (student?.photo_url) {
      await adminSupabase.storage.from("student-photos").remove([student.photo_url])
    }

    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "jpg"
    // We'll use a simple path for the filename now
    const filename = `${studentId}/${self.crypto.randomUUID()}.${fileExtension}`

    const { error: uploadError } = await adminSupabase.storage
      .from("student-photos")
      .upload(filename, file, { cacheControl: "3600", upsert: true })

    if (uploadError) {
      console.error("[v0] Photo upload error:", uploadError)
      return NextResponse.json({ error: "Failed to upload photo" }, { status: 500 })
    }

    // Update student record with the new filename
    const { error: updateError } = await adminSupabase
      .from("students")
      .update({ photo_url: filename })
      .eq("uin", studentId)

    if (updateError) {
      await adminSupabase.storage.from("student-photos").remove([filename]) // Clean up on error
      console.error("[v0] Database update error:", updateError)
      return NextResponse.json({ error: "Failed to update student record" }, { status: 500 })
    }

    // Create a new signed URL to return to the client for immediate display
    const { data: signedUrlData, error: signedUrlError } = await adminSupabase.storage
      .from("student-photos")
      .createSignedUrl(filename, 3600) // 1 hour expiration

    if (signedUrlError) {
      console.error("[v0] Signed URL generation error after upload:", signedUrlError)
      // The upload succeeded, so we don't need to fail the whole request.
      // The client can fetch the new URL on the next load.
      return NextResponse.json({ message: "Photo uploaded but failed to generate immediate URL." })
    }

    return NextResponse.json({
      message: "Photo uploaded successfully",
      photoUrl: signedUrlData.signedUrl, // Return the temporary signed URL
    })
  } catch (error) {
    console.error("[v0] Photo upload API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin", "staff"])
    const { id: studentId } = await params
    const adminSupabase = createAdminClient()

    const { data: student, error: studentError } = await adminSupabase
      .from("students")
      .select("photo_url")
      .eq("uin", studentId)
      .single()

    if (studentError || !student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    if (student.photo_url) {
      await adminSupabase.storage.from("student-photos").remove([student.photo_url])
    }

    const { error: updateError } = await adminSupabase.from("students").update({ photo_url: null }).eq("uin", studentId)

    if (updateError) {
      return NextResponse.json({ error: "Failed to update student record" }, { status: 500 })
    }

    return NextResponse.json({ message: "Photo deleted successfully" })
  } catch (error) {
    console.error("[v0] Photo deletion API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
