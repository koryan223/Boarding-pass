import { type NextRequest, NextResponse } from "next/server"
import { processSwipe } from "@/lib/meal-swipes"

console.log("[SERVER][v0] API route file loaded")

export async function POST(request: NextRequest) {
  console.log("[SERVER][v0] POST function called - ENTRY POINT")

  try {
    console.log("[SERVER][v0] API route called")

    let requestData
    try {
      requestData = await request.json()
      console.log("[SERVER][v0] Request data:", requestData)
    } catch (parseError) {
      console.log("[SERVER][v0] Failed to parse request JSON:", parseError)
      return NextResponse.json({ success: false, message: "Invalid JSON in request" }, { status: 400 })
    }

    const { studentUin, sessionId } = requestData // Removed location from destructuring

    if (!studentUin || typeof studentUin !== "string") {
      console.log("[SERVER][v0] Invalid UIN provided:", studentUin)
      return NextResponse.json({ success: false, message: "Student UIN is required" }, { status: 400 })
    }

    console.log("[SERVER][v0] Calling processSwipe function")
    const result = await processSwipe(studentUin, sessionId) // Removed location parameter
    console.log("[SERVER][v0] processSwipe result:", result)

    return NextResponse.json(result)
  } catch (error) {
    console.error("[SERVER][v0] Meal swipe error:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}
