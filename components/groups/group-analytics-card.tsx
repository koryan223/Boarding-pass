"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getGroupAnalyticsClient, type GroupAnalytics } from "@/lib/group-management-client"
import { Loader2, TrendingUp, Users, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface GroupAnalyticsCardProps {
  groupId: string
  month?: number
}

export function GroupAnalyticsCard({ groupId, month }: GroupAnalyticsCardProps) {
  const [analytics, setAnalytics] = useState<GroupAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [groupId, month])

  const loadAnalytics = async () => {
    try {
      setIsLoading(true)
      const data = await getGroupAnalyticsClient(groupId, month)
      setAnalytics(data)
    } catch (error) {
      console.error("[v0] Error loading group analytics:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No analytics data available</p>
        </CardContent>
      </Card>
    )
  }

  const weeklyData = [
    { week: "Week 1", swipes: analytics.week_1_swipes },
    { week: "Week 2", swipes: analytics.week_2_swipes },
    { week: "Week 3", swipes: analytics.week_3_swipes },
    { week: "Week 4", swipes: analytics.week_4_swipes },
    { week: "Week 5", swipes: analytics.week_5_swipes },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Swipes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total_swipes}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.student_count}</div>
            <p className="text-xs text-muted-foreground">In this group</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg per Student</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(analytics.average_swipes_per_student ?? 0).toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Swipes per student</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Breakdown</CardTitle>
          <CardDescription>Meal swipes by week this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {weeklyData.map((week) => (
              <div key={week.week} className="flex items-center justify-between">
                <span className="text-sm font-medium">{week.week}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: analytics.total_swipes > 0 ? `${(week.swipes / analytics.total_swipes) * 100}%` : "0%",
                      }}
                    />
                  </div>
                  <Badge variant="secondary" className="min-w-[60px] justify-center">
                    {week.swipes}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
