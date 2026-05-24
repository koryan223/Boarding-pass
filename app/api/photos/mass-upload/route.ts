import { type NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-server"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { findStudentMatch, validatePhotoFilename } from "@/lib/photo-matching"

interface PhotoProcessingResult {
  filename: string
  uin: string
  status: "success" | "failed" | "no-student"
  message: string
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(["admin", "staff"])

    const formData = await request.formData()
    const photos = formData.getAll("photos") as File[]

    if (!photos || photos.length === 0) {
      return NextResponse.json({ error: "No photos provided" }, { status: 400 })
    }

    console.log(`[v0] Processing ${photos.length} photos for mass upload`)

    const supabase = await createServerClient()
    const adminSupabase = await createAdminClient()

    const { data: allStudents, error: studentsError } = await supabase
      .from("students")
      .select("uin, first_name, last_name, photo_url")

    if (studentsError) {
      console.error("[v0] Error fetching students:", studentsError)
      return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 })
    }

    const studentMap = new Map(allStudents.map((student) => [student.uin, student]))
    const results: PhotoProcessingResult[] = []
    let successful = 0
    let failed = 0

    for (const photo of photos) {
      const result = await processPhoto(photo, studentMap, adminSupabase)
      results.push(result)

      if (result.status === "success") {
        successful++
      } else {
        failed++
      }
    }

    console.log(`[v0] Mass upload complete: ${successful} successful, ${failed} failed`)

    return NextResponse.json({
      success: successful > 0,
      message:
        successful > 0
          ? `Successfully uploaded ${successful} photos${failed > 0 ? ` (${failed} failed)` : ""}`
          : "No photos were uploaded successfully",
      processed: photos.length,
      successful,
      failed,
      results,
    })
  } catch (error) {
    console.error("[v0] Mass photo upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function processPhoto(
  photo: File,
  studentMap: Map<string, any>,
  adminSupabase: any,
): Promise<PhotoProcessingResult> {
  try {
    const validation = validatePhotoFilename(photo.name)
    if (!validation.isValid) {
      return {
        filename: photo.name,
        uin: "unknown",
        status: "failed",
        message: validation.issues.join(", "),
      }
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(photo.type)) {
      return {
        filename: photo.name,
        uin: "unknown",
        status: "failed",
        message: "Invalid file type",
      }
    }

    if (photo.size > 5 * 1024 * 1024) {
      return {
        filename: photo.name,
        uin: "unknown",
        status: "failed",
        message: "File too large (max 5MB)",
      }
    }

    const allStudents = Array.from(studentMap.values())
    const match = findStudentMatch(photo.name, allStudents)

    if (!match) {
      return {
        filename: photo.name,
        uin: "unknown",
        status: "no-student",
        message: "No matching student found",
      }
    }

    const student = studentMap.get(match.uin)
    if (!student) {
      return {
        filename: photo.name,
        uin: match.uin,
        status: "no-student",
        message: "Student not found in database",
      }
    }

    if (student.photo_url && !student.photo_url.includes("/placeholder.svg")) {
      try {
        await adminSupabase.storage.from("student-photos").remove([student.photo_url])
      } catch (error) {
        console.log(`[v0] Could not remove existing photo for ${match.uin}:`, error)
        // Continue with upload even if removal fails
      }
    }

    const fileExtension = photo.name.split(".").pop()?.toLowerCase() || "jpg"
    const filename = `${match.uin}/${self.crypto.randomUUID()}.${fileExtension}`

    const { error: uploadError } = await adminSupabase.storage
      .from("student-photos")
      .upload(filename, photo, { cacheControl: "3600", upsert: true })

    if (uploadError) {
      console.error(`[v0] Upload error for ${match.uin}:`, uploadError)
      return {
        filename: photo.name,
        uin: match.uin,
        status: "failed",
        message: "Upload failed",
      }
    }

    const { error: updateError } = await adminSupabase
      .from("students")
      .update({ photo_url: filename })
      .eq("uin", match.uin)

    if (updateError) {
      await adminSupabase.storage.from("student-photos").remove([filename])
      console.error(`[v0] Database update error for ${match.uin}:`, updateError)
      return {
        filename: photo.name,
        uin: match.uin,
        status: "failed",
        message: "Database update failed",
      }
    }

    const confidenceText = match.confidence === "high" ? "" : ` (${match.confidence} confidence)`
    return {
      filename: photo.name,
      uin: match.uin,
      status: "success",
      message: `Uploaded for ${student.first_name} ${student.last_name}${confidenceText}`,
    }
  } catch (error) {
    console.error(`[v0] Error processing photo ${photo.name}:`, error)
    return {
      filename: photo.name,
      uin: "unknown",
      status: "failed",
      message: "Processing error",
    }
  }
}
