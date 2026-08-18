export interface Student {
  uin: string
  first_name: string
  last_name: string
  room_number: string
  meal_plan: number
  meal_plan_type: "standard" | "count" | "prepaid"
  weekly_credits: number
  photo_url: string
  created_at: string
  updated_at: string
  group_id: string | null
  base_location_id: string | null
  // Embedded relation names (populated via Supabase joins for display)
  groups?: { name: string } | null
}

export interface StudentSwipeAnalytics {
  lastSwipe: {
    date: string
    creditsRemaining: number
  } | null
  weeklySwipeData: {
    week: string
    swipeCount: number
    successCount?: number
    reentryCount?: number
    failCount?: number
  }[]
  averageSwipesPerWeek: number
  totalSwipesThisMonth: number
  swipesThisWeek: number
  reentryThisWeek: number
}
