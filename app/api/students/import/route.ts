import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

interface StudentRow {
  UIN: string
  Fname: string
  Lname: string
  room_number: string | null
  meal_plan: string
  group: string | null
  base_location: string | null
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Allow": "POST, OPTIONS",
    },
  })
}

export async function POST(request: NextRequest) {
  console.log("[v0] CSV import POST request received")
  try {
    console.log("[v0] CSV import API called")

    // Check authentication and role
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: userRole } = await supabase.from("user_roles").select("role").eq("id", user.id).single()

    if (!userRole || !["admin", "staff"].includes(userRole.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    console.log("[v0] User authorized for import:", userRole.role)

    // Parse form data
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json({ error: "Invalid file type. Only CSV files are allowed." }, { status: 400 })
    }

    console.log("[v0] Processing CSV file:", file.name)

    // Read and parse CSV
    const csvText = await file.text()
    const lines = csvText.split("\n").filter((line) => line.trim())

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV file must contain at least a header row and one data row" },
        { status: 400 },
      )
    }

    // Parse header
    const header = lines[0].split(",").map((col) => col.trim().replace(/"/g, ""))
    const requiredColumns = ["UIN", "Fname", "Lname", "room_number", "meal_plan"]

    // Validate header - only required columns
    const missingColumns = requiredColumns.filter((col) => !header.includes(col))
    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required columns: ${missingColumns.join(", ")}. Expected: ${requiredColumns.join(", ")} (group column is optional)`,
        },
        { status: 400 },
      )
    }

    const hasGroupColumn = header.includes("group")
    const hasBaseLocationColumn = header.includes("base_location")
    console.log("[v0] CSV header validated, has group column:", hasGroupColumn, ", has base_location column:", hasBaseLocationColumn)

    // Parse data rows
    const students: StudentRow[] = []
    const errors: string[] = []
    const seenUINs = new Set<string>()

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(",").map((cell) => cell.trim().replace(/"/g, ""))

      if (row.length < requiredColumns.length) {
        errors.push(`Row ${i + 1}: Column count mismatch`)
        continue
      }

      const studentData: any = {}
      header.forEach((col, index) => {
        studentData[col] = row[index] || ""
      })

      // Validate student data
      const uin = studentData.UIN
      const fname = studentData.Fname
      const lname = studentData.Lname
      const roomNumber = studentData.room_number
      const mealPlan = studentData.meal_plan
      const group = hasGroupColumn ? studentData.group || null : null
      const baseLocation = hasBaseLocationColumn ? studentData.base_location || null : null

      // Validation
      if (!uin || !/^\d{2,9}$/.test(uin)) {
        errors.push(`Row ${i + 1}: Invalid UIN (must be 2-9 digits)`)
        continue
      }

      if (seenUINs.has(uin)) {
        errors.push(`Row ${i + 1}: Duplicate UIN ${uin} found in CSV`)
        continue
      }
      seenUINs.add(uin)

      if (!fname || !lname) {
        errors.push(`Row ${i + 1}: First name and last name are required`)
        continue
      }

      let validatedRoomNumber: string | null = null
      if (roomNumber && roomNumber.trim() !== "") {
        if (!/^\d{3}[A-Za-z]$/.test(roomNumber)) {
          errors.push(
            `Row ${i + 1}: Invalid room number format (must be 3 digits followed by a letter, or leave empty)`,
          )
          continue
        }
        validatedRoomNumber = roomNumber.toUpperCase()
      }

      if (!mealPlan || !/^\d+$/.test(mealPlan)) {
        errors.push(`Row ${i + 1}: Invalid meal plan (must be a number, 0 for count-only)`)
        continue
      }

      const mealPlanNum = Number.parseInt(mealPlan)
      if (mealPlanNum < 0) {
        errors.push(`Row ${i + 1}: Invalid meal plan (must be 0 or positive)`)
        continue
      }

      students.push({
        UIN: uin,
        Fname: fname,
        Lname: lname,
        room_number: validatedRoomNumber,
        meal_plan: mealPlan,
        group: group && group.trim() !== "" ? group.trim() : null,
        base_location: baseLocation && baseLocation.trim() !== "" ? baseLocation.trim() : null,
      })
    }

    console.log("[v0] Parsed students:", students.length, "Errors:", errors.length)

    if (students.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No valid students to import",
        imported: 0,
        failed: lines.length - 1,
        errors,
      })
    }

    const adminSupabase = createAdminClient()

    // Process base locations
    const locationNames = [...new Set(students.map((s) => s.base_location).filter((l): l is string => l !== null))]
    const locationMap = new Map<string, string>() // location name -> location id

    if (locationNames.length > 0) {
      console.log("[v0] Processing base locations:", locationNames)

      // Fetch existing locations
      const { data: existingLocations } = await adminSupabase
        .from("locations")
        .select("id, name")
      
      if (existingLocations) {
        for (const location of existingLocations) {
          locationMap.set(location.name.toLowerCase(), location.id)
        }
      }

      // Check for locations that don't exist
      const missingLocations = locationNames.filter(name => !locationMap.has(name.toLowerCase()))
      if (missingLocations.length > 0) {
        console.log("[v0] Warning: Some locations do not exist:", missingLocations)
        // Add warnings to errors for missing locations
        for (const loc of missingLocations) {
          errors.push(`Warning: Base location "${loc}" does not exist and will be skipped`)
        }
      }
    }

    const groupNames = [...new Set(students.map((s) => s.group).filter((g): g is string => g !== null))]
    const groupMap = new Map<string, string>() // group name -> group id

    if (groupNames.length > 0) {
      console.log("[v0] Processing groups:", groupNames)

      // Fetch existing groups
      const { data: existingGroups } = await adminSupabase.from("groups").select("id, name").in("name", groupNames)

      if (existingGroups) {
        for (const group of existingGroups) {
          groupMap.set(group.name.toLowerCase(), group.id)
        }
      }

      // Create missing groups
      for (const groupName of groupNames) {
        if (!groupMap.has(groupName.toLowerCase())) {
          console.log("[v0] Creating new group:", groupName)
          const { data: newGroup, error: createError } = await adminSupabase
            .from("groups")
            .insert({ name: groupName })
            .select("id, name")
            .single()

          if (newGroup && !createError) {
            groupMap.set(newGroup.name.toLowerCase(), newGroup.id)
          } else {
            console.error("[v0] Failed to create group:", groupName, createError)
          }
        }
      }
    }

    let imported = 0
    let failed = 0
    let groupsAssigned = 0
    let locationsAssigned = 0
    const failureDetails: string[] = []

    const batchSize = 50
    for (let i = 0; i < students.length; i += batchSize) {
      const batch = students.slice(i, i + batchSize)
      const studentsToInsert = batch.map((student) => {
        const mealPlanNum = Number.parseInt(student.meal_plan)
        const isCountOnly = mealPlanNum === 0
        const groupId = student.group ? groupMap.get(student.group.toLowerCase()) || null : null
        const baseLocationId = student.base_location ? locationMap.get(student.base_location.toLowerCase()) || null : null
        return {
          uin: student.UIN,
          first_name: student.Fname,
          last_name: student.Lname,
          room_number: student.room_number,
          meal_plan: mealPlanNum,
          weekly_credits: isCountOnly ? 0 : mealPlanNum,
          meal_plan_type: isCountOnly ? "count" : "standard",
          photo_url: "/placeholder.svg?height=150&width=150",
          group_id: groupId,
          base_location_id: baseLocationId,
        }
      })

      try {
        console.log(`[v0] Inserting batch ${Math.floor(i / batchSize) + 1} (${batch.length} students)`)

        const { data, error } = await adminSupabase.from("students").insert(studentsToInsert).select()

        if (error) {
          console.error("[v0] Batch insert error:", error.code, error.message)
          // If batch fails, try inserting one by one to identify specific failures
          for (let j = 0; j < batch.length; j++) {
            const student = batch[j]
            const studentToInsert = studentsToInsert[j]
            try {
              const { error: singleError } = await adminSupabase.from("students").insert(studentToInsert)

              if (singleError) {
                console.error("[v0] Insert error for UIN", student.UIN, ":", singleError.code, singleError.message)
                if (singleError.code === "23505") {
                  const msg = `UIN ${student.UIN} (${student.Fname} ${student.Lname}) already exists`
                  errors.push(msg)
                  failureDetails.push(msg)
                } else {
                  const msg = `UIN ${student.UIN}: ${singleError.message}`
                  errors.push(msg)
                  failureDetails.push(msg)
                }
                failed++
              } else {
                imported++
                if (studentToInsert.group_id) groupsAssigned++
                if (studentToInsert.base_location_id) locationsAssigned++
              }
            } catch (err) {
              console.error("[v0] Exception inserting student:", err)
              const msg = `UIN ${student.UIN}: ${err instanceof Error ? err.message : "Unknown error"}`
              errors.push(msg)
              failureDetails.push(msg)
              failed++
            }
          }
        } else {
          const insertedCount = data?.length || batch.length
          imported += insertedCount
          groupsAssigned += studentsToInsert.filter((s) => s.group_id).length
          locationsAssigned += studentsToInsert.filter((s) => s.base_location_id).length
          console.log(`[v0] Batch inserted successfully: ${insertedCount} students`)
        }
      } catch (error) {
        console.error("[v0] Batch exception:", error)
        // Try individual inserts as fallback
        for (let j = 0; j < batch.length; j++) {
          const student = batch[j]
          const studentToInsert = studentsToInsert[j]
          try {
            const { error: singleError } = await adminSupabase.from("students").insert(studentToInsert)

            if (singleError) {
              failed++
              const msg = `UIN ${student.UIN}: ${singleError.message}`
              errors.push(msg)
              failureDetails.push(msg)
            } else {
              imported++
              if (studentToInsert.group_id) groupsAssigned++
              if (studentToInsert.base_location_id) locationsAssigned++
            }
          } catch (err) {
            failed++
            const msg = `UIN ${student.UIN}: ${err instanceof Error ? err.message : "Unknown error"}`
            errors.push(msg)
            failureDetails.push(msg)
          }
        }
      }
    }

    console.log("[v0] Import complete. Imported:", imported, "Failed:", failed, "Groups assigned:", groupsAssigned, "Locations assigned:", locationsAssigned)
    if (failureDetails.length > 0) {
      console.log("[v0] Failed imports:", failureDetails.slice(0, 10))
    }

    const groupMessage = groupsAssigned > 0 ? `, ${groupsAssigned} assigned to groups` : ""
    const locationMessage = locationsAssigned > 0 ? `, ${locationsAssigned} assigned to locations` : ""

    return NextResponse.json({
      success: imported > 0,
      message:
        imported > 0
          ? `Successfully imported ${imported} students${groupMessage}${locationMessage}${failed > 0 ? ` (${failed} failed)` : ""}`
          : "No students were imported",
      imported,
      failed,
      groupsAssigned,
      locationsAssigned,
      errors: errors.slice(0, 20),
      totalErrors: errors.length,
    })
  } catch (error) {
    console.error("[v0] CSV import error:", error)
    return NextResponse.json({ error: "Internal server error during import" }, { status: 500 })
  }
}
