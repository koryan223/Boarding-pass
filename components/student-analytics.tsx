"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { getStudentAnalyticsClient, type StudentSwipeAnalytics } from "@/lib/student-management"
import { TrendingUp, XCircle } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Button } from "@/components/ui/button"

interface StudentAnalyticsProps {
  studentId: string
}

const parseWeekDate = (dateStr: string): Date => {
  // Adding T12:00:00 prevents timezone conversion from shifting the date
  return new Date(dateStr + "T12:00:00")
}

export function StudentAnalytics({ studentId }: StudentAnalyticsProps) {
  const [analytics, setAnalytics] = useState<StudentSwipeAnalytics | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedWeek, setSelectedWeek] = useState<{
    week: string
    successCount: number
    reentryCount: number
    failCount: number
  } | null>(null)

  useEffect(() => {
    loadAnalytics()
  }, [studentId, selectedMonth])

  const loadAnalytics = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await getStudentAnalyticsClient(studentId, selectedMonth)
      setAnalytics(data)
    } catch (error) {
      console.error("[v0] Error loading analytics:", error)
      setError(error instanceof Error ? error.message : "Failed to load analytics")
    } finally {
      setIsLoading(false)
    }
  }

  const prepareChartData = (weeklyData: StudentSwipeAnalytics["weeklySwipeData"]) => {
    if (!weeklyData || weeklyData.length === 0) {
      return []
    }

    const dates = weeklyData.map((d) => parseWeekDate(d.week))
    const earliestDate = new Date(Math.min(...dates.map((d) => d.getTime())))

    // JavaScript getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
    // To get Monday: subtract (getDay() + 6) % 7 days
    // For Monday (1): (1 + 6) % 7 = 0 days back (stays on Monday)
    // For Sunday (0): (0 + 6) % 7 = 6 days back (goes to previous Monday)
    const startMonday = new Date(earliestDate)
    const dayOfWeek = startMonday.getDay()
    const daysToSubtract = (dayOfWeek + 6) % 7
    startMonday.setDate(startMonday.getDate() - daysToSubtract)

    // Generate 4 weeks starting from the earliest Monday
    const fourWeeks = []
    for (let i = 0; i < 4; i++) {
      const monday = new Date(startMonday)
      monday.setDate(startMonday.getDate() + i * 7)
      const weekKey = monday.toISOString().split("T")[0]

      // Find matching data or create empty week
      const weekData = weeklyData.find((d) => d.week === weekKey)
      fourWeeks.push({
        week: weekKey,
        swipeCount: weekData?.swipeCount || 0,
        successCount: weekData?.successCount || 0,
        reentryCount: weekData?.reentryCount || 0,
        failCount: weekData?.failCount || 0,
      })
    }

    return fourWeeks
  }

  const handleWeekClick = (weekData: {
    week: string
    swipeCount: number
    successCount: number
    reentryCount: number
    failCount: number
  }) => {
    setSelectedWeek({
      week: weekData.week,
      successCount: weekData.successCount || weekData.swipeCount || 0,
      reentryCount: weekData.reentryCount || 0,
      failCount: weekData.failCount || 0,
    })
  }

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props
    if (cx === undefined || cy === undefined) return null

    return (
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill="hsl(var(--primary))"
        stroke="hsl(var(--background))"
        strokeWidth={2}
        style={{ cursor: "pointer" }}
        onClick={(e) => {
          e.stopPropagation()
          handleWeekClick(payload)
        }}
      />
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Swipe Activities
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={loadAnalytics} disabled={isLoading}>
                <TrendingUp className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const date = new Date()
                    date.setMonth(date.getMonth() - i)
                    const monthStr = date.toISOString().slice(0, 7)
                    return (
                      <SelectItem key={monthStr} value={monthStr}>
                        {date.toLocaleDateString("en-US", { year: "numeric", month: "long" })}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading analytics...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={loadAnalytics} variant="outline">
                Try Again
              </Button>
            </div>
          ) : analytics ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{analytics.totalSwipesThisMonth}</div>
                  <div className="text-sm text-muted-foreground">Total Swipes</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{analytics.averageSwipesPerWeek.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground">Avg Per Week</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{analytics.swipesThisWeek}</div>
                  <div className="text-sm text-muted-foreground">Swipes This Week</div>
                </div>
              </div>

              <div className="h-64 w-full">
                {analytics.weeklySwipeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={prepareChartData(analytics.weeklySwipeData)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="week"
                        tickFormatter={(value) => {
                          const date = parseWeekDate(value)
                          return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        }}
                        tick={{ fontSize: 12 }}
                        tickMargin={10}
                      />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="bg-background p-3 rounded-lg border shadow-lg">
                                <p className="font-semibold mb-1">
                                  Week of{" "}
                                  {parseWeekDate(data.week).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </p>
                                <p className="text-sm text-primary">{data.swipeCount} swipes</p>
                                <p className="text-xs text-muted-foreground mt-1">Click dot for details</p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="swipeCount"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={<CustomDot />}
                        activeDot={<CustomDot />}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                    No swipe data available for this month
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Failed to load analytics data</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedWeek} onOpenChange={(open) => !open && setSelectedWeek(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Week of{" "}
              {selectedWeek &&
                parseWeekDate(selectedWeek.week).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
              Detail
            </DialogTitle>
            <DialogDescription>
              Detailed swipe statistics for this week, including successful swipes, re-entries, and failed attempts.
            </DialogDescription>
          </DialogHeader>
          {selectedWeek && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {selectedWeek.successCount}
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300">Swipes</div>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedWeek.reentryCount}</div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">Re-entry</div>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{selectedWeek.failCount}</div>
                  <div className="text-sm text-red-700 dark:text-red-300">Failed</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Monday {parseWeekDate(selectedWeek.week).toLocaleDateString()} - Sunday{" "}
                {new Date(parseWeekDate(selectedWeek.week).getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
