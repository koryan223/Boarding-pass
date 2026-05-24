"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, CheckCircle, XCircle, Calendar, Hash, RefreshCw } from "lucide-react"
import type { MealSwipe } from "@/lib/meal-swipes"

interface StudentSwipeHistoryProps {
  studentUin: string
}

interface SwipeWithSession extends MealSwipe {
  sessions?: {
    id: string
    title: string
    started_at: string
    ended_at: string | null
  }
}

export function StudentSwipeHistory({ studentUin }: StudentSwipeHistoryProps) {
  const [swipeHistory, setSwipeHistory] = useState<SwipeWithSession[]>([])
  const [isLoading, setIsLoading] = useState(true) // Start loading immediately
  const [showHistory, setShowHistory] = useState(true) // Show history by default
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterMonth, setFilterMonth] = useState<string>("all")
  const [error, setError] = useState<string | null>(null) // Add error state

  useEffect(() => {
    loadSwipeHistory()
  }, [])

  const loadSwipeHistory = async () => {
    try {
      setIsLoading(true)
      setError(null) // Clear previous errors
      const response = await fetch(`/api/students/${studentUin}/swipe-history`)

      if (!response.ok) {
        throw new Error("Failed to fetch swipe history")
      }

      const data = await response.json()
      console.log("[v0] Swipe history loaded:", data.swipeHistory?.length || 0, "swipes")
      setSwipeHistory(data.swipeHistory || [])
    } catch (error) {
      console.error("[v0] Error loading swipe history:", error)
      setError(error instanceof Error ? error.message : "Failed to load swipe history") // Set error message
    } finally {
      setIsLoading(false)
    }
  }

  const toggleHistory = async () => {
    if (!showHistory && swipeHistory.length === 0 && !error) {
      // Check error state
      await loadSwipeHistory()
    }
    setShowHistory(!showHistory)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "insufficient_credits":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "reentry":
        return <RefreshCw className="h-4 w-4 text-blue-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="default">Success</Badge>
      case "insufficient_credits":
        return <Badge variant="destructive">No Credits</Badge>
      case "failed":
        return <Badge variant="secondary">Failed</Badge>
      case "reentry":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Re-entry</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Filter swipes based on selected filters
  const filteredSwipes = swipeHistory.filter((swipe) => {
    const statusMatch = filterStatus === "all" || swipe.status === filterStatus
    const monthMatch = filterMonth === "all" || new Date(swipe.swiped_at).toISOString().slice(0, 7) === filterMonth
    return statusMatch && monthMatch
  })

  // Get unique months from swipe history
  const availableMonths = Array.from(
    new Set(swipeHistory.map((swipe) => new Date(swipe.swiped_at).toISOString().slice(0, 7))),
  )
    .sort()
    .reverse()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Swipe History
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={loadSwipeHistory} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" onClick={toggleHistory} disabled={isLoading}>
              {showHistory ? "Hide History" : "Show History"}
            </Button>
          </div>
        </div>
      </CardHeader>

      {showHistory && (
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading swipe history...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={loadSwipeHistory} variant="outline">
                Try Again
              </Button>
            </div>
          ) : swipeHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No swipe history found for this student</div>
          ) : (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex gap-4 items-center flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="insufficient_credits">No Credits</SelectItem>
                      <SelectItem value="reentry">Re-entry</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {availableMonths.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Month:</span>
                    <Select value={filterMonth} onValueChange={setFilterMonth}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Months</SelectItem>
                        {availableMonths.map((month) => (
                          <SelectItem key={month} value={month}>
                            {new Date(month + "-01").toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                            })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Badge variant="secondary" className="ml-auto">
                  {filteredSwipes.length} swipe{filteredSwipes.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              {/* Swipe History List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredSwipes.map((swipe) => (
                  <div key={swipe.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
                    {getStatusIcon(swipe.status)}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {new Date(swipe.swiped_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {new Date(swipe.swiped_at).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {swipe.sessions && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Hash className="h-3 w-3" />
                          <span className="truncate">{swipe.sessions.title}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">{getStatusBadge(swipe.status)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
