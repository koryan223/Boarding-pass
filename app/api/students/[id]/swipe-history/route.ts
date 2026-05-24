import { type NextRequest, NextResponse } from "next/server"
import { getStudentSwipeHistory } from "@/lib/meal-swipes"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const swipeHistory = await getStudentSwipeHistory(id)

    return NextResponse.json({ swipeHistory })
  } catch (error) {
    console.error("[v0] Error fetching student swipe history:", error)
    return NextResponse.json({ error: "Failed to fetch student swipe history" }, { status: 500 })
  }
}
